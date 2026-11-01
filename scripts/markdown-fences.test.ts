import { describe, it, expect } from "vitest";
import {
  normalizeFences,
  splitFencedSegments,
  mapOutsideFences,
  DEFAULT_FENCE_LANGUAGE,
} from "./markdown-fences";

describe("normalizeFences", () => {
  it("adds the default language to a bare fence opener (MD040)", () => {
    const input = "Intro\n\n```\ncode\n```\n\nAfter\n";
    expect(normalizeFences(input)).toBe(
      `Intro\n\n\`\`\`${DEFAULT_FENCE_LANGUAGE}\ncode\n\`\`\`\n\nAfter\n`
    );
  });

  it("leaves an opener that already declares a language alone", () => {
    const input = "```bash\necho hi\n```\n";
    expect(normalizeFences(input)).toBe(input);
  });

  it("inserts blank lines around a fence glued to paragraphs (MD031)", () => {
    const input = "Run:\n```sh\nls\n```\nDone.\n";
    expect(normalizeFences(input)).toBe("Run:\n\n```sh\nls\n```\n\nDone.\n");
  });

  it("does not double up blank lines that are already there", () => {
    const input = "Run:\n\n```sh\nls\n```\n\nDone.\n";
    expect(normalizeFences(input)).toBe(input);
  });

  it("handles indented fences inside list items", () => {
    const input = "- item\n  ```\n  code\n  ```\n- next\n";
    expect(normalizeFences(input)).toBe(
      `- item\n\n  \`\`\`${DEFAULT_FENCE_LANGUAGE}\n  code\n  \`\`\`\n\n- next\n`
    );
  });

  it("never rewrites lines inside a fence, including nested backticks", () => {
    const input = "````md\n```\ninner\n```\n````\n";
    expect(normalizeFences(input)).toBe(input);
  });

  it("supports tilde fences", () => {
    const input = "x\n~~~\ncode\n~~~\ny\n";
    expect(normalizeFences(input)).toBe(
      `x\n\n~~~${DEFAULT_FENCE_LANGUAGE}\ncode\n~~~\n\ny\n`
    );
  });

  it("does not treat a backtick opener whose info string contains a backtick as a fence (CommonMark)", () => {
    // Per CommonMark a backtick fence's info string may not contain a
    // backtick, so this line is a paragraph: no language is added, no blank
    // line is forced before it, and the following lines are not fence content.
    const input = "Intro\n```foo`bar\nnot code\n```\nAfter\n";
    expect(normalizeFences(input)).toBe(
      `Intro\n\`\`\`foo\`bar\nnot code\n\n\`\`\`${DEFAULT_FENCE_LANGUAGE}\nAfter\n`
    );
  });

  it("still allows a backtick inside the info string of a tilde fence", () => {
    const input = "~~~foo`bar\ncode\n~~~\n";
    expect(normalizeFences(input)).toBe(input);
  });

  it("leaves a fence that closes the document unchanged apart from the language", () => {
    const input = "text\n```\ncode\n```";
    expect(normalizeFences(input)).toBe(
      `text\n\n\`\`\`${DEFAULT_FENCE_LANGUAGE}\ncode\n\`\`\``
    );
  });
});

describe("splitFencedSegments", () => {
  it("separates fenced and unfenced text and round-trips", () => {
    const input = "a\n```js\nb\n```\nc\n";
    const segs = splitFencedSegments(input);
    expect(segs).toEqual([
      { text: "a\n", fenced: false },
      { text: "```js\nb\n```\n", fenced: true },
      { text: "c\n", fenced: false },
    ]);
    expect(segs.map(s => s.text).join("")).toBe(input);
  });

  it("handles ~~~ fences and does not close on a different marker", () => {
    const segs = splitFencedSegments("~~~\n```\nx\n~~~\ny");
    expect(segs).toEqual([
      { text: "~~~\n```\nx\n~~~\n", fenced: true },
      { text: "y", fenced: false },
    ]);
  });

  it("closes on a longer marker but not a shorter one", () => {
    const segs = splitFencedSegments("````\n```\n`````\nz");
    expect(segs).toEqual([
      { text: "````\n```\n`````\n", fenced: true },
      { text: "z", fenced: false },
    ]);
  });

  it("runs an unclosed fence to EOF", () => {
    expect(splitFencedSegments("a\n```\nb\nc")).toEqual([
      { text: "a\n", fenced: false },
      { text: "```\nb\nc", fenced: true },
    ]);
  });

  it("does not treat a backtick fence with a backtick in its info as a fence", () => {
    expect(splitFencedSegments("```a`b\nx\n")).toEqual([
      { text: "```a`b\nx\n", fenced: false },
    ]);
  });
});

describe("mapOutsideFences", () => {
  it("only transforms unfenced text", () => {
    expect(mapOutsideFences("a\n```\na\n```\na", t => t.toUpperCase())).toBe(
      "A\n```\na\n```\nA"
    );
  });
});
