import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";
import { buildPageMap } from "../app/docs/page-map";
import { type ProjectId } from "@/config/versions";

/**
 * buildPageMap() silently skips a nav entry whose file is not on disk
 * (`if (allDocFiles.includes(value))`), so a NAV_STRUCTURE_* path that
 * points at a page nobody syncs or commits just disappears from the
 * sidebar — no build error, no 404, nothing in CI. page-map-adr-nav-drift
 * covers the other direction (every synced page is in the nav); this pins
 * the reverse: every nav path resolves to a real file.
 */

const PROJECTS: Array<[ProjectId, string]> = [
  ["hive", "NAV_STRUCTURE_HIVE"],
  ["hotshot", "NAV_STRUCTURE_HOTSHOT"],
  ["pluk", "NAV_STRUCTURE_PLUK"],
  ["rationguard", "NAV_STRUCTURE_RATIONGUARD"],
  ["promptargs", "NAV_STRUCTURE_PROMPTARGS"],
  ["dibs", "NAV_STRUCTURE_DIBS"],
  ["crux", "NAV_STRUCTURE_CRUX"],
  ["spektacular", "NAV_STRUCTURE_SPEKTACULAR"],
];

const source = fs.readFileSync(
  path.join(process.cwd(), "src/app/docs/page-map.ts"),
  "utf8"
);

/** String leaf values ('title': 'path.md') declared inside one nav constant. */
function navPaths(constName: string): string[] {
  const start = source.indexOf(`const ${constName}`);
  expect(start, `${constName} is declared in page-map.ts`).toBeGreaterThan(-1);
  const end = source.indexOf("\nconst ", start + 1);
  const block = source.slice(start, end === -1 ? undefined : end);
  return [...block.matchAll(/:\s*'([^']+\.mdx?)'/g)].map(m => m[1]);
}

describe("every nav entry resolves to a file buildPageMap can serve", () => {
  it.each(PROJECTS)("%s", (projectId, constName) => {
    const paths = navPaths(constName);
    expect(paths.length).toBeGreaterThan(0);
    const { filePaths } = buildPageMap(projectId);
    const dangling = paths.filter(p => !filePaths.includes(p));
    expect(dangling).toEqual([]);
  });
});
