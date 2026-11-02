import { describe, it, expect } from "vitest";
import { sanitizeHtmlForMdx, removeCommentPatterns } from "../lib/sanitizeHtml";
import { rewriteRelativeDocLinks } from "../lib/rewriteDocLinks";
import { rewriteRelativeImagePaths } from "../lib/rewriteImagePaths";
import { rewriteMarkdownLinks } from "../../scripts/link-rewrite";
import { scrubLegacyBranding } from "../../scripts/scrub-legacy-branding";
import { convertMdxToMarkdown } from "../../scripts/mdx-to-markdown";
import { splitFencedSegments } from "../../scripts/markdown-fences";

// Every construct the markdown transforms touch, placed where a transform must
// leave it alone: inside backtick fences, tilde fences and inline code.
const FIXTURE = [
  "# Title",
  "",
  'Inline `<button class="ham-lead-act" style="x:y">` and `![a](rel.png)` and `[x](rel.md)`.',
  "",
  "```html",
  '<button class="ham-lead-act" style="color:red" align="left" width="10">',
  '<img src="rel.png" width="5"><br>',
  "<hr>",
  "![alt](images/rel.png) [x](rel.md)",
  "<table><tr><td>cell</td></tr></table>",
  "<!-- comment --> {# jinja #}",
  "<name> kubestellar",
  "```",
  "",
  "~~~md",
  '<div class="a" frameborder="0">![a](rel.png)</div> <br>',
  "[x](./rel.md) <name>",
  "~~~",
  "",
  "Prose after.",
  "",
].join("\n");

// Fenced segments plus inline code spans: the text no transform may change.
function protectedSpans(text: string): string[] {
  return splitFencedSegments(text).flatMap(seg =>
    seg.fenced ? [seg.text] : (seg.text.match(/`[^`\n]*`/g) ?? [])
  );
}

const TRANSFORMS: Array<[string, (md: string) => string]> = [
  ["sanitizeHtmlForMdx", sanitizeHtmlForMdx],
  ["removeCommentPatterns", removeCommentPatterns],
  ["rewriteRelativeDocLinks", md => rewriteRelativeDocLinks(md, "guide")],
  ["rewriteRelativeImagePaths", md => rewriteRelativeImagePaths(md, "guide")],
  [
    "rewriteMarkdownLinks",
    md =>
      rewriteMarkdownLinks(md, {
        sourceRepoPath: "docs/a.md",
        blobBase: "https://github.com/o/r/blob/main",
        rawBase: "https://raw.githubusercontent.com/o/r/main",
        resolveSyncedRoute: () => "/docs/x",
      }),
  ],
  [
    "convertMdxToMarkdown",
    md =>
      convertMdxToMarkdown(md, { siteBase: "https://example.dev" }).markdown,
  ],
];

describe("fenced and inline code survive every markdown transform", () => {
  it("fixture actually contains protected spans", () => {
    expect(protectedSpans(FIXTURE).length).toBeGreaterThanOrEqual(4);
  });

  it.each(TRANSFORMS)("%s leaves code byte-identical", (_name, transform) => {
    expect(protectedSpans(transform(FIXTURE))).toEqual(protectedSpans(FIXTURE));
  });

  it("sanitizeHtmlForMdx still rewrites real HTML outside code", () => {
    const out = sanitizeHtmlForMdx('<p class="a" style="x:y">hi<br></p>');
    expect(out).toContain('className="a"');
    expect(out).not.toContain("style=");
    expect(out).toContain("<br />");
  });

  it("sanitizeHtmlForMdx still strips scripts and event handlers", () => {
    expect(sanitizeHtmlForMdx("<script>alert(1)</script>ok")).not.toContain(
      "script"
    );
    expect(sanitizeHtmlForMdx('<b onclick="x()">t</b>')).not.toContain(
      "onclick"
    );
  });

  // Explicit opt-out: branding migration is intentionally content-level and
  // must also rewrite examples inside fences.
  it("scrubLegacyBranding is the documented opt-out", () => {
    const md = "```sh\ngit clone https://github.com/kubestellar/hive\n```\n";
    expect(scrubLegacyBranding(md)).toContain("github.com/hivecommons/hive");
  });
});
