// Guards the hand-maintained routing invariants in netlify.toml. The file is
// evaluated only by the Netlify deploy, after merge, so this is the earliest
// point a stale or missing rule can fail a PR:
//   - every project in src/config/versions.ts needs a `/docs/<id>` and
//     `/docs/<id>/` 302 pair onto its landing page (the same hrefs are
//     duplicated by hand in DocsSidebar/DocsFooter; the redirect pair is the
//     one that is easy to forget when a sibling project is added);
//   - a `from = "/*"` rule shadows every server-rendered route under
//     @netlify/plugin-nextjs and 404s the whole site (see the comment block in
//     netlify.toml).
import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { getAllProjects } from "../config/versions";

const REPO_ROOT = join(__dirname, "..", "..");
const NETLIFY_TOML = readFileSync(join(REPO_ROOT, "netlify.toml"), "utf8");

type Redirect = Record<string, string>;

// netlify.toml only uses flat `key = value` tables, so a line-oriented parser
// is enough; pulling in a TOML library just for this test is not worth it.
export function parseRedirects(toml: string): Redirect[] {
  const redirects: Redirect[] = [];
  let current: Redirect | null = null;
  for (const raw of toml.split("\n")) {
    const line = raw.replace(/#.*$/, "").trim();
    if (line === "") continue;
    if (line === "[[redirects]]") {
      current = {};
      redirects.push(current);
      continue;
    }
    if (line.startsWith("[")) {
      current = null;
      continue;
    }
    if (current === null) continue;
    const m = line.match(/^([A-Za-z_]+)\s*=\s*(.+)$/);
    if (!m) continue;
    current[m[1]] = m[2].replace(/^"(.*)"$/, "$1");
  }
  return redirects;
}

export function parseTableValue(
  toml: string,
  table: string,
  key: string
): string | undefined {
  const lines = toml.split("\n").map(l => l.replace(/#.*$/, "").trim());
  const start = lines.indexOf(`[${table}]`);
  if (start === -1) return undefined;
  for (const line of lines.slice(start + 1)) {
    if (line.startsWith("[")) break;
    const m = line.match(/^([A-Za-z_]+)\s*=\s*(.+)$/);
    if (m && m[1] === key) return m[2].replace(/^"(.*)"$/, "$1");
  }
  return undefined;
}

const redirects = parseRedirects(NETLIFY_TOML);
const docsRedirects = redirects.filter(r =>
  (r.from ?? "").startsWith("/docs/")
);

describe("netlify.toml redirects", () => {
  it("parses at least one redirect block", () => {
    expect(redirects.length).toBeGreaterThan(0);
    for (const r of redirects) {
      expect(r).toHaveProperty("from");
      expect(r).toHaveProperty("to");
      expect(r).toHaveProperty("status");
    }
  });

  it.each(getAllProjects().map(p => [p.basePath]))(
    "redirects /docs/%s (with and without trailing slash) to the landing page",
    basePath => {
      const landing = `/docs/${basePath}/overview/introduction`;
      for (const from of [`/docs/${basePath}`, `/docs/${basePath}/`]) {
        const rule = redirects.find(r => r.from === from);
        expect(rule, `missing [[redirects]] for ${from}`).toBeDefined();
        expect(rule?.to).toBe(landing);
        expect(rule?.status).toBe("302");
        // A forced rule would also shadow the real landing page itself.
        expect(rule?.force).toBeUndefined();
      }
    }
  );

  it("has no /docs/* redirect for a project that no longer exists", () => {
    const known = new Set(getAllProjects().map(p => p.basePath));
    const stale = docsRedirects
      .map(r => r.from)
      .filter(
        from =>
          from !== "/docs/hive/overview/intro" &&
          !known.has(from.replace(/^\/docs\//, "").replace(/\/$/, ""))
      );
    expect(stale).toEqual([]);
  });

  it("redirects the removed Hive intro to the synced introduction", () => {
    const rule = docsRedirects.find(
      r => r.from === "/docs/hive/overview/intro"
    );
    expect(rule?.to).toBe("/docs/hive/overview/introduction");
    expect(rule?.status).toBe("301");
  });

  it("has exactly one redirect per /docs/* source path", () => {
    const seen = new Map<string, number>();
    for (const r of docsRedirects)
      seen.set(r.from, (seen.get(r.from) ?? 0) + 1);
    const dupes = [...seen.entries()].filter(([, n]) => n > 1).map(([f]) => f);
    expect(dupes).toEqual([]);
  });

  it("never declares a catch-all /* rule (shadows every Next.js route)", () => {
    const catchAll = redirects.filter(r => r.from === "/*" || r.from === "/**");
    expect(catchAll).toEqual([]);
  });

  it("uses an absolute https target for every forced external redirect", () => {
    for (const r of redirects.filter(r => r.force === "true")) {
      expect(r.to).toMatch(/^https:\/\//);
      expect(r.status).toBe("301");
    }
  });
});

describe("netlify.toml build and functions", () => {
  it("pins the Netlify Functions directory to the checked-in NPS relay", () => {
    const dir = parseTableValue(NETLIFY_TOML, "functions", "directory");
    expect(dir).toBe("netlify/functions");
    const abs = join(REPO_ROOT, dir as string);
    expect(existsSync(abs) && statSync(abs).isDirectory()).toBe(true);
    expect(existsSync(join(abs, "nps.mts"))).toBe(true);
  });

  it("threads the deploy branch into the build so version detection works", () => {
    // src/lib/url.ts derives the preview/branch URL from NEXT_PUBLIC_BRANCH;
    // both the production and branch-deploy commands must set it.
    const build = parseTableValue(NETLIFY_TOML, "build", "command");
    const branchDeploy = parseTableValue(
      NETLIFY_TOML,
      "context.branch-deploy",
      "command"
    );
    expect(build).toContain("NEXT_PUBLIC_BRANCH=${BRANCH:-main}");
    expect(branchDeploy).toBe(build);
  });
});

describe("parseRedirects", () => {
  it("ignores comments, blank lines and non-redirect tables", () => {
    const toml = `
# comment
[build]
  command = "npm run build"

[[redirects]]
  from = "/a" # trailing comment
  to = "/b"
  status = 302

[[headers]]
  for = "/x"
  [headers.values]
    Cache-Control = "no-store"

[[redirects]]
  from = "/c"
  to = "https://example.com"
  status = 301
  force = true
`;
    expect(parseRedirects(toml)).toEqual([
      { from: "/a", to: "/b", status: "302" },
      { from: "/c", to: "https://example.com", status: "301", force: "true" },
    ]);
    expect(parseTableValue(toml, "build", "command")).toBe("npm run build");
    expect(parseTableValue(toml, "build", "missing")).toBeUndefined();
    expect(parseTableValue(toml, "nope", "command")).toBeUndefined();
  });
});
