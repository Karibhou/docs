import { describe, it, expect, vi, beforeEach } from "vitest";

/** Synced-from provenance banner must not leak into the search index (hivecommons/docs#705). */

const { mockRouteMap, mockFiles } = vi.hoisted(() => {
  const mockRouteMap: Record<string, string> = {
    "architecture/overview": "architecture.md",
  };
  const mockFiles: Record<string, string> = {
    "hive/architecture.md":
      "> **Synced from Hive.** This page is pulled from [hivecommons/hive@v5](https://github.com/hivecommons/hive/blob/v5/src/docs/architecture.md) during the docs build. Edit the canonical source in the Hive repository.\n\n# Architecture Overview\n\nHive runs as a single control plane.",
  };
  return { mockRouteMap, mockFiles };
});

vi.mock("fs", () => ({
  default: {
    existsSync: (filePath: string) => {
      const rel = filePath.replace(/.*\/docs\/content\//, "");
      return rel in mockFiles;
    },
    readFileSync: (filePath: string) => {
      const rel = filePath.replace(/.*\/docs\/content\//, "");
      return mockFiles[rel] || "";
    },
  },
}));

vi.mock("../app/docs/page-map", () => ({
  buildPageMap: () => ({ routeMap: mockRouteMap }),
  docsContentPath: "/fake/docs/content",
  basePath: "docs",
}));

vi.mock("@/lib/transformMdx", () => ({
  convertHtmlScriptsToJsxComments: (content: string) => content,
}));

vi.mock("path", async () => {
  const actual = await vi.importActual<typeof import("path")>("path");
  return {
    ...actual,
    default: {
      ...actual,
      join: (...parts: string[]) => parts.join("/").replace(/\/+/g, "/"),
    },
  };
});

class MockNextRequest {
  nextUrl: { searchParams: URLSearchParams };
  constructor(query: string) {
    this.nextUrl = {
      searchParams: new URLSearchParams(query ? `q=${query}` : ""),
    };
  }
}

vi.mock("next/server", () => ({
  NextRequest: MockNextRequest,
  NextResponse: {
    json: (body: unknown, init?: { status?: number }) => ({
      body,
      status: init?.status || 200,
    }),
  },
}));

let GET: (request: any) => Promise<any>;

beforeEach(async () => {
  vi.resetModules();
  const mod = await import("../app/api/search/route");
  GET = mod.GET;
});

describe("GET /api/search — synced banner", () => {
  it("starts snippet and content at the first real sentence", async () => {
    const res = await GET(new MockNextRequest("architecture"));
    const hit = res.body.results.find(
      (r: any) => r.title === "Architecture Overview"
    );
    expect(hit).toBeDefined();
    expect(hit.matchType).toBe("title");
    for (const field of [hit.snippet, hit.content]) {
      expect(field).not.toContain("Synced from");
      expect(field.startsWith(">")).toBe(false);
      expect(field.startsWith("Architecture Overview")).toBe(true);
    }
  });

  it("does not match banner-only phrases", async () => {
    const res = await GET(new MockNextRequest("canonical%20source"));
    expect(res.body.results).toHaveLength(0);
  });
});
