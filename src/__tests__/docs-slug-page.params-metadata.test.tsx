/**
 * Coverage for the untested halves of the docs [...slug] route:
 *
 * - generateStaticParams: content-tree walk, per-project routeMap params,
 *   general-section skip, dedupe, and the HIVE_DOCS_PATH env branch.
 * - generateMetadata: the hive/integrations special case vs the default.
 * - DocPage: notFound() for unknown slugs, the integrations JSON-LD
 *   <script> branch, and the plain-text <pre> fallback when MDX
 *   compilation throws.
 * - SlugLayout (layout.tsx): project detection from the slug and Meta-node
 *   stripping of the page map passed to the sidebar.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import fs from "fs";
import os from "os";
import path from "path";

// Same runtime-injection shim as docs-page-render.test.ts: nextra's
// evaluate() injects react/jsx-dev-runtime under NODE_ENV=test while
// compileMdx emits production _jsx() calls; re-implement it with the
// production runtime so the two agree.
vi.mock("nextra/evaluate", async () => {
  const runtime = await import("react/jsx-runtime");
  return {
    evaluate(
      rawJs: string,
      components = {},
      scope: Record<string, unknown> = {}
    ) {
      const keys = Object.keys(scope);
      const values = Object.values(scope);
      const hydrateFn = Reflect.construct(Function, ["$", ...keys, rawJs]);
      return hydrateFn(
        { ...runtime, useMDXComponents: () => components },
        ...values
      );
    },
  };
});

// notFound() must be observable: replace it with a throwing sentinel.
const NOT_FOUND = new Error("NEXT_NOT_FOUND (test sentinel)");
vi.mock("next/navigation", async importOriginal => {
  const actual = await importOriginal<typeof import("next/navigation")>();
  return {
    ...actual,
    usePathname: () => "/docs/hive/integrations",
    notFound: () => {
      throw NOT_FOUND;
    },
  };
});

// next/link expects Next.js router context; render a plain anchor instead.
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

import { DocsProvider } from "../components/docs/DocsProvider";
import DocPage, {
  generateMetadata,
  generateStaticParams,
} from "../app/docs/[...slug]/page";

const RENDER_TIMEOUT_MS = 60_000;

async function renderDocsRoute(slug: string[]): Promise<string> {
  const page = await DocPage({ params: Promise.resolve({ slug }) });
  return renderToStaticMarkup(createElement(DocsProvider, null, page));
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("generateStaticParams", () => {
  it("walks the content tree and prefixes project routeMap routes", async () => {
    const params = await generateStaticParams();
    const keys = new Set(params.map(p => p.slug.join("/")));

    // From the docs/content walk (general section, extension stripped).
    expect(keys.has("community/meetings")).toBe(true);
    // Project-prefixed route from the hive routeMap.
    expect(keys.has("hive/integrations")).toBe(true);

    // No empty slugs, no duplicates.
    for (const p of params) {
      expect(p.slug.length).toBeGreaterThan(0);
      expect(p.slug.every(Boolean)).toBe(true);
    }
    expect(keys.size).toBe(params.length);
  });

  it("routes general sections at the top level, not under every project", async () => {
    const params = await generateStaticParams();
    const keys = new Set(params.map(p => p.slug.join("/")));
    expect(keys.has("pluk/community/meetings")).toBe(false);
    expect(keys.has("dibs/community/meetings")).toBe(false);
  });

  it("adds hive routes for each directory under HIVE_DOCS_PATH when set", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "docs-hive-docs-"));
    try {
      fs.mkdirSync(path.join(dir, "extra-guide"));
      fs.writeFileSync(path.join(dir, "loose-file.md"), "# not a directory");

      vi.stubEnv("HIVE_DOCS_PATH", dir);
      vi.resetModules();
      const fresh = await import("../app/docs/[...slug]/page");
      const params = await fresh.generateStaticParams();
      const keys = new Set(
        params.map((p: { slug: string[] }) => p.slug.join("/"))
      );

      expect(keys.has("hive/extra-guide")).toBe(true);
      // Plain files under HIVE_DOCS_PATH are skipped (directories only).
      expect(keys.has("hive/loose-file.md")).toBe(false);
      expect(keys.has("hive/loose-file")).toBe(false);
    } finally {
      vi.resetModules();
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("generateMetadata", () => {
  it("returns the SEO metadata block for hive/integrations", async () => {
    const meta = await generateMetadata({
      params: Promise.resolve({ slug: ["hive", "integrations"] }),
    });
    expect(meta.title).toBe("Supported agents & inference engines");
    expect(meta.alternates?.canonical).toBe("/docs/hive/integrations");
    expect(meta.openGraph?.url).toBe(
      "https://docs.hivecommons.dev/docs/hive/integrations"
    );
    expect(meta.robots).toEqual({ index: true, follow: true });
  });

  it("returns empty metadata for every other page", async () => {
    const meta = await generateMetadata({
      params: Promise.resolve({ slug: ["hive", "overview", "introduction"] }),
    });
    expect(meta).toEqual({});
  });
});

describe("DocPage fatal and special branches", () => {
  it("calls notFound() when no content resolves for the slug", async () => {
    await expect(
      DocPage({
        params: Promise.resolve({ slug: ["no-such-project-page", "nope"] }),
      })
    ).rejects.toBe(NOT_FOUND);
  });

  it(
    "embeds the integrations JSON-LD script only on hive/integrations",
    async () => {
      const html = await renderDocsRoute(["hive", "integrations"]);
      expect(html).toContain("application/ld+json");
      expect(html).toContain("Supported agents &amp; inference engines");

      const other = await renderDocsRoute(["hive", "overview", "introduction"]);
      expect(other).not.toContain("application/ld+json");
    },
    RENDER_TIMEOUT_MS
  );

  it(
    "falls back to plain-text <pre> rendering when MDX compilation throws",
    async () => {
      vi.resetModules();
      vi.doMock("nextra/compile", () => ({
        compileMdx: () => {
          throw new Error("boom: simulated MDX compile failure");
        },
      }));
      try {
        const fresh = await import("../app/docs/[...slug]/page");
        // After resetModules the wrapper resolves a fresh DocsProvider module,
        // so the provider must come from the same module graph.
        const { DocsProvider: FreshProvider } =
          await import("../components/docs/DocsProvider");
        const page = await fresh.default({
          params: Promise.resolve({
            slug: ["hive", "overview", "introduction"],
          }),
        });
        const html = renderToStaticMarkup(
          createElement(FreshProvider, null, page)
        );
        expect(html).toContain("<pre>");
        // Raw markdown shipped as text, not compiled to headings.
        expect(html).not.toMatch(/<h1[ >]/);
      } finally {
        vi.doUnmock("nextra/compile");
        vi.resetModules();
      }
    },
    RENDER_TIMEOUT_MS
  );
});

describe("SlugLayout", () => {
  it("detects the project from the slug and strips Meta nodes from the page map", async () => {
    vi.resetModules();
    const captured: Array<{ projectId: string; pageMap: unknown[] }> = [];
    vi.doMock("@/components/docs/SidebarContainer", () => ({
      SidebarContainer: (props: { projectId: string; pageMap: unknown[] }) => {
        captured.push(props);
        return null;
      },
    }));
    try {
      const { default: SlugLayout } =
        await import("../app/docs/[...slug]/layout");

      for (const [first, expected] of [
        ["hotshot", "hotshot"],
        ["pluk", "pluk"],
        ["rationguard", "rationguard"],
        ["promptargs", "promptargs"],
        ["dibs", "dibs"],
        ["crux", "crux"],
        ["spektacular", "spektacular"],
        ["anything-else", "hive"],
      ] as const) {
        renderToStaticMarkup(
          await SlugLayout({
            children: null,
            params: Promise.resolve({ slug: [first, "page"] }),
          })
        );
        expect(captured.at(-1)?.projectId).toBe(expected);
      }

      // The empty slug also falls back to hive.
      renderToStaticMarkup(
        await SlugLayout({
          children: null,
          params: Promise.resolve({ slug: [] }),
        })
      );
      expect(captured.at(-1)?.projectId).toBe("hive");

      // Meta nodes (raw and nextra-normalized) are stripped recursively.
      type Node = {
        name?: string;
        route?: string;
        kind?: string;
        data?: unknown;
        children?: Node[];
      };
      const hasMeta = (items: Node[]): boolean =>
        items.some(
          n =>
            n.kind === "Meta" ||
            ("data" in n && !n.name && !n.route) ||
            (n.children ? hasMeta(n.children) : false)
        );
      const pageMap = captured.at(-1)?.pageMap as Node[];
      expect(Array.isArray(pageMap)).toBe(true);
      expect(pageMap.length).toBeGreaterThan(0);
      expect(hasMeta(pageMap)).toBe(false);
    } finally {
      vi.doUnmock("@/components/docs/SidebarContainer");
      vi.resetModules();
    }
  });

  it("strips raw `kind: 'Meta'` nodes, including nested ones, before they reach the sidebar", async () => {
    // buildPageMap() returns nextra-normalized nodes (no `kind`), so the
    // raw-Meta arm of isMetaNode is only reachable with a hand-built map.
    // The raw nodes carry a `name` so the normalized arm (data + no name/
    // route) cannot strip them: only the `kind === 'Meta'` check can.
    vi.resetModules();
    const captured: Array<{ pageMap: unknown[] }> = [];
    vi.doMock("@/components/docs/SidebarContainer", () => ({
      SidebarContainer: (props: { pageMap: unknown[] }) => {
        captured.push(props);
        return null;
      },
    }));
    vi.doMock("../app/docs/page-map", () => ({
      buildPageMap: () => ({
        pageMap: [
          { kind: "Meta", name: "_meta", data: { index: "Home" } },
          { name: "index", route: "/docs/hive" },
          {
            name: "guide",
            route: "/docs/hive/guide",
            children: [
              { kind: "Meta", name: "_meta", data: { intro: "Intro" } },
              { data: { nested: "Nested" } },
              { name: "intro", route: "/docs/hive/guide/intro" },
            ],
          },
        ],
      }),
    }));
    try {
      const { default: SlugLayout } =
        await import("../app/docs/[...slug]/layout");
      renderToStaticMarkup(
        await SlugLayout({
          children: null,
          params: Promise.resolve({ slug: ["hive", "guide"] }),
        })
      );
      expect(captured.at(-1)?.pageMap).toEqual([
        { name: "index", route: "/docs/hive" },
        {
          name: "guide",
          route: "/docs/hive/guide",
          children: [{ name: "intro", route: "/docs/hive/guide/intro" }],
        },
      ]);
    } finally {
      vi.doUnmock("@/components/docs/SidebarContainer");
      vi.doUnmock("../app/docs/page-map");
      vi.resetModules();
    }
  });
});
