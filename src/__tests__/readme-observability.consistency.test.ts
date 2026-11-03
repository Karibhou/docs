// The README "Observability" section tells operators which API handlers are
// instrumented and promises that the list matches `ApiRoutes` in
// src/lib/metrics.ts. Nothing else reads that prose, so when a route is added
// to or removed from ApiRoutes the README silently keeps the old list (#606
// fixed exactly that drift by hand after `healthz` was instrumented). This
// test fails the PR instead: every ApiRoutes value must be named as inline
// code in the Observability section, and the section must not name a route
// that the registry no longer emits.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ApiRoutes } from "@/lib/metrics";

const README_PATH = join(__dirname, "..", "..", "README.md");
const README_TEXT = readFileSync(README_PATH, "utf8");

// Returns the body of the "## Observability" section: from its heading up to
// the next H2 heading (or EOF).
export function observabilitySection(markdown: string): string {
  const match = markdown.match(
    /^## Observability\s*$([\s\S]*?)(?=^## |(?![\s\S]))/m
  );
  return match ? match[1] : "";
}

// Inline-code tokens in the sentence that enumerates the instrumented
// handlers: everything between "counters and histograms for the" and
// "API handlers only". Other code spans in the section (`/api/metrics`,
// `ApiRoutes`, file paths) are deliberately outside this window.
export function instrumentedRoutesInReadme(section: string): string[] {
  const window = section.match(/histograms for the([\s\S]*?)API handlers only/);
  if (!window) return [];
  return Array.from(window[1].matchAll(/`([^`]+)`/g), m => m[1]);
}

describe("README Observability section vs ApiRoutes", () => {
  const section = observabilitySection(README_TEXT);

  it("has an Observability section that points at ApiRoutes", () => {
    expect(section).not.toBe("");
    expect(section).toContain("`ApiRoutes`");
    expect(section).toContain("src/lib/metrics.ts");
  });

  it("names every ApiRoutes value as an instrumented handler", () => {
    const listed = instrumentedRoutesInReadme(section);
    expect(listed.length).toBeGreaterThan(0);
    for (const route of ApiRoutes) {
      expect(listed, `README omits instrumented route "${route}"`).toContain(
        route
      );
    }
  });

  it("does not name a handler that ApiRoutes no longer instruments", () => {
    const known = new Set<string>(ApiRoutes);
    for (const route of instrumentedRoutesInReadme(section)) {
      expect(
        known.has(route),
        `README lists "${route}" but ApiRoutes does not`
      ).toBe(true);
    }
  });
});

describe("README section helpers", () => {
  it("returns an empty section when the heading is missing", () => {
    expect(observabilitySection("# Title\n\n## Other\n\ntext\n")).toBe("");
  });

  it("stops the section at the next H2 heading", () => {
    const md =
      "## Observability\n\ncounters and histograms for the `a` and `b` API handlers only\n\n## Next\n\n`c`\n";
    expect(observabilitySection(md)).not.toContain("`c`");
    expect(instrumentedRoutesInReadme(observabilitySection(md))).toEqual([
      "a",
      "b",
    ]);
  });

  it("returns no routes when the enumerating sentence is missing", () => {
    expect(
      instrumentedRoutesInReadme("## Observability\n\nnothing here\n")
    ).toEqual([]);
  });
});
