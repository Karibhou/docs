import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const workflow = readFileSync(
  join(__dirname, "../../.github/workflows/fossa.yml"),
  "utf8"
);
const step = workflow.split("      - name: Run FOSSA policy test\n")[1];
const command = step
  .split("        run: |\n")[1]
  .trimEnd()
  .split("\n")
  .map(line => line.slice(10))
  .join("\n");

describe("FOSSA policy workflow", () => {
  it.each([
    {
      name: "successful diff",
      message: "",
      diff: 0,
      full: 0,
      retry: false,
      status: 0,
    },
    {
      name: "missing base",
      message:
        "Error: Revision for locator (custom+162/hivecommons/docs$base) was not found.",
      diff: 1,
      full: 0,
      retry: true,
      status: 0,
    },
    {
      name: "full policy violation",
      message:
        "Error: Revision for locator (custom+162/hivecommons/docs$base) was not found.",
      diff: 1,
      full: 7,
      retry: true,
      status: 7,
    },
    {
      name: "diff policy violation",
      message: "License policy violation",
      diff: 1,
      full: 0,
      retry: false,
      status: 1,
    },
    {
      name: "service failure",
      message: "Unable to reach FOSSA",
      diff: 1,
      full: 0,
      retry: false,
      status: 1,
    },
    {
      name: "other locator error",
      message: "Revision for locator could not be fetched: unauthorized",
      diff: 1,
      full: 0,
      retry: false,
      status: 1,
    },
  ])("handles $name", ({ message, diff, full, retry, status }) => {
    const dir = mkdtempSync(join(tmpdir(), "fossa-policy-"));
    try {
      writeFileSync(
        join(dir, "fossa"),
        `#!/usr/bin/env bash
printf '%s\\n' "$*" >> "$CALLS"
if [[ "$*" == *"--diff"* ]]; then
  printf '%s\\n' "$MESSAGE" >&2
  exit "$DIFF_STATUS"
fi
exit "$FULL_STATUS"
`,
        { mode: 0o755 }
      );
      const calls = join(dir, "calls");
      const summary = join(dir, "summary");
      writeFileSync(summary, "");
      const result = spawnSync(
        "bash",
        ["--noprofile", "--norc", "-e", "-o", "pipefail", "-c", command],
        {
          encoding: "utf8",
          env: {
            ...process.env,
            PATH: `${dir}:${process.env.PATH}`,
            TMPDIR: dir,
            BASE_SHA: "base-sha",
            GITHUB_STEP_SUMMARY: summary,
            CALLS: calls,
            MESSAGE: message,
            DIFF_STATUS: String(diff),
            FULL_STATUS: String(full),
          },
        }
      );
      expect(result.error).toBeUndefined();
      expect(result.status).toBe(status);
      expect(readFileSync(calls, "utf8").trim().split("\n")).toEqual([
        "test --project hivecommons/docs --diff base-sha",
        ...(retry ? ["test --project hivecommons/docs"] : []),
      ]);
      expect(
        readFileSync(summary, "utf8").includes("running the full policy test")
      ).toBe(retry);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
