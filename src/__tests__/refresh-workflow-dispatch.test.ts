// Guards the contract between the scheduled refresh workflows and the CI
// workflows they dispatch. PRs opened with GITHUB_TOKEN never get
// pull_request runs (#335, #337, #496), so meeting-recordings-refresh.yml and
// hive-docs-refresh.yml run `gh workflow run <wf>` for every entry in their
// REQUIRED_CHECK_WORKFLOWS list instead. That only works while each listed
// workflow still declares `on: workflow_dispatch`; dropping the trigger, or
// renaming a workflow file without updating the list, fails only inside the
// refresh run — the daily PR then sits without its required checks and never
// merges. Reading the files here is the earliest point that can be caught.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const WORKFLOWS_DIR = join(__dirname, "..", "..", ".github", "workflows");

const REFRESH_WORKFLOWS = [
  "meeting-recordings-refresh.yml",
  "hive-docs-refresh.yml",
];

function readWorkflow(name: string): string {
  return readFileSync(join(WORKFLOWS_DIR, name), "utf8");
}

// The list is a space-separated string under top-level `env:`; the dispatch
// step iterates it with `for wf in $REQUIRED_CHECK_WORKFLOWS`.
export function readRequiredCheckWorkflows(yaml: string): string[] | undefined {
  const m = yaml.match(/^\s*REQUIRED_CHECK_WORKFLOWS:\s*(.+?)\s*$/m);
  return m ? m[1].split(/\s+/).filter(Boolean) : undefined;
}

// Returns the trigger names under the top-level `on:` block. GitHub Actions
// accepts `on: push`, `on: [a, b]` and the mapping form; the CI workflows
// here all use the mapping form, and this reads only that shape so a change
// to another shape fails loudly instead of being silently accepted.
export function readTriggers(yaml: string): string[] {
  const lines = yaml.split("\n");
  const start = lines.findIndex(line => /^on:\s*$/.test(line));
  if (start === -1) return [];
  const triggers: string[] = [];
  for (const line of lines.slice(start + 1)) {
    if (/^\S/.test(line)) break; // next top-level key
    const m = line.match(/^ {2}([A-Za-z_][\w-]*):/);
    if (m) triggers.push(m[1]);
  }
  return triggers;
}

describe.each(REFRESH_WORKFLOWS)("%s dispatches required checks", refresh => {
  const yaml = readWorkflow(refresh);
  const required = readRequiredCheckWorkflows(yaml);

  it("declares a non-empty REQUIRED_CHECK_WORKFLOWS list", () => {
    expect(required).toBeDefined();
    expect(required!.length).toBeGreaterThan(0);
  });

  it("iterates that list in the dispatch step", () => {
    expect(yaml).toMatch(/for wf in \$REQUIRED_CHECK_WORKFLOWS;/);
    expect(yaml).toMatch(/gh workflow run "\$wf"/);
  });

  it.each(required ?? [])("lists an existing workflow file: %s", wf => {
    expect(existsSync(join(WORKFLOWS_DIR, wf))).toBe(true);
  });

  it.each(required ?? [])(
    "%s declares workflow_dispatch so `gh workflow run` is accepted",
    wf => {
      expect(readTriggers(readWorkflow(wf))).toContain("workflow_dispatch");
    }
  );

  it.each(required ?? [])(
    "%s also runs on pull_request, so it is a check a PR can require",
    wf => {
      expect(readTriggers(readWorkflow(wf))).toContain("pull_request");
    }
  );
});

describe("refresh workflows agree on the required-check list", () => {
  it("keeps both REQUIRED_CHECK_WORKFLOWS lists identical", () => {
    const lists = REFRESH_WORKFLOWS.map(wf =>
      [...(readRequiredCheckWorkflows(readWorkflow(wf)) ?? [])].sort()
    );
    for (const list of lists.slice(1)) {
      expect(list).toEqual(lists[0]);
    }
  });
});

describe("readTriggers", () => {
  it("reads mapping-form triggers and stops at the next top-level key", () => {
    const yaml = [
      "name: x",
      "",
      "on:",
      "  pull_request:",
      "    branches: [main]",
      "  # a comment",
      "  workflow_dispatch:",
      "",
      "permissions:",
      "  contents: read",
    ].join("\n");
    expect(readTriggers(yaml)).toEqual(["pull_request", "workflow_dispatch"]);
  });

  it("returns nothing for the scalar and list forms rather than guessing", () => {
    expect(readTriggers("on: push\njobs: {}")).toEqual([]);
    expect(readTriggers("on: [push, workflow_dispatch]\njobs: {}")).toEqual([]);
  });
});

describe("readRequiredCheckWorkflows", () => {
  it("splits the space-separated env value", () => {
    expect(
      readRequiredCheckWorkflows(
        "env:\n  REQUIRED_CHECK_WORKFLOWS: a.yml  b.yml\n"
      )
    ).toEqual(["a.yml", "b.yml"]);
  });

  it("is undefined when the env entry is missing", () => {
    expect(readRequiredCheckWorkflows("env:\n  OTHER: x\n")).toBeUndefined();
  });
});
