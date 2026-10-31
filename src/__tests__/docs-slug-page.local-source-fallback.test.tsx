/**
 * DocPage computes the "View Source" / "Compose a PR" target in three arms:
 *
 * - general-section files (community/...) -> this repo, always;
 * - synced pages -> the canonical URL read from their "Synced from" banner;
 * - every other page -> this repo, under docs/content/<project>/<file>,
 *   because a page with no banner was authored here and the project's
 *   upstream path would 404.
 *
 * The third arm is asserted here at the route level: DocsSourceActions.test.tsx
 * only checks that the component renders whatever sourceUrl it is handed, so
 * reverting the fallback in page.tsx leaves that suite green.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import fs from "fs";
import path from "path";

vi.mock("next/navigation", async importOriginal => {
  const actual = await importOriginal<typeof import("next/navigation")>();
  return { ...actual, usePathname: () => "/docs/hive/governor" };
});

vi.mock("next/link", async () => {
  const { createElement: h } = await import("react");
  return {
    default: ({
      href,
      children,
      ...rest
    }: { href?: unknown; children?: ReactNode } & Record<string, unknown>) =>
      h(
        "a",
        { ...rest, href: typeof href === "string" ? href : undefined },
        children
      ),
  };
});

// The source-link arms do not depend on the MDX body; fail compilation so the
// page takes its <pre> fallback and the test stays fast.
const { compileMdx } = vi.hoisted(() => ({
  compileMdx: vi.fn(() => {
    throw new Error("compile failed (test stub)");
  }),
}));
vi.mock("nextra/compile", () => ({ compileMdx }));

import { DocsProvider } from "../components/docs/DocsProvider";
import DocPage from "../app/docs/[...slug]/page";

const DOCS_BLOB = "https://github.com/hivecommons/docs/blob/main/docs/content";
const DOCS_EDIT = "https://github.com/hivecommons/docs/edit/main/docs/content";

async function renderDocsRoute(slug: string[]): Promise<string> {
  const page = await DocPage({ params: Promise.resolve({ slug }) });
  return renderToStaticMarkup(createElement(DocsProvider, null, page));
}

function readContent(rel: string): string {
  return fs.readFileSync(
    path.join(process.cwd(), "docs/content", rel),
    "utf-8"
  );
}

afterEach(() => {
  compileMdx.mockClear();
});

describe("DocPage — source links for pages without a 'Synced from' banner", () => {
  it("points a locally authored hive page at this repo, not at hivecommons/hive", async () => {
    // Fixture guard: the arm under test only fires when the banner is absent.
    expect(readContent("hive/governor.md")).not.toMatch(/^> \*\*Synced from/m);

    const html = await renderDocsRoute(["hive", "governor"]);

    expect(compileMdx).toHaveBeenCalledTimes(1);
    expect(html).toContain(`href="${DOCS_BLOB}/hive/governor.md"`);
    expect(html).toContain(`href="${DOCS_EDIT}/hive/governor.md?fork=true"`);
    expect(html).toContain(
      encodeURIComponent(`Source file:\n${DOCS_BLOB}/hive/governor.md`)
    );
    // The page body may link into hivecommons/hive; the action buttons must not.
    expect(html).not.toMatch(
      /href="https:\/\/github\.com\/hivecommons\/hive\/(blob|edit)\/[^"]*governor\.md/
    );
  });

  it("keeps a synced page pointed at the canonical upstream file", async () => {
    const banner = readContent("hive/getting-started.md");
    const upstream =
      /\((https:\/\/github\.com\/hivecommons\/hive\/blob\/[^)\s]+)\)/.exec(
        banner
      )?.[1];
    expect(upstream).toBeDefined();

    const html = await renderDocsRoute(["hive", "getting-started"]);

    expect(html).toContain(`href="${upstream}"`);
    expect(html).not.toContain(`${DOCS_BLOB}/hive/getting-started.md`);
  });
});
