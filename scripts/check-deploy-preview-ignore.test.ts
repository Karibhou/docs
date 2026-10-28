import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { main, readDeployPreviewIgnore } from "./check-deploy-preview-ignore";

vi.mock("node:fs", async importOriginal => ({
  ...(await importOriginal<typeof import("node:fs")>()),
  readFileSync: vi.fn(
    (await importOriginal<typeof import("node:fs")>()).readFileSync
  ),
}));
vi.mock("node:child_process", async importOriginal => ({
  ...(await importOriginal<typeof import("node:child_process")>()),
  spawnSync: vi.fn(
    (await importOriginal<typeof import("node:child_process")>()).spawnSync
  ),
}));

afterEach(() => vi.clearAllMocks());

function rule(command: string): string {
  return `[context.deploy-preview]\nignore = ${JSON.stringify(command)}\n`;
}

describe("deploy-preview drift gate", () => {
  it.each(["User", "Organization", undefined])(
    "does not gate author type %s, even on an unknown lane",
    type => {
      expect(
        main({ PR_AUTHOR_TYPE: type, PR_HEAD_REF: "new-lane/topic" })
      ).toBe(0);
      expect(readFileSync).not.toHaveBeenCalled();
      expect(spawnSync).not.toHaveBeenCalled();
    }
  );

  it.each([
    "reviewer/topic",
    "feat/topic",
    "fix/topic",
    "generated/topic",
    "bot/hive-docs-refresh",
    "docs-rot-weekly",
  ])("accepts a Bot PR covered by the real rule: %s", head => {
    expect(main({ PR_AUTHOR_TYPE: "Bot", PR_HEAD_REF: head })).toBe(0);
  });

  it.each(["new-lane/topic", "topic", "feature/reviewer/topic"])(
    "rejects an uncovered Bot PR: %s",
    head => {
      expect(main({ PR_AUTHOR_TYPE: "Bot", PR_HEAD_REF: head })).toBe(1);
    }
  );

  it("fails when bot head metadata is missing", () => {
    expect(main({ PR_AUTHOR_TYPE: "Bot" })).toBe(1);
    expect(spawnSync).not.toHaveBeenCalled();
  });

  it("uses the current config, so adding a new lane resolves drift", () => {
    vi.mocked(readFileSync).mockReturnValueOnce(
      rule('case "${HEAD:-$BRANCH}" in new-lane/*) exit 0;; *) exit 1;; esac')
    );
    expect(main({ PR_AUTHOR_TYPE: "Bot", PR_HEAD_REF: "new-lane/topic" })).toBe(
      0
    );
  });

  it("keeps shell metacharacters in the branch inert and isolates the environment", () => {
    const head = "new-lane/$(exit 0);`exit 0`";
    expect(
      main({ PR_AUTHOR_TYPE: "Bot", PR_HEAD_REF: head, SECRET: "private" })
    ).toBe(1);
    expect(vi.mocked(spawnSync).mock.calls[0][2]).toEqual({
      env: {
        PATH: process.env.PATH,
        NODE_ENV: "production",
        HEAD: head,
        BRANCH: "main",
      },
      encoding: "utf8",
      timeout: 5000,
    });
  });

  it.each(["", "exit 1", 'case "broken', "kill -TERM $$"])(
    "fails closed for a missing, non-skipping, or broken rule: %s",
    command => {
      vi.mocked(readFileSync).mockReturnValueOnce(rule(command));
      expect(
        main({ PR_AUTHOR_TYPE: "Bot", PR_HEAD_REF: "reviewer/topic" })
      ).toBe(1);
    }
  );

  it("fails on a shell launch error or timeout", () => {
    vi.mocked(spawnSync).mockReturnValueOnce({
      error: new Error("spawn failed"),
      status: null,
      signal: null,
      stdout: "",
      stderr: "",
      output: [],
      pid: 0,
    });
    expect(main({ PR_AUTHOR_TYPE: "Bot", PR_HEAD_REF: "reviewer/topic" })).toBe(
      1
    );
  });
});

describe("readDeployPreviewIgnore", () => {
  it("ignores other contexts and comments", () => {
    expect(
      readDeployPreviewIgnore(
        '[build]\nignore = "exit 0"\n[context.deploy-preview]\n# comment\nignore = "exit 1"\n'
      )
    ).toBe("exit 1");
  });
  it.each([
    "",
    '[build]\nignore = "exit 0"',
    '[context.deploy-preview]\n[context.branch-deploy]\nignore = "exit 0"',
    "[context.deploy-preview]\n# empty",
  ])("does not borrow another context's rule: %s", toml =>
    expect(readDeployPreviewIgnore(toml)).toBeUndefined()
  );
  it("decodes quotes and backslashes", () => {
    const command =
      'case "${HEAD:-$BRANCH}" in bot/\\*) exit 0;; *) exit 1;; esac';
    expect(readDeployPreviewIgnore(rule(command))).toBe(command);
  });
  it("rejects malformed string escapes", () => {
    expect(() =>
      readDeployPreviewIgnore('[context.deploy-preview]\nignore = "\\q"')
    ).toThrow();
  });
});
