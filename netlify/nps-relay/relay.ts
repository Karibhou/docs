/**
 * NPS relay for standalone hives (hivecommons/hive#9619).
 *
 * A hive that is connected to a hub forwards its dashboard NPS responses to
 * that hub directly. A standalone hive has no hub link, so, when its operator
 * opts in, it posts them here instead. The hivecommons hub then pulls the
 * entries from this relay and deletes them once stored.
 *
 * Endpoints (all JSON, server-to-server only, no CORS):
 *
 *   POST /api/nps/register register an install's Ed25519 public key.
 *                          Auth: a signature by that key (proof of possession).
 *   POST /api/nps          submit one response. Auth: a signature by the
 *                          install's registered key.
 *   GET  /api/nps/pending  the hub pulls up to `limit` entries, oldest first.
 *                          Auth: the hub pull secret.
 *   POST /api/nps/ack      the hub deletes the entries it has stored.
 *                          Auth: the hub pull secret.
 *
 * There is deliberately NO public read path: GET /api/nps is 405
 * (kubestellar/console#16486 served free text to anyone).
 *
 * Self-registered install keys
 * ----------------------------
 * There are no operator-issued credentials for hives. On first use a hive
 * generates an Ed25519 keypair and a random install id (a lowercase UUID) and
 * registers the public key here. Every request it makes is signed; the
 * signature covers this exact byte string (joined with "\n"):
 *
 *   hive-nps-relay-v1
 *   <purpose: "register" or "submit">
 *   <install id>
 *   <unix seconds, as sent in X-Hive-Timestamp>
 *   <nonce, as sent in X-Hive-Nonce: 32 lowercase hex chars>
 *   <lowercase hex sha256 of the exact request body bytes>
 *
 * and travels in X-Hive-Install-Id, X-Hive-Timestamp, X-Hive-Nonce and
 * X-Hive-Signature (base64). The hive side is src/pkg/dashboard/nps_relay.go
 * in hivecommons/hive; a test on each side pins the same signing input.
 *
 * A self-registered key proves continuity of ONE install, not that it is a
 * real or trusted hive (anyone can register a key). The hub labels relay
 * responses "unverified install", and this relay bounds what any caller can
 * do instead of trusting it.
 *
 * Security properties (the kubestellar/console NPS function shipped without
 * each of these):
 *   - Submissions must be signed by the key registered for their install id
 *     (console#13664, console#13758); timestamps outside a window and reused
 *     nonces are rejected, so a captured request cannot be replayed.
 *   - An install id, once registered, can never be moved to a different key
 *     (no takeover). Re-registering the same (install id, key) is a no-op.
 *   - Registrations are rate limited per client IP and capped per day in
 *     total; submissions are limited to 1 per client IP per 24h plus a
 *     per-install cap. IPs are stored only as hashes.
 *   - Bodies are capped by the bytes actually READ, never by Content-Length,
 *     so a chunked or lying request cannot make the function buffer more
 *     (console#16666).
 *   - Every bound above is enforced with conditional (compare-and-swap)
 *     writes, so concurrent requests cannot all pass a check against the
 *     same stale record; under persistent contention the relay fails closed.
 *   - Score must be an integer 1-4; feedback at most 500 characters; hive_id
 *     must match the hub's name rule.
 *   - Entries live in Netlify Blobs as a rolling window.
 *
 * Operator setup (Netlify site environment variables):
 *
 *   NPS_RELAY_HUB_SECRET_SHA256 sha256 hex of the hub pull secret. This is the
 *                               ONLY setting. Without it the hub routes answer
 *                               503; registration and submissions need no
 *                               configuration and are bounded by the limits
 *                               above.
 *
 *   SECRET=$(openssl rand -hex 32)
 *   printf '%s' "$SECRET" | sha256sum   # -> set as NPS_RELAY_HUB_SECRET_SHA256
 *   # give $SECRET to the hub as HIVE_NPS_RELAY_PULL_SECRET
 *
 * Nothing is needed per hive: a hive operator only sets HIVE_NPS_ENABLED=true
 * and HIVE_NPS_RELAY_URL=https://docs.hivecommons.dev/api/nps.
 */

import {
  createHash,
  createPublicKey,
  randomUUID,
  timingSafeEqual,
  verify as cryptoVerify,
} from "node:crypto";
import { logger } from "../../src/lib/logger";

// ── Constants ────────────────────────────────────────────────────────

/** Public route of the submit endpoint; the other routes hang off it. */
export const RELAY_BASE_PATH = "/api/nps";
export const REGISTER_PATH = `${RELAY_BASE_PATH}/register`;
export const PENDING_PATH = `${RELAY_BASE_PATH}/pending`;
export const ACK_PATH = `${RELAY_BASE_PATH}/ack`;

/** Netlify Blobs store holding entries, installs and rate-limit counters. */
export const STORE_NAME = "hive-nps-relay";
/** Key prefix of stored entries. Keys sort oldest first. */
export const ENTRY_PREFIX = "entry/";
/** Key prefix of registered installs (install id -> public key). */
export const INSTALL_PREFIX = "install/";
/** Key prefix of per-install seen-nonce records. */
export const NONCE_PREFIX = "nonce/";
/** Key prefix of per-IP submission rate-limit records (IP is hashed). */
export const IP_RATE_PREFIX = "rate/ip/";
/** Key prefix of per-install submission rate-limit records. */
export const INSTALL_RATE_PREFIX = "rate/install/";
/** Key prefix of per-IP registration rate-limit records (IP is hashed). */
export const REGISTER_IP_RATE_PREFIX = "rate/register-ip/";
/** Key prefix of the global per-UTC-day registration counters. */
export const REGISTER_DAY_PREFIX = "rate/register-day/";

/** Env var: sha256 hex of the hub pull secret. The only operator setting. */
export const HUB_SECRET_HASH_ENV = "NPS_RELAY_HUB_SECRET_SHA256";

/** Maximum bytes read from a submission body. */
export const MAX_SUBMIT_BODY_BYTES = 4_096;
/** Maximum bytes read from a registration body. */
export const MAX_REGISTER_BODY_BYTES = 1_024;
/** Maximum bytes read from an ack body (a full batch of ids fits). */
export const MAX_ACK_BODY_BYTES = 16_384;
/** Maximum feedback length, in characters (code points). */
export const MAX_FEEDBACK_CHARS = 500;
/** Maximum stored dashboard / hive version length. */
export const MAX_VERSION_CHARS = 64;
/** Maximum hive id length (matches the hub's name rule). */
export const MAX_HIVE_ID_CHARS = 100;
/** Valid score range: the 4-point emoji scale. */
export const SCORE_MIN = 1;
export const SCORE_MAX = 4;

/** Rolling window: at most this many entries are kept, oldest dropped. */
export const MAX_ENTRIES = 1_000;
/** Most entries one pull returns (and the default). */
export const MAX_PULL_BATCH = 100;

/** Rate-limit window for submissions and per-IP registrations. */
export const RATE_WINDOW_MS = 24 * 60 * 60 * 1000;
/** Submissions accepted per client IP per window. */
export const MAX_PER_IP_PER_WINDOW = 1;
/** Submissions accepted per install per window. */
export const MAX_PER_INSTALL_PER_WINDOW = 10;
/** New registrations accepted per client IP per window. */
export const MAX_REGISTRATIONS_PER_IP_PER_WINDOW = 3;
/** New registrations accepted in total per UTC day (bounds store growth). */
export const MAX_REGISTRATIONS_PER_DAY = 500;

/** A signed request's timestamp may be at most this far from the relay clock. */
export const SIGNATURE_MAX_SKEW_MS = 5 * 60 * 1000;
/**
 * Seen nonces are kept this long. A request is only accepted within
 * SIGNATURE_MAX_SKEW_MS of its timestamp, so a nonce older than twice that can
 * no longer be replayed.
 */
export const NONCE_RETENTION_MS = 2 * SIGNATURE_MAX_SKEW_MS;
/** Most live nonces kept per install; more signed requests in the window get 429. */
export const MAX_NONCES_PER_INSTALL = 100;
/**
 * Attempts made to update one record with a conditional write before giving
 * up. Each retry re-reads the record, so a lost race is re-checked against
 * the winner's write rather than the stale copy.
 */
export const CAS_MAX_ATTEMPTS = 4;

/** Prefix of the signed input; a future format must change it. */
export const SIGNATURE_VERSION = "hive-nps-relay-v1";
export const PURPOSE_REGISTER = "register";
export const PURPOSE_SUBMIT = "submit";
/** Signed-request headers (Headers.get is case-insensitive). */
export const HEADER_INSTALL_ID = "x-hive-install-id";
export const HEADER_TIMESTAMP = "x-hive-timestamp";
export const HEADER_NONCE = "x-hive-nonce";
export const HEADER_SIGNATURE = "x-hive-signature";
/** Error code telling a hive to register (again) before submitting. */
export const UNKNOWN_INSTALL_CODE = "unknown_install";

/** Raw Ed25519 public key and signature sizes. */
const ED25519_PUBLIC_KEY_BYTES = 32;
const ED25519_SIGNATURE_BYTES = 64;
/** DER SubjectPublicKeyInfo header for a raw Ed25519 public key (RFC 8410). */
const ED25519_SPKI_PREFIX = Buffer.from("302a300506032b6570032100", "hex");
/** Milliseconds per second, for the unix-seconds timestamp header. */
const MS_PER_SECOND = 1000;
/** Length of the YYYY-MM-DD prefix of an ISO timestamp. */
const ISO_DATE_LENGTH = 10;

/** Length of a sha256 hex digest. */
const SHA256_HEX_LENGTH = 64;
/** Width the millisecond timestamp in an entry id is zero-padded to. */
const ENTRY_ID_TIME_WIDTH = 13;

const HIVE_ID_PATTERN = /^[A-Za-z0-9._-]+$/;
const SHA256_HEX_PATTERN = /^[0-9a-f]{64}$/;
/** Install ids are lowercase UUIDs. */
const INSTALL_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
/** Nonces are 16 random bytes, lowercase hex. */
const NONCE_PATTERN = /^[0-9a-f]{32}$/;
/** Unix seconds; bounded length so parsing can never overflow. */
const TIMESTAMP_PATTERN = /^[0-9]{1,12}$/;
const BASE64_PATTERN = /^[A-Za-z0-9+/]+={0,2}$/;
/** Entry ids are `<zero-padded ms>-<uuid>`; also the hub's accepted id shape. */
const ENTRY_ID_PATTERN = /^\d{13}-[0-9a-f-]{36}$/;
const VERSION_DISALLOWED = /[^A-Za-z0-9._/-]/g;
/** Control characters other than newline and tab. */
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u0008\u000b-\u001f\u007f]/g;

// ── Types ────────────────────────────────────────────────────────────

/** Conditions a write may carry: update only this version, or create only. */
export type ConditionalSetOptions =
  | { onlyIfMatch?: string; onlyIfNew?: never }
  | { onlyIfNew?: boolean; onlyIfMatch?: never };

/** Result of a (possibly conditional) write. */
export interface WriteOutcome {
  /** False when the condition was not met and nothing was written. */
  modified: boolean;
  etag?: string;
}

/** The subset of the Netlify Blobs store API the relay uses. */
export interface RelayStore {
  get(key: string, options: { type: "json" }): Promise<unknown>;
  /** Like get, also returning the ETag the record can be conditionally updated with. */
  getWithMetadata(
    key: string,
    options: { type: "json" }
  ): Promise<{ data: unknown; etag?: string } | null>;
  setJSON(
    key: string,
    value: unknown,
    options?: ConditionalSetOptions
  ): Promise<WriteOutcome>;
  delete(key: string): Promise<unknown>;
  list(options: { prefix: string }): Promise<{ blobs: Array<{ key: string }> }>;
}

export interface RelayEnv {
  hubSecretHash?: string;
}

export interface RelayDeps {
  store: RelayStore;
  env: RelayEnv;
  /** Client IP as reported by the platform; undefined when unknown. */
  clientIp?: string;
  now?: () => number;
}

/** One stored entry, exactly as the hub pull returns it. */
export interface RelayEntry {
  id: string;
  install_id: string;
  hive_id: string;
  score: number;
  feedback?: string;
  dashboard_version?: string;
  timestamp: string;
}

/** One registered install. */
export interface InstallRecord {
  public_key: string;
  hive_version?: string;
  registered_at: string;
}

interface RateRecord {
  times: number[];
}

interface DayCounter {
  count: number;
}

interface NonceRecord {
  seen: Array<{ n: string; t: number }>;
}

interface SignedHeaders {
  installId: string;
  timestamp: string;
  nonce: string;
  signature: string;
}

export class BodyTooLargeError extends Error {
  constructor(maxBytes: number) {
    super(`request body exceeds ${maxBytes} bytes`);
    this.name = "BodyTooLargeError";
  }
}

// ── Helpers ──────────────────────────────────────────────────────────

const JSON_HEADERS = {
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
};

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

const UNAUTHORIZED = (): Response => json(401, { error: "unauthorized" });
const RATE_LIMITED = (): Response =>
  json(429, { error: "rate limit exceeded" });

function sha256Hex(value: string | Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

/** Constant-time comparison of two sha256 hex digests. */
function hashesEqual(a: string, b: string): boolean {
  if (a.length !== SHA256_HEX_LENGTH || b.length !== SHA256_HEX_LENGTH)
    return false;
  return timingSafeEqual(Buffer.from(a, "utf8"), Buffer.from(b, "utf8"));
}

function bearerToken(req: Request): string | null {
  const auth = req.headers.get("authorization") ?? "";
  const match = /^Bearer (.+)$/.exec(auth);
  const token = match?.[1]?.trim();
  return token ? token : null;
}

function hubSecretMatches(token: string, rawHash: string | undefined): boolean {
  const expected = (rawHash ?? "").trim().toLowerCase();
  if (!SHA256_HEX_PATTERN.test(expected)) return false;
  return hashesEqual(sha256Hex(token), expected);
}

/** Decodes strict base64 of exactly `bytes` bytes, or null. */
function decodeBase64Exact(value: string, bytes: number): Buffer | null {
  if (!BASE64_PATTERN.test(value)) return null;
  const decoded = Buffer.from(value, "base64");
  if (decoded.length !== bytes || decoded.toString("base64") !== value)
    return null;
  return decoded;
}

/** Validates a base64 raw Ed25519 public key. */
export function isValidPublicKey(value: unknown): value is string {
  return (
    typeof value === "string" &&
    decodeBase64Exact(value, ED25519_PUBLIC_KEY_BYTES) !== null
  );
}

/**
 * The exact bytes a signature covers. hivecommons/hive
 * src/pkg/dashboard/nps_relay.go npsRelaySigningInput builds the same string.
 */
export function signingInput(
  purpose: string,
  installId: string,
  timestamp: string,
  nonce: string,
  body: Uint8Array
): Buffer {
  return Buffer.from(
    [
      SIGNATURE_VERSION,
      purpose,
      installId,
      timestamp,
      nonce,
      sha256Hex(body),
    ].join("\n"),
    "utf8"
  );
}

/** Verifies an Ed25519 signature; any malformed input is simply false. */
export function verifyEd25519(
  publicKeyB64: string,
  message: Uint8Array,
  signatureB64: string
): boolean {
  const raw = decodeBase64Exact(publicKeyB64, ED25519_PUBLIC_KEY_BYTES);
  const sig = decodeBase64Exact(signatureB64, ED25519_SIGNATURE_BYTES);
  if (!raw || !sig) return false;
  try {
    const key = createPublicKey({
      key: Buffer.concat([ED25519_SPKI_PREFIX, raw]),
      format: "der",
      type: "spki",
    });
    return cryptoVerify(null, message, key, sig);
  } catch {
    return false;
  }
}

/** Reads the signed-request headers; null when any is missing or malformed. */
function readSignedHeaders(req: Request): SignedHeaders | null {
  const installId = req.headers.get(HEADER_INSTALL_ID) ?? "";
  const timestamp = req.headers.get(HEADER_TIMESTAMP) ?? "";
  const nonce = req.headers.get(HEADER_NONCE) ?? "";
  const signature = req.headers.get(HEADER_SIGNATURE) ?? "";
  if (
    !INSTALL_ID_PATTERN.test(installId) ||
    !TIMESTAMP_PATTERN.test(timestamp) ||
    !NONCE_PATTERN.test(nonce) ||
    !BASE64_PATTERN.test(signature)
  ) {
    return null;
  }
  return { installId, timestamp, nonce, signature };
}

/** Whether a signed timestamp (unix seconds) is within the skew window. */
function timestampFresh(timestamp: string, now: number): boolean {
  const ms = Number(timestamp) * MS_PER_SECOND;
  return Number.isFinite(ms) && Math.abs(now - ms) <= SIGNATURE_MAX_SKEW_MS;
}

function verifySigned(
  signed: SignedHeaders,
  purpose: string,
  body: Uint8Array,
  publicKey: string,
  now: number
): boolean {
  if (!timestampFresh(signed.timestamp, now)) return false;
  const message = signingInput(
    purpose,
    signed.installId,
    signed.timestamp,
    signed.nonce,
    body
  );
  return verifyEd25519(publicKey, message, signed.signature);
}

/**
 * Reads a request body, enforcing the cap on bytes actually read. The
 * Content-Length header is never consulted.
 */
export async function readCappedBytes(
  req: Request,
  maxBytes: number
): Promise<Uint8Array> {
  if (!req.body) return new Uint8Array(0);
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        throw new BodyTooLargeError(maxBytes);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const combined = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    combined.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return combined;
}

/** Text form of readCappedBytes. */
export async function readCappedText(
  req: Request,
  maxBytes: number
): Promise<string> {
  return new TextDecoder().decode(await readCappedBytes(req, maxBytes));
}

/** Parses JSON from already-read bytes; undefined when it is not JSON. */
function parseJson(bytes: Uint8Array): unknown {
  try {
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return undefined;
  }
}

/** Reads a capped body, mapping failures to a response. */
async function readBody(
  req: Request,
  maxBytes: number
): Promise<Uint8Array | Response> {
  try {
    return await readCappedBytes(req, maxBytes);
  } catch (err) {
    if (err instanceof BodyTooLargeError)
      return json(413, { error: "payload too large" });
    return json(400, { error: "unreadable body" });
  }
}

function newEntryId(now: number): string {
  return `${String(now).padStart(ENTRY_ID_TIME_WIDTH, "0")}-${randomUUID()}`;
}

async function entryKeysOldestFirst(store: RelayStore): Promise<string[]> {
  const { blobs } = await store.list({ prefix: ENTRY_PREFIX });
  return blobs.map(b => b.key).sort();
}

/** Timestamps inside the window, from a stored rate record. */
function liveTimes(rec: unknown, now: number): number[] {
  const times =
    rec && Array.isArray((rec as RateRecord).times)
      ? (rec as RateRecord).times
      : [];
  return times.filter(t => typeof t === "number" && now - t < RATE_WINDOW_MS);
}

/** One compare-and-swap step: the record to write, or the response to stop with. */
type CasStep = { next: unknown } | { reject: Response };

/**
 * Updates one record atomically. `step` sees the current record and decides
 * the next one (or rejects); the write only lands if the record is still the
 * version that was read. A lost race re-reads and re-decides, so a check
 * such as "under the limit" is always made against the record the write
 * replaces. Returns null on success, else the response to send. Persistent
 * contention fails closed (429) rather than letting a write through
 * unchecked.
 */
async function compareAndSwap(
  store: RelayStore,
  key: string,
  step: (current: unknown) => CasStep
): Promise<Response | null> {
  for (let attempt = 0; attempt < CAS_MAX_ATTEMPTS; attempt++) {
    const current = await store.getWithMetadata(key, { type: "json" });
    const decision = step(current ? current.data : null);
    if ("reject" in decision) return decision.reject;
    const condition: ConditionalSetOptions = current
      ? { onlyIfMatch: current.etag }
      : { onlyIfNew: true };
    const result = await store.setJSON(key, decision.next, condition);
    if (result.modified) return null;
  }
  return RATE_LIMITED();
}

/**
 * Reserves one slot in a windowed rate record, or returns 429 when the
 * record already holds `max` live timestamps. Check and reservation are one
 * conditional write, so concurrent callers cannot all fit in the last slot.
 */
function reserveSlot(
  store: RelayStore,
  key: string,
  max: number,
  now: number
): Promise<Response | null> {
  return compareAndSwap(store, key, current => {
    const times = liveTimes(current, now);
    if (times.length >= max) return { reject: RATE_LIMITED() };
    return { next: { times: [...times, now] } satisfies RateRecord };
  });
}

/** Gives back one slot taken by `reserveSlot` at `now`. */
function releaseSlot(
  store: RelayStore,
  key: string,
  now: number
): Promise<Response | null> {
  return compareAndSwap(store, key, current => {
    const times = liveTimes(current, now);
    const i = times.indexOf(now);
    if (i !== -1) times.splice(i, 1);
    return { next: { times } satisfies RateRecord };
  });
}

/** Whether a windowed rate record is already at `max`, without reserving. */
async function atLimit(
  store: RelayStore,
  key: string,
  max: number,
  now: number
): Promise<boolean> {
  return liveTimes(await store.get(key, { type: "json" }), now).length >= max;
}

async function getInstall(
  store: RelayStore,
  installId: string
): Promise<InstallRecord | null> {
  const rec = (await store.get(`${INSTALL_PREFIX}${installId}`, {
    type: "json",
  })) as InstallRecord | null;
  return rec && typeof rec.public_key === "string" ? rec : null;
}

function ipHash(deps: RelayDeps): string {
  return sha256Hex(deps.clientIp || "unknown");
}

// ── Validation ───────────────────────────────────────────────────────

type Submission = Pick<
  RelayEntry,
  "hive_id" | "score" | "feedback" | "dashboard_version"
>;

function cleanVersion(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  return (
    value.replace(VERSION_DISALLOWED, "").slice(0, MAX_VERSION_CHARS) ||
    undefined
  );
}

/** Validates a submission body; returns the clean fields or an error. */
export function validateSubmission(
  body: unknown
): { ok: true; value: Submission } | { ok: false; error: string } {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return { ok: false, error: "body must be a JSON object" };
  }
  const b = body as Record<string, unknown>;
  const hiveId = b.hive_id;
  if (
    typeof hiveId !== "string" ||
    hiveId.length === 0 ||
    hiveId.length > MAX_HIVE_ID_CHARS ||
    !HIVE_ID_PATTERN.test(hiveId)
  ) {
    return { ok: false, error: "invalid hive_id" };
  }
  const score = b.score;
  if (
    typeof score !== "number" ||
    !Number.isInteger(score) ||
    score < SCORE_MIN ||
    score > SCORE_MAX
  ) {
    return {
      ok: false,
      error: `score must be an integer ${SCORE_MIN}-${SCORE_MAX}`,
    };
  }
  let feedback: string | undefined;
  if (b.feedback !== undefined && b.feedback !== null) {
    if (typeof b.feedback !== "string")
      return { ok: false, error: "feedback must be a string" };
    if ([...b.feedback].length > MAX_FEEDBACK_CHARS) {
      return {
        ok: false,
        error: `feedback must be at most ${MAX_FEEDBACK_CHARS} characters`,
      };
    }
    const cleaned = b.feedback.replace(CONTROL_CHARS, "").trim();
    feedback = cleaned || undefined;
  }
  return {
    ok: true,
    value: {
      hive_id: hiveId,
      score,
      feedback,
      dashboard_version: cleanVersion(b.dashboard_version),
    },
  };
}

type Registration = {
  install_id: string;
  public_key: string;
  hive_version?: string;
};

/** Validates a registration body. */
export function validateRegistration(
  body: unknown
): { ok: true; value: Registration } | { ok: false; error: string } {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return { ok: false, error: "body must be a JSON object" };
  }
  const b = body as Record<string, unknown>;
  if (
    typeof b.install_id !== "string" ||
    !INSTALL_ID_PATTERN.test(b.install_id)
  ) {
    return { ok: false, error: "install_id must be a lowercase UUID" };
  }
  if (!isValidPublicKey(b.public_key)) {
    return {
      ok: false,
      error: "public_key must be a base64 Ed25519 public key",
    };
  }
  return {
    ok: true,
    value: {
      install_id: b.install_id,
      public_key: b.public_key,
      hive_version: cleanVersion(b.hive_version),
    },
  };
}

// ── Handlers ─────────────────────────────────────────────────────────

async function handleRegister(
  req: Request,
  deps: RelayDeps,
  now: number
): Promise<Response> {
  const { store } = deps;
  const bytes = await readBody(req, MAX_REGISTER_BODY_BYTES);
  if (bytes instanceof Response) return bytes;
  const parsed = validateRegistration(parseJson(bytes));
  if (!parsed.ok) return json(400, { error: parsed.error });
  const reg = parsed.value;

  // Proof of possession: the request must be signed by the key it registers,
  // for the install id it names. Nothing is read or written before this.
  const signed = readSignedHeaders(req);
  if (!signed || signed.installId !== reg.install_id) return UNAUTHORIZED();
  if (!verifySigned(signed, PURPOSE_REGISTER, bytes, reg.public_key, now))
    return UNAUTHORIZED();

  const existing = await getInstall(store, reg.install_id);
  if (existing) {
    if (existing.public_key === reg.public_key)
      return json(200, { ok: true, registered: false });
    // No takeover: an install id stays bound to its first key.
    return json(409, { error: "install_id is registered to a different key" });
  }

  // Reserve the per-IP and per-day slots before creating the install, so a
  // limit that is hit never leaves a registration behind. The two writes are
  // not atomic together: if the day cap refuses, the IP slot is released so a
  // rejected registration does not consume the independent IP quota.
  const ipKey = `${REGISTER_IP_RATE_PREFIX}${ipHash(deps)}`;
  const ipDenied = await reserveSlot(
    store,
    ipKey,
    MAX_REGISTRATIONS_PER_IP_PER_WINDOW,
    now
  );
  if (ipDenied) return ipDenied;
  const dayKey = `${REGISTER_DAY_PREFIX}${new Date(now).toISOString().slice(0, ISO_DATE_LENGTH)}`;
  const dayDenied = await compareAndSwap(store, dayKey, current => {
    const count =
      current && typeof (current as DayCounter).count === "number"
        ? (current as DayCounter).count
        : 0;
    if (count >= MAX_REGISTRATIONS_PER_DAY) return { reject: RATE_LIMITED() };
    return { next: { count: count + 1 } satisfies DayCounter };
  });
  if (dayDenied) {
    await releaseSlot(store, ipKey, now);
    return dayDenied;
  }

  const record: InstallRecord = {
    public_key: reg.public_key,
    ...(reg.hive_version ? { hive_version: reg.hive_version } : {}),
    registered_at: new Date(now).toISOString(),
  };
  // Create-only: two registrations racing for the same install id cannot both
  // win, so the id is bound to exactly one key — the first write's.
  const created = await store.setJSON(
    `${INSTALL_PREFIX}${reg.install_id}`,
    record,
    { onlyIfNew: true }
  );
  if (!created.modified) {
    // The registration was not created here, so give back both reservations.
    await releaseSlot(store, ipKey, now);
    await compareAndSwap(store, dayKey, current => {
      const count =
        current && typeof (current as DayCounter).count === "number"
          ? (current as DayCounter).count
          : 0;
      return { next: { count: Math.max(0, count - 1) } satisfies DayCounter };
    });
    const winner = await getInstall(store, reg.install_id);
    if (winner && winner.public_key === reg.public_key)
      return json(200, { ok: true, registered: false });
    return json(409, { error: "install_id is registered to a different key" });
  }
  return json(201, { ok: true, registered: true });
}

/**
 * Records a nonce for an install, rejecting a reuse. Returns null when the
 * nonce is fresh, else the response to send. Check and record are one
 * conditional write, so two copies of the same request cannot both pass.
 */
function consumeNonce(
  store: RelayStore,
  installId: string,
  nonce: string,
  now: number
): Promise<Response | null> {
  return compareAndSwap(store, `${NONCE_PREFIX}${installId}`, current => {
    const rec = current as NonceRecord | null;
    const live = (rec && Array.isArray(rec.seen) ? rec.seen : []).filter(
      s =>
        s &&
        typeof s.n === "string" &&
        typeof s.t === "number" &&
        now - s.t < NONCE_RETENTION_MS
    );
    if (live.some(s => s.n === nonce))
      return { reject: json(401, { error: "replayed request" }) };
    if (live.length >= MAX_NONCES_PER_INSTALL)
      return { reject: RATE_LIMITED() };
    return {
      next: { seen: [...live, { n: nonce, t: now }] } satisfies NonceRecord,
    };
  });
}

async function handleSubmit(
  req: Request,
  deps: RelayDeps,
  now: number
): Promise<Response> {
  const { store } = deps;
  const bytes = await readBody(req, MAX_SUBMIT_BODY_BYTES);
  if (bytes instanceof Response) return bytes;

  // Authenticate before writing anything, so an unauthenticated caller cannot
  // make the relay store anything (not even rate-limit records).
  const signed = readSignedHeaders(req);
  if (!signed || !timestampFresh(signed.timestamp, now)) return UNAUTHORIZED();
  const install = await getInstall(store, signed.installId);
  if (!install)
    return json(401, { error: "unknown install", code: UNKNOWN_INSTALL_CODE });
  if (!verifySigned(signed, PURPOSE_SUBMIT, bytes, install.public_key, now))
    return UNAUTHORIZED();
  const replay = await consumeNonce(store, signed.installId, signed.nonce, now);
  if (replay) return replay;

  // Cheap pre-checks keep today's response order (429 before 400) without
  // reserving anything; the reservations below are what actually bound.
  const ipKey = `${IP_RATE_PREFIX}${ipHash(deps)}`;
  if (await atLimit(store, ipKey, MAX_PER_IP_PER_WINDOW, now))
    return RATE_LIMITED();

  const body = parseJson(bytes);
  if (body === undefined) return json(400, { error: "invalid JSON body" });
  const parsed = validateSubmission(body);
  if (!parsed.ok) return json(400, { error: parsed.error });

  const installKey = `${INSTALL_RATE_PREFIX}${signed.installId}`;
  if (await atLimit(store, installKey, MAX_PER_INSTALL_PER_WINDOW, now))
    return RATE_LIMITED();

  // Reserve each slot with its own conditional write before storing the
  // entry, so concurrent submissions cannot all squeeze into the same
  // remaining slot. The two writes are not atomic together: if the install
  // reservation is refused, the IP slot is released so a rejected submission
  // does not consume the independent IP quota.
  const ipDenied = await reserveSlot(store, ipKey, MAX_PER_IP_PER_WINDOW, now);
  if (ipDenied) return ipDenied;
  const installDenied = await reserveSlot(
    store,
    installKey,
    MAX_PER_INSTALL_PER_WINDOW,
    now
  );
  if (installDenied) {
    await releaseSlot(store, ipKey, now);
    return installDenied;
  }

  const entry: RelayEntry = {
    id: newEntryId(now),
    install_id: signed.installId,
    hive_id: parsed.value.hive_id,
    score: parsed.value.score,
    ...(parsed.value.feedback ? { feedback: parsed.value.feedback } : {}),
    ...(parsed.value.dashboard_version
      ? { dashboard_version: parsed.value.dashboard_version }
      : {}),
    timestamp: new Date(now).toISOString(),
  };
  await store.setJSON(`${ENTRY_PREFIX}${entry.id}`, entry);

  // Rolling window: drop the oldest entries beyond the cap.
  const keys = await entryKeysOldestFirst(store);
  const overflow = keys.length - MAX_ENTRIES;
  if (overflow > 0) {
    await Promise.allSettled(
      keys.slice(0, overflow).map(key => store.delete(key))
    );
  }
  return json(201, { ok: true });
}

function hubAuthorized(req: Request, env: RelayEnv): Response | null {
  if (
    !SHA256_HEX_PATTERN.test((env.hubSecretHash ?? "").trim().toLowerCase())
  ) {
    return json(503, { error: "relay pull is not configured" });
  }
  const token = bearerToken(req);
  if (!token || !hubSecretMatches(token, env.hubSecretHash))
    return UNAUTHORIZED();
  return null;
}

async function handlePending(req: Request, deps: RelayDeps): Promise<Response> {
  const denied = hubAuthorized(req, deps.env);
  if (denied) return denied;
  const requested = Number.parseInt(
    new URL(req.url).searchParams.get("limit") ?? "",
    10
  );
  const limit =
    Number.isInteger(requested) && requested > 0
      ? Math.min(requested, MAX_PULL_BATCH)
      : MAX_PULL_BATCH;
  const keys = (await entryKeysOldestFirst(deps.store)).slice(0, limit);
  const entries: RelayEntry[] = [];
  for (const key of keys) {
    const entry = (await deps.store.get(key, {
      type: "json",
    })) as RelayEntry | null;
    if (entry) entries.push(entry);
  }
  return json(200, { entries });
}

async function handleAck(req: Request, deps: RelayDeps): Promise<Response> {
  const denied = hubAuthorized(req, deps.env);
  if (denied) return denied;
  const bytes = await readBody(req, MAX_ACK_BODY_BYTES);
  if (bytes instanceof Response) return bytes;
  const body = parseJson(bytes);
  if (body === undefined) return json(400, { error: "invalid JSON body" });
  const ids = (body as { ids?: unknown } | null)?.ids;
  if (!Array.isArray(ids) || ids.length > MAX_PULL_BATCH) {
    return json(400, {
      error: `ids must be an array of at most ${MAX_PULL_BATCH} entry ids`,
    });
  }
  const valid = ids.filter(
    (id): id is string => typeof id === "string" && ENTRY_ID_PATTERN.test(id)
  );
  await Promise.all(valid.map(id => deps.store.delete(`${ENTRY_PREFIX}${id}`)));
  return json(200, { deleted: valid.length });
}

const LOG_ROUTES: Record<string, string> = {
  [RELAY_BASE_PATH]: "nps",
  [REGISTER_PATH]: "nps-register",
  [PENDING_PATH]: "nps-pending",
  [ACK_PATH]: "nps-ack",
};

/**
 * Routes one request and emits one bounded structured log line (route from a
 * fixed set, method, status, duration; no paths, headers, IPs or bodies).
 * The Netlify function is a thin wrapper around this.
 */
export async function handleRelayRequest(
  req: Request,
  deps: RelayDeps
): Promise<Response> {
  const started = performance.now();
  const res = await routeRelayRequest(req, deps);
  const path = new URL(req.url).pathname.replace(/\/+$/, "");
  logger.info("nps relay request", {
    route: LOG_ROUTES[path] ?? "unknown",
    method: ["GET", "POST"].includes(req.method) ? req.method : "OTHER",
    status: res.status,
    durationMs: Math.round(performance.now() - started),
  });
  return res;
}

async function routeRelayRequest(
  req: Request,
  deps: RelayDeps
): Promise<Response> {
  const now = (deps.now ?? Date.now)();
  const path = new URL(req.url).pathname.replace(/\/+$/, "");
  try {
    if (path === RELAY_BASE_PATH) {
      if (req.method !== "POST")
        return json(405, { error: "method not allowed" });
      return await handleSubmit(req, deps, now);
    }
    if (path === REGISTER_PATH) {
      if (req.method !== "POST")
        return json(405, { error: "method not allowed" });
      return await handleRegister(req, deps, now);
    }
    if (path === PENDING_PATH) {
      if (req.method !== "GET")
        return json(405, { error: "method not allowed" });
      return await handlePending(req, deps);
    }
    if (path === ACK_PATH) {
      if (req.method !== "POST")
        return json(405, { error: "method not allowed" });
      return await handleAck(req, deps);
    }
    return json(404, { error: "not found" });
  } catch (err) {
    // Never echo request data (signatures and secrets live in headers) into logs.
    console.error(
      "nps relay: internal error:",
      err instanceof Error ? err.name : "unknown"
    );
    return json(500, { error: "internal server error" });
  }
}
