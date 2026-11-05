import fs from "fs";
import path from "path";
import {
  rewriteLinkTarget as rewriteSharedLinkTarget,
  rewriteMarkdownLinks,
} from "./link-rewrite";
import { fetchTextWithTimeout } from "./fetch-with-timeout";
import { normalizeFences } from "./markdown-fences";
import { scrubLegacyBranding } from "./scrub-legacy-branding";
import filesData from "./sync-hive-docs.files.json";

// Post-migration the canonical hive repo is hivecommons/hive; until the code
// transfer lands the docs stay in hivecommons/hive. Override with HIVE_DOCS_OWNER.
const owner = process.env.HIVE_DOCS_OWNER || "hivecommons";
const repo = process.env.HIVE_DOCS_REPO || "hive";
// Default tracks the Hive branch that feeds the `stable` release channel (hivecommons/hive#7814, #7721 Phase 3).
const branch = process.env.HIVE_DOCS_REF || "v5";
const docsRoot = path.join(process.cwd(), "docs", "content", "hive");
const rawBase = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/src/docs`;
const canonicalBase = `https://github.com/${owner}/${repo}/blob/${branch}/src/docs`;

// The curated list of pages to sync lives in a data file so the scheduled
// refresh can append to it in heal mode (see "File-list drift" below). Each
// entry: `source` (path under src/docs), optional `target` (output path under
// docs/content/hive), optional `route` (nav URL when the page-map slug differs
// from the target, so links land on the page shown in the sidebar) and an
// optional free-text `comment`.
export interface SyncFile {
  source: string;
  target?: string;
  route?: string;
  comment?: string;
}
export const FILES_LIST_PATH = "scripts/sync-hive-docs.files.json";
export const ALLOWLIST_PATH = "scripts/sync-hive-docs.unsynced-allowlist.txt";

const files: SyncFile[] = filesData.map(f => ({ ...f }));

// Hive pages authored in this repo (docs/content/hive/) rather than synced,
// listed so links from synced pages resolve to their site routes.
const localHiveDocs: Array<{ source: string; target?: string }> = [
  // Supported agents & inference engines page authored here, published at /docs/hive/integrations (#552).
  { source: "integrations.md" },
];

// ---------------------------------------------------------------------------
// Brand scrub
// ---------------------------------------------------------------------------

function canonicalHeader(source: string): string {
  const canonical = `${canonicalBase}/${source}`;
  return `> **Synced from Hive.** This page is pulled from [hivecommons/hive@${branch}](${canonical}) during the docs build. Edit the canonical source in the Hive repository.\n\n`;
}

// ---------------------------------------------------------------------------
// Link rewriting
// ---------------------------------------------------------------------------
//
// The Hive markdown is authored for GitHub's file browser, where relative links
// like `[Architecture](architecture.md)` or `[bin index](../../bin/README.md)`
// resolve against the file's location in the `hivecommons/hive` repo. When those
// files are copied verbatim into this docs site they 404, because:
//
//   * The site serves each Hive page at a route WITHOUT the `.md` extension
//     (e.g. `docs/content/hive/architecture.md` -> `/docs/hive/architecture`),
//     and some pages render one level deep under a nav section
//     (e.g. `readme.md` -> `/docs/hive/overview/introduction`). A bare
//     `architecture.md` link therefore resolves against the wrong directory and
//     keeps a `.md` suffix that is not a valid route.
//   * Repo-relative escapes such as `../../bin/README.md` point outside the
//     synced docs tree entirely and have no site route at all.
//
// This pass fixes both cases GENERICALLY (no per-file hardcoding) so future
// version bumps (v5, v6, ...) and layout changes stay correct automatically:
//
//   Case 1 — the link resolves to a Hive doc that IS synced/published here:
//     rewrite it to the site-absolute, extension-less route `/docs/hive/<name>`.
//     A root-absolute path is used deliberately: it resolves correctly no matter
//     how deep the *current* page renders in the nav, so it cannot break if a
//     page later moves between nav sections.
//
//   Case 2 — the link escapes the synced tree, or points at a repo path that is
//     NOT synced (bin/README.md, deploy/README.md, AGENT-DEFINITION.md, etc.):
//     rewrite it to an absolute GitHub URL on the same branch the sync uses, by
//     resolving the `../` segments against the source file's real repo path
//     (`src/docs/<source>`) to recover the true repo path, then emitting
//     `https://github.com/<owner>/<repo>/blob/<branch>/<repo-path>`.
//
//   Absolute (`http(s)://`, `//`) links and pure in-page `#anchor` links are
//   left untouched.
//
// The resolution itself lives in scripts/link-rewrite.ts, shared with
// sync-sibling-docs.ts; this file supplies the Hive route map.

// Repo path (relative to the hive repo root) of every source file the sync
// pulls, e.g. `src/docs/architecture.md`, `src/docs/adr/README.md`.
const syncedRepoPaths = new Set<string>();

// Map from a synced source's repo path -> its published site route (no `.md`).
// e.g. `src/docs/README.md` -> `/docs/hive/readme`,
//      `src/docs/adr/0001-...md` -> `/docs/hive/adr/0001-...`.
const repoPathToSiteRoute = new Map<string, string>();

// Basename -> site route, used only as a recovery fallback (see rewriteLinkTarget).
// `README.md` is intentionally excluded because it is ambiguous (root README vs
// adr/README); those are only ever matched by exact path.
const basenameToSiteRoute = new Map<string, string>();

// Add a page to the route maps. Runs for every listed page at load time and
// again for pages appended in heal mode, so links to them become Case 1.
function registerPage(f: SyncFile, synced: boolean) {
  const repoPath = `src/docs/${f.source}`;
  if (synced) syncedRepoPaths.add(repoPath);
  const target = f.target || f.source;
  const route = f.route || target.replace(/\.mdx?$/i, "");
  repoPathToSiteRoute.set(repoPath, `/docs/hive/${route}`);
  const base = f.source.split("/").pop()!;
  if (base.toLowerCase() !== "readme.md") {
    basenameToSiteRoute.set(base, `/docs/hive/${route}`);
  }
}
for (const f of files) registerPage(f, true);
for (const f of localHiveDocs) registerPage(f, false);

const blobBase = `https://github.com/${owner}/${repo}/blob/${branch}`;

// Case 1: the link points at a doc we actually sync/publish -> site route.
// Case 1b (recovery): the resolved path is not itself synced, but its basename
// uniquely matches a synced doc. This happens when the Hive source was already
// hand-edited with SITE-relative links (e.g. `../architecture.md` written to
// resolve at `/docs/hive/...` rather than in GitHub's file browser). Rather
// than push such a link out to GitHub, keep it internal.
// Returning undefined falls through to Case 2 (absolute GitHub URL).
function resolveSyncedRoute(
  resolved: string,
  pathPart: string
): string | undefined {
  if (syncedRepoPaths.has(resolved)) {
    return repoPathToSiteRoute.get(resolved)!;
  }
  const base = pathPart.split("/").pop() ?? "";
  return basenameToSiteRoute.get(base);
}

// Rewrite a single markdown link target that appears in `sourceRepoPath`'s
// content (sourceRepoPath is e.g. `src/docs/README.md`). Returns the original
// target unchanged when no rewrite applies.
function rewriteLinkTarget(target: string, sourceRepoPath: string): string {
  return rewriteSharedLinkTarget(target, {
    sourceRepoPath,
    blobBase,
    resolveSyncedRoute,
  });
}

// Apply link rewriting to a file's markdown content. Handles inline links
// `[text](target)` and reference-style definitions `[id]: target`.
// When `unsyncedRefs` is given, every `src/docs/**/*.md` target that Case 2
// pushed out to GitHub is recorded in it (source path -> referencing pages)
// for the drift check.
function rewriteLinks(
  content: string,
  sourceRepoPath: string,
  unsyncedRefs?: Map<string, Set<string>>
): string {
  return rewriteMarkdownLinks(content, {
    sourceRepoPath,
    blobBase,
    resolveSyncedRoute: (resolved, pathPart) => {
      const route = resolveSyncedRoute(resolved, pathPart);
      if (route === undefined && unsyncedRefs) {
        const m = resolved.match(/^src\/docs\/(.+\.md)$/i);
        if (m) {
          const from = sourceRepoPath.replace(/^src\/docs\//, "");
          const refs = unsyncedRefs.get(m[1]) ?? new Set<string>();
          unsyncedRefs.set(m[1], refs.add(from));
        }
      }
      return route;
    },
  });
}

// Exported for unit testing (see scripts/sync-hive-docs.test.ts).
export { rewriteLinkTarget, rewriteLinks };

function applyLocalHiveOverlays(content: string, source: string): string {
  if (source !== "adr/0011-knowledge-system.md") {
    return content;
  }

  return `${content.trimEnd()}\n\n## Operator access\n\nFor the anonymous, read-only way to let external agents consult public operational facts, see [Public knowledge MCP endpoint](/docs/hive/public-knowledge-mcp).\n`;
}

async function fetchText(url: string): Promise<string> {
  const response = await fetchTextWithTimeout(url);
  if (!response.ok) {
    throw new Error(
      `failed to fetch ${url}: ${response.status} ${response.statusText}`
    );
  }
  return response.body;
}

/** Resolve a sync target under docsRoot, refusing anything that escapes it. */
export function resolveSyncTarget(root: string, target: string): string {
  const targetPath = path.join(root, target);
  if (!targetPath.startsWith(root + path.sep)) {
    throw new Error(`refusing to write outside Hive docs root: ${target}`);
  }
  return targetPath;
}

// ---------------------------------------------------------------------------
// File-list drift (hivecommons/docs#612)
// ---------------------------------------------------------------------------
//
// `files` is curated, not a mirror of src/docs, so a page added upstream next
// to pages we sync is easy to miss: links to it silently become GitHub URLs
// (Case 2) and the site nav has a hole. After every sync this reports:
//
//   * unlisted siblings — upstream `src/docs/<dir>/*.md` pages in a
//     subdirectory with at least one synced page that are not listed
//     themselves (root-level pages are only reported when linked, below);
//   * referenced pages — `src/docs/**/*.md` pages a synced page links to that
//     Case 2 pushed out to a GitHub URL.
//
// Pages in scripts/sync-hive-docs.unsynced-allowlist.txt are intentional
// omissions and are never reported. By default (prebuild, PR builds) the
// check is report-only: it prints the drift, appends it to
// $GITHUB_STEP_SUMMARY when set, and never changes the exit code. Heal mode
// (SYNC_HIVE_DOCS_HEAL=1 or --heal; the scheduled refresh) appends the drift
// to scripts/sync-hive-docs.files.json, syncs the new pages and adds them to
// NAV_STRUCTURE_HIVE in src/app/docs/page-map.ts (so the #616 nav guard keeps
// passing), failing only if that cannot be applied.

export interface DriftEntry {
  /** Path under src/docs, as used for `source` in the files list. */
  source: string;
  reason: "unlisted-sibling" | "referenced";
  /** Synced pages that link to it (sources under src/docs). */
  referencedBy: string[];
}

/** One `src/docs`-relative path per line; `#` starts a comment. */
export function parseAllowlist(text: string): Set<string> {
  return new Set(
    text
      .split("\n")
      .map(line => line.replace(/#.*/, "").trim())
      .filter(Boolean)
  );
}

export function detectDrift(opts: {
  /** Sources in the files list. */
  synced: string[];
  /** Every file under upstream src/docs; undefined if it could not be listed. */
  upstream?: string[];
  /** Case 2 targets under src/docs -> pages linking to them. */
  referenced: Map<string, Set<string>>;
  allowlist: Set<string>;
}): DriftEntry[] {
  const synced = new Set(opts.synced);
  const upstream = opts.upstream && new Set(opts.upstream);
  const syncedDirs = new Set(
    opts.synced.filter(s => s.includes("/")).map(s => path.posix.dirname(s))
  );
  const drift = new Map<string, DriftEntry>();
  for (const source of opts.upstream ?? []) {
    if (
      /\.md$/i.test(source) &&
      syncedDirs.has(path.posix.dirname(source)) &&
      !synced.has(source)
    ) {
      drift.set(source, {
        source,
        reason: "unlisted-sibling",
        referencedBy: [],
      });
    }
  }
  for (const [source, from] of opts.referenced) {
    // A link to a page that does not exist upstream is a broken link, not
    // drift; it cannot be synced.
    if (upstream && !upstream.has(source)) continue;
    const entry = drift.get(source) ?? {
      source,
      reason: "referenced" as const,
      referencedBy: [],
    };
    entry.referencedBy = [...from].sort();
    drift.set(source, entry);
  }
  return [...drift.values()]
    .filter(e => !opts.allowlist.has(e.source))
    .sort((a, b) => a.source.localeCompare(b.source));
}

/** The files list with every drift entry appended (heal mode). */
export function healFilesList(
  list: SyncFile[],
  drift: DriftEntry[]
): SyncFile[] {
  return [
    ...list,
    ...drift.map(e => {
      const target = e.source.replace(/(^|\/)README\.md$/, "$1readme.md");
      return target === e.source
        ? { source: e.source }
        : { source: e.source, target };
    }),
  ];
}

export const PAGE_MAP_PATH = "src/app/docs/page-map.ts";

/** Nav title: the page's first `# ` heading, falling back to the filename. */
function navTitle(content: string, source: string): string {
  const heading = /^# +(.+?)\s*$/m.exec(content)?.[1];
  return heading ?? path.posix.basename(source, ".md");
}

/**
 * Appends one nav entry per healed page to the last section of
 * NAV_STRUCTURE_HIVE (text edit between the NAV_STRUCTURE_HIVE and
 * NAV_STRUCTURE_HOTSHOT markers). Targets already present are skipped.
 */
export function addToHiveNav(
  pageMap: string,
  pages: Array<{ title: string; target: string }>
): string {
  const start = pageMap.indexOf("const NAV_STRUCTURE_HIVE");
  const end = pageMap.indexOf("const NAV_STRUCTURE_HOTSHOT");
  if (start === -1 || end === -1 || end < start) return pageMap;
  const region = pageMap.slice(start, end);
  const quote = (v: string) =>
    `'${v.replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`;
  const lines = pages
    .filter(p => !region.includes(quote(p.target)))
    .map(p => `      { ${quote(p.title)}: ${quote(p.target)} },\n`);
  // Last line that is exactly the section closer (`    ]`); a plain
  // substring search would also match a deeper-indented sub-list closer.
  let close = -1;
  for (const m of region.matchAll(/^ {4}\]$/gm)) close = m.index;
  if (!lines.length || close === -1) return pageMap;
  const at = start + close;
  return pageMap.slice(0, at) + lines.join("") + pageMap.slice(at);
}

function describeDrift(e: DriftEntry): string {
  const why = [
    e.reason === "unlisted-sibling" ? "unlisted sibling of synced pages" : "",
    e.referencedBy.length ? `linked from ${e.referencedBy.join(", ")}` : "",
  ].filter(Boolean);
  return `- \`${e.source}\` — ${why.join("; ")}`;
}

/** Markdown report printed to stdout and appended to $GITHUB_STEP_SUMMARY. */
export function formatDriftReport(opts: {
  drift: DriftEntry[];
  healed?: DriftEntry[];
  upstreamListed: boolean;
}): string {
  const lines = ["### sync-hive-docs file-list drift", ""];
  if (!opts.upstreamListed) {
    lines.push(
      "Upstream `src/docs` could not be listed; only linked pages were checked.",
      ""
    );
  }
  if (opts.healed?.length) {
    lines.push(
      `Healed: appended ${opts.healed.length} page(s) to \`${FILES_LIST_PATH}\`, synced them and added them to NAV_STRUCTURE_HIVE in \`${PAGE_MAP_PATH}\`:`,
      "",
      ...opts.healed.map(describeDrift),
      ""
    );
  }
  if (opts.drift.length) {
    lines.push(
      `${opts.drift.length} upstream page(s) are not in \`${FILES_LIST_PATH}\`. The scheduled refresh adds them; list intentional omissions in \`${ALLOWLIST_PATH}\`:`,
      "",
      ...opts.drift.map(describeDrift)
    );
  } else {
    lines.push("No unlisted upstream pages.");
  }
  return lines.join("\n") + "\n";
}

/** Every file path under upstream src/docs (relative to it). */
async function listUpstreamDocs(): Promise<string[]> {
  const url = `https://api.github.com/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`;
  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  const response = await fetchTextWithTimeout(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!response.ok) {
    throw new Error(
      `failed to list ${url}: ${response.status} ${response.statusText}`
    );
  }
  const parsed: {
    tree: Array<{ path: string; type: string }>;
    truncated?: boolean;
  } = JSON.parse(response.body);
  if (parsed.truncated) {
    throw new Error(`upstream tree listing truncated: ${url}`);
  }
  const tree = parsed.tree;
  return tree
    .filter(t => t.type === "blob" && t.path.startsWith("src/docs/"))
    .map(t => t.path.slice("src/docs/".length));
}

function readAllowlist(): Set<string> {
  const file = path.join(process.cwd(), ALLOWLIST_PATH);
  return fs.existsSync(file)
    ? parseAllowlist(fs.readFileSync(file, "utf8"))
    : new Set();
}

async function syncFiles(
  list: SyncFile[],
  cache: Map<string, string>,
  unsyncedRefs: Map<string, Set<string>>
) {
  for (const file of list) {
    const target = file.target || file.source;
    const sourceURL = `${rawBase}/${file.source}`;
    const targetPath = resolveSyncTarget(docsRoot, target);
    const content = cache.get(file.source) ?? (await fetchText(sourceURL));
    cache.set(file.source, content);
    // Rewrite GitHub-relative links so they resolve on the docs site.
    const overlaid = applyLocalHiveOverlays(content, file.source);
    const rewritten = rewriteLinks(
      overlaid,
      `src/docs/${file.source}`,
      unsyncedRefs
    );
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    fs.writeFileSync(
      targetPath,
      canonicalHeader(file.source) +
        normalizeFences(scrubLegacyBranding(rewritten))
    );
    console.log(`synced ${file.source} -> docs/content/hive/${target}`);
  }
}

async function main() {
  const heal =
    process.env.SYNC_HIVE_DOCS_HEAL === "1" || process.argv.includes("--heal");
  const cache = new Map<string, string>();
  let refs = new Map<string, Set<string>>();
  await syncFiles(files, cache, refs);

  let upstream: string[] | undefined;
  try {
    upstream = await listUpstreamDocs();
  } catch (error) {
    // Report-only builds must never fail on the drift check; heal mode
    // cannot apply without the upstream listing.
    if (heal) throw error;
    console.log(`drift check: ${(error as Error).message}`);
  }
  const allowlist = readAllowlist();
  const detect = () =>
    detectDrift({
      synced: files.map(f => f.source),
      upstream,
      referenced: refs,
      allowlist,
    });
  let drift = detect();
  let healed: DriftEntry[] = [];
  if (heal && drift.length) {
    healed = drift;
    const added = healFilesList(files, drift).slice(files.length);
    for (const f of added) {
      files.push(f);
      registerPage(f, true);
    }
    // Re-sync everything: links to the new pages now resolve to site routes.
    refs = new Map();
    await syncFiles(files, cache, refs);
    const listPath = path.join(process.cwd(), FILES_LIST_PATH);
    fs.mkdirSync(path.dirname(listPath), { recursive: true });
    fs.writeFileSync(listPath, JSON.stringify(files, null, 2) + "\n");
    const pageMapPath = path.join(process.cwd(), PAGE_MAP_PATH);
    if (fs.existsSync(pageMapPath)) {
      fs.writeFileSync(
        pageMapPath,
        addToHiveNav(
          fs.readFileSync(pageMapPath, "utf8"),
          added.map(f => ({
            title: navTitle(cache.get(f.source) ?? "", f.source),
            target: f.target ?? f.source,
          }))
        )
      );
    }
    drift = detect();
  }

  const report = formatDriftReport({
    drift,
    healed,
    upstreamListed: upstream !== undefined,
  });
  console.log(report);
  if (process.env.GITHUB_STEP_SUMMARY) {
    fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, report);
  }
}

// Only run the sync when this file is executed directly (not when imported by
// the test suite, which would otherwise trigger network fetches on import).
const isDirectRun =
  typeof process !== "undefined" &&
  Array.isArray(process.argv) &&
  /sync-hive-docs\.ts$/.test(process.argv[1] ?? "");

if (isDirectRun) {
  main().catch(error => {
    console.error(error);
    process.exit(1);
  });
}
