import fs from "fs";
import path from "path";
import {
  rewriteLinkTarget as rewriteSharedLinkTarget,
  rewriteMarkdownLinks,
} from "./link-rewrite";
import { fetchTextWithTimeout } from "./fetch-with-timeout";
import { normalizeFences } from "./markdown-fences";
import { scrubLegacyBranding } from "./scrub-legacy-branding";

// Post-migration the canonical hive repo is hivecommons/hive; until the code
// transfer lands the docs stay in hivecommons/hive. Override with HIVE_DOCS_OWNER.
const owner = process.env.HIVE_DOCS_OWNER || "hivecommons";
const repo = process.env.HIVE_DOCS_REPO || "hive";
// Default tracks the Hive branch that feeds the `stable` release channel (hivecommons/hive#7814, #7721 Phase 3).
const branch = process.env.HIVE_DOCS_REF || "v5";
const docsRoot = path.join(process.cwd(), "docs", "content", "hive");
const rawBase = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/src/docs`;
const canonicalBase = `https://github.com/${owner}/${repo}/blob/${branch}/src/docs`;

const files: Array<{ source: string; target?: string; route?: string }> = [
  { source: "README.md", target: "readme.md" },
  { source: "documentation-map.md" },
  { source: "architecture.md" },
  { source: "security-threat-model.md" },
  { source: "roadmap.md" },
  { source: "landscape.md" },
  // Operations pages — single-sourced from hive src/docs (previously hand-copied
  // into docs/content/hive and prone to drift; migrated to auto-sync).
  { source: "acmm-policy-matrix.md" },
  // ACMM Level 6 operating guide (hivecommons/hive#10516, #10517).
  { source: "running-at-level-6.md" },
  { source: "agent-configuration.md" },
  { source: "hivectl.md" },
  { source: "manual-provisioning.md" },
  { source: "work-sources.md" },
  { source: "getting-started.md" },
  { source: "net-admin-requirement.md" },
  { source: "release-channels.md" },
  // Stable soak/promotion policy referenced from release-channels (hivecommons/docs#181).
  // `route` is the nav URL (slug derives from the page-map title), so links land on the page shown in the sidebar.
  {
    source: "stable-soak-policy.md",
    route: "operations/stable-soak-and-promotion-policy",
  },
  { source: "contributor-relay.md" },
  { source: "security-model.md" },
  { source: "securing-your-hive.md" },
  { source: "troubleshooting.md" },
  // Dashboard section help pages (hivecommons/docs#253, hivecommons/hive#10915).
  { source: "dashboard-sections.md" },
  { source: "dashboard-glossary.md" },
  { source: "dashboard-sections/overview-and-metrics.md" },
  { source: "dashboard-sections/workflow-and-agents.md" },
  { source: "dashboard-sections/activity-monitor.md" },
  { source: "labels-and-control-signals.md" },
  { source: "labels-and-control-signals/reference.md" },
  { source: "labels-and-control-signals/stage-labels.md" },
  { source: "labels-and-control-signals/glossary-and-operations.md" },
  { source: "backup-restore.md", target: "backup-dr.md" },
  { source: "env-vars.md" },
  // Third-party integration guide (hivecommons/hive#10171).
  { source: "integration-guide.md" },
  { source: "integrations/work-source-providers.md" },
  { source: "integrations/clanker-flue.md" },
  { source: "integrations/spektacular.md" },
  { source: "public-knowledge-mcp.md" },
  { source: "copilot-permissions-comparison.md" },
  { source: "adr/README.md", target: "adr/readme.md" },
  { source: "adr/0001-record-architecture-decisions.md" },
  { source: "adr/0002-mitm-proxy-network-enforcement.md" },
  { source: "adr/0003-acmm-autonomy-levels.md" },
  { source: "adr/0004-beads-work-ledger.md" },
  { source: "adr/0005-forge-abstraction.md" },
  { source: "adr/0006-planning-intelligence.md" },
  { source: "adr/0007-token-mint.md" },
  { source: "adr/0008-ioscan-untrusted-input.md" },
  { source: "adr/0009-trajectory-review.md" },
  { source: "adr/0010-escalation-circuit-breaker.md" },
  { source: "adr/0011-knowledge-system.md" },
  { source: "adr/0012-skill-registry.md" },
  { source: "adr/0013-cel-triggers.md" },
  { source: "adr/0014-hub-spoke.md" },
  { source: "adr/0015-csp-style-src-scope.md" },
  { source: "adr/0016-csp-script-src-scope.md" },
  { source: "adr/0017-podman-quadlet-lifecycle.md" },
  { source: "adr/0018-dashboard-design-tokens.md" },
  { source: "adr/0019-escalation-over-stalling.md" },
  { source: "adr/0020-spek-continuous-convergence.md" },
  { source: "adr/0022-opt-in-earned-codex-reset-redemption.md" },
  { source: "adr/0023-trusted-author-automerge.md" },
  { source: "adr/0024-provider-credential-lifecycle.md" },
  { source: "adr/0025-central-stage-engine.md" },
  { source: "adr/0026-sandbox-runtime-selection.md" },
];

// Hive pages authored in this repo (docs/content/hive/) rather than synced,
// listed so links from synced pages resolve to their site routes.
const localHiveDocs: Array<{ source: string; target?: string }> = [];

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
const syncedRepoPaths = new Set(files.map(f => `src/docs/${f.source}`));

// Map from a synced source's repo path -> its published site route (no `.md`).
// e.g. `src/docs/README.md` -> `/docs/hive/readme`,
//      `src/docs/adr/0001-...md` -> `/docs/hive/adr/0001-...`.
const repoPathToSiteRoute = new Map<string, string>();
for (const f of [...files, ...localHiveDocs]) {
  const repoPath = `src/docs/${f.source}`;
  const target = f.target || f.source;
  const targetNoExt =
    ("route" in f && f.route) || target.replace(/\.mdx?$/i, "");
  repoPathToSiteRoute.set(repoPath, `/docs/hive/${targetNoExt}`);
}

// Basename -> site route, used only as a recovery fallback (see rewriteLinkTarget).
// `README.md` is intentionally excluded because it is ambiguous (root README vs
// adr/README); those are only ever matched by exact path.
const basenameToSiteRoute = new Map<string, string>();
for (const f of [...files, ...localHiveDocs]) {
  const base = f.source.split("/").pop()!;
  if (base.toLowerCase() === "readme.md") continue;
  const target = f.target || f.source;
  const route = ("route" in f && f.route) || target.replace(/\.mdx?$/i, "");
  basenameToSiteRoute.set(base, `/docs/hive/${route}`);
}

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
function rewriteLinks(content: string, sourceRepoPath: string): string {
  return rewriteMarkdownLinks(content, {
    sourceRepoPath,
    blobBase,
    resolveSyncedRoute,
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

async function main() {
  for (const file of files) {
    const target = file.target || file.source;
    const sourceURL = `${rawBase}/${file.source}`;
    const targetPath = resolveSyncTarget(docsRoot, target);
    const content = await fetchText(sourceURL);
    // Rewrite GitHub-relative links so they resolve on the docs site.
    const overlaid = applyLocalHiveOverlays(content, file.source);
    const rewritten = rewriteLinks(overlaid, `src/docs/${file.source}`);
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    fs.writeFileSync(
      targetPath,
      canonicalHeader(file.source) +
        normalizeFences(scrubLegacyBranding(rewritten))
    );
    console.log(`synced ${file.source} -> docs/content/hive/${target}`);
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
