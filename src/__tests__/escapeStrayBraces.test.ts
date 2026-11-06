import { describe, it, expect } from "vitest";
import { compileMdx } from "nextra/compile";
import { escapeStrayBraces } from "@/lib/escapeStrayBraces";
import { remarkStripMdxJs } from "@/lib/remarkStripMdxJs";

const compile = (src: string) =>
  compileMdx(src, { mdxOptions: { remarkPlugins: [remarkStripMdxJs] } });

// The first MDX compile is slow (~10s cold start in CI), well past vitest's
// 5s default timeout.
const COMPILE_TIMEOUT_MS = 60_000;

describe("escapeStrayBraces", () => {
  it(
    "lets a Go-template token in prose compile (fails without the escape)",
    async () => {
      const src = "Run --format {{.Mountpoint}} here.";
      await expect(compile(src)).rejects.toThrow();
      await expect(compile(escapeStrayBraces(src))).resolves.toBeTruthy();
    },
    COMPILE_TIMEOUT_MS
  );

  it(
    "lets a single-brace expression in prose compile",
    async () => {
      const src = "use {expr} here";
      await expect(compile(src)).resolves.toBeTruthy();
      expect(escapeStrayBraces(src)).toBe("use \\{expr\\} here");
      await expect(compile("use {a b} here")).rejects.toThrow();
      await expect(
        compile(escapeStrayBraces("use {a b} here"))
      ).resolves.toBeTruthy();
    },
    COMPILE_TIMEOUT_MS
  );

  it("leaves code spans, fences and tags untouched", () => {
    const src = [
      "inline `{{.Mountpoint}}` ok {x}",
      "",
      "```sh",
      "podman inspect --format '{{.Mountpoint}}'",
      "```",
      "",
      "<Tag prop={a} /> {/* note */}",
    ].join("\n");
    const out = escapeStrayBraces(src);
    expect(out).toContain("`{{.Mountpoint}}`");
    expect(out).toContain("'{{.Mountpoint}}'");
    expect(out).toContain("<Tag prop={a} />");
    expect(out).toContain("{/* note */}");
    expect(out).toContain("ok \\{x\\}");
  });

  it("protects every line of a multi-line fence, including unterminated ones", () => {
    const src = [
      "```sh",
      "set -e",
      "podman volume inspect hive-data --format '{{.Mountpoint}}'",
      "echo {done}",
      "```",
      "",
      "after {x}",
      "",
      "~~~",
      "open {a}",
      "still {b}",
    ].join("\n");
    const out = escapeStrayBraces(src);
    expect(out).toContain("--format '{{.Mountpoint}}'");
    expect(out).toContain("echo {done}");
    expect(out).toContain("after \\{x\\}");
    expect(out).toContain("open {a}\nstill {b}");
  });

  it("is idempotent on already-escaped braces", () => {
    expect(escapeStrayBraces("a \\{b\\}")).toBe("a \\{b\\}");
  });
});
