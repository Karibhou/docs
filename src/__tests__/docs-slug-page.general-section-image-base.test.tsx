/**
 * General-section files are read from the shared docs/content/ root even at a
 * project-prefixed route, so relative images must resolve against that root
 * and not against the project's content directory.
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

afterEach(() => {
  vi.restoreAllMocks();
  compileMdx.mockClear();
});

describe("DocPage — general-section image base dir", () => {
  it.each([
    [["community", "join-hive-commons"]],
    [["hive", "community", "join-hive-commons"]],
  ])("%j rewrites images against the shared root", async slug => {
    const target = path.join(
      "docs/content",
      "community",
      "join-hive-commons.md"
    );
    const realRead = fs.readFileSync;
    vi.spyOn(fs, "readFileSync").mockImplementation(((
      file: fs.PathOrFileDescriptor,
      ...rest: unknown[]
    ) =>
      typeof file === "string" && file.endsWith(target)
        ? "![x](images/foo.png)"
        : (realRead as (...a: unknown[]) => unknown)(
            file,
            ...rest
          )) as typeof fs.readFileSync);

    await DocPage({ params: Promise.resolve({ slug }) });

    const source = String((compileMdx.mock.calls[0] as unknown[])[0]);
    expect(source).toContain("/docs-images/community/images/foo.png");
    expect(source).not.toContain("/docs-images/hive/");
  });
});
