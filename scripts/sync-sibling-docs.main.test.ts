import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PROJECTS, introduceSpekStyle } from "./sync-sibling-docs";

// Drives scripts/sync-sibling-docs.ts main() end to end, IN PROCESS, the same
// way scripts/sync-hive-docs.main.test.ts does: point process.cwd() at a
// throwaway dir, set process.argv[1] so the direct-run guard fires, replace
// globalThis.fetch with a scripted stub, and dynamic-import the module after
// vi.resetModules(). Running in process (rather than spawning tsx) lets the
// v8 coverage provider see main(), copyAssets() and renderPage().

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);
const scriptPath = path.join(repoRoot, "scripts", "sync-sibling-docs.ts");
const workRoot = path.join(repoRoot, ".test-work", "sync-sibling-docs");

const ENV_KEYS = [
  "SIBLING_DOCS_OWNER",
  "SPEKTACULAR_WEBSITE_DOCS_REF",
  "HOTSHOT_DOCS_REF",
  "PLUK_DOCS_REF",
  "RATIONGUARD_DOCS_REF",
  "PROMPTARGS_DOCS_REF",
  "DIBS_DOCS_REF",
  "SPEKTACULAR_DOCS_REF",
] as const;

let caseDir: string;
let cwdSpy: ReturnType<typeof vi.spyOn>;
let exitSpy: ReturnType<typeof vi.spyOn>;
let logSpy: ReturnType<typeof vi.spyOn>;
let warnSpy: ReturnType<typeof vi.spyOn>;
let errSpy: ReturnType<typeof vi.spyOn>;
let origArgv1: string | undefined;
let origFetch: typeof globalThis.fetch;
let origEnv: Partial<Record<(typeof ENV_KEYS)[number], string | undefined>>;
let fetchedUrls: string[];

type Responses = Record<
  string,
  string | { binary: string } | { status: number }
>;

/**
 * Install a fetch stub that serves `responses` keyed by the
 * raw.githubusercontent path after the host (e.g. "hivecommons/pluk/main/README.md").
 * Any URL not listed answers 404; a `{ status }` entry answers that status
 * with an empty body. Every fetched URL is recorded in `fetchedUrls` so tests
 * can assert what main() asked for.
 */
function stubFetch(responses: Responses) {
  fetchedUrls = [];
  globalThis.fetch = (async (input: string | URL | Request) => {
    const u = String(input instanceof Request ? input.url : input);
    fetchedUrls.push(u);
    const key = u.replace("https://raw.githubusercontent.com/", "");
    const hit = responses[key];
    if (hit === undefined) {
      return new Response("missing", { status: 404, statusText: "Not Found" });
    }
    if (typeof hit === "string") return new Response(hit, { status: 200 });
    if ("status" in hit) return new Response("", { status: hit.status });
    return new Response(Buffer.from(hit.binary, "base64"), { status: 200 });
  }) as typeof fetch;
}

function joinCalls(spy: { mock: { calls: unknown[][] } }): string {
  return spy.mock.calls.map(c => c.map(String).join(" ")).join("\n");
}

/**
 * Import the script (firing the direct-run guard) and settle once main() has
 * either exited or dealt with the last file of the last project — which is
 * logged as `synced` or warned as `skipped` / `removed stale`.
 */
async function runSync(): Promise<{ out: string; warn: string; err: string }> {
  const lastProject = PROJECTS[PROJECTS.length - 1];
  const lastFile = lastProject.files[lastProject.files.length - 1];
  vi.resetModules();
  await import("./sync-sibling-docs");
  await vi.waitFor(
    () => {
      const warned = joinCalls(warnSpy);
      const done =
        exitSpy.mock.calls.length > 0 ||
        joinCalls(logSpy).includes(
          `synced ${lastProject.project}/${lastFile.target}`
        ) ||
        warned.includes(`${lastFile.source} not found — skipped`) ||
        warned.includes(
          `${lastFile.source} not found — removed stale ${lastProject.project}/${lastFile.target}`
        );
      if (!done) throw new Error("sync still running");
    },
    { timeout: 5_000, interval: 5 }
  );
  return {
    out: joinCalls(logSpy),
    warn: joinCalls(warnSpy),
    err: joinCalls(errSpy),
  };
}

function fetched(): string[] {
  return fetchedUrls;
}

function outPath(project: string, target: string): string {
  return path.join(caseDir, "docs", "content", project, target);
}

/** Minimal response set: every required readme answers so main() completes. */
function allReadmes(): Responses {
  const r: Responses = {};
  for (const p of PROJECTS) {
    for (const f of p.files) {
      if (!f.required) continue;
      const repo = f.repo ?? p;
      r[`${repo.owner}/${repo.repo}/${repo.branch}/${f.source}`] =
        `# ${p.project}\n\nSee [guide](docs/GUIDE.md).\n`;
    }
  }
  return r;
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
  warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  globalThis.fetch = origFetch;
  cwdSpy.mockRestore();
  exitSpy.mockRestore();
  logSpy.mockRestore();
  warnSpy.mockRestore();
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

describe("sync-sibling-docs main()", () => {
  it("does not run the sync when imported rather than executed", async () => {
    process.argv[1] = path.join(repoRoot, "scripts", "something-else.ts");
    stubFetch(allReadmes());

    vi.resetModules();
    await import("./sync-sibling-docs");
    await new Promise(r => setTimeout(r, 20));

    expect(fetched()).toEqual([]);
    expect(fs.existsSync(path.join(caseDir, "docs"))).toBe(false);
  });

  it("fails the build when a required readme is missing", async () => {
    const responses = allReadmes();
    delete responses["hivecommons/pluk/main/README.md"];
    stubFetch(responses);
    const { err } = await runSync();

    expect(exitSpy).toHaveBeenCalledTimes(1);
    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(err).toContain("hivecommons/pluk@main/README.md not found");
    // hotshot (listed before pluk) was still written; nothing after pluk was attempted.
    expect(fs.existsSync(outPath("hotshot", "readme.md"))).toBe(true);
    expect(fs.existsSync(outPath("rationguard", "readme.md"))).toBe(false);
  });

  it("skips optional pages that 404 with a warning and writes the rest", async () => {
    stubFetch(allReadmes());
    const { out, warn } = await runSync();

    expect(exitSpy).not.toHaveBeenCalled();
    expect(warn).toContain(
      "hivecommons/hotshot@main/linux/README.md not found — skipped"
    );
    expect(warn).toContain(
      "hivecommons/spektacular@main/docs/knowledge-base.md not found — skipped"
    );
    for (const p of PROJECTS) {
      expect(fs.existsSync(outPath(p.project, "readme.md"))).toBe(true);
    }
    expect(fs.existsSync(outPath("hotshot", "linux.md"))).toBe(false);
    expect(fs.existsSync(outPath("spektacular", "getting-started.md"))).toBe(
      false
    );
    expect(out).toContain(
      "synced pluk/readme.md <- hivecommons/pluk/README.md"
    );
  });

  it("removes a previously synced optional page once its upstream source 404s", async () => {
    const stale = outPath("hotshot", "linux.md");
    fs.mkdirSync(path.dirname(stale), { recursive: true });
    fs.writeFileSync(stale, "stale upstream copy\n");
    stubFetch(allReadmes());
    const { warn } = await runSync();

    expect(exitSpy).not.toHaveBeenCalled();
    expect(fs.existsSync(stale)).toBe(false);
    expect(warn).toContain(
      "hivecommons/hotshot@main/linux/README.md not found — removed stale hotshot/linux.md"
    );
  });

  it("prunes assets copied for a removed optional page but keeps ones another page uses", async () => {
    const stale = outPath("hotshot", "linux.md");
    const own = outPath("hotshot", "images/linux-only.png");
    const shared = outPath("hotshot", "images/shared.png");
    fs.mkdirSync(path.dirname(own), { recursive: true });
    fs.writeFileSync(own, "png");
    fs.writeFileSync(shared, "png");
    fs.writeFileSync(
      stale,
      "![a](images/linux-only.png)\n![b](images/shared.png)\n"
    );
    const other = outPath("hotshot", "windows.md");
    fs.writeFileSync(other, "![c](images/shared.png)\n");
    const responses = allReadmes();
    responses["hivecommons/hotshot/main/windows/README.md"] = { status: 500 };
    stubFetch(responses);
    await runSync();

    expect(fs.existsSync(stale)).toBe(false);
    expect(fs.existsSync(own)).toBe(false);
    expect(fs.existsSync(shared)).toBe(true);
  });

  it.each([429, 500])(
    "keeps a previously synced optional page when its source answers %i",
    async status => {
      const live = outPath("hotshot", "linux.md");
      fs.mkdirSync(path.dirname(live), { recursive: true });
      fs.writeFileSync(live, "live committed copy\n");
      const responses = allReadmes();
      responses["hivecommons/hotshot/main/linux/README.md"] = { status };
      stubFetch(responses);
      const { warn } = await runSync();

      expect(exitSpy).not.toHaveBeenCalled();
      expect(fs.existsSync(live)).toBe(true);
      expect(fs.readFileSync(live, "utf8")).toBe("live committed copy\n");
      expect(warn).toContain(
        "hivecommons/hotshot@main/linux/README.md not found — skipped"
      );
      expect(warn).not.toContain("removed stale");
    }
  );

  it("keeps a required page's existing copy and still fails when its source 404s", async () => {
    const existing = outPath("pluk", "readme.md");
    fs.mkdirSync(path.dirname(existing), { recursive: true });
    fs.writeFileSync(existing, "existing\n");
    const responses = allReadmes();
    delete responses["hivecommons/pluk/main/README.md"];
    stubFetch(responses);
    const { err } = await runSync();

    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(err).toContain("hivecommons/pluk@main/README.md not found");
    expect(fs.existsSync(existing)).toBe(true);
  });

  it("writes markdown pages with the synced header and rewritten links", async () => {
    const responses = allReadmes();
    responses["hivecommons/pluk/main/ROADMAP.md"] =
      "# Roadmap\n\nBack to the [readme](README.md#install) or [source](src/main.go).\n";
    stubFetch(responses);
    await runSync();

    expect(exitSpy).not.toHaveBeenCalled();
    const roadmap = fs.readFileSync(outPath("pluk", "roadmap.md"), "utf8");
    expect(
      roadmap.startsWith(
        "> **Synced from pluk.** This page is pulled from [hivecommons/pluk@main](https://github.com/hivecommons/pluk/blob/main/ROADMAP.md)"
      )
    ).toBe(true);
    expect(roadmap).toContain("[readme](/docs/pluk/readme#install)");
    expect(roadmap).toContain(
      "[source](https://github.com/hivecommons/pluk/blob/main/src/main.go)"
    );
  });

  it("syncs the dibs roadmap and docs/ reference pages with links resolved from docs/", async () => {
    const responses = allReadmes();
    responses["hivecommons/dibs/main/ROADMAP.md"] = "# Roadmap\n";
    responses["hivecommons/dibs/main/docs/credit-wall-api.md"] =
      "# Credit wall\n\nSee [server](../server.json) and [token](../README.md#token).\n";
    responses["hivecommons/dibs/main/docs/mcp-registry.md"] = "# MCP\n";
    stubFetch(responses);
    await runSync();

    expect(exitSpy).not.toHaveBeenCalled();
    expect(fs.existsSync(outPath("dibs", "roadmap.md"))).toBe(true);
    expect(fs.existsSync(outPath("dibs", "mcp-registry.md"))).toBe(true);
    const api = fs.readFileSync(outPath("dibs", "credit-wall-api.md"), "utf8");
    expect(
      api.startsWith(
        "> **Synced from dibs.** This page is pulled from [hivecommons/dibs@main](https://github.com/hivecommons/dibs/blob/main/docs/credit-wall-api.md)"
      )
    ).toBe(true);
    expect(api).toContain(
      "[server](https://github.com/hivecommons/dibs/blob/main/server.json)"
    );
    expect(api).toContain("[token](/docs/dibs/readme#token)");
    expect(fs.existsSync(outPath("dibs", "casefold-gate.md"))).toBe(false);
  });

  it("honours *_DOCS_REF overrides when choosing the branch to fetch", async () => {
    const responses = allReadmes();
    delete responses["hivecommons/pluk/main/README.md"];
    responses["hivecommons/pluk/v2/README.md"] = "# pluk v2\n";
    stubFetch(responses);
    process.env.PLUK_DOCS_REF = "v2";
    await runSync();

    expect(exitSpy).not.toHaveBeenCalled();
    expect(fetched()).toContain(
      "https://raw.githubusercontent.com/hivecommons/pluk/v2/README.md"
    );
    expect(fs.readFileSync(outPath("pluk", "readme.md"), "utf8")).toContain(
      "hivecommons/pluk@v2"
    );
  });

  describe("mdx pages from spektacular-website", () => {
    const png = Buffer.from("89504e470d0a1a0a", "hex").toString("base64");
    const mdx = [
      "---",
      "title: Getting started",
      "summary: First steps",
      "---",
      "",
      "![ok](/images/tutorials/ok.png)",
      "",
      "![missing](/images/tutorials/missing.png)",
      "",
      "![escape](/images/../../escape.png)",
      "",
      "Read the [guide](/guides/knowledge-base/).",
      "",
    ].join("\n");

    it("copies fetched images beside the page, links missing ones to the site, and refuses traversal", async () => {
      const responses = allReadmes();
      responses[
        "hivecommons/spektacular-website/main/src/content/tutorials/getting-started.mdx"
      ] = mdx;
      responses[
        "hivecommons/spektacular-website/main/public/images/tutorials/ok.png"
      ] = { binary: png };
      stubFetch(responses);
      const { warn } = await runSync();

      expect(exitSpy).not.toHaveBeenCalled();

      const copied = path.join(
        caseDir,
        "docs",
        "content",
        "spektacular",
        "images",
        "tutorials",
        "ok.png"
      );
      expect(fs.existsSync(copied)).toBe(true);
      expect(fs.readFileSync(copied).toString("base64")).toBe(png);

      const page = fs.readFileSync(
        outPath("spektacular", "getting-started.md"),
        "utf8"
      );
      expect(page).toContain("![ok](images/tutorials/ok.png)");
      expect(page).toContain(
        "![missing](https://spektacular.dev/images/tutorials/missing.png)"
      );
      expect(page).toContain(
        "![escape](https://spektacular.dev/images/../../escape.png)"
      );
      expect(page).toContain(
        "[guide](https://spektacular.dev/guides/knowledge-base/)"
      );
      expect(page).toContain("Synced from spektacular-website.");

      expect(warn).toContain(
        "public/images/tutorials/missing.png not found — linking to https://spektacular.dev/images/tutorials/missing.png"
      );
      expect(warn).toContain(
        "refusing to copy /images/../../escape.png outside"
      );

      // The traversal candidate is never fetched and never lands on disk.
      expect(fetched().some(u => u.includes("escape.png"))).toBe(false);
      expect(fs.existsSync(path.join(caseDir, "escape.png"))).toBe(false);
      expect(fs.existsSync(path.join(caseDir, "docs", "escape.png"))).toBe(
        false
      );
    });

    it("surfaces converter notes for the page and dedupes repeated images", async () => {
      const responses = allReadmes();
      responses[
        "hivecommons/spektacular-website/main/src/content/tutorials/getting-started.mdx"
      ] = [
        "---",
        "title: Getting started",
        "---",
        "",
        "import Thing from '../components/Thing.astro';",
        "",
        "<Thing />",
        "",
        "![a](/images/tutorials/ok.png)",
        "![b](/images/tutorials/ok.png)",
        "",
      ].join("\n");
      responses[
        "hivecommons/spektacular-website/main/public/images/tutorials/ok.png"
      ] = { binary: png };
      stubFetch(responses);
      const { warn } = await runSync();

      expect(exitSpy).not.toHaveBeenCalled();
      // A repeated image is fetched exactly once.
      expect(
        fetched().filter(u => u.endsWith("public/images/tutorials/ok.png"))
      ).toHaveLength(1);
      const page = fs.readFileSync(
        outPath("spektacular", "getting-started.md"),
        "utf8"
      );
      expect(page).toContain("![a](images/tutorials/ok.png)");
      expect(page).toContain("![b](images/tutorials/ok.png)");
      // Converter notes are reported against the project/target page.
      expect(warn).toMatch(
        /sync-sibling-docs: spektacular\/getting-started\.md: /
      );
    });
  });
});

describe("introduceSpekStyle", () => {
  it("leaves non-spektacular projects untouched", () => {
    const src = "Spektacular turns it into a plan.";
    expect(introduceSpekStyle("pluk", "readme.md", src)).toBe(src);
  });

  it("leaves spektacular targets with no replacement table untouched", () => {
    const src = "Spektacular turns it into a plan.";
    expect(introduceSpekStyle("spektacular", "knowledge-base.md", src)).toBe(
      src
    );
  });

  it("rewrites prose on the spektacular readme while keeping command names", () => {
    const src = [
      "Spektacular turns it into a plan.",
      "the central `spec`, `plan`, and `changelog` stores",
      "Spec names are normalised. Spec names are normalised.",
    ].join("\n");
    const out = introduceSpekStyle("spektacular", "readme.md", src);
    expect(out).toContain("Spek turns it into a plan.");
    expect(out).toContain("the central `spec`, `plan`, and `changelog` stores");
    // replaceAll: every occurrence is rewritten, not just the first.
    expect(out).toBe(
      "Spek turns it into a plan.\nthe central `spec`, `plan`, and `changelog` stores\nSpek names are normalised. Spek names are normalised."
    );
  });

  it("rewrites the getting-started tutorial with its own table", () => {
    const out = introduceSpekStyle(
      "spektacular",
      "getting-started.md",
      "In this tutorial you will see how Spektacular's agent works."
    );
    expect(out).toBe("In this tutorial you will see how Spek's agent works.");
  });
});
