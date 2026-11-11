import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

const messagesDir = path.join(process.cwd(), "messages");

function load(file: string): unknown {
  return JSON.parse(fs.readFileSync(path.join(messagesDir, file), "utf8"));
}

function flatten(
  value: unknown,
  prefix = "",
  out: Record<string, string> = {}
) {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    for (const [key, child] of Object.entries(value)) {
      flatten(child, prefix ? `${prefix}.${key}` : key, out);
    }
  } else {
    out[prefix] = String(value);
  }
  return out;
}

function placeholders(message: string): string[] {
  return [
    ...new Set([...message.matchAll(/\{\s*(\w+)/g)].map(m => m[1])),
  ].sort();
}

const en = flatten(load("en.json"));
const locales = fs
  .readdirSync(messagesDir)
  .filter(f => f.endsWith(".json") && f !== "en.json")
  .sort();

describe("messages parity with en.json", () => {
  it.each(locales)("%s has no keys missing from en.json", file => {
    const orphans = Object.keys(flatten(load(file))).filter(k => !(k in en));
    expect(orphans, `orphan keys in ${file}:\n${orphans.join("\n")}`).toEqual(
      []
    );
  });

  it.each(locales)("%s keeps en.json ICU placeholders", file => {
    const mismatches: string[] = [];
    for (const [key, text] of Object.entries(flatten(load(file)))) {
      if (!(key in en)) continue;
      const got = placeholders(text).join(",");
      const want = placeholders(en[key]).join(",");
      if (got !== want) {
        mismatches.push(`${key}: expected {${want}}, found {${got}}`);
      }
    }
    expect(mismatches, `placeholder mismatches in ${file}`).toEqual([]);
  });
});
