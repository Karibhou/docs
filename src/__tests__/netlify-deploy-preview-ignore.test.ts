// Guards the `[context.deploy-preview] ignore` rule in netlify.toml (#419).
// The rule is a shell `case` statement embedded in a TOML string, and Netlify
// and the CI drift gate both run it. Its failure mode is
// silent: Netlify skips the build only on exit 0, so a quoting slip or a
// dropped alternative does not break anything visible — it just lets the bot
// previews it was meant to suppress start draining build minutes again.
// Running the exact string under `sh` here is the earliest point that can
// be caught.
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { readDeployPreviewIgnore } from "../../scripts/check-deploy-preview-ignore";

const REPO_ROOT = join(__dirname, "..", "..");
const NETLIFY_TOML = readFileSync(join(REPO_ROOT, "netlify.toml"), "utf8");

// Mirrors what Netlify does with the ignore command: run it through `sh`
// with the deploy context's environment. HEAD is the PR head branch on a
// deploy preview; BRANCH is always set.
function runIgnore(
  command: string,
  env: { HEAD?: string; BRANCH?: string }
): number {
  const res = spawnSync("sh", ["-c", command], {
    env: { PATH: process.env.PATH ?? "/usr/bin:/bin", ...env },
    encoding: "utf8",
  });
  expect(res.error).toBeUndefined();
  expect(res.stderr).toBe("");
  return res.status ?? -1;
}

const SKIP = 0; // Netlify: exit 0 → skip the build
const BUILD = 1; // Netlify: any other exit → build

const ignore = readDeployPreviewIgnore(NETLIFY_TOML);

describe("netlify.toml [context.deploy-preview] ignore", () => {
  it("is present and is the bot-branch case statement", () => {
    expect(ignore).toBeDefined();
    expect(ignore).toMatch(/^case "\$\{HEAD:-\$BRANCH\}" in .* esac$/);
  });

  it("is valid sh (a quoting slip would fail open as exit 2 = build)", () => {
    const res = spawnSync("sh", ["-n", "-c", ignore!], { encoding: "utf8" });
    expect(res.stderr).toBe("");
    expect(res.status).toBe(0);
  });

  it.each([
    "arch/docs",
    "guide/adr-0025-walkthrough",
    "scanner/fix-419",
    "quality/test-netlify-ignore",
    "sec/fix-markdown-it-15-0-3",
    "outreach/docs-issue-forms",
    "ops/runbook-healthz-field",
    "automation/meeting-recordings-refresh",
    "hive/forward-merge",
    "dependabot/npm_and_yarn/next-16.4.1",
    "reviewer/docs",
    "feat/new-page",
    "fix/typo",
    "generated/update",
    "docs-rot-2026-10-24",
    "docs/runbook-postmortem-template",
  ])("skips the preview for bot branch %s", head => {
    expect(runIgnore(ignore!, { HEAD: head, BRANCH: head })).toBe(SKIP);
  });

  it.each([
    "main",
    "feature/new-landing",
    "docs/v1.2",
    // A human branch that merely contains a bot prefix must still build:
    // the patterns are anchored to the start of the branch name.
    "feature/scanner/dashboard",
    "mydocs-rot-update",
    "docs-rotation",
    "myquality/notes",
    "myops/notes",
    "myguide/notes",
  ])("builds the preview for non-bot branch %s", head => {
    expect(runIgnore(ignore!, { HEAD: head, BRANCH: head })).toBe(BUILD);
  });

  it("falls back to BRANCH when HEAD is unset", () => {
    expect(runIgnore(ignore!, { BRANCH: "scanner/fix-1" })).toBe(SKIP);
    expect(runIgnore(ignore!, { BRANCH: "main" })).toBe(BUILD);
  });

  it("prefers HEAD over BRANCH when both are set", () => {
    // On a deploy preview HEAD is the PR head; BRANCH may name the target.
    expect(runIgnore(ignore!, { HEAD: "scanner/fix-1", BRANCH: "main" })).toBe(
      SKIP
    );
    expect(runIgnore(ignore!, { HEAD: "main", BRANCH: "scanner/fix-1" })).toBe(
      BUILD
    );
  });

  it("builds when neither variable is set rather than silently skipping", () => {
    expect(runIgnore(ignore!, {})).toBe(BUILD);
  });
});
