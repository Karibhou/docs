import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

const ADR_RE = /adr\/(\d{4}-[a-z0-9-]+\.md)/g;

function adrEntries(file: string): string[] {
  const src = fs.readFileSync(path.join(process.cwd(), file), "utf8");
  return [...new Set([...src.matchAll(ADR_RE)].map(m => m[1]))].sort();
}

describe("hive navigation stays in step with sync-hive-docs", () => {
  it("lists every synced ADR in NAV_STRUCTURE_HIVE", () => {
    const synced = adrEntries("scripts/sync-hive-docs.ts");
    const inNav = adrEntries("src/app/docs/page-map.ts");
    expect(synced.length).toBeGreaterThan(0);
    expect(inNav).toEqual(synced);
  });

  it("lists every synced page in NAV_STRUCTURE_HIVE", () => {
    const sync = fs.readFileSync(
      path.join(process.cwd(), "scripts/sync-hive-docs.ts"),
      "utf8"
    );
    const map = fs.readFileSync(
      path.join(process.cwd(), "src/app/docs/page-map.ts"),
      "utf8"
    );
    const start = map.indexOf("const NAV_STRUCTURE_HIVE");
    const end = map.indexOf("const NAV_STRUCTURE_HOTSHOT", start);
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    const nav = map.slice(start, end);
    // Scans every `source:` entry in the sync script, so this deliberately
    // covers both the synced `files` list and `localHiveDocs`: local hive
    // pages must be in the nav too.
    const targets = [
      ...sync.matchAll(/source:\s*"([^"]+)"(?:,\s*target:\s*"([^"]+)")?/g),
    ].map(m => m[2] ?? m[1]);
    // Pages intentionally reachable by URL only; add a comment per entry.
    const urlOnly = new Set<string>([]);
    expect(targets.length).toBeGreaterThan(0);
    const missing = targets.filter(
      t => !urlOnly.has(t) && !nav.includes(`'${t}'`)
    );
    expect(missing).toEqual([]);
  });
});
