import { describe, it, expect } from "vitest";
import {
  convertMdxToMarkdown,
  parseAttrs,
  splitFrontmatter,
} from "./mdx-to-markdown";

const SITE = "https://spektacular.dev";

const convert = (src: string) => convertMdxToMarkdown(src, { siteBase: SITE });

describe("splitFrontmatter — edge cases", () => {
  it("accepts CRLF line endings and single-quoted values", () => {
    const { data, body } = splitFrontmatter(
      "---\r\ntitle: 'Quoted'\r\ndescription: plain\r\n---\r\nBody\r\n"
    );
    expect(data).toEqual({ title: "Quoted", description: "plain" });
    expect(body).toBe("Body\r\n");
  });

  it("ignores frontmatter lines that are not key: value pairs", () => {
    const { data } = splitFrontmatter(
      "---\ntitle: T\n  - list item\n# comment\nbad key: x\n---\n"
    );
    expect(data).toEqual({ title: "T" });
  });

  it("does not treat a mismatched quote pair as quoted", () => {
    const { data } = splitFrontmatter("---\ntitle: \"half'\n---\n");
    expect(data.title).toBe("\"half'");
  });
});

describe("parseAttrs — edge cases", () => {
  it("reads single-quoted values", () => {
    expect(parseAttrs("heading='Clone it'")).toEqual({ heading: "Clone it" });
  });

  it("parses false, negative and decimal numeric expressions", () => {
    expect(parseAttrs("a={false} b={-3} c={2.5}")).toEqual({
      a: false,
      b: -3,
      c: 2.5,
    });
  });

  it("unwraps a quoted string literal inside an expression", () => {
    expect(parseAttrs("for={\"codex\"} alt={'x'}")).toEqual({
      for: "codex",
      alt: "x",
    });
  });

  it("keeps a non-literal expression as its trimmed source text", () => {
    expect(parseAttrs("start={ offset + 1 }")).toEqual({
      start: "offset + 1",
    });
  });
});

describe("<YouTubeVideo> rendering", () => {
  it("appends t= with & when the url already has a query string", () => {
    const out = convert(
      '<YouTubeVideo url="https://youtu.be/x?feature=share" start={65} />'
    );
    expect(out.markdown).toBe(
      "[Watch this section on YouTube (from 1:05)](https://youtu.be/x?feature=share&t=65)\n"
    );
  });

  it("omits the timestamp when start is missing", () => {
    const out = convert('<YouTubeVideo url="https://youtu.be/x" />');
    expect(out.markdown).toBe(
      "[Watch this section on YouTube](https://youtu.be/x)\n"
    );
  });

  it("treats a non-numeric start as absent", () => {
    const out = convert('<YouTubeVideo url="https://youtu.be/x" start="10" />');
    expect(out.markdown).toContain("[Watch this section on YouTube](");
  });
});

describe("<Step> heading variants", () => {
  it("renders heading only when number is absent", () => {
    const out = convert('<Step heading="Install">\nrun it\n</Step>');
    expect(out.markdown).toBe("### Install\n\nrun it\n");
  });

  it("renders Step N when heading is absent", () => {
    const out = convert("<Step number={2}>\nrun it\n</Step>");
    expect(out.markdown).toBe("### Step 2\n\nrun it\n");
  });
});

describe("<AgentBlock> label fallbacks", () => {
  it("capitalises an unknown agent id", () => {
    const out = convert('<AgentBlock for="gemini">\nhi\n</AgentBlock>');
    expect(out.markdown).toBe("**Gemini**\n\nhi\n");
  });

  it("falls back to Agent when no id is given", () => {
    const out = convert("<AgentBlock>\nhi\n</AgentBlock>");
    expect(out.markdown).toBe("**Agent**\n\nhi\n");
  });
});

describe("block parsing — structure and fences", () => {
  it("records a note and keeps content for an unterminated block", () => {
    const out = convert("<Step number={1}>\nleft open\n\nmore");
    expect(out.notes).toEqual([
      "unterminated <Step> at line 1; tag removed, content kept",
    ]);
    expect(out.markdown).toBe("left open\n\nmore\n");
  });

  it("removes a stray closing tag and records a note", () => {
    const out = convert("text\n</Step>\nafter");
    expect(out.notes).toEqual(["stray closing tag removed at line 2: </Step>"]);
    expect(out.markdown).toBe("text\nafter\n");
  });

  it("matches the outermost close when the same component is nested", () => {
    const src = [
      "<Step number={1}>",
      "outer",
      "<Step number={2}>",
      "inner",
      "</Step>",
      "tail",
      "</Step>",
      "after",
    ].join("\n");
    const out = convert(src);
    expect(out.markdown).toBe(
      "### Step 1\n\nouter\n### Step 2\n\ninner\ntail\nafter\n"
    );
    expect(out.notes).toEqual([]);
  });

  it("ignores a closing tag that appears inside a fence within the block", () => {
    const src = [
      "<Step number={1}>",
      "```html",
      "</Step>",
      "<Step>",
      "```",
      "body",
      "</Step>",
    ].join("\n");
    const out = convert(src);
    expect(out.notes).toEqual([]);
    expect(out.markdown).toBe(
      "### Step 1\n\n```html\n</Step>\n<Step>\n```\nbody\n"
    );
  });

  it("does not close a backtick fence with a tilde fence or a shorter fence", () => {
    const src = [
      "````",
      "~~~",
      "```",
      "<Step>",
      "````",
      '<YouTubeVideo url="https://youtu.be/x" />',
    ].join("\n");
    const out = convert(src);
    // Everything until the 4-backtick close stays verbatim; the component
    // after the fence is still converted.
    expect(out.markdown).toContain("````\n~~~\n```\n<Step>\n````");
    expect(out.markdown).toContain("[Watch this section on YouTube]");
    expect(out.notes).toEqual([]);
  });

  it("treats tilde fences as code and does not parse components inside them", () => {
    const out = convert("~~~\n<Step number={1}>\n~~~\n");
    expect(out.markdown).toBe("~~~\n<Step number={1}>\n~~~\n");
    expect(out.notes).toEqual([]);
  });

  it("does not treat a fence line with trailing info text as a close", () => {
    const out = convert("```\n``` not-a-close\n<Step>\n```\n");
    expect(out.notes).toEqual([]);
    expect(out.markdown).toBe("```\n``` not-a-close\n<Step>\n```\n");
  });

  it("keeps a block whose body is only blank lines", () => {
    const out = convert("<Step number={3}>\n\n   \n</Step>");
    expect(out.markdown).toBe("### Step 3\n");
  });

  it("leaves an unindented body untouched by dedent", () => {
    const out = convert("<Step number={1}>\nno indent\n  some indent\n</Step>");
    expect(out.markdown).toBe("### Step 1\n\nno indent\n  some indent\n");
  });

  it("rewrites a link after a backtick run whose info string has a backtick", () => {
    // ```not`a`fence is not a fence opener, so the link below it is prose.
    const out = convert("```not`a`fence\n[a](/install/)\n\n```text\nx\n```\n");
    expect(out.markdown).toBe(
      `\`\`\`not\`a\`fence\n[a](${SITE}/install/)\n\n\`\`\`text\nx\n\`\`\`\n`
    );
  });

  it("rewrites a link after a fence closed by a longer marker run", () => {
    const out = convert(
      "```\n[x](/in/)\n`````\n[a](/install/)\n\n```text\nx\n```\n"
    );
    expect(out.markdown).toBe(
      `\`\`\`\n[x](/in/)\n\`\`\`\`\`\n[a](${SITE}/install/)\n\n\`\`\`text\nx\n\`\`\`\n`
    );
  });
});

describe("convertMdxToMarkdown — options and frontmatter fallbacks", () => {
  it("uses frontmatter description when summary is absent", () => {
    const out = convert('---\ntitle: T\ndescription: "Desc"\n---\nBody');
    expect(out.description).toBe("Desc");
    expect(out.markdown).toBe("# T\n\n_Desc_\n\nBody\n");
  });

  it("emits only the body when there is no title or description", () => {
    const out = convert("Body only");
    expect(out.title).toBeUndefined();
    expect(out.description).toBeUndefined();
    expect(out.markdown).toBe("Body only\n");
  });

  it("strips a trailing slash from siteBase before joining links", () => {
    const out = convertMdxToMarkdown("[a](/install/)", {
      siteBase: SITE + "/",
    });
    expect(out.markdown).toBe(`[a](${SITE}/install/)\n`);
  });

  it("honours a custom imagePrefix and rewriteImage, preserving the title", () => {
    const out = convertMdxToMarkdown(
      '![alt](/assets/a.png "Title") ![other](/images/b.png)',
      {
        siteBase: SITE,
        imagePrefix: "/assets/",
        rewriteImage: s => `./img/${s.split("/").pop()}`,
      }
    );
    expect(out.images).toEqual(["/assets/a.png"]);
    expect(out.markdown).toBe(
      '![alt](./img/a.png "Title") ![other](/images/b.png)\n'
    );
  });

  it("collapses three or more blank lines to one", () => {
    const out = convert("a\n\n\n\n\nb");
    expect(out.markdown).toBe("a\n\nb\n");
  });

  it("protects inline code from brace escaping and tag removal", () => {
    const out = convert("Use `{x}` and `<Foo>` here");
    expect(out.markdown).toBe("Use `{x}` and `<Foo>` here\n");
    expect(out.notes).toEqual([]);
  });
});

describe("convertMdxToMarkdown — linked images", () => {
  it("rewrites a linked image as an image and the enclosing link as a link", () => {
    const r = convertMdxToMarkdown(
      "---\ntitle: T\n---\n\n[![Badge](/images/badge.png)](/docs/guide)\n",
      { siteBase: "https://example.dev", rewriteImage: s => `RAW${s}` }
    );
    expect(r.images).toEqual(["/images/badge.png"]);
    expect(r.markdown).toContain(
      "[![Badge](RAW/images/badge.png)](https://example.dev/docs/guide)"
    );
  });

  it("still rewrites a plain image and a plain link independently", () => {
    const r = convertMdxToMarkdown(
      "See [guide](/docs/guide) and ![solo](/images/solo.png)\n",
      { siteBase: "https://example.dev", rewriteImage: s => `RAW${s}` }
    );
    expect(r.images).toEqual(["/images/solo.png"]);
    expect(r.markdown).toContain(
      "See [guide](https://example.dev/docs/guide) and ![solo](RAW/images/solo.png)"
    );
  });
});
