import { describe, it, expect } from "vitest";
import { rewriteRelativeDocLinks } from "@/lib/rewriteDocLinks";

const same = (md: string, baseDir = "hive") =>
  expect(rewriteRelativeDocLinks(md, baseDir)).toBe(md);

describe("rewriteRelativeDocLinks", () => {
  it("rewrites a same-directory .md link", () => {
    expect(rewriteRelativeDocLinks("[A](architecture.md)", "hive")).toBe(
      "[A](/docs/hive/architecture)"
    );
  });

  it("rewrites an extensionless link", () => {
    expect(rewriteRelativeDocLinks("[A](architecture)", "hive")).toBe(
      "[A](/docs/hive/architecture)"
    );
  });

  it("preserves a #fragment", () => {
    const md = "[x](agent-configuration.md#some-anchor)";
    expect(rewriteRelativeDocLinks(md, "hive")).toBe(
      "[x](/docs/hive/agent-configuration#some-anchor)"
    );
  });

  it("resolves ../ links", () => {
    expect(rewriteRelativeDocLinks("[x](../other/x.md)", "hive")).toBe(
      "[x](/docs/other/x)"
    );
  });

  it("resolves ./ links", () => {
    expect(rewriteRelativeDocLinks("[x](./x.md)", "hive")).toBe(
      "[x](/docs/hive/x)"
    );
  });

  it("handles an empty baseDir", () => {
    expect(rewriteRelativeDocLinks("[x](x.md?a=1#b)", "")).toBe(
      "[x](/docs/x?a=1#b)"
    );
  });

  it("leaves a link that escapes docs/content unchanged", () => {
    same("[x](../../x.md)", "hive");
  });

  it("leaves root-absolute links untouched", () => {
    same("[x](/docs/hive/x)");
  });

  it("leaves external and protocol-relative links untouched", () => {
    same("[a](https://e.com/x.md) [b](http://e.com) [c](mailto:a@b.c)");
    same("[d](//cdn.example.com/x.md)");
  });

  it("leaves pure anchors untouched", () => {
    same("[x](#anchor)");
  });

  it("leaves image and asset links untouched", () => {
    same("![img](images/a.png)");
    same("[pdf](files/a.pdf)");
    same("[yaml](config/a.yaml)");
  });

  it("leaves fenced code and inline code untouched", () => {
    same("```md\n[x](x.md)\n```");
    same("~~~\n[x](x.md)\n~~~");
    same("use `[x](x.md)` here");
  });

  it("rewrites links around a fenced block", () => {
    const md = "[a](a.md)\n```\n[b](b.md)\n```\n[c](c.md)";
    expect(rewriteRelativeDocLinks(md, "h")).toBe(
      "[a](/docs/h/a)\n```\n[b](b.md)\n```\n[c](/docs/h/c)"
    );
  });

  it("rewrites reference-style definitions", () => {
    const md = '[id]: architecture.md#top "T"';
    expect(rewriteRelativeDocLinks(md, "hive")).toBe(
      '[id]: /docs/hive/architecture#top "T"'
    );
  });

  it("rewrites reference-style definitions without a title", () => {
    expect(rewriteRelativeDocLinks("[id]: architecture.md", "hive")).toBe(
      "[id]: /docs/hive/architecture"
    );
  });

  it("leaves non-doc reference-style definitions unchanged", () => {
    same("[ext]: https://example.com/page");
    same("[abs]: /docs/hive/architecture");
    same("[img]: diagram.png");
  });

  it("preserves CommonMark titles", () => {
    expect(rewriteRelativeDocLinks('[x](x.md "Title")', "hive")).toBe(
      '[x](/docs/hive/x "Title")'
    );
  });
});
