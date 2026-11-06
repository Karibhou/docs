/**
 * Every `{{…}}` in docs/content prose (outside fences and code spans) must be
 * one of the `config.*` macros replaceTemplateVariables substitutes.
 *
 * Anything else reaches the MDX compiler as an expression: `{{file}}` parses
 * and is dropped by remarkStripMdxJs, while `{{.Mountpoint}}`, `{{name=x}}`
 * and `{{! comment}}` are acorn parse errors that make DocPage fall back to
 * rendering the whole page as plain text. Inside code the braces are literal
 * and render as written, which is where upstream docs keep them today.
 */
import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import { splitFencedSegments } from "../../scripts/markdown-fences";

const CONTENT_ROOT = path.resolve(__dirname, "../../docs/content");

// Keys substituted by replaceTemplateVariables in src/app/docs/[...slug]/page.tsx.
const KNOWN_MACROS = new Set([
  "config.ks_branch",
  "config.ks_tag",
  "config.ks_latest_release",
  "config.ks_latest_regular_release",
  "config.docs_url",
  "config.repo_url",
  "config.site_url",
]);

// A code span is a backtick run closed by a run of the same length; it may
// span lines but, as in CommonMark, never a blank line — otherwise a stray
// unmatched backtick would swallow every paragraph up to the next one and
// hide the tokens in between. Fenced segments are removed first so a fence's
// backticks never pair with a span's.
const CODE_SPAN_RE = /(`+)(?:(?!\n[ \t]*\n)[\s\S])*?\1/g;
const DOUBLE_BRACE_RE = /\{\{([^}]*)\}\}/g;

export function unknownProseDoubleBraces(markdown: string): string[] {
  const prose = splitFencedSegments(markdown)
    .filter(seg => !seg.fenced)
    .map(seg => seg.text.replace(CODE_SPAN_RE, ""))
    .join("\n");
  const found: string[] = [];
  for (const m of prose.matchAll(DOUBLE_BRACE_RE)) {
    if (!KNOWN_MACROS.has(m[1].trim())) found.push(m[0]);
  }
  return found;
}

function markdownFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return markdownFiles(full);
    return /\.mdx?$/.test(entry.name) ? [full] : [];
  });
}

describe("unknownProseDoubleBraces", () => {
  it("ignores braces inside fences and code spans", () => {
    const md = [
      "Use `--format '{{.Mountpoint}}'` or ``a `{{x}}` b``.",
      "",
      "```sh",
      "podman inspect --format '{{.State.ExitCode}}'",
      "```",
      "",
      "A span `can wrap",
      "{{.Lines}}` too.",
      "",
    ].join("\n");
    expect(unknownProseDoubleBraces(md)).toEqual([]);
  });

  it("does not let a stray backtick hide tokens in a later paragraph", () => {
    const md = [
      "Don't type ` here.",
      "",
      "Use {{.Mountpoint}} then `code`.",
      "",
    ].join("\n");
    expect(unknownProseDoubleBraces(md)).toEqual(["{{.Mountpoint}}"]);
  });

  it("allows the config.* macros, with or without padding", () => {
    const md = "See {{config.docs_url}}/hive and {{ config.repo_url }}.";
    expect(unknownProseDoubleBraces(md)).toEqual([]);
  });

  it("reports prose tokens the renderer would strip or choke on", () => {
    const md = [
      "Review {{file}} for {{focus=correctness}} issues.",
      "Run --format '{{.Mountpoint}}' {{! not a macro}} {{config.unknown}}",
    ].join("\n");
    expect(unknownProseDoubleBraces(md)).toEqual([
      "{{file}}",
      "{{focus=correctness}}",
      "{{.Mountpoint}}",
      "{{! not a macro}}",
      "{{config.unknown}}",
    ]);
  });
});

describe("docs/content", () => {
  it("keeps every non-macro {{…}} inside a fence or code span", () => {
    const offenders = markdownFiles(CONTENT_ROOT).flatMap(file =>
      unknownProseDoubleBraces(fs.readFileSync(file, "utf8")).map(
        token => `${path.relative(CONTENT_ROOT, file)}: ${token}`
      )
    );
    expect(offenders).toEqual([]);
  });
});
