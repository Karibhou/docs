import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Drives scripts/check-internal-links.ts end to end, IN PROCESS, against a
// synthetic docs/content tree + page-map.ts. The script runs its route
// collection at module load and calls main() only when it is the entry
// module (import.meta.url === pathToFileURL(process.argv[1])), so each case:
//   1. points process.cwd() at a fixture dir,
//   2. sets process.argv[1] to the script path so main() fires,
//   3. stubs process.exit (the failure path) and console.{log,error},
//   4. vi.resetModules() + dynamic import() to re-run the top-level code.
// Running in process (rather than spawning tsx like the other script suites)
// lets v8 attribute coverage to the script itself.

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);
const scriptPath = path.join(repoRoot, "scripts", "check-internal-links.ts");
const workRoot = path.join(repoRoot, ".test-work", "check-internal-links");

let caseDir: string;
let cwdSpy: ReturnType<typeof vi.spyOn>;
let exitSpy: ReturnType<typeof vi.spyOn>;
let logSpy: ReturnType<typeof vi.spyOn>;
let errSpy: ReturnType<typeof vi.spyOn>;
let origArgv1: string | undefined;

class ExitSignal extends Error {
  constructor(public code: number | string | null | undefined) {
    super(`process.exit(${code})`);
  }
}

function writeContent(rel: string, body: string) {
  const abs = path.join(caseDir, "docs", "content", rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, body);
}

function writePageMap(src: string) {
  const abs = path.join(caseDir, "src", "app", "docs", "page-map.ts");
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, src);
}

const EMPTY_PAGE_MAP = "export const nothing = 1\n";

async function runChecker(): Promise<{
  exitCode: number | null;
  out: string;
  err: string;
}> {
  vi.resetModules();
  let exitCode: number | null = null;
  try {
    await import("./check-internal-links");
  } catch (e) {
    if (e instanceof ExitSignal) {
      exitCode = Number(e.code);
    } else {
      throw e;
    }
  }
  const join = (spy: { mock: { calls: unknown[][] } }) =>
    spy.mock.calls.map(c => c.map(String).join(" ")).join("\n");
  return { exitCode, out: join(logSpy), err: join(errSpy) };
}

beforeEach(() => {
  fs.mkdirSync(workRoot, { recursive: true });
  caseDir = fs.mkdtempSync(path.join(workRoot, "case-"));
  fs.mkdirSync(path.join(caseDir, "docs", "content"), { recursive: true });
  writePageMap(EMPTY_PAGE_MAP);

  cwdSpy = vi.spyOn(process, "cwd").mockReturnValue(caseDir);
  origArgv1 = process.argv[1];
  process.argv[1] = scriptPath;
  exitSpy = vi.spyOn(process, "exit").mockImplementation(((code?: number) => {
    throw new ExitSignal(code);
  }) as never);
  logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
  errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  cwdSpy.mockRestore();
  exitSpy.mockRestore();
  logSpy.mockRestore();
  errSpy.mockRestore();
  if (origArgv1 === undefined) {
    delete (process.argv as unknown as Record<number, string>)[1];
  } else {
    process.argv[1] = origArgv1;
  }
  fs.rmSync(caseDir, { recursive: true, force: true });
});

describe("check-internal-links main()", () => {
  it("passes when every internal link resolves to a flat content route", async () => {
    writeContent(
      "hive/readme.md",
      [
        "[Getting started](getting-started.md)",
        "[Nested](./guide/setup)",
        "[Absolute](/docs/hive/guide/setup)",
        "[With fragment](getting-started.md#install)",
        "[With query](getting-started?tab=1)",
      ].join("\n")
    );
    writeContent("hive/getting-started.md", "# GS\n");
    writeContent("hive/guide/setup.mdx", "# Setup\n");

    const r = await runChecker();

    expect(r.exitCode).toBeNull();
    expect(exitSpy).not.toHaveBeenCalled();
    expect(r.out).toMatch(/Checked 5 internal links .* against 3 routes\./);
    expect(r.out).toContain("No broken internal links.");
    expect(r.err).toBe("");
  });

  it("ignores external, protocol-relative, mailto, pure-anchor and asset links", async () => {
    writeContent(
      "hive/readme.md",
      [
        "[ext](https://example.com/x)",
        "[proto](//cdn.example.com/y)",
        "[mail](mailto:team@example.com)",
        "[anchor](#section)",
        "[query-only](?tab=2)",
        "![img](images/diagram.png)",
        "[pdf](/docs/hive/spec.PDF)",
        "[real](other.md)",
      ].join("\n")
    );
    writeContent("hive/other.md", "# other\n");

    const r = await runChecker();

    expect(r.exitCode).toBeNull();
    // Only the one real doc link is counted.
    expect(r.out).toMatch(/Checked 1 internal links/);
  });

  it("reports each broken link with its file, raw target and resolved route, then exits 1", async () => {
    writeContent(
      "hive/readme.md",
      [
        "[missing](missing-page.md)",
        "[missing-abs](/docs/pluk/nope)",
        "[ok](ok.md)",
      ].join("\n")
    );
    writeContent("hive/ok.md", "# ok\n");

    const r = await runChecker();

    expect(r.exitCode).toBe(1);
    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(r.err).toContain("Found 2 broken internal link(s)");
    expect(r.err).toContain("docs/content/hive/readme.md");
    expect(r.err).toContain("link: missing-page.md");
    expect(r.err).toContain("resolves to (no route): /docs/hive/missing-page");
    expect(r.err).toContain("link: /docs/pluk/nope");
    expect(r.err).toContain("resolves to (no route): /docs/pluk/nope");
    expect(r.err).toContain("use an absolute GitHub URL instead");
    // The summary line is still printed before the failure report.
    expect(r.out).toMatch(/Checked 3 internal links/);
    expect(r.out).not.toContain("No broken internal links.");
  });

  it("resolves reference-style link definitions and parent-relative paths", async () => {
    writeContent(
      "hive/guide/setup.md",
      [
        "See [the intro][intro] and [bad][bad].",
        "",
        "[intro]: ../readme.md",
        "[bad]: ../../nowhere",
      ].join("\n")
    );
    writeContent("hive/readme.md", "# intro\n");

    const r = await runChecker();

    expect(r.exitCode).toBe(1);
    expect(r.out).toMatch(/Checked 2 internal links/);
    expect(r.err).toContain("Found 1 broken internal link(s)");
    expect(r.err).toContain("link: ../../nowhere");
    expect(r.err).toContain("resolves to (no route): /docs/nowhere");
    expect(r.err).not.toContain("link: ../readme.md");
  });

  it("treats trailing-slash and .mdx-suffixed links as the same route", async () => {
    writeContent(
      "hive/readme.md",
      [
        "[slash](/docs/hive/guide/)",
        "[mdx](guide.mdx)",
        "[MD upper](GUIDE2.MD)",
      ].join("\n")
    );
    writeContent("hive/guide.mdx", "# g\n");
    writeContent("hive/GUIDE2.md", "# g2\n");

    const r = await runChecker();

    expect(r.exitCode).toBeNull();
    expect(r.out).toMatch(/Checked 3 internal links .* against 3 routes\./);
  });

  it("skips dotfolders and node_modules while walking content", async () => {
    writeContent("hive/readme.md", "[ok](ok.md)\n");
    writeContent("hive/ok.md", "# ok\n");
    writeContent(".hidden/broken.md", "[bad](does-not-exist.md)\n");
    writeContent("node_modules/pkg/broken.md", "[bad](does-not-exist.md)\n");
    // Non-markdown files are neither routes nor scanned for links.
    writeContent("hive/notes.txt", "[bad](does-not-exist.md)\n");

    const r = await runChecker();

    expect(r.exitCode).toBeNull();
    expect(r.out).toMatch(/Checked 1 internal links .* against 2 routes\./);
  });

  it("registers only the real nav route when its file exists", async () => {
    writePageMap(`
type NavItem = { [key: string]: string } | string
const NAV_STRUCTURE_HIVE: Array<{ title: string; items: NavItem[] }> = [
  {
    title: 'Overview',
    items: [
      { 'Introduction': 'readme.md' },
      { 'Ghost Page': 'ghost.md' },
      { 'External': 'https://example.com/x.md' },
    ]
  },
]
`);
    writeContent("hive/readme.md", "# intro\n");
    writeContent(
      "pluk/links.md",
      [
        "[sectioned alias](/docs/hive/overview/introduction)",
        "[bare alias](/docs/hive/introduction)",
        "[ghost sectioned](/docs/hive/overview/ghost-page)",
        "[ghost bare](/docs/hive/ghost-page)",
      ].join("\n")
    );

    const r = await runChecker();

    // Two flat routes plus the one real sidebar route for readme.md.
    expect(r.out).toMatch(/Checked 4 internal links .* against 3 routes\./);
    expect(r.exitCode).toBe(1);
    expect(r.err).toContain("Found 3 broken internal link(s)");
    expect(r.err).toContain("resolves to (no route): /docs/hive/introduction");
    expect(r.err).toContain(
      "resolves to (no route): /docs/hive/overview/ghost-page"
    );
    expect(r.err).toContain("resolves to (no route): /docs/hive/ghost-page");
  });

  it("accepts a nested sidebar URL and rejects a cross-section alias", async () => {
    writePageMap(`
const NAV_STRUCTURE_HIVE = [
  { title: 'Reference', items: [
    { 'Architecture Decision Records': [
      { 'ADR index': 'adr/readme.md' },
    ] },
  ] },
  { title: 'Security', items: [] },
]
`);
    writeContent("hive/adr/readme.md", "# ADRs\n");
    writeContent(
      "hive/links.md",
      "[real](/docs/hive/reference/architecture-decision-records/adr-index)\n" +
        "[invented](/docs/hive/security/adr-index)\n"
    );

    const r = await runChecker();
    expect(r.out).toMatch(/Checked 2 internal links .* against 3 routes\./);
    expect(r.err).toContain("Found 1 broken internal link(s)");
    expect(r.err).toContain(
      "resolves to (no route): /docs/hive/security/adr-index"
    );
  });

  it("resolves GENERAL nav entries against docs/content directly", async () => {
    writePageMap(`
const NAV_STRUCTURE_GENERAL: Array<{ title: string; items: NavItem[] }> = [
  {
    title: 'Community',
    items: [
      { 'Community meetings': 'community/meetings.md' },
    ]
  }
]
`);
    writeContent("community/meetings.md", "# meetings\n");
    writeContent(
      "hive/readme.md",
      [
        "[alias](/docs/community/meetings)",
        "[flat](/docs/community/meetings)",
      ].join("\n")
    );

    const r = await runChecker();

    expect(r.exitCode).toBeNull();
    // The nav route coincides with the direct route for this general file.
    expect(r.out).toMatch(/Checked 2 internal links .* against 2 routes\./);
  });

  it("does not register a project alias for a file outside that project", async () => {
    writePageMap(`
const NAV_STRUCTURE_PLUK: Array<{ title: string; items: NavItem[] }> = [
  { title: 'Guides', items: [ { 'Shared Guide': 'shared.md' } ] }
]
`);
    // shared.md lives at docs/content/shared.md, not docs/content/pluk/shared.md.
    writeContent("shared.md", "# shared\n");
    writeContent("hive/readme.md", "[alias](/docs/pluk/guides/shared-guide)\n");

    const r = await runChecker();

    expect(r.exitCode).toBe(1);
    expect(r.out).toMatch(/Checked 1 internal links .* against 2 routes\./);
    expect(r.err).toContain(
      "resolves to (no route): /docs/pluk/guides/shared-guide"
    );
  });

  it("ignores NAV_STRUCTURE blocks with no PROJECT_FOR_NAV mapping", async () => {
    writePageMap(`
const NAV_STRUCTURE_UNKNOWN: Array<{ title: string; items: NavItem[] }> = [
  { title: 'Sec', items: [ { 'Thing': 'thing.md' } ] }
]
`);
    writeContent("hive/thing.md", "# thing\n");
    writeContent("hive/readme.md", "[alias](/docs/hive/sec/thing)\n");

    const r = await runChecker();

    expect(r.exitCode).toBe(1);
    expect(r.out).toMatch(/against 2 routes\./);
    expect(r.err).toContain("resolves to (no route): /docs/hive/sec/thing");
  });

  it("does not run main() when imported as a library (not the entry module)", async () => {
    process.argv[1] = path.join(caseDir, "somewhere-else.ts");
    writeContent("hive/readme.md", "[bad](nope.md)\n");

    const r = await runChecker();

    expect(r.exitCode).toBeNull();
    expect(exitSpy).not.toHaveBeenCalled();
    expect(r.out).toBe("");
    expect(r.err).toBe("");
  });
});
