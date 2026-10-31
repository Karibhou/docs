import { beforeEach, describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { SharedConfig } from "@/hooks/useSharedConfig";
import type { ProjectId } from "@/config/versions";

const useSharedConfigMock = vi.fn<() => { config: SharedConfig | null }>(
  () => ({ config: null })
);
vi.mock("@/hooks/useSharedConfig", async importOriginal => {
  const actual =
    await importOriginal<typeof import("@/hooks/useSharedConfig")>();
  return { ...actual, useSharedConfig: () => useSharedConfigMock() };
});

import {
  DocsSourceActions,
  editUrlFromSource,
} from "@/components/docs/DocsSourceActions";

const BLOB =
  "https://github.com/hivecommons/docs/blob/main/docs/content/community/meetings.md";
const EDIT =
  "https://github.com/hivecommons/docs/edit/main/docs/content/community/meetings.md?fork=true";

function configWithEditBase(
  editBaseUrls: Record<string, string>
): SharedConfig {
  return { editBaseUrls } as unknown as SharedConfig;
}

function render(
  props: Partial<Parameters<typeof DocsSourceActions>[0]> = {}
): string {
  return renderToStaticMarkup(
    createElement(DocsSourceActions, {
      filePath: "getting-started/install.md",
      projectId: "pluk",
      pageTitle: "Install",
      ...props,
    })
  );
}

function hrefs(html: string): string[] {
  return [...html.matchAll(/href="([^"]*)"/g)].map(m =>
    m[1].replace(/&amp;/g, "&")
  );
}

beforeEach(() => {
  useSharedConfigMock.mockReset();
  useSharedConfigMock.mockReturnValue({ config: null });
});

describe("editUrlFromSource", () => {
  it("rewrites a GitHub blob URL into a fork-based edit URL, dropping hash and query", () => {
    expect(editUrlFromSource(`${BLOB}?plain=1#L10`)).toBe(EDIT);
  });

  it.each([
    ["http scheme", "http://github.com/hivecommons/docs/blob/main/README.md"],
    [
      "non-GitHub host",
      "https://gitlab.com/hivecommons/docs/blob/main/README.md",
    ],
    [
      "lookalike host",
      "https://github.com.evil.example/hivecommons/docs/blob/main/README.md",
    ],
    ["non-blob path", "https://github.com/hivecommons/docs/tree/main/docs"],
    ["javascript scheme", "javascript:alert(1)//blob/"],
  ])("rejects a %s source (%s)", (_label, url) => {
    expect(editUrlFromSource(url)).toBeNull();
  });

  it("returns null when the source is not a parseable URL", () => {
    expect(editUrlFromSource("not a url /blob/ at all")).toBeNull();
    expect(editUrlFromSource("")).toBeNull();
  });
});

describe("DocsSourceActions — edit URL resolution", () => {
  it("prefers a synced GitHub blob sourceUrl over the project edit base", () => {
    const html = render({ sourceUrl: BLOB });
    const links = hrefs(html);

    expect(links[0]).toBe(EDIT);
    expect(links[1]).toBe(BLOB);
    expect(links[2]).toContain(encodeURIComponent(`Source file:\n${BLOB}`));
    expect(html).not.toContain("hivecommons/pluk/edit");
  });

  it("points a locally authored hive page (no upstream twin) at this repo", () => {
    const local =
      "https://github.com/hivecommons/docs/blob/main/docs/content/hive/governor.md";
    const html = render({
      projectId: "hive",
      filePath: "governor.md",
      sourceUrl: local,
    });
    const links = hrefs(html);

    expect(links[0]).toBe(
      "https://github.com/hivecommons/docs/edit/main/docs/content/hive/governor.md?fork=true"
    );
    expect(links[1]).toBe(local);
    expect(links[2]).toContain(encodeURIComponent(`Source file:\n${local}`));
    expect(html).not.toContain("hivecommons/hive/");
  });

  it("falls back to the project edit base when sourceUrl is not a GitHub blob URL", () => {
    const html = render({
      sourceUrl: "https://gitlab.com/hivecommons/docs/blob/main/README.md",
    });
    const links = hrefs(html);

    expect(links[0]).toBe(
      "https://github.com/hivecommons/pluk/edit/main/getting-started/install.md?fork=true"
    );
    expect(links[1]).toBe(
      "https://github.com/hivecommons/pluk/blob/main/getting-started/install.md"
    );
    expect(html).not.toContain("gitlab.com");
  });

  it("uses the shared-config editBaseUrls override when present", () => {
    useSharedConfigMock.mockReturnValue({
      config: configWithEditBase({
        pluk: "https://github.com/hivecommons/pluk/edit/release-2",
      }),
    });

    expect(hrefs(render())[0]).toBe(
      "https://github.com/hivecommons/pluk/edit/release-2/getting-started/install.md?fork=true"
    );
  });

  it("strips path traversal and leading slashes from filePath", () => {
    const html = render({ filePath: "/../../etc/passwd.md" });

    expect(hrefs(html)[0]).toBe(
      "https://github.com/hivecommons/pluk/edit/main/etc/passwd.md?fork=true"
    );
  });

  it("renders nothing for a project with no edit base in static or shared config", () => {
    expect(render({ projectId: "unknown" as ProjectId })).toBe("");
  });

  it("renders nothing when the shared-config edit base is not a GitHub /edit/ URL", () => {
    useSharedConfigMock.mockReturnValue({
      config: configWithEditBase({
        pluk: "https://example.com/hivecommons/pluk/edit/main",
      }),
    });
    expect(render()).toBe("");

    useSharedConfigMock.mockReturnValue({
      config: configWithEditBase({
        pluk: "https://github.com/hivecommons/pluk/tree/main",
      }),
    });
    expect(render()).toBe("");
  });

  it("renders nothing when the shared-config edit base is not a parseable URL", () => {
    useSharedConfigMock.mockReturnValue({
      config: configWithEditBase({ pluk: "::not-a-url::" }),
    });
    expect(render()).toBe("");
  });
});

describe("DocsSourceActions — variants", () => {
  it("full variant renders labelled links with titles and safe rel", () => {
    const html = render();

    expect(html).toContain("Compose a PR");
    expect(html).toContain("View Source");
    expect(html).toContain("Open Issue");
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
    expect(html).toContain("min-w-[150px]");
    expect(html).not.toContain("h-11 w-11");
  });

  it("compact variant renders icon-only square buttons and keeps titles for accessibility", () => {
    const html = render({ variant: "compact" });

    expect(html).toContain("h-11 w-11");
    expect(html).not.toContain("min-w-[150px]");
    expect(html).toContain('title="Compose a PR"');
    expect(html).toContain('title="View Source"');
    expect(html).toContain('title="Open Issue"');
    expect(html).not.toContain(">Compose a PR<");
    expect(hrefs(html)).toHaveLength(3);
  });

  it("issue link encodes the page title and source URL", () => {
    const html = render({ pageTitle: "Install & Setup" });
    const issue = hrefs(html)[2];

    expect(
      issue.startsWith("https://github.com/hivecommons/docs/issues/new?")
    ).toBe(true);
    expect(issue).toContain(
      `title=${encodeURIComponent("Docs: Install & Setup")}`
    );
    expect(issue).toContain(
      encodeURIComponent(
        "Source file:\nhttps://github.com/hivecommons/pluk/blob/main/getting-started/install.md"
      )
    );
  });
});
