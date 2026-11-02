import {
  createHash,
  generateKeyPairSync,
  randomBytes,
  sign,
  type KeyObject,
} from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ACK_PATH,
  CAS_MAX_ATTEMPTS,
  ENTRY_PREFIX,
  HEADER_INSTALL_ID,
  HEADER_NONCE,
  HEADER_SIGNATURE,
  HEADER_TIMESTAMP,
  INSTALL_PREFIX,
  INSTALL_RATE_PREFIX,
  IP_RATE_PREFIX,
  PENDING_PATH,
  PURPOSE_REGISTER,
  PURPOSE_SUBMIT,
  REGISTER_DAY_PREFIX,
  REGISTER_IP_RATE_PREFIX,
  REGISTER_PATH,
  RELAY_BASE_PATH,
  BodyTooLargeError,
  handleRelayRequest,
  readCappedBytes,
  readCappedText,
  signingInput,
  type ConditionalSetOptions,
  type RelayDeps,
  type RelayStore,
  type WriteOutcome,
} from "./relay";

const ORIGIN = "https://relay.test";
const HUB_SECRET = "hub-pull-secret-for-failure-tests";
const T0 = Date.UTC(2026, 9, 7, 12, 0, 0);
const MS_PER_SECOND = 1000;
const NONCE_BYTES = 16;

function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

/** Minimal in-memory store; every method can be overridden per test. */
class MemoryStore implements RelayStore {
  data = new Map<string, unknown>();
  private etags = new Map<string, string>();
  private version = 0;

  async get(key: string): Promise<unknown> {
    return this.data.has(key)
      ? JSON.parse(JSON.stringify(this.data.get(key)))
      : null;
  }

  async getWithMetadata(
    key: string
  ): Promise<{ data: unknown; etag?: string } | null> {
    const data = await this.get(key);
    return data === null ? null : { data, etag: this.etags.get(key) };
  }

  async setJSON(
    key: string,
    value: unknown,
    options?: ConditionalSetOptions
  ): Promise<WriteOutcome> {
    if (options?.onlyIfNew && this.data.has(key)) return { modified: false };
    if (
      options?.onlyIfMatch !== undefined &&
      options.onlyIfMatch !== this.etags.get(key)
    )
      return { modified: false };
    const etag = `"v${++this.version}"`;
    this.data.set(key, JSON.parse(JSON.stringify(value)));
    this.etags.set(key, etag);
    return { modified: true, etag };
  }

  async delete(key: string): Promise<void> {
    this.data.delete(key);
    this.etags.delete(key);
  }

  async list({
    prefix,
  }: {
    prefix: string;
  }): Promise<{ blobs: Array<{ key: string }> }> {
    return {
      blobs: [...this.data.keys()]
        .filter(k => k.startsWith(prefix))
        .map(key => ({ key })),
    };
  }
}

interface Hive {
  installId: string;
  publicKey: string;
  privateKey: KeyObject;
}

let counter = 0;
function newHive(): Hive {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  const der = publicKey.export({ format: "der", type: "spki" });
  counter++;
  return {
    installId: `00000000-0000-4000-8000-${String(counter).padStart(12, "0")}`,
    publicKey: der.subarray(der.length - 32).toString("base64"),
    privateKey,
  };
}

let store: MemoryStore;

function deps(overrides: Partial<RelayDeps> = {}): RelayDeps {
  return {
    store,
    env: { hubSecretHash: sha256(HUB_SECRET) },
    clientIp: "203.0.113.9",
    now: () => T0,
    ...overrides,
  };
}

function registerRequest(hive: Hive): Request {
  return signedRequest(hive, PURPOSE_REGISTER);
}

function signedRequest(hive: Hive, purpose: string): Request {
  const body = JSON.stringify(
    purpose === PURPOSE_REGISTER
      ? { install_id: hive.installId, public_key: hive.publicKey }
      : { hive_id: "failure-test-hive", score: 4 }
  );
  const ts = String(Math.floor(T0 / MS_PER_SECOND));
  const nonce = randomBytes(NONCE_BYTES).toString("hex");
  const message = signingInput(
    purpose,
    hive.installId,
    ts,
    nonce,
    Buffer.from(body, "utf8")
  );
  return new Request(
    ORIGIN + (purpose === PURPOSE_REGISTER ? REGISTER_PATH : RELAY_BASE_PATH),
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        [HEADER_INSTALL_ID]: hive.installId,
        [HEADER_TIMESTAMP]: ts,
        [HEADER_NONCE]: nonce,
        [HEADER_SIGNATURE]: sign(null, message, hive.privateKey).toString(
          "base64"
        ),
      },
      body,
    }
  );
}

function hubHeaders(): Record<string, string> {
  return { authorization: `Bearer ${HUB_SECRET}` };
}

/** A request whose body stream fails mid-read. */
function brokenBodyRequest(path: string, headers: Record<string, string>) {
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new Uint8Array([0x7b]));
      controller.error(new Error("socket reset"));
    },
  });
  return new Request(ORIGIN + path, {
    method: "POST",
    headers,
    body: stream,
    duplex: "half",
  } as RequestInit & { duplex: "half" });
}

beforeEach(() => {
  store = new MemoryStore();
});

describe("hub routes refuse the wrong method", () => {
  it("answers 405 for non-GET on pending and non-POST on ack, before auth", async () => {
    for (const method of ["POST", "PUT", "DELETE", "OPTIONS"]) {
      const res = await handleRelayRequest(
        new Request(ORIGIN + PENDING_PATH, { method }),
        deps()
      );
      expect(res.status).toBe(405);
      expect(await res.json()).toEqual({ error: "method not allowed" });
    }
    for (const method of ["GET", "PUT", "DELETE", "OPTIONS"]) {
      const res = await handleRelayRequest(
        new Request(ORIGIN + ACK_PATH, { method }),
        deps()
      );
      expect(res.status).toBe(405);
      expect(await res.json()).toEqual({ error: "method not allowed" });
    }
  });

  it("treats a trailing slash as the same route", async () => {
    const res = await handleRelayRequest(
      new Request(`${ORIGIN}${PENDING_PATH}///`, { method: "POST" }),
      deps()
    );
    expect(res.status).toBe(405);
  });
});

describe("unreadable request bodies", () => {
  it("maps a failing body stream to 400 rather than 413 or 500", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await handleRelayRequest(
      brokenBodyRequest(ACK_PATH, {
        ...hubHeaders(),
        "content-type": "application/json",
      }),
      deps()
    );
    error.mockRestore();
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "unreadable body" });
  });

  it("readCappedBytes propagates the stream error after releasing the reader", async () => {
    const req = brokenBodyRequest(RELAY_BASE_PATH, {});
    await expect(readCappedBytes(req, 1024)).rejects.toThrow("socket reset");
    expect(req.body?.locked).toBe(false);
  });
});

describe("readCappedText", () => {
  it("decodes a body that fits within the cap as UTF-8", async () => {
    const req = new Request(ORIGIN + RELAY_BASE_PATH, {
      method: "POST",
      body: "héllo ✓",
    });
    await expect(readCappedText(req, 64)).resolves.toBe("héllo ✓");
  });

  it("returns an empty string for a request without a body", async () => {
    const req = new Request(ORIGIN + RELAY_BASE_PATH, { method: "GET" });
    await expect(readCappedText(req, 64)).resolves.toBe("");
  });

  it("rejects with BodyTooLargeError once bytes read exceed the cap", async () => {
    const req = new Request(ORIGIN + RELAY_BASE_PATH, {
      method: "POST",
      body: "x".repeat(65),
    });
    await expect(readCappedText(req, 64)).rejects.toBeInstanceOf(
      BodyTooLargeError
    );
  });
});

describe("internal errors", () => {
  it("answers a bare 500 and logs only the error name, never the message", async () => {
    const boom = new Error(
      `blob backend down for ${HUB_SECRET} at install/secret-id`
    );
    boom.name = "BlobsUnavailable";
    const failing: RelayStore = {
      ...store,
      get: async () => {
        throw boom;
      },
      getWithMetadata: async () => {
        throw boom;
      },
      setJSON: async () => {
        throw boom;
      },
      delete: async () => {
        throw boom;
      },
      list: async () => {
        throw boom;
      },
    };
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const res = await handleRelayRequest(
      new Request(ORIGIN + PENDING_PATH, {
        method: "GET",
        headers: hubHeaders(),
      }),
      deps({ store: failing })
    );
    const logged = error.mock.calls
      .map(c => c.map(String).join(" "))
      .join("\n");
    const requestLog = JSON.parse(String(warn.mock.calls[0][0]));
    error.mockRestore();
    warn.mockRestore();

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "internal server error" });
    expect(logged).toContain("nps relay: internal error:");
    expect(logged).toContain("BlobsUnavailable");
    expect(logged).not.toContain(HUB_SECRET);
    expect(logged).not.toContain("secret-id");
    expect(logged).not.toContain("blob backend down");
    expect(requestLog).toMatchObject({ route: "nps-pending", status: 500 });
  });

  it("labels a thrown non-Error as unknown", async () => {
    const failing: RelayStore = {
      ...store,
      list: async () => {
        throw "string-thrown-with-secret";
      },
      get: async () => null,
      getWithMetadata: async () => null,
      setJSON: async () => ({ modified: true, etag: '"v"' }),
      delete: async () => {},
    };
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const res = await handleRelayRequest(
      new Request(ORIGIN + PENDING_PATH, {
        method: "GET",
        headers: hubHeaders(),
      }),
      deps({ store: failing })
    );
    const logged = error.mock.calls
      .map(c => c.map(String).join(" "))
      .join("\n");
    vi.restoreAllMocks();
    expect(res.status).toBe(500);
    expect(logged).toContain("unknown");
    expect(logged).not.toContain("string-thrown-with-secret");
  });
});

describe("registration race loser", () => {
  it("answers 409 when the create-only write loses to a different key", async () => {
    const loser = newHive();
    const winner = newHive();
    const key = `${INSTALL_PREFIX}${loser.installId}`;
    // The pre-check sees no registration; another instance then wins the
    // create-only write with a different key before this one lands.
    const racing = new (class extends MemoryStore {
      async setJSON(
        k: string,
        value: unknown,
        options?: ConditionalSetOptions
      ): Promise<WriteOutcome> {
        if (k === key && options?.onlyIfNew && !this.data.has(k)) {
          this.data.set(k, {
            public_key: winner.publicKey,
            registered_at: new Date(T0).toISOString(),
          });

          return { modified: false };
        }
        return super.setJSON(k, value, options);
      }
    })();
    const res = await handleRelayRequest(
      registerRequest(loser),
      deps({ store: racing })
    );
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({
      error: "install_id is registered to a different key",
    });
    // The winner's binding is untouched.
    expect(await racing.get(key)).toMatchObject({
      public_key: winner.publicKey,
    });
    expect(
      await racing.get(`${REGISTER_IP_RATE_PREFIX}${sha256("203.0.113.9")}`)
    ).toEqual({ times: [] });
    expect(
      await racing.get(
        `${REGISTER_DAY_PREFIX}${new Date(T0).toISOString().slice(0, 10)}`
      )
    ).toEqual({ count: 0 });
  });

  it("answers 200 registered:false when the write loses to the same key", async () => {
    const hive = newHive();
    const key = `${INSTALL_PREFIX}${hive.installId}`;
    const racing = new (class extends MemoryStore {
      async setJSON(
        k: string,
        value: unknown,
        options?: ConditionalSetOptions
      ): Promise<WriteOutcome> {
        if (k === key && options?.onlyIfNew && !this.data.has(k)) {
          this.data.set(k, {
            public_key: hive.publicKey,
            registered_at: new Date(T0).toISOString(),
          });
          return { modified: false };
        }
        return super.setJSON(k, value, options);
      }
    })();
    const res = await handleRelayRequest(
      registerRequest(hive),
      deps({ store: racing })
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, registered: false });
    expect(
      await racing.get(`${REGISTER_IP_RATE_PREFIX}${sha256("203.0.113.9")}`)
    ).toEqual({ times: [] });
    expect(
      await racing.get(
        `${REGISTER_DAY_PREFIX}${new Date(T0).toISOString().slice(0, 10)}`
      )
    ).toEqual({ count: 0 });
  });
});

describe("post-reservation failure gate", () => {
  const ip = "203.0.113.9";
  const dayKey = `${REGISTER_DAY_PREFIX}${new Date(T0).toISOString().slice(0, 10)}`;
  const registerIpKey = `${REGISTER_IP_RATE_PREFIX}${sha256(ip)}`;
  const submitIpKey = `${IP_RATE_PREFIX}${sha256(ip)}`;

  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => vi.restoreAllMocks());

  async function arrange(purpose: string) {
    const hive = newHive();
    const installRateKey = `${INSTALL_RATE_PREFIX}${hive.installId}`;
    // Seed existing quota records so the gate compares their exact JSON, not
    // just counts. New empty records are harmless and cannot be safely deleted
    // without a conditional-delete API.
    await store.setJSON(registerIpKey, { times: [T0 - 20] });
    await store.setJSON(dayKey, { count: 7 });
    await store.setJSON(submitIpKey, { times: [] });
    await store.setJSON(installRateKey, { times: [T0 - 10] });
    if (purpose === PURPOSE_SUBMIT) {
      await store.setJSON(`${INSTALL_PREFIX}${hive.installId}`, {
        public_key: hive.publicKey,
      });
    }
    return {
      hive,
      installRateKey,
      secondKey: purpose === PURPOSE_REGISTER ? dayKey : installRateKey,
      commitPrefix:
        purpose === PURPOSE_REGISTER ? INSTALL_PREFIX : ENTRY_PREFIX,
    };
  }

  function rateSnapshot() {
    return [...store.data]
      .filter(([key]) => key.startsWith("rate/"))
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => [key, JSON.stringify(value)]);
  }

  const failurePoints = [
    {
      step: "second reservation read",
      method: "getWithMetadata",
      mode: "throw",
      status: 500,
    },
    {
      step: "second reservation write",
      method: "setJSON",
      mode: "throw",
      status: 500,
    },
    {
      step: "second reservation contention",
      method: "setJSON",
      mode: "refuse",
      status: 429,
    },
    {
      step: "commit write",
      method: "setJSON",
      mode: "throw",
      status: 500,
    },
    {
      step: "commit refusal",
      method: "setJSON",
      mode: "refuse",
      status: 500,
    },
  ] as const;

  it.each(
    [PURPOSE_REGISTER, PURPOSE_SUBMIT].flatMap(purpose =>
      failurePoints.map(point => ({ purpose, ...point }))
    )
  )(
    "$purpose: refunds exact quotas after $step",
    async ({ purpose, step, method, mode, status }) => {
      const { hive, secondKey, commitPrefix } = await arrange(purpose);
      const before = rateSnapshot();
      const isCommit = step.startsWith("commit");
      const target = isCommit ? commitPrefix : secondKey;
      let injected = 0;
      if (method === "getWithMetadata") {
        const read = store.getWithMetadata.bind(store);
        vi.spyOn(store, method).mockImplementation(async key => {
          if (key === target && injected++ === 0)
            throw new Error("read failed");
          return read(key);
        });
      } else {
        const write = store.setJSON.bind(store);
        vi.spyOn(store, method).mockImplementation(
          async (key, value, options) => {
            if (
              key.startsWith(target) &&
              injected < (mode === "refuse" ? CAS_MAX_ATTEMPTS : 1)
            ) {
              injected++;
              if (mode === "throw") throw new Error("write failed");
              return { modified: false };
            }
            return write(key, value, options);
          }
        );
      }
      const res = await handleRelayRequest(
        signedRequest(hive, purpose),
        deps()
      );
      expect(injected).toBeGreaterThan(0);
      expect(res.status).toBe(
        purpose === PURPOSE_REGISTER && step === "commit refusal" ? 409 : status
      );
      expect(rateSnapshot()).toEqual(before);
      expect(
        [...store.data.keys()].filter(key => key.startsWith(commitPrefix))
      ).toHaveLength(0);

      vi.restoreAllMocks();
      // Submit retries use a fresh signed nonce; replay protection is unchanged.
      const retry = await handleRelayRequest(
        signedRequest(hive, purpose),
        deps()
      );
      expect(retry.status).toBe(201);
    }
  );

  it("refunds both registration reservations if reading the race winner throws", async () => {
    const { hive } = await arrange(PURPOSE_REGISTER);
    const before = rateSnapshot();
    const key = `${INSTALL_PREFIX}${hive.installId}`;
    const write = store.setJSON.bind(store);
    let lost = false;
    vi.spyOn(store, "setJSON").mockImplementation(async (k, value, options) => {
      if (k === key) {
        lost = true;
        return { modified: false };
      }
      return write(k, value, options);
    });
    const read = store.get.bind(store);
    vi.spyOn(store, "get").mockImplementation(async k => {
      if (k === key && lost) throw new Error("winner lookup failed");
      return read(k);
    });
    expect(
      (await handleRelayRequest(registerRequest(hive), deps())).status
    ).toBe(500);
    expect(lost).toBe(true);
    expect(rateSnapshot()).toEqual(before);
  });

  it("keeps committed submission quotas if rolling-window listing fails", async () => {
    const { hive, installRateKey } = await arrange(PURPOSE_SUBMIT);
    vi.spyOn(store, "list").mockRejectedValue(new Error("listing failed"));
    expect(
      (await handleRelayRequest(signedRequest(hive, PURPOSE_SUBMIT), deps()))
        .status
    ).toBe(500);
    expect(await store.get(submitIpKey)).toEqual({ times: [T0] });
    expect(await store.get(installRateKey)).toEqual({
      times: [T0 - 10, T0],
    });
    expect(
      [...store.data.keys()].filter(key => key.startsWith(ENTRY_PREFIX))
    ).toHaveLength(1);
    expect(
      (await handleRelayRequest(signedRequest(hive, PURPOSE_SUBMIT), deps()))
        .status
    ).toBe(429);
  });

  it("keeps committed registration quotas if constructing the response throws", async () => {
    const { hive } = await arrange(PURPOSE_REGISTER);
    const stringify = JSON.stringify;
    vi.spyOn(JSON, "stringify").mockImplementation((value, ...args) => {
      if (value?.ok && value?.registered === true) {
        throw new Error("response construction failed");
      }
      return stringify(value, ...args);
    });
    expect(
      (await handleRelayRequest(registerRequest(hive), deps())).status
    ).toBe(500);
    expect(await store.get(registerIpKey)).toEqual({
      times: [T0 - 20, T0],
    });
    expect(await store.get(dayKey)).toEqual({ count: 8 });
    const beforeRetry = rateSnapshot();
    const retry = await handleRelayRequest(registerRequest(hive), deps());
    expect(retry.status).toBe(200);
    expect(await retry.json()).toEqual({
      ok: true,
      registered: false,
    });
    expect(rateSnapshot()).toEqual(beforeRetry);
  });

  it.each([PURPOSE_REGISTER, PURPOSE_SUBMIT])(
    "%s: a failed first request leaves empty quotas available for retry",
    async purpose => {
      const hive = newHive();
      if (purpose === PURPOSE_SUBMIT) {
        await store.setJSON(`${INSTALL_PREFIX}${hive.installId}`, {
          public_key: hive.publicKey,
        });
      }
      const prefix =
        purpose === PURPOSE_REGISTER ? INSTALL_PREFIX : ENTRY_PREFIX;
      const write = store.setJSON.bind(store);
      vi.spyOn(store, "setJSON").mockImplementation(
        async (key, value, options) => {
          if (key.startsWith(prefix)) throw new Error("commit failed");
          return write(key, value, options);
        }
      );
      expect(
        (await handleRelayRequest(signedRequest(hive, purpose), deps())).status
      ).toBe(500);
      for (const [key, value] of store.data) {
        if (key.startsWith("rate/")) {
          expect(value).toEqual(key === dayKey ? { count: 0 } : { times: [] });
        }
      }
      vi.mocked(store.setJSON).mockRestore();
      expect(
        (await handleRelayRequest(signedRequest(hive, purpose), deps())).status
      ).toBe(201);
    }
  );

  it("surfaces cleanup contention instead of returning a normal rate-limit refusal", async () => {
    const { hive } = await arrange(PURPOSE_REGISTER);
    await store.setJSON(dayKey, { count: 500 });
    const write = store.setJSON.bind(store);
    let ipWrites = 0;
    vi.spyOn(store, "setJSON").mockImplementation(
      async (key, value, options) => {
        if (key === registerIpKey && ipWrites++ > 0) return { modified: false };
        return write(key, value, options);
      }
    );
    expect(
      (await handleRelayRequest(registerRequest(hive), deps())).status
    ).toBe(500);
    expect(console.error).toHaveBeenCalledWith(
      "nps relay: internal error:",
      "ReservationCleanupError",
      "ReservationReleaseContention"
    );
  });

  it.each([PURPOSE_REGISTER, PURPOSE_SUBMIT])(
    "%s: retries cleanup CAS without erasing a concurrent successful request",
    async purpose => {
      const { hive, secondKey, commitPrefix } = await arrange(purpose);
      const other = purpose === PURPOSE_REGISTER ? newHive() : hive;
      const write = store.setJSON.bind(store);
      let failed = false;
      let interleaved = false;
      vi.spyOn(store, "setJSON").mockImplementation(
        async (key, value, options) => {
          if (!failed && key.startsWith(commitPrefix)) {
            failed = true;
            throw new Error("commit failed");
          }
          // Interleave after cleanup has read the counter but before its CAS.
          if (failed && !interleaved && key === secondKey) {
            interleaved = true;
            const concurrent = await handleRelayRequest(
              signedRequest(other, purpose),
              deps({
                clientIp: purpose === PURPOSE_REGISTER ? ip : "203.0.113.10",
              })
            );
            expect(concurrent.status).toBe(201);
          }
          return write(key, value, options);
        }
      );
      expect(
        (await handleRelayRequest(signedRequest(hive, purpose), deps())).status
      ).toBe(500);
      expect(interleaved).toBe(true);
      expect(await store.get(secondKey)).toEqual(
        purpose === PURPOSE_REGISTER ? { count: 8 } : { times: [T0 - 10, T0] }
      );
      expect(
        await store.get(
          purpose === PURPOSE_REGISTER ? registerIpKey : submitIpKey
        )
      ).toEqual({
        times: purpose === PURPOSE_REGISTER ? [T0 - 20, T0] : [],
      });
      expect(
        [...store.data.keys()].filter(key => key.startsWith(commitPrefix))
      ).toHaveLength(1);
    }
  );

  it.each(["throw", "refuse"] as const)(
    "surfaces cleanup %s, preserves the original error, and attempts the other release",
    async mode => {
      const { hive, installRateKey } = await arrange(PURPOSE_SUBMIT);
      const write = store.setJSON.bind(store);
      let failed = false;
      let cleanupAttempts = 0;
      const original = new Error("private commit failure details");
      original.name = "CommitUnavailable";
      const cleanup = new Error("private cleanup failure details");
      cleanup.name = "CleanupUnavailable";
      vi.spyOn(store, "setJSON").mockImplementation(
        async (key, value, options) => {
          if (key.startsWith(ENTRY_PREFIX)) {
            failed = true;
            throw original;
          }
          if (failed && key === installRateKey) {
            cleanupAttempts++;
            if (mode === "throw") throw cleanup;
            return { modified: false };
          }
          return write(key, value, options);
        }
      );
      expect(
        (await handleRelayRequest(signedRequest(hive, PURPOSE_SUBMIT), deps()))
          .status
      ).toBe(500);
      expect(cleanupAttempts).toBe(mode === "throw" ? 1 : CAS_MAX_ATTEMPTS);
      expect(await store.get(submitIpKey)).toEqual({ times: [] });
      expect(await store.get(installRateKey)).toEqual({
        times: [T0 - 10, T0],
      });
      expect(console.error).toHaveBeenCalledWith(
        "nps relay: internal error:",
        "ReservationCleanupError",
        "CommitUnavailable",
        mode === "throw" ? "CleanupUnavailable" : "ReservationReleaseContention"
      );
      expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain(
        "private"
      );
    }
  );
});
