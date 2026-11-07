// Guards how the scheduled refresh workflows open their PRs. PRs opened with
// GITHUB_TOKEN get their pull_request runs held for maintainer approval
// (#293, #296, #335, #337, #496), so the daily PR sits without checks and
// never merges. meeting-recordings-refresh.yml and hive-docs-refresh.yml
// therefore mint a hive App installation token and hand it to
// peter-evans/create-pull-request; App-opened PRs run CI normally, which
// also made the old `gh workflow run` dispatch hack (and its `actions:
// write` grant) unnecessary. Reading the files here is the earliest point a
// regression to either can be caught.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const WORKFLOWS_DIR = join(__dirname, "..", "..", ".github", "workflows");

const REFRESH_WORKFLOWS = [
  "meeting-recordings-refresh.yml",
  "hive-docs-refresh.yml",
];

const APP_TOKEN_STEP_ID = "app-token";
const SHA_PIN = /@[0-9a-f]{40}\b/;

function readWorkflow(name: string): string {
  return readFileSync(join(WORKFLOWS_DIR, name), "utf8");
}

// Returns the `uses:` value of the step whose `id:` matches, or undefined.
// Steps are list items under `steps:`; an item starts at `- ` and ends at
// the next `- ` at the same indent, so this locates the item containing the
// matching `id:` and scans it for `uses:`.
export function readStepUses(yaml: string, id: string): string | undefined {
  const lines = yaml.split("\n");
  const idRe = new RegExp(`^(\\s+)(- )?id:\\s*${id}\\s*$`);
  const idIdx = lines.findIndex(line => idRe.test(line));
  if (idIdx === -1) return undefined;
  const [, lead, dash] = lines[idIdx].match(idRe)!;
  // Indent of the step's keys; `- id:` puts the key two columns past the dash.
  const indent = lead.length + (dash ? 2 : 0);
  const itemStart = new RegExp(`^ {${indent - 2}}- `);
  let from = idIdx;
  while (from > 0 && !itemStart.test(lines[from])) from--;
  for (let i = from; i < lines.length; i++) {
    if (i > from && itemStart.test(lines[i])) break;
    const u = lines[i].match(/^\s+(?:- )?uses:\s*(\S+)/)?.[1];
    if (u !== undefined) return u;
  }
  return undefined;
}

// Returns the permission keys granted at every `permissions:` block
// (top-level and per-job). Only the mapping form is read; the refresh
// workflows use it exclusively, so another shape fails loudly instead of
// being silently accepted.
export function readPermissionKeys(yaml: string): string[] {
  const lines = yaml.split("\n");
  const keys: string[] = [];
  lines.forEach((line, i) => {
    const m = line.match(/^(\s*)permissions:\s*$/);
    if (!m) return;
    const indent = m[1].length;
    for (const next of lines.slice(i + 1)) {
      if (next.trim() === "" || next.trim().startsWith("#")) continue;
      const nextIndent = next.match(/^(\s*)/)![1].length;
      if (nextIndent <= indent) break;
      const k = next.match(/^\s+([A-Za-z_-]+):/);
      if (k) keys.push(k[1]);
    }
  });
  return keys;
}

describe.each(REFRESH_WORKFLOWS)("%s opens its PR as the hive App", refresh => {
  const yaml = readWorkflow(refresh);

  it(`mints the token with a SHA-pinned actions/create-github-app-token step id ${APP_TOKEN_STEP_ID}`, () => {
    const uses = readStepUses(yaml, APP_TOKEN_STEP_ID);
    expect(uses).toBeDefined();
    expect(uses).toMatch(/^actions\/create-github-app-token@/);
    expect(uses).toMatch(SHA_PIN);
  });

  it("reads the App id and private key from the repo's vars and secrets", () => {
    expect(yaml).toMatch(
      /^\s+app-id:\s*\$\{\{\s*vars\.HIVE_APP_ID\s*\}\}\s*$/m
    );
    expect(yaml).toMatch(
      /^\s+private-key:\s*\$\{\{\s*secrets\.HIVE_APP_PRIVATE_KEY\s*\}\}\s*$/m
    );
  });

  it("passes the minted token to peter-evans/create-pull-request", () => {
    expect(yaml).toMatch(/uses:\s*peter-evans\/create-pull-request@/);
    expect(yaml).toMatch(
      new RegExp(
        `^\\s+token:\\s*\\$\\{\\{\\s*steps\\.${APP_TOKEN_STEP_ID}\\.outputs\\.token\\s*\\}\\}\\s*$`,
        "m"
      )
    );
    expect(yaml).not.toMatch(/token:\s*\$\{\{\s*(secrets\.)?GITHUB_TOKEN/);
  });

  it("no longer dispatches the required checks by hand", () => {
    expect(yaml).not.toMatch(/REQUIRED_CHECK_WORKFLOWS/);
    expect(yaml).not.toMatch(/gh workflow run/);
    expect(yaml).not.toMatch(/gh api .*\/dispatches/);
  });

  it("does not grant actions: write anywhere", () => {
    expect(readPermissionKeys(yaml)).not.toContain("actions");
    expect(yaml).not.toMatch(/^\s+actions:\s*write\s*$/m);
  });
});

describe("readStepUses", () => {
  const yaml = [
    "jobs:",
    "  refresh:",
    "    steps:",
    "      - uses: actions/checkout@abc",
    "      - name: Mint",
    "        id: app-token",
    "        uses: owner/action@0123456789abcdef0123456789abcdef01234567 # v1",
    "        with:",
    "          app-id: x",
    "      - id: after",
    "        uses: other/action@def",
    "      - uses: first/action@111",
    "        id: uses-first",
    "      - id: no-uses",
    "        run: echo hi",
  ].join("\n");

  it("finds uses: after the id within the same step", () => {
    expect(readStepUses(yaml, "app-token")).toBe(
      "owner/action@0123456789abcdef0123456789abcdef01234567"
    );
    expect(readStepUses(yaml, "after")).toBe("other/action@def");
  });

  it("finds uses: before the id when it opens the list item", () => {
    expect(readStepUses(yaml, "uses-first")).toBe("first/action@111");
  });

  it("is undefined for run steps and unknown ids", () => {
    expect(readStepUses(yaml, "no-uses")).toBeUndefined();
    expect(readStepUses(yaml, "missing")).toBeUndefined();
  });
});

describe("readPermissionKeys", () => {
  it("collects keys from top-level and job-level blocks", () => {
    const yaml = [
      "permissions:",
      "  contents: read",
      "",
      "jobs:",
      "  a:",
      "    permissions:",
      "      # comment",
      "      pull-requests: write",
      "      actions: write",
      "    runs-on: ubuntu-latest",
    ].join("\n");
    expect(readPermissionKeys(yaml)).toEqual([
      "contents",
      "pull-requests",
      "actions",
    ]);
  });

  it("returns nothing for the scalar form rather than guessing", () => {
    expect(readPermissionKeys("permissions: write-all\njobs: {}")).toEqual([]);
  });
});
