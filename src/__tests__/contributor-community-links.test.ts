// GitHub links CONTRIBUTING.md and the issue chooser from every new-issue and
// new-PR page, so they are where a first-time contributor looks for something
// to work on and somewhere to ask. Nothing renders either file on the site, so
// a link dropped in an edit would go unnoticed (#702). This test pins
// the starter-issue, issue-form and community links in both.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(__dirname, "..", "..");
const read = (path: string) => readFileSync(join(ROOT, path), "utf8");

const DISCORD = "https://hivecommons.dev/discord";
const MEETINGS = "https://docs.hivecommons.dev/docs/community/meetings";

// Body of the "## Finding something to work on" section, up to the next H2.
export function findingWorkSection(markdown: string): string {
  const match = markdown.match(
    /^## Finding something to work on\s*$([\s\S]*?)(?=^## |(?![\s\S]))/m
  );
  return match ? match[1] : "";
}

describe("CONTRIBUTING.md onboarding links", () => {
  const section = findingWorkSection(read("CONTRIBUTING.md"));

  it("has a Finding something to work on section", () => {
    expect(section.trim()).not.toBe("");
  });

  it.each([
    ["good first issue", "label%3A%22good+first+issue%22"],
    ["help wanted", "label%3A%22help+wanted%22"],
    ["documentation issue form", "issues/new?template=doc_issue.yaml"],
    ["feature request form", "issues/new?template=feature_request.yaml"],
    ["Discord", DISCORD],
    ["community meeting", MEETINGS],
  ])("links the %s", (_name, url) => {
    expect(section).toContain(url);
  });

  it("links issue forms that exist", () => {
    for (const [, form] of section.matchAll(/template=([\w.-]+)/g)) {
      expect(() => read(`.github/ISSUE_TEMPLATE/${form}`)).not.toThrow();
    }
  });
});

describe("issue chooser community links", () => {
  const config = read(".github/ISSUE_TEMPLATE/config.yml");

  it.each([
    ["Discord", DISCORD],
    ["community meeting", MEETINGS],
  ])("links the %s", (_name, url) => {
    expect(config).toContain(`url: ${url}`);
  });
});
