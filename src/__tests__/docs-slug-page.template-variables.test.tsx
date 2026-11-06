/**
 * replaceTemplateVariables must only substitute the known `config.*` macros.
 * Other double-brace tokens (promptargs blanks, Go-template --format strings)
 * are real page content and must reach the compiler untouched.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import fs from "fs";
import path from "path";

const { compileMdx } = vi.hoisted(() => ({
  compileMdx: vi.fn(() => {
    throw new Error("compile failed (test stub)");
  }),
}));
vi.mock("nextra/compile", () => ({ compileMdx }));

import DocPage from "../app/docs/[...slug]/page";

const FIXTURE = [
  "A blank looks like this: {{file}}",
  "podman volume inspect hive-data --format '{{.Mountpoint}}'",
  "See {{ config.docs_url }}/hive",
].join("\n");

afterEach(() => {
  vi.restoreAllMocks();
  compileMdx.mockClear();
});

describe("DocPage — template variable replacement", () => {
  it("keeps unknown {{…}} tokens and substitutes config.* macros", async () => {
    const target = path.join("docs/content", "hive", "governor.md");
    const realRead = fs.readFileSync;
    vi.spyOn(fs, "readFileSync").mockImplementation(((
      file: fs.PathOrFileDescriptor,
      ...rest: unknown[]
    ) =>
      typeof file === "string" && file.endsWith(target)
        ? FIXTURE
        : (realRead as (...a: unknown[]) => unknown)(
            file,
            ...rest
          )) as typeof fs.readFileSync);

    await DocPage({ params: Promise.resolve({ slug: ["hive", "governor"] }) });

    const source = String((compileMdx.mock.calls[0] as unknown[])[0]);
    expect(source).toContain("{{file}}");
    expect(source).toContain("--format '{{.Mountpoint}}'");
    expect(source).toContain("https://docs.hivecommons.dev/hive");
    expect(source).not.toContain("config.docs_url");
  });
});
