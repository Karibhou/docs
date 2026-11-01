import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Drives scripts/sync-hive-docs.ts main() end to end, IN PROCESS, the same
// way scripts/check-internal-links.main.test.ts does: point process.cwd() at
// a throwaway dir, set process.argv[1] so the direct-run guard fires, replace
// globalThis.fetch with a scripted stub, and dynamic-import the module after
// vi.resetModules(). main() is fire-and-forget at module top level, so each
// case waits for either the final `synced` log line or process.exit.

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);
const scriptPath = path.join(repoRoot, "scripts", "sync-hive-docs.ts");
const workRoot = path.join(repoRoot, ".test-work", "sync-hive-docs");

const ENV_KEYS = [
  "HIVE_DOCS_OWNER",
  "HIVE_DOCS_REPO",
  "HIVE_DOCS_REF",
] as const;

let caseDir: string;
let cwdSpy: ReturnType<typeof vi.spyOn>;
let exitSpy: ReturnType<typeof vi.spyOn>;
let logSpy: ReturnType<typeof vi.spyOn>;
let errSpy: ReturnType<typeof vi.spyOn>;
let origArgv1: string | undefined;
let origFetch: typeof globalThis.fetch;
let origEnv: Partial<Record<(typeof ENV_KEYS)[number], string | undefined>>;
let fetched: string[];

type Responder = (url: string) => string | null;

/** Install a fetch stub: `responder` returns the body, or null for a 404. */
function stubFetch(responder: Responder) {
  fetched = [];
  globalThis.fetch = (async (input: string | URL | Request) => {
    const url = String(input instanceof Request ? input.url : input);
    fetched.push(url);
    const body = responder(url);
    if (body === null) {
      return new Response("missing", { status: 404, statusText: "Not Found" });
    }
    return new Response(body, { status: 200 });
  }) as typeof fetch;
}

function sourceOf(url: string): string {
  return url.replace(/^.*\/src\/docs\//, "");
}

function joinCalls(spy: { mock: { calls: unknown[][] } }): string {
  return spy.mock.calls.map(c => c.map(String).join(" ")).join("\n");
}

async function runSync(): Promise<{ out: string; err: string }> {
  vi.resetModules();
  await import("./sync-hive-docs");
  // main() runs detached from the import promise; settle on completion.
  await vi.waitFor(
    () => {
      const done =
        exitSpy.mock.calls.length > 0 ||
        joinCalls(logSpy).includes("adr/0026-sandbox-runtime-selection.md");
      if (!done) throw new Error("sync still running");
    },
    { timeout: 5_000, interval: 5 }
  );
  return { out: joinCalls(logSpy), err: joinCalls(errSpy) };
}

function outPath(target: string): string {
  return path.join(caseDir, "docs", "content", "hive", target);
}

function readOut(target: string): string {
  return fs.readFileSync(outPath(target), "utf8");
}

beforeEach(() => {
  fs.mkdirSync(workRoot, { recursive: true });
  caseDir = fs.mkdtempSync(path.join(workRoot, "case-"));

  origEnv = {};
  for (const k of ENV_KEYS) {
    origEnv[k] = process.env[k];
    delete process.env[k];
  }
  origFetch = globalThis.fetch;
  cwdSpy = vi.spyOn(process, "cwd").mockReturnValue(caseDir);
  origArgv1 = process.argv[1];
  process.argv[1] = scriptPath;
  exitSpy = vi
    .spyOn(process, "exit")
    .mockImplementation((() => undefined) as never);
  logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
  errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  globalThis.fetch = origFetch;
  cwdSpy.mockRestore();
  exitSpy.mockRestore();
  logSpy.mockRestore();
  errSpy.mockRestore();
  for (const k of ENV_KEYS) {
    if (origEnv[k] === undefined) delete process.env[k];
    else process.env[k] = origEnv[k];
  }
  if (origArgv1 === undefined) {
    delete (process.argv as unknown as Record<number, string>)[1];
  } else {
    process.argv[1] = origArgv1;
  }
  fs.rmSync(caseDir, { recursive: true, force: true });
});

describe("sync-hive-docs main()", () => {
  it("does not run the sync when imported rather than executed", async () => {
    process.argv[1] = path.join(repoRoot, "scripts", "something-else.ts");
    stubFetch(() => "# never\n");

    vi.resetModules();
    await import("./sync-hive-docs");
    await new Promise(r => setTimeout(r, 20));

    expect(fetched).toEqual([]);
    expect(fs.existsSync(path.join(caseDir, "docs"))).toBe(false);
  });

  it("writes every synced page under docs/content/hive with the canonical header", async () => {
    stubFetch(url => `# ${sourceOf(url)}\n`);

    const { out, err } = await runSync();

    expect(err).toBe("");
    expect(exitSpy).not.toHaveBeenCalled();

    // Every fetch targets the default owner/repo/branch under src/docs.
    expect(fetched.length).toBeGreaterThan(30);
    for (const u of fetched) {
      expect(u).toMatch(
        /^https:\/\/raw\.githubusercontent\.com\/hivecommons\/hive\/v5\/src\/docs\//
      );
    }
    expect(new Set(fetched).size).toBe(fetched.length);

    // Explicit `target` renames and nested directories are honoured.
    expect(fs.existsSync(outPath("readme.md"))).toBe(true);
    expect(fs.existsSync(outPath("README.md"))).toBe(false);
    expect(fs.existsSync(outPath("backup-dr.md"))).toBe(true);
    expect(fs.existsSync(outPath("backup-restore.md"))).toBe(false);
    expect(fs.existsSync(outPath("adr/readme.md"))).toBe(true);
    expect(
      fs.existsSync(outPath("integrations/work-source-providers.md"))
    ).toBe(true);
    for (const sub of [
      "dashboard-sections/overview-and-metrics.md",
      "dashboard-sections/workflow-and-agents.md",
      "dashboard-sections/activity-monitor.md",
      "labels-and-control-signals/reference.md",
      "labels-and-control-signals/stage-labels.md",
      "labels-and-control-signals/glossary-and-operations.md",
    ]) {
      expect(fs.existsSync(outPath(sub))).toBe(true);
    }

    // One output file per fetched source.
    const written = fs
      .readdirSync(outPath(""), { recursive: true, withFileTypes: true })
      .filter(d => d.isFile()).length;
    expect(written).toBe(fetched.length);

    const readme = readOut("readme.md");
    expect(
      readme.startsWith(
        "> **Synced from Hive.** This page is pulled from [hivecommons/hive@v5](https://github.com/hivecommons/hive/blob/v5/src/docs/README.md) during the docs build."
      )
    ).toBe(true);
    expect(readme).toContain(
      "Edit the canonical source in the Hive repository.\n\n# README.md\n"
    );

    const securityGuide = readOut("securing-your-hive.md");
    expect(securityGuide).toContain("/blob/v5/src/docs/securing-your-hive.md)");
    expect(securityGuide).toContain("# securing-your-hive.md\n");

    const backup = readOut("backup-dr.md");
    expect(backup).toContain("/blob/v5/src/docs/backup-restore.md)");
    expect(backup).toContain("# backup-restore.md\n");

    expect(out).toContain("synced README.md -> docs/content/hive/readme.md");
    expect(out).toContain(
      "synced backup-restore.md -> docs/content/hive/backup-dr.md"
    );
    expect(out).toContain(
      "synced adr/README.md -> docs/content/hive/adr/readme.md"
    );
    expect(out.match(/^synced /gm)?.length).toBe(fetched.length);
  });

  it("rewrites GitHub-relative links, scrubs legacy branding and normalises fences", async () => {
    stubFetch(url => {
      if (sourceOf(url) === "architecture.md") {
        return [
          "# Arch",
          "See [roadmap](roadmap.md#phases) and [bin](../../bin/README.md).",
          "Visit https://hive.kubestellar.io and github.com/kubestellar/hive.",
          "KubeStellar rocks.",
          "```",
          "plain fence",
          "```",
          "",
        ].join("\n");
      }
      return `# ${sourceOf(url)}\n`;
    });

    const { err } = await runSync();
    expect(err).toBe("");

    const arch = readOut("architecture.md");
    // Case 1: synced sibling -> site route, fragment preserved.
    expect(arch).toContain("[roadmap](/docs/hive/roadmap#phases)");
    // Case 2: repo escape -> absolute GitHub URL on the sync branch.
    expect(arch).toContain(
      "[bin](https://github.com/hivecommons/hive/blob/v5/bin/README.md)"
    );
    // Legacy branding scrub runs on the synced body.
    expect(arch).toContain("https://hive.hivecommons.dev");
    expect(arch).toContain("github.com/hivecommons/hive.");
    expect(arch).toContain("Hive Commons rocks.");
    expect(arch).not.toMatch(/kubestellar/i);
    // Bare fences get a language tag so MDX rendering is stable.
    expect(arch).toContain("```text\nplain fence\n```");
  });

  it("honours HIVE_DOCS_OWNER / HIVE_DOCS_REPO / HIVE_DOCS_REF overrides", async () => {
    process.env.HIVE_DOCS_OWNER = "someone";
    process.env.HIVE_DOCS_REPO = "hive-fork";
    process.env.HIVE_DOCS_REF = "v6";
    stubFetch(url => `# ${sourceOf(url)}\n[bin](../../bin/README.md)\n`);

    const { err } = await runSync();
    expect(err).toBe("");

    for (const u of fetched) {
      expect(u).toMatch(
        /^https:\/\/raw\.githubusercontent\.com\/someone\/hive-fork\/v6\/src\/docs\//
      );
    }
    const readme = readOut("readme.md");
    expect(readme).toContain(
      "[hivecommons/hive@v6](https://github.com/someone/hive-fork/blob/v6/src/docs/README.md)"
    );
    expect(readme).toContain(
      "[bin](https://github.com/someone/hive-fork/blob/v6/bin/README.md)"
    );
  });

  it("fails the build with the failing URL and status when any page cannot be fetched", async () => {
    stubFetch(url =>
      sourceOf(url) === "roadmap.md" ? null : `# ${sourceOf(url)}\n`
    );

    const { out, err } = await runSync();

    expect(exitSpy).toHaveBeenCalledTimes(1);
    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(err).toContain(
      "failed to fetch https://raw.githubusercontent.com/hivecommons/hive/v5/src/docs/roadmap.md: 404 Not Found"
    );

    // Pages ahead of the failure were written; the failing page and everything
    // after it were not — the prebuild fallback keeps the committed copies.
    expect(fs.existsSync(outPath("readme.md"))).toBe(true);
    expect(fs.existsSync(outPath("architecture.md"))).toBe(true);
    expect(fs.existsSync(outPath("roadmap.md"))).toBe(false);
    expect(fs.existsSync(outPath("landscape.md"))).toBe(false);
    expect(fs.existsSync(outPath("adr"))).toBe(false);
    expect(out).toContain("synced architecture.md");
    expect(out).not.toContain("synced roadmap.md");
    expect(fetched[fetched.length - 1]).toMatch(/\/roadmap\.md$/);
  });
});
