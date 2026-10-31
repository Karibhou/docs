/**
 * Sync hotshot, pluk, rationguard, promptargs, dibs, Crux, and Spektacular docs from their GitHub repos into docs/content/.
 *
 * Same single-sourcing model as scripts/sync-hive-docs.ts: the repos own the
 * markdown; this script pulls it at build time (prebuild) so the site never
 * drifts from the source. Only readme.md is required per project and fails
 * the build when missing. For optional pages a definite 404 removes the
 * previously synced docs/content copy (with a warning) so a page deleted
 * upstream does not linger here; any other non-OK response (429/5xx) keeps
 * the committed copy rather than unpublish a live page.
 *
 * A project may pull pages from more than one repository (Spektacular's
 * tutorials live in the spektacular-website Astro site), and a page may be
 * authored as MDX, in which case it is converted to plain Markdown by
 * scripts/mdx-to-markdown.ts and the images it references are copied next to
 * the synced page.
 */
import fs from "fs";
import path from "path";
import {
  fetchBytesWithTimeout,
  fetchTextWithTimeout,
} from "./fetch-with-timeout";
import { rewriteMarkdownLinks } from "./link-rewrite";
import { normalizeFences } from "./markdown-fences";
import { convertMdxToMarkdown } from "./mdx-to-markdown";
import { scrubLegacyBranding } from "./scrub-legacy-branding";

export interface RepoRef {
  owner: string;
  repo: string;
  branch: string;
}

export interface SyncedFile {
  source: string; // path in the source repo
  target: string; // filename under docs/content/<project>/
  required?: boolean;
  /** Pull this page from a different repository than the project default. */
  repo?: RepoRef;
  /** `mdx` pages are converted to Markdown; `md` (default) pages are copied. */
  format?: "md" | "mdx";
  /**
   * For `mdx` pages: the canonical site the page is published on. Site-absolute
   * links (`/install/`) are rewritten to this origin and the page header
   * points readers at it.
   */
  siteBase?: string;
  /** For `mdx` pages: path of the page on `siteBase`, e.g. /tutorials/getting-started/. */
  sitePath?: string;
  /**
   * For `mdx` pages: directory in the source repo that site-absolute asset
   * paths (`/images/...`) resolve under, e.g. `public`. Referenced images are
   * copied into docs/content/<project>/ at the same relative path.
   */
  assetsRoot?: string;
}

export interface ProjectSync extends RepoRef {
  project: string; // docs/content/<project> and /docs/<project> route base
  /** Canonical site for the project, shown on the overview page when set. */
  canonicalSite?: string;
  files: SyncedFile[];
}

const SIBLING_OWNER = process.env.SIBLING_DOCS_OWNER || "hivecommons";
const SPEKTACULAR_SITE = "https://spektacular.dev";

const SPEKTACULAR_WEBSITE: RepoRef = {
  owner: SIBLING_OWNER,
  repo: "spektacular-website",
  branch: process.env.SPEKTACULAR_WEBSITE_DOCS_REF || "main",
};

export const PROJECTS: ProjectSync[] = [
  {
    project: "hotshot",
    owner: SIBLING_OWNER,
    repo: "hotshot",
    branch: process.env.HOTSHOT_DOCS_REF || "main",
    files: [
      { source: "README.md", target: "readme.md", required: true },
      { source: "linux/README.md", target: "linux.md" },
      { source: "windows/README.md", target: "windows.md" },
      { source: "ROADMAP.md", target: "roadmap.md" },
    ],
  },
  {
    project: "pluk",
    owner: SIBLING_OWNER,
    repo: "pluk",
    branch: process.env.PLUK_DOCS_REF || "main",
    files: [
      { source: "README.md", target: "readme.md", required: true },
      { source: "ROADMAP.md", target: "roadmap.md" },
    ],
  },
  {
    project: "rationguard",
    owner: SIBLING_OWNER,
    repo: "rationguard",
    branch: process.env.RATIONGUARD_DOCS_REF || "main",
    files: [{ source: "README.md", target: "readme.md", required: true }],
  },
  {
    project: "promptargs",
    owner: SIBLING_OWNER,
    repo: "promptargs",
    branch: process.env.PROMPTARGS_DOCS_REF || "main",
    files: [{ source: "README.md", target: "readme.md", required: true }],
  },
  {
    project: "dibs",
    owner: SIBLING_OWNER,
    repo: "dibs",
    branch: process.env.DIBS_DOCS_REF || "main",
    files: [
      { source: "README.md", target: "readme.md", required: true },
      { source: "ROADMAP.md", target: "roadmap.md" },
      { source: "docs/credit-wall-api.md", target: "credit-wall-api.md" },
      { source: "docs/mcp-registry.md", target: "mcp-registry.md" },
    ],
  },
  {
    project: "crux",
    owner: SIBLING_OWNER,
    repo: "crux",
    branch: process.env.CRUX_DOCS_REF || "main",
    files: [{ source: "README.md", target: "readme.md", required: true }],
  },
  {
    // Canonical site is https://spektacular.dev. The repo README and
    // docs/knowledge-base.md come from the spektacular repo; the tutorials are
    // authored as MDX in the spektacular-website Astro site.
    project: "spektacular",
    owner: SIBLING_OWNER,
    repo: "spektacular",
    branch: process.env.SPEKTACULAR_DOCS_REF || "main",
    canonicalSite: SPEKTACULAR_SITE,
    files: [
      { source: "README.md", target: "readme.md", required: true },
      { source: "docs/knowledge-base.md", target: "knowledge-base.md" },
      {
        source: "src/content/tutorials/getting-started.mdx",
        target: "getting-started.md",
        repo: SPEKTACULAR_WEBSITE,
        format: "mdx",
        siteBase: SPEKTACULAR_SITE,
        sitePath: "/tutorials/getting-started/",
        assetsRoot: "public",
      },
      {
        source: "src/content/tutorials/unknown-criteria.mdx",
        target: "unknown-criteria.md",
        repo: SPEKTACULAR_WEBSITE,
        format: "mdx",
        siteBase: SPEKTACULAR_SITE,
        sitePath: "/tutorials/unknown-criteria/",
        assetsRoot: "public",
      },
    ],
  },
];

// ---------------------------------------------------------------------------
// Spek naming style
// ---------------------------------------------------------------------------
// Keep canonical command names, paths, and stage identifiers unchanged while the
// docs site introduces the Spek nickname in rendered prose.
export function introduceSpekStyle(
  project: string,
  target: string,
  content: string
): string {
  if (project !== "spektacular") return content;

  const replacementsByTarget: Record<string, Array<[string, string]>> = {
    "readme.md": [
      [
        "# Spektacular\n\nAgent-agnostic CLI tool for spec-driven development, providing skills and integrations for coding agents (Claude, Bob, Codex) to plan and implement work from a written spec.",
        "# Spektacular\n\n> Spektacular — Spek for short. The specs it produces are called speks.\n\nAgent-agnostic CLI tool for spec-driven development, providing skills and integrations for coding agents (Claude, Bob, Codex) to plan and implement work from a written spek.",
      ],
      [
        "## What is Spektacular?\n\nSpektacular is a self-contained Go binary",
        "## What is Spektacular?\n\nSpek is a self-contained Go binary",
      ],
      ["Spektacular turns it into", "Spek turns it into"],
      [
        "You write a markdown spec (requirements",
        "You write a markdown spek (requirements",
      ],
      [
        "Spektacular is a single self-contained Go binary.",
        "Spek is a single self-contained Go binary.",
      ],
      ["run the Spektacular workflows", "run the Spek workflows"],
      [
        "Spec, plan, and implement each run",
        "Spec, plan, and implement each run",
      ],
      ["Spektacular hands the agent", "Spek hands the agent"],
      [
        "referenced by the spec that needs it, so specs stay readable",
        "referenced by the spek that needs it, so speks stay readable",
      ],
      [
        "Spektacular follows a three-stage workflow",
        "Spek follows a three-stage workflow",
      ],
      [
        "You write a markdown specification; Spek turns it into",
        "You write a markdown spek; Spek turns it into",
      ],
      ["scaffolds one from a template", "scaffolds one from a template"],
      ["reading Spektacular's state files", "reading Spek's state files"],
      [
        "across the spec file, the plan directory and the changelog record",
        "across the spek file, the plan directory and the changelog record",
      ],
      ["Spec names are normalised", "Spek names are normalised"],
      ["Specs are plain markdown", "Speks are plain markdown"],
      ["full walkthrough and spec format", "full walkthrough and spek format"],
      ["Spektacular ships with three", "Spek ships with three"],
      [
        "so the Spektacular agent rules take effect",
        "so the Spek agent rules take effect",
      ],
      [
        "backing the spec, plan, and knowledge stores",
        "backing the spek, plan, and knowledge stores",
      ],
      ["By default Spektacular reads", "By default Spek reads"],
      ["In a Spektacular-initialised repo", "In a Spek-initialised repo"],
      ["A repo's Spektacular files", "A repo's Spek files"],
      [
        "Spektacular always runs against a project",
        "Spek always runs against a project",
      ],
      ["Spektacular's files go inside", "Spek's files go inside"],
      [
        "git repository that Spektacular clones",
        "git repository that Spek clones",
      ],
      ["coding agent Spektacular drives", "coding agent Spek drives"],
      [
        "location of each repo's Spektacular files",
        "location of each repo's Spek files",
      ],
      [
        "the central `spec`, `plan`, and `changelog` stores",
        "the central `spec`, `plan`, and `changelog` stores",
      ],
      ["written by Spektacular", "written by Spektacular"],
      ["new Spektacular", "new Spektacular"],
      [
        "until the project is brought up to date",
        "until the project is brought up to date",
      ],
      [
        "older than the running Spektacular",
        "older than the running Spektacular",
      ],
      [
        "Settings written by a *newer* Spektacular",
        "Settings written by a *newer* Spektacular",
      ],
      ["Spektacular's own listing", "Spek's own listing"],
      ["Spektacular has two layers", "Spek has two layers"],
      ["none of Spektacular's internal", "none of Spek's internal"],
    ],
    "getting-started.md": [
      [
        "_Take a feature from a rough idea to working code using a Spektacular spec,",
        "_Take a feature from a rough idea to working code using a Spektacular (Spek) spek,",
      ],
      [
        "In this tutorial you will see how Spektacular's",
        "In this tutorial you will see how Spek's",
      ],
      ["coding agent Spektacular supports", "coding agent Spek supports"],
      [
        "## What is Spektacular\n\nSpektacular is a CLI",
        "## What is Spektacular\n\nSpek is a CLI",
      ],
      [
        "store your specs and knowledge base",
        "store your speks and knowledge base",
      ],
      ["# scaffold a new specification", "# scaffold a new specification"],
      ["turn a spec into", "turn a spek into"],
      ["agent state: the spec, the plan", "agent state: the spek, the plan"],
      [
        "### Step 2: Install Spektacular\n\nSpektacular is a Go binary",
        "### Step 2: Install Spektacular\n\nSpek is a Go binary",
      ],
      ["Spektacular drives an external", "Spek drives an external"],
      [
        "outside Spektacular before continuing",
        "outside Spek before continuing",
      ],
      ["use Spektacular with", "use Spek with"],
      ["want Spektacular to\noperate on", "want Spek to\noperate on"],
      ["so Spektacular knows", "so Spek knows"],
      ["The specification in Spektacular\nserves", "The spek in Spek\nserves"],
      [
        "The specification in the Spektacular workflow",
        "The spek in the Spek workflow",
      ],
      [
        "The content in these sections guides",
        "The content in these sections guides",
      ],
      ["the specification pays off", "the spek pays off"],
      ["The spec also serves", "The spek also serves"],
      ["Scaffold a new specification", "Scaffold a new spek"],
      [
        "Spektacular will automatically create",
        "Spek will automatically create",
      ],
      ["Spektacular writes all temporary", "Spek writes all temporary"],
      ["file name for the spec", "file name for the spek"],
      ["The way Spektacular works", "The way Spek works"],
      ["Spektacular invokes `codex`", "Spek invokes `codex`"],
      ["Spektacular\ninvokes `codex`", "Spek\ninvokes `codex`"],
      ["call the Spektacular CLI", "call the Spektacular CLI"],
      ["creating the spec file", "creating the spek file"],
      ["an empty spec will be created", "an empty spek will be created"],
      ["sections of the spec", "sections of the spek"],
      ["final specification or plan", "final spek or plan"],
      ["current specification and the answers", "current spek and the answers"],
      ["final section of the specification", "final section of the spek"],
      [
        "verify the specification before writing",
        "verify the spek before writing",
      ],
      ["pass over the specification", "pass over the spek"],
      ["the specification is well formed", "the spek is well formed"],
      ["generate your full specification", "generate your full spek"],
      ["judge the spec the", "judge the spek the"],
      ["writing the spec to", "writing the spek to"],
      ["Select the spec you just created", "Select the spek you just created"],
      ["review the final specification", "review the final spek"],
      ["When reviewing the specification", "When reviewing the spek"],
      ["edit the spec directly", "edit the spek directly"],
      ["Spektacular gives you", "Spek gives you"],
      ["learn how Spektacular\nsupports", "learn how Spek\nsupports"],
      ["Spektacular queries every store", "Spek queries every store"],
      ["As with the specification", "As with the spek"],
      ["name of the specification", "name of the spek"],
      ["from the specification or the context", "from the spek or the context"],
      [
        "retrieved from the specification and the context",
        "retrieved from the spek and the context",
      ],
      [
        "The spec defines no success metrics",
        "The spec defines no success metrics",
      ],
      [
        "using the Spec Driven Development workflow",
        "using the Spec Driven Development workflow",
      ],
      ["The specification and plan", "The spek and plan"],
    ],
    "unknown-criteria.md": [
      [
        "In the first case, I can use the Spektacular workflow",
        "In the first case, I can use the Spektacular (Spek) workflow",
      ],
      ["a bug in Spektacular when", "a bug in Spek when"],
      ["The way that Spektacular works", "The way that Spek works"],
      ["how Spektacular works", "how Spek works"],
      ["surfaced by Spektacular are", "surfaced by Spek are"],
      ["full specification for\nthis work", "full spek for\nthis work"],
      ["Writing the specifications", "Writing the speks"],
      ["creates a specification", "creates a spek"],
      ["this\nspecification", "this\nspek"],
      ["write a\nspecification for", "write a\nspek for"],
      ["two new specifications", "two new speks"],
      [
        "diagnostic information that Spektacular produces",
        "diagnostic information that Spek produces",
      ],
      ["share these specifications", "share these speks"],
      ["write a specification for the work", "write a spek for the work"],
      ["a specification and a plan", "a spek and a plan"],
      [
        "turns the activity of writing the specification",
        "turns the activity of writing the spek",
      ],
      ["write a specification", "write a spek"],
      ["specification and plan", "spek and plan"],
    ],
  };

  let result = content;
  for (const [from, to] of replacementsByTarget[target] ?? []) {
    result = result.replaceAll(from, to);
  }
  return result;
}

function fileRepo(p: ProjectSync, f: SyncedFile): RepoRef {
  return f.repo ?? { owner: p.owner, repo: p.repo, branch: p.branch };
}

export function syncedHeader(p: ProjectSync, f: SyncedFile): string {
  const r = fileRepo(p, f);
  const canonical = `https://github.com/${r.owner}/${r.repo}/blob/${r.branch}/${f.source}`;
  let header = `> **Synced from ${r.repo}.** This page is pulled from [${r.owner}/${r.repo}@${r.branch}](${canonical}) during the docs build. Edit the canonical source in the ${r.repo} repository.`;
  const site = f.siteBase ?? p.canonicalSite;
  if (site) {
    const pageUrl = f.sitePath
      ? `${site.replace(/\/$/, "")}${f.sitePath}`
      : site;
    const host = site.replace(/^https?:\/\//, "").replace(/\/$/, "");
    header += `\n>\n> Also published at [${host}](${pageUrl}), which is the canonical copy of this documentation.`;
  }
  return header + "\n\n";
}

/**
 * Rewrite links authored for GitHub's file browser (via the shared
 * scripts/link-rewrite.ts, also used by sync-hive-docs.ts). Relative targets
 * are resolved against the source file's directory (`./`, `../`), keeping any
 * `#fragment` / `?query`:
 *  - a link to a markdown file that IS synced here becomes the site-absolute
 *    extension-less route (/docs/<project>/<target-sans-md>)
 *  - any other relative link (source files, directories, unsynced markdown)
 *    becomes an absolute GitHub URL so it keeps working
 *  - relative image sources become raw.githubusercontent URLs
 *  - absolute URLs and pure anchors are left untouched
 * Inline links and reference-style `[id]: target` definitions are handled.
 */
export function rewriteLinks(
  content: string,
  p: ProjectSync,
  f?: SyncedFile
): string {
  const r = f ? fileRepo(p, f) : p;
  // Source paths are only meaningful within their own repo, so only files from
  // the same repo as the one being rewritten can be link targets.
  const syncedRoutes = new Map<string, string>();
  for (const s of p.files) {
    const sr = fileRepo(p, s);
    if (sr.owner !== r.owner || sr.repo !== r.repo) continue;
    syncedRoutes.set(
      s.source.toLowerCase(),
      `/docs/${p.project}/${s.target.replace(/\.mdx?$/i, "")}`
    );
  }
  return rewriteMarkdownLinks(content, {
    // Without a file, resolve relative to the repo root.
    sourceRepoPath: f?.source ?? "README.md",
    blobBase: `https://github.com/${r.owner}/${r.repo}/blob/${r.branch}`,
    rawBase: `https://raw.githubusercontent.com/${r.owner}/${r.repo}/${r.branch}`,
    resolveSyncedRoute: resolved => syncedRoutes.get(resolved.toLowerCase()),
  });
}

function rawUrl(r: RepoRef, source: string): string {
  return `https://raw.githubusercontent.com/${r.owner}/${r.repo}/${r.branch}/${source}`;
}

async function fetchFile(
  r: RepoRef,
  source: string
): Promise<{ status: number; body: string | null }> {
  const res = await fetchTextWithTimeout(rawUrl(r, source));
  return { status: res.status, body: res.ok ? res.body : null };
}

async function fetchBinary(
  r: RepoRef,
  source: string
): Promise<{ status: number; body: Buffer | null }> {
  const res = await fetchBytesWithTimeout(rawUrl(r, source));
  return { status: res.status, body: res.ok ? res.body : null };
}

/**
 * Copy the site-absolute images an MDX page references into the project's
 * content folder so they are served by the docs-image route. Images that
 * cannot be fetched keep an absolute URL on the canonical site instead.
 */
async function copyAssets(
  p: ProjectSync,
  f: SyncedFile,
  images: string[],
  outDir: string
): Promise<Map<string, string>> {
  const rewritten = new Map<string, string>();
  const r = fileRepo(p, f);
  for (const img of images) {
    if (rewritten.has(img)) continue;
    const rel = img.replace(/^\/+/, "");
    const dest = path.resolve(outDir, rel);
    if (!dest.startsWith(path.resolve(outDir) + path.sep)) {
      console.warn(
        `sync-sibling-docs: refusing to copy ${img} outside ${outDir}`
      );
      rewritten.set(img, `${f.siteBase ?? ""}${img}`);
      continue;
    }
    const source = path.posix.join(f.assetsRoot ?? "", rel);
    const { body } = await fetchBinary(r, source);
    if (body === null) {
      console.warn(
        `sync-sibling-docs: ${r.owner}/${r.repo}@${r.branch}/${source} not found — linking to ${f.siteBase}${img}`
      );
      rewritten.set(img, `${f.siteBase ?? ""}${img}`);
      continue;
    }
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, body);
    rewritten.set(img, rel);
  }
  return rewritten;
}

const MARKDOWN_IMAGE = /!\[[^\]]*\]\(\s*<?([^)\s>]+)/g;

function localImageRefs(markdown: string, outDir: string): Set<string> {
  const refs = new Set<string>();
  for (const m of markdown.matchAll(MARKDOWN_IMAGE)) {
    if (/^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i.test(m[1])) continue;
    refs.add(path.resolve(outDir, m[1].replace(/^\/+/, "")));
  }
  return refs;
}

/**
 * Remove the images copyAssets wrote for a page that is being unpublished.
 * Only files under outDir that no other synced page still references are
 * deleted.
 */
function pruneAssets(p: ProjectSync, stale: string, outDir: string): void {
  const root = path.resolve(outDir) + path.sep;
  const kept = new Set<string>();
  for (const other of p.files) {
    const file = path.join(outDir, other.target);
    if (file === stale || !fs.existsSync(file)) continue;
    for (const ref of localImageRefs(fs.readFileSync(file, "utf8"), outDir)) {
      kept.add(ref);
    }
  }
  for (const asset of localImageRefs(fs.readFileSync(stale, "utf8"), outDir)) {
    if (!asset.startsWith(root) || kept.has(asset)) continue;
    if (fs.existsSync(asset) && fs.statSync(asset).isFile()) fs.rmSync(asset);
  }
}

async function renderPage(
  p: ProjectSync,
  f: SyncedFile,
  body: string,
  outDir: string
): Promise<string> {
  if (f.format === "mdx") {
    // First pass collects the image list; assets are copied and the src
    // values are rewritten in a second pass with the resolved locations.
    const probe = convertMdxToMarkdown(body, { siteBase: f.siteBase ?? "" });
    const assets = await copyAssets(p, f, probe.images, outDir);
    const conv = convertMdxToMarkdown(body, {
      siteBase: f.siteBase ?? "",
      rewriteImage: src => assets.get(src) ?? src.replace(/^\//, ""),
    });
    for (const note of conv.notes) {
      console.warn(`sync-sibling-docs: ${p.project}/${f.target}: ${note}`);
    }
    return conv.markdown;
  }
  return rewriteLinks(body, p, f);
}

async function main() {
  for (const p of PROJECTS) {
    const outDir = path.join(process.cwd(), "docs", "content", p.project);
    fs.mkdirSync(outDir, { recursive: true });

    for (const f of p.files) {
      const r = fileRepo(p, f);
      const { status, body } = await fetchFile(r, f.source);
      if (body === null) {
        const msg = `sync-sibling-docs: ${r.owner}/${r.repo}@${r.branch}/${f.source} not found`;
        if (f.required) throw new Error(msg);
        const stale = path.join(outDir, f.target);
        // Only a definite 404 means the upstream source is gone; a 429/5xx
        // must keep the committed copy rather than unpublish a live page.
        if (status === 404 && fs.existsSync(stale)) {
          pruneAssets(p, stale, outDir);
          fs.rmSync(stale);
          console.warn(`${msg} — removed stale ${p.project}/${f.target}`);
        } else {
          console.warn(`${msg} — skipped`);
        }
        continue;
      }
      const page = await renderPage(p, f, body, outDir);
      const out =
        syncedHeader(p, f) +
        normalizeFences(
          scrubLegacyBranding(introduceSpekStyle(p.project, f.target, page))
        );
      fs.writeFileSync(path.join(outDir, f.target), out);
      console.log(
        `synced ${p.project}/${f.target} <- ${r.owner}/${r.repo}/${f.source}`
      );
    }
  }
}

// Only run the sync when this file is executed directly (not when imported by
// the test suite, which would otherwise trigger network fetches on import).
const isDirectRun =
  typeof process !== "undefined" &&
  Array.isArray(process.argv) &&
  /sync-sibling-docs\.ts$/.test(process.argv[1] ?? "");

if (isDirectRun) {
  main().catch(err => {
    console.error(err);
    process.exit(1);
  });
}
