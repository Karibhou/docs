import { describe, it, expect } from "vitest";
import {
  convertMdxToMarkdown,
  parseAttrs,
  splitFrontmatter,
} from "./mdx-to-markdown";

const SITE = "https://spektacular.dev";

describe("splitFrontmatter", () => {
  it("parses quoted and bare values and returns the body", () => {
    const { data, body } = splitFrontmatter(
      '---\ntitle: "A title"\norder: 10\n---\nBody\n'
    );
    expect(data).toEqual({ title: "A title", order: "10" });
    expect(body).toBe("Body\n");
  });

  it("returns the whole document when there is no frontmatter", () => {
    expect(splitFrontmatter("Just text").body).toBe("Just text");
  });
});

describe("parseAttrs", () => {
  it("reads string, expression and boolean attributes", () => {
    expect(
      parseAttrs(
        ' spaced number="1" heading="Clone" start={107} fullscreen={true}'
      )
    ).toEqual({
      spaced: true,
      number: "1",
      heading: "Clone",
      start: 107,
      fullscreen: true,
    });
  });
});

describe("convertMdxToMarkdown", () => {
  it("lifts title and summary into an H1 and lede", () => {
    const src =
      '---\ntitle: "How to use it"\nsummary: "Short summary."\norder: 1\n---\nHello.\n';
    const out = convertMdxToMarkdown(src, { siteBase: SITE });
    expect(out.title).toBe("How to use it");
    expect(out.description).toBe("Short summary.");
    expect(out.markdown).toBe(
      "# How to use it\n\n_Short summary._\n\nHello.\n"
    );
  });

  it("strips multi-line imports and component exports", () => {
    const src = [
      'import Step from "../a.astro"; import',
      'AgentBlock from "../b.astro";',
      "",
      "export const components = { img: ZoomImage };",
      "",
      "Text.",
    ].join("\n");
    const out = convertMdxToMarkdown(src, { siteBase: SITE });
    expect(out.markdown).toBe("Text.\n");
    expect(out.notes).toEqual([]);
  });

  it("does not strip an import statement inside a code fence", () => {
    const src = '```go\nimport "fmt"\n```\n';
    expect(convertMdxToMarkdown(src, { siteBase: SITE }).markdown).toBe(src);
  });

  it("converts <Step> to a numbered H3 and dedents its body, code fences included", () => {
    const src = [
      '<Step spaced number="2" heading="Install">',
      "",
      "  Verify:",
      "",
      "  ```bash",
      "  spektacular --version",
      "  ```",
      "",
      "</Step>",
    ].join("\n");
    const out = convertMdxToMarkdown(src, { siteBase: SITE });
    expect(out.markdown).toBe(
      "### Step 2: Install\n\nVerify:\n\n```bash\nspektacular --version\n```\n"
    );
  });

  it("does not let a backtick run with a backtick in its info string hide a closing tag (CommonMark)", () => {
    const src = [
      '<Step number="1" heading="Quote">',
      "",
      "  ```not`a`fence",
      "",
      "</Step>",
    ].join("\n");
    const out = convertMdxToMarkdown(src, { siteBase: SITE });
    expect(out.markdown).toBe("### Step 1: Quote\n\n```not`a`fence\n");
    expect(out.notes).toEqual([]);
  });

  it("converts nested <AgentBlock> inside <Step> to labelled sections", () => {
    const src = [
      '<Step number="4" heading="Init">',
      "",
      "  Run init.",
      "",
      '  <AgentBlock for="claude">',
      "",
      "    ```bash",
      "    spektacular init claude",
      "    ```",
      "",
      "  </AgentBlock>",
      "",
      '  <AgentBlock for="bob"> ',
      "    Bob text.",
      "  </AgentBlock>",
      "",
      "</Step>",
    ].join("\n");
    const out = convertMdxToMarkdown(src, { siteBase: SITE });
    expect(out.markdown).toBe(
      [
        "### Step 4: Init",
        "",
        "Run init.",
        "",
        "**Claude Code**",
        "",
        "```bash",
        "spektacular init claude",
        "```",
        "",
        "**Bob**",
        "",
        "Bob text.",
        "",
      ].join("\n")
    );
    expect(out.notes).toEqual([]);
  });

  it("turns a self-closing <YouTubeVideo> into a timestamped link", () => {
    const src =
      '<YouTubeVideo url="https://youtu.be/abc" start={108} end={151} fullscreen={true} />\n';
    const out = convertMdxToMarkdown(src, { siteBase: SITE });
    expect(out.markdown).toBe(
      "[Watch this section on YouTube (from 1:48)](https://youtu.be/abc?t=108)\n"
    );
  });

  it("flattens an unknown block component to its content and records a note", () => {
    const src = '<Callout kind="warn">\n  Careful.\n</Callout>\n';
    const out = convertMdxToMarkdown(src, { siteBase: SITE });
    expect(out.markdown).toBe("Careful.\n");
    expect(out.notes).toEqual([
      "flattened unknown component <Callout> to its text content",
    ]);
  });

  it("drops an unknown self-closing component and records a note", () => {
    const out = convertMdxToMarkdown("Before\n\n<AgentSelector />\n\nAfter\n", {
      siteBase: SITE,
    });
    expect(out.markdown).toBe("Before\n\nAfter\n");
    expect(out.notes).toEqual([
      "dropped self-closing component <AgentSelector /> (no Markdown equivalent)",
    ]);
  });

  it("removes inline tags but keeps their text", () => {
    const out = convertMdxToMarkdown("Use <Badge>beta</Badge> now.\n", {
      siteBase: SITE,
    });
    expect(out.markdown).toBe("Use beta now.\n");
    expect(out.notes).toHaveLength(2);
  });

  it("rewrites site-absolute links to the canonical site and collects images", () => {
    const src = "See the [guide](/install/).\n\n![init](/images/t/init.png)\n";
    const out = convertMdxToMarkdown(src, {
      siteBase: SITE,
      rewriteImage: s => `assets${s}`,
    });
    expect(out.markdown).toBe(
      "See the [guide](https://spektacular.dev/install/).\n\n![init](assets/images/t/init.png)\n"
    );
    expect(out.images).toEqual(["/images/t/init.png"]);
  });

  it("defaults image rewriting to a page-relative path", () => {
    const out = convertMdxToMarkdown("![x](/images/a.png)", { siteBase: SITE });
    expect(out.markdown).toBe("![x](images/a.png)\n");
  });

  it("leaves absolute URLs, anchors and code untouched", () => {
    const src = '[repo](https://github.com/x/y) [top](#top) `{"step":"a"}`\n';
    expect(convertMdxToMarkdown(src, { siteBase: SITE }).markdown).toBe(src);
  });

  it("escapes stray braces outside code so MDX does not evaluate them", () => {
    const out = convertMdxToMarkdown("Set {step} here.\n", { siteBase: SITE });
    expect(out.markdown).toBe("Set &#123;step&#125; here.\n");
  });

  it("removes JSX comments", () => {
    const out = convertMdxToMarkdown("A\n\n{/* hidden */}\n\nB\n", {
      siteBase: SITE,
    });
    expect(out.markdown).toBe("A\n\nB\n");
  });
});
