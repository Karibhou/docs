import { describe, it, expect } from "vitest";
import {
  sanitizeHtmlForMdx,
  removeCommentPatterns,
  stripUntilStable,
} from "../lib/sanitizeHtml";

/**
 * Unit tests for the sanitizeHtmlForMdx() function.
 *
 * This function is the primary XSS defense for user-supplied markdown
 * content rendered on the docs site. It MUST be tested for bypass vectors.
 *
 * Tests cover:
 * - Script tag removal (CodeQL #190: attribute-bearing close tags)
 * - Unclosed comment loop (CodeQL #188: incomplete multi-char sanitization)
 * - Style/meta/link/base/iframe removal
 * - Null byte and control character stripping
 * - CDATA/processing instruction/DOCTYPE removal
 * - Nested tag reconstruction bypass prevention (stripUntilStable)
 */

// ═══════════════════════════════════════════════════════════════════════
// Script tag removal (CodeQL #190: js/bad-tag-filter)
// ═══════════════════════════════════════════════════════════════════════

describe("sanitizeHtmlForMdx — script removal", () => {
  it("strips basic <script>...</script>", () => {
    const result = sanitizeHtmlForMdx(
      "<p>Hello</p><script>alert(1)</script><p>World</p>"
    );
    expect(result).toContain("<p>Hello</p>");
    expect(result).toContain("<p>World</p>");
    expect(result).not.toContain("script");
    expect(result).not.toContain("alert");
  });

  it("strips script with attributes", () => {
    const result = sanitizeHtmlForMdx(
      '<script type="text/javascript" src="evil.js"></script>'
    );
    expect(result).not.toContain("script");
    expect(result).not.toContain("evil");
  });

  it("strips </script > with trailing whitespace in close tag", () => {
    const result = sanitizeHtmlForMdx("<script>x</script >");
    expect(result).not.toContain("script");
  });

  it("strips </script/foo> attribute-bearing close tag (CodeQL #190 bypass)", () => {
    const result = sanitizeHtmlForMdx('<script>alert(1)</script foo="bar">');
    expect(result).not.toContain("script");
    expect(result).not.toContain("alert");
  });

  it("strips </script\\n> with newline in close tag", () => {
    const result = sanitizeHtmlForMdx("<script>x</script\n>");
    expect(result).not.toContain("script");
  });

  it("strips nested script reconstruction (stripUntilStable)", () => {
    const result = sanitizeHtmlForMdx(
      "<scr<script>y</script>ipt>alert(1)</script>"
    );
    expect(result).not.toContain("alert");
    expect(result).not.toContain("script");
  });

  it("strips deeply nested reconstruction", () => {
    const result = sanitizeHtmlForMdx(
      "<scr<scr<script></script>ipt></script>ipt>evil</script>"
    );
    expect(result).not.toContain("evil");
    expect(result).not.toContain("script");
  });

  it("strips multiple script tags", () => {
    const result = sanitizeHtmlForMdx(
      "<script>a()</script>text<script>b()</script>"
    );
    expect(result).toBe("text");
  });
});

// ═══════════════════════════════════════════════════════════════════════
// Comment removal (CodeQL #188: incomplete multi-character sanitization)
// ═══════════════════════════════════════════════════════════════════════

describe("sanitizeHtmlForMdx — comment removal (via removeCommentPatterns)", () => {
  it("removes a normal closed comment", () => {
    const result = removeCommentPatterns("before<!-- comment -->after");
    expect(result).toBe("beforeafter");
  });

  it("removes an unclosed comment (residual opener) via loop", () => {
    const result = removeCommentPatterns("safe<!-- this never closes");
    expect(result).toBe("safe");
  });

  it("removes nested comment reconstruction", () => {
    const result = removeCommentPatterns("start<!-<!--x-->end");
    expect(result).not.toContain("<!--");
  });

  it("removes multiple comments", () => {
    const result = removeCommentPatterns("a<!-- one -->b<!-- two -->c");
    expect(result).toBe("abc");
  });

  it("does not expand a placeholder-shaped sequence present in raw input", () => {
    const forged = removeCommentPatterns(
      "x \u0000MDX_CODE_0\u0000 y `code` <!-- c -->"
    );
    expect(forged).toBe("x MDX_CODE_0 y `code` ");

    const outOfRange = removeCommentPatterns("x \u0000MDX_CODE_5\u0000 y");
    expect(outOfRange).toBe("x MDX_CODE_5 y");
    expect(outOfRange).not.toContain("undefined");
  });

  it("removes multiline comments", () => {
    const result = removeCommentPatterns(
      "before<!--\nmultiline\ncomment\n-->after"
    );
    expect(result).toBe("beforeafter");
  });

  it("removes Jinja-style comments", () => {
    const result = removeCommentPatterns("text{# jinja comment #}more");
    expect(result).toBe("textmore");
  });
});

// ═══════════════════════════════════════════════════════════════════════
// Style tag removal
// ═══════════════════════════════════════════════════════════════════════

describe("sanitizeHtmlForMdx — style removal", () => {
  it("strips <style>...</style>", () => {
    const result = sanitizeHtmlForMdx(
      "<style>body{display:none}</style><p>text</p>"
    );
    expect(result).not.toContain("style");
    expect(result).toContain("<p>text</p>");
  });

  it("strips nested style reconstruction", () => {
    const result = sanitizeHtmlForMdx("<sty<style>x</style>le>.evil{}</style>");
    expect(result).not.toContain("style");
    expect(result).not.toContain(".evil");
  });
});

// ═══════════════════════════════════════════════════════════════════════
// Null bytes and control characters
// ═══════════════════════════════════════════════════════════════════════

describe("sanitizeHtmlForMdx — control character removal", () => {
  it("strips null bytes", () => {
    const result = sanitizeHtmlForMdx("he\x00llo");
    expect(result).toBe("hello");
  });

  it("strips control characters but preserves whitespace", () => {
    const result = sanitizeHtmlForMdx("line1\n\tline2\x01\x02");
    expect(result).toBe("line1\n\tline2");
  });

  it("strips DEL character (0x7F)", () => {
    const result = sanitizeHtmlForMdx("test\x7Fvalue");
    expect(result).toBe("testvalue");
  });
});

// ═══════════════════════════════════════════════════════════════════════
// CDATA, processing instructions, DOCTYPE
// ═══════════════════════════════════════════════════════════════════════

describe("sanitizeHtmlForMdx — structural HTML removal", () => {
  it("strips CDATA sections", () => {
    const result = sanitizeHtmlForMdx(
      "before<![CDATA[malicious content]]>after"
    );
    expect(result).toBe("beforeafter");
  });

  it("strips processing instructions", () => {
    const result = sanitizeHtmlForMdx('before<?xml version="1.0"?>after');
    expect(result).toBe("beforeafter");
  });

  it("strips DOCTYPE declarations", () => {
    const result = sanitizeHtmlForMdx("<!DOCTYPE html><p>content</p>");
    expect(result).toContain("<p>content</p>");
    expect(result).not.toContain("DOCTYPE");
  });
});

// ═══════════════════════════════════════════════════════════════════════
// Meta, link, base tag removal
// ═══════════════════════════════════════════════════════════════════════

describe("sanitizeHtmlForMdx — dangerous tag removal", () => {
  it("strips <meta> tags", () => {
    const result = sanitizeHtmlForMdx(
      '<meta http-equiv="refresh" content="0;url=evil.com"><p>safe</p>'
    );
    expect(result).not.toContain("meta");
    expect(result).toContain("<p>safe</p>");
  });

  it("strips <link> tags", () => {
    const result = sanitizeHtmlForMdx(
      '<link rel="stylesheet" href="evil.css"><p>safe</p>'
    );
    expect(result).not.toContain("link");
    expect(result).toContain("<p>safe</p>");
  });

  it("strips <base> tags", () => {
    const result = sanitizeHtmlForMdx(
      '<base href="https://evil.com/"><a href="/login">Click</a>'
    );
    expect(result).not.toContain("base");
    expect(result).toContain('<a href="/login">Click</a>');
  });

  it("strips <sub> tags (content preserved)", () => {
    const result = sanitizeHtmlForMdx("H<sub>2</sub>O");
    expect(result).toBe("H2O");
  });
});

// ═══════════════════════════════════════════════════════════════════════
// stripUntilStable helper
// ═══════════════════════════════════════════════════════════════════════

describe("stripUntilStable", () => {
  it("removes pattern in one pass when no nesting", () => {
    const result = stripUntilStable("hello world", /world/g);
    expect(result).toBe("hello ");
  });

  it("removes patterns that emerge after first removal", () => {
    // '<scr<script>ipt>' → pass 1 removes '<script>' → '<script>' → pass 2 removes it → ''
    const result = stripUntilStable("<scr<script>ipt>", /<script>/gi);
    expect(result).toBe("");
  });
});

// ═══════════════════════════════════════════════════════════════════════
// Edge cases
// ═══════════════════════════════════════════════════════════════════════

describe("sanitizeHtmlForMdx — edge cases", () => {
  it("handles empty input", () => {
    expect(sanitizeHtmlForMdx("")).toBe("");
  });

  it("passes through clean markdown-like content", () => {
    const clean =
      "# Hello\n\nThis is **bold** and *italic* text.\n\n- item 1\n- item 2";
    expect(sanitizeHtmlForMdx(clean)).toBe(clean);
  });

  it("handles mixed attack vectors in one payload", () => {
    const payload =
      '<script>a()</script><!-- hidden --><style>.x{}</style><meta charset="utf-8">safe';
    const result = sanitizeHtmlForMdx(payload);
    expect(result).not.toContain("script");
    expect(result).not.toContain("style");
    expect(result).not.toContain("meta");
    expect(result).toContain("safe");
  });

  it("preserves safe HTML tags", () => {
    const safe = "<p>paragraph</p><div>block</div><strong>bold</strong>";
    const result = sanitizeHtmlForMdx(safe);
    expect(result).toContain("<p>paragraph</p>");
    expect(result).toContain("<div>block</div>");
    expect(result).toContain("<strong>bold</strong>");
  });

  it("escapes shell-style placeholders in prose that MDX would parse as JSX, but not inside code", () => {
    const result = sanitizeHtmlForMdx(
      "Run `tool <prompt>` against <owner>/<repo>."
    );
    expect(result).toContain("`tool <prompt>`");
    expect(result).toContain("&lt;owner&gt;/&lt;repo&gt;");
  });

  it("escapes multi-word placeholders in prose that look like a JSX opening tag with an attribute", () => {
    // A bare `<branch tip>` (no attributes regex previously required an
    // immediate `>` after the tag name) reached the MDX compiler unescaped
    // and was parsed as an unclosed JSX element, failing compilation.
    const result = sanitizeHtmlForMdx(
      "Upgrade available \u2192 <branch tip> while running."
    );
    expect(result).toContain("&lt;branch tip&gt;");
  });

  it("preserves safe tags that carry real attributes", () => {
    const result = sanitizeHtmlForMdx('<a href="https://example.com">link</a>');
    expect(result).toBe('<a href="https://example.com">link</a>');
  });

  it("normalizes angle-bracket autolinks for MDX", () => {
    const result = sanitizeHtmlForMdx(
      "See <https://github.com/settings/copilot>."
    );
    expect(result).toBe(
      "See [https://github.com/settings/copilot](https://github.com/settings/copilot)."
    );
  });

  it("handles very long content without hanging (performance)", () => {
    const longContent = "<p>safe</p>".repeat(1000);
    const start = Date.now();
    const result = sanitizeHtmlForMdx(longContent);
    const elapsed = Date.now() - start;
    expect(result).toContain("<p>safe</p>");
    expect(elapsed).toBeLessThan(5000);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// Angle-bracket placeholders inside code are literal, not escaped
// ═══════════════════════════════════════════════════════════════════════

describe("sanitizeHtmlForMdx — code spans keep <placeholder> literal", () => {
  it("leaves <name> untouched inside a fenced code block", () => {
    const input =
      "1. Step:\n\n   ```bash\n   cd <repo>\n   spektacular spec status <name>\n   ```\n";
    const result = sanitizeHtmlForMdx(input);
    expect(result).toContain("cd <repo>");
    expect(result).toContain("status <name>");
    expect(result).not.toContain("&lt;repo&gt;");
  });

  it("leaves <name> untouched inside inline code", () => {
    const result = sanitizeHtmlForMdx(
      "Run `spektacular plan status <name>` first."
    );
    expect(result).toContain("`spektacular plan status <name>`");
  });

  it("still escapes unknown tags in prose outside code", () => {
    const result = sanitizeHtmlForMdx("Replace <repo> with your path.");
    expect(result).toContain("&lt;repo&gt;");
  });

  it("falls back to escaping on a table row whose code span contains a pipe", () => {
    const row =
      '| `muse` | Muse (`curl -fsSL https://x/install.sh | bash`). Use `muse exec "<prompt>"`. |';
    const result = sanitizeHtmlForMdx(row);
    expect(result).toContain("&lt;prompt&gt;");
  });

  it("keeps <name> literal in a table row whose code spans have no pipe", () => {
    const result = sanitizeHtmlForMdx(
      "| verb | `spektacular spec status <name>` |"
    );
    expect(result).toContain("status <name>`");
  });

  it("still strips script tags that appear inside a fence-like span", () => {
    const result = sanitizeHtmlForMdx("```\n<script>alert(1)</script>\n```");
    expect(result).not.toContain("<script>");
  });
});

describe("URL scheme neutralization in href/src attributes", () => {
  it("rewrites javascript: hrefs to an inert fragment", () => {
    const result = sanitizeHtmlForMdx(
      '<a href="javascript:alert(document.cookie)">click me</a>'
    );
    expect(result).toBe('<a href="#">click me</a>');
  });

  it("is case-insensitive on the scheme", () => {
    const result = sanitizeHtmlForMdx('<a href="JaVaScRiPt:alert(1)">x</a>');
    expect(result).toBe('<a href="#">x</a>');
  });

  it("rewrites data: and vbscript: URLs", () => {
    expect(sanitizeHtmlForMdx('<a href="vbscript:msgbox(1)">x</a>')).toBe(
      '<a href="#">x</a>'
    );
    expect(
      sanitizeHtmlForMdx('<a href="data:text/html;base64,PHNjcmlwdD4=">x</a>')
    ).toBe('<a href="#">x</a>');
  });

  it("catches whitespace- and control-character-obfuscated schemes", () => {
    expect(sanitizeHtmlForMdx('<a href="java\tscript:alert(1)">x</a>')).toBe(
      '<a href="#">x</a>'
    );
    expect(sanitizeHtmlForMdx('<a href=" javascript:alert(1)">x</a>')).toBe(
      '<a href="#">x</a>'
    );
    expect(
      sanitizeHtmlForMdx('<a href="jav&#x0A;ascript:alert(1)">x</a>')
    ).toBe('<a href="#">x</a>');
  });

  it("catches character-reference-encoded schemes", () => {
    expect(sanitizeHtmlForMdx('<a href="&#106;avascript:alert(1)">x</a>')).toBe(
      '<a href="#">x</a>'
    );
    expect(sanitizeHtmlForMdx('<a href="&#x6A;avascript:alert(1)">x</a>')).toBe(
      '<a href="#">x</a>'
    );
    expect(
      sanitizeHtmlForMdx('<a href="javascript&colon;alert(1)">x</a>')
    ).toBe('<a href="#">x</a>');
  });

  it("neutralizes disallowed schemes flowing into contributor cards", () => {
    const table =
      '<table><tr><td><a href="javascript:alert(1)"><img src="https://avatars.githubusercontent.com/u/1"/><br/><sub><b>Mallory</b></sub></a></td></tr></table>';
    const result = sanitizeHtmlForMdx(table);
    expect(result).not.toContain("javascript:");
    expect(result).toContain('href="#"');
  });

  it("keeps http, https, mailto, relative, fragment and scheme-relative URLs", () => {
    expect(
      sanitizeHtmlForMdx('<a href="https://example.com/a?b=c#d">x</a>')
    ).toContain('href="https://example.com/a?b=c#d"');
    expect(sanitizeHtmlForMdx('<a href="http://example.com">x</a>')).toContain(
      'href="http://example.com"'
    );
    expect(
      sanitizeHtmlForMdx('<a href="mailto:team@example.com">x</a>')
    ).toContain('href="mailto:team@example.com"');
    expect(sanitizeHtmlForMdx('<a href="/docs/hive/overview">x</a>')).toContain(
      'href="/docs/hive/overview"'
    );
    expect(sanitizeHtmlForMdx('<a href="../sibling.md">x</a>')).toContain(
      'href="../sibling.md"'
    );
    expect(sanitizeHtmlForMdx('<a href="#section">x</a>')).toContain(
      'href="#section"'
    );
    expect(sanitizeHtmlForMdx('<a href="//example.com/x">x</a>')).toContain(
      'href="//example.com/x"'
    );
  });

  it("leaves img src URLs with allowed schemes untouched", () => {
    const result = sanitizeHtmlForMdx(
      '<img src="https://raw.githubusercontent.com/o/r/main/a.png" alt="a" />'
    );
    expect(result).toContain(
      'src="https://raw.githubusercontent.com/o/r/main/a.png"'
    );
  });

  it("does not rewrite URLs inside code fences or inline code", () => {
    const fenced = sanitizeHtmlForMdx(
      '```\n<a href="ftp://example.com">x</a>\n```'
    );
    expect(fenced).toContain("ftp://example.com");
    const inline = sanitizeHtmlForMdx('use `<a href="file:///etc">x</a>` here');
    expect(inline).toContain("file:///etc");
  });

  it("treats out-of-range character references as hostile", () => {
    const result = sanitizeHtmlForMdx(
      '<a href="&#x110000;javascript:alert(1)">x</a>'
    );
    expect(result).toContain('href="#"');
  });
});

describe("sanitizeHtmlForMdx prose words starting with 'on'", () => {
  it("keeps once/only/onto in prose", () => {
    const input = "Run this once, only when online. Move onto the next step.";
    expect(sanitizeHtmlForMdx(input)).toBe(input);
  });

  it("still strips real on* handler attributes", () => {
    const result = sanitizeHtmlForMdx('<img src="a.png" onerror="alert(1)">');
    expect(result).not.toContain("onerror");
  });
});
