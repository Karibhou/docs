import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Drives the CLI entry of scripts/npm-audit-gate.ts IN PROCESS, the way
// npm-audit.yml invokes it (`npx tsx scripts/npm-audit-gate.ts audit.json`).
// The module calls main() only when process.argv[1] is its own path, so each
// case:
//   1. sets process.argv to [node, <script>, ...args],
//   2. points process.cwd() at a temp dir (no .github/npm-audit-exceptions.json),
//   3. stubs process.exit and console.{log,error},
//   4. vi.resetModules() + dynamic import() to re-run the top-level code.
// Running in process (same approach as check-deploy-preview-ignore.main.test.ts)
// lets v8 attribute coverage to the entry block itself; the main() unit tests
// in npm-audit-gate.test.ts cannot reach it because they import the module
// with a foreign argv[1].

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);
const scriptPath = path.join(repoRoot, "scripts", "npm-audit-gate.ts");

const CLEAN_REPORT = {
  vulnerabilities: {},
  metadata: { vulnerabilities: { total: 0 } },
};

const HIGH_REPORT = {
  vulnerabilities: {
    zod: {
      name: "zod",
      severity: "high",
      via: [
        {
          source: 1,
          name: "zod",
          title: "Denial of service",
          url: "https://github.com/advisories/GHSA-mrhx-c7xc-m3w5",
          severity: "high",
        },
      ],
    },
  },
};

let dir: string;
let origArgv: string[];
let cwdSpy: ReturnType<typeof vi.spyOn>;
let exitSpy: ReturnType<typeof vi.spyOn>;
let logSpy: ReturnType<typeof vi.spyOn>;
let errSpy: ReturnType<typeof vi.spyOn>;

function writeReport(data: unknown): string {
  const abs = path.join(dir, "audit.json");
  fs.writeFileSync(abs, JSON.stringify(data));
  return abs;
}

async function runEntry(argv1: string, ...args: string[]): Promise<void> {
  process.argv = [process.execPath, argv1, ...args];
  vi.resetModules();
  await import("./npm-audit-gate");
}

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "npm-audit-gate-entry-"));
  origArgv = process.argv;
  cwdSpy = vi.spyOn(process, "cwd").mockReturnValue(dir);
  exitSpy = vi
    .spyOn(process, "exit")
    .mockImplementation((() => undefined) as never);
  logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
  errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  process.argv = origArgv;
  cwdSpy.mockRestore();
  exitSpy.mockRestore();
  logSpy.mockRestore();
  errSpy.mockRestore();
  fs.rmSync(dir, { recursive: true, force: true });
});

describe("npm-audit-gate CLI entry", () => {
  it("does nothing when imported as a library (argv[1] is another file)", async () => {
    await runEntry(path.join(repoRoot, "scripts", "something-else.ts"));
    expect(exitSpy).not.toHaveBeenCalled();
    expect(logSpy).not.toHaveBeenCalled();
    expect(errSpy).not.toHaveBeenCalled();
  });

  it("does nothing when argv[1] is absent", async () => {
    process.argv = [process.execPath];
    vi.resetModules();
    await import("./npm-audit-gate");
    expect(exitSpy).not.toHaveBeenCalled();
    expect(logSpy).not.toHaveBeenCalled();
    expect(errSpy).not.toHaveBeenCalled();
  });

  it("reads the report path from process.argv and passes a clean report", async () => {
    const report = writeReport(CLEAN_REPORT);
    await runEntry(scriptPath, report);
    expect(exitSpy).not.toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalledWith(
      '✅ npm audit gate passed at level "high".'
    );
  });

  it("honours --level from process.argv and exits 1 on a blocking advisory", async () => {
    const report = writeReport(HIGH_REPORT);
    await runEntry(scriptPath, report, "--level=moderate");
    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(errSpy.mock.calls.flat().join("\n")).toMatch(
      /at or above "moderate" without an exception/
    );
  });

  it("exits 2 with usage when no report path is given", async () => {
    await runEntry(scriptPath);
    expect(exitSpy).toHaveBeenCalledWith(2);
    expect(errSpy.mock.calls.flat().join("\n")).toMatch(/^usage:/);
  });
});
