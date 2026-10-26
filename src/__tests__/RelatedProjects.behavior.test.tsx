// @vitest-environment jsdom
//
// Covers src/components/docs/RelatedProjects.tsx (previously 0%):
//  - getCurrentProject(): pathname-based highlighting of the active project,
//    general sections, and the Hive fallback
//  - getProjectUrl(): relative links on production-like hostnames (jsdom's
//    localhost) vs absolute https://docs.hivecommons.dev links on branch
//    deploys (unknown hostnames)
//  - config?.relatedProjects fallback to the static placeholder list
//  - the Legacy secondary section: collapsed by default, expand/collapse via
//    the button, autoExpandLegacy prop syncing on rerender
//  - renderLegacyMenuTree(): depth<2 items always visible, depth>=2 children
//    hidden behind expand buttons, Link-vs-<a> selection and the '#' route
//    fallback
//  - the slim variant: theme toggle calls setTheme with the opposite theme,
//    and the expand-sidebar button calls onCollapse
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import type { SharedConfig } from "@/hooks/useSharedConfig";

let pathname = "/docs/hive";
vi.mock("next/navigation", () => ({
  usePathname: () => pathname,
}));

let resolvedTheme: string | undefined = "light";
const setThemeMock = vi.fn();
vi.mock("next-themes", () => ({
  useTheme: () => ({ resolvedTheme, setTheme: setThemeMock }),
}));

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...rest
  }: React.PropsWithChildren<{ href: string } & Record<string, unknown>>) => (
    <a href={href} data-next-link="true" {...rest}>
      {children}
    </a>
  ),
}));

const useSharedConfigMock = vi.fn<() => { config: SharedConfig | null }>(
  () => ({
    config: null,
  })
);
vi.mock("@/hooks/useSharedConfig", async importOriginal => {
  const actual =
    await importOriginal<typeof import("@/hooks/useSharedConfig")>();
  return {
    ...actual,
    useSharedConfig: () => useSharedConfigMock(),
  };
});

import { RelatedProjects } from "@/components/docs/RelatedProjects";

function configWith(
  relatedProjects: SharedConfig["relatedProjects"]
): SharedConfig {
  return {
    versions: {},
    projects: {},
    relatedProjects,
    editBaseUrls: {},
    updatedAt: "2026-01-01T00:00:00Z",
  };
}

const projects = [
  { title: "Hive", href: "/docs/hive" },
  { title: "pluk", href: "/docs/pluk" },
  { title: "Old Thing", href: "/docs/old-thing", secondary: true },
];

beforeEach(() => {
  pathname = "/docs/hive";
  resolvedTheme = "light";
  useSharedConfigMock.mockReturnValue({ config: configWith(projects) });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("project list and highlighting", () => {
  it("renders config projects and highlights the current one from the pathname", () => {
    pathname = "/docs/pluk/setup";
    render(<RelatedProjects />);
    const active = screen.getByText("pluk");
    const inactive = screen.getByText("Hive");
    expect(active.className).toContain("font-medium");
    expect(inactive.className).not.toContain("font-medium");
  });

  it("highlights projects without a hard-coded prefix, not Hive", () => {
    pathname = "/docs/rationguard/overview/introduction";
    useSharedConfigMock.mockReturnValue({
      config: configWith([
        { title: "Hive", href: "/docs/hive/overview/introduction" },
        {
          title: "rationguard",
          href: "/docs/rationguard/overview/introduction",
        },
      ]),
    });
    render(<RelatedProjects />);
    expect(screen.getByText("rationguard").className).toContain("font-medium");
    expect(screen.getByText("Hive").className).not.toContain("font-medium");
  });

  it("falls back to Hive when no section prefix matches", () => {
    pathname = "/docs/something-else";
    render(<RelatedProjects />);
    expect(screen.getByText("Hive").className).toContain("font-medium");
  });

  it("falls back to the static placeholder list without config", () => {
    useSharedConfigMock.mockReturnValue({ config: null });
    render(<RelatedProjects />);
    expect(screen.getByText("Console")).toBeTruthy();
    expect(screen.getByText("Loading projects...")).toBeTruthy();
  });

  it("highlights a matching general section instead of a project", () => {
    pathname = "/docs/community/meetings";
    render(
      <RelatedProjects
        generalSections={[{ title: "Community", href: "/docs/community" }]}
      />
    );
    expect(screen.getByText("Community").className).toContain("font-medium");
    expect(screen.getByText("Hive").className).not.toContain("font-medium");
  });
});

describe("getProjectUrl branch-deploy handling", () => {
  it("keeps links relative on localhost (production-like host)", async () => {
    render(<RelatedProjects />);
    // The mounted effect re-evaluates isProduction from window.location.
    expect((await screen.findByText("pluk")).getAttribute("href")).toBe(
      "/docs/pluk"
    );
  });

  it("prefixes the production origin on unknown hostnames", async () => {
    const original = window.location;
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { ...original, hostname: "deploy-preview.example.com" },
    });
    try {
      render(<RelatedProjects />);
      expect((await screen.findByText("pluk")).getAttribute("href")).toBe(
        "https://docs.hivecommons.dev/docs/pluk"
      );
      // Absolute URLs render as plain <a>, not next/link.
      expect(
        screen.getByText("pluk").getAttribute("data-next-link")
      ).toBeNull();
    } finally {
      Object.defineProperty(window, "location", {
        configurable: true,
        value: original,
      });
    }
  });
});

describe("Legacy secondary section", () => {
  it("is collapsed by default and expands via the Legacy button", () => {
    render(<RelatedProjects />);
    const wrapper = screen
      .getByText("Old Thing")
      .closest("div.overflow-hidden");
    expect(wrapper?.className).toContain("max-h-0");
    fireEvent.click(screen.getByText("Legacy"));
    expect(wrapper?.className).toContain("max-h-[2000px]");
    fireEvent.click(screen.getByText("Legacy"));
    expect(wrapper?.className).toContain("max-h-0");
  });

  it("syncs with autoExpandLegacy across rerenders", () => {
    const { rerender } = render(<RelatedProjects autoExpandLegacy={false} />);
    const wrapper = screen
      .getByText("Old Thing")
      .closest("div.overflow-hidden");
    expect(wrapper?.className).toContain("max-h-0");
    rerender(<RelatedProjects autoExpandLegacy={true} />);
    expect(wrapper?.className).toContain("max-h-[2000px]");
  });
});

describe("renderLegacyMenuTree", () => {
  const legacyPageMap = [
    {
      name: "Guides",
      children: [
        {
          name: "Advanced",
          children: [
            {
              name: "Deep",
              children: [{ name: "Deepest", route: "/docs/legacy/deepest" }],
            },
          ],
        },
        { name: "Quickstart", route: "/docs/legacy/quickstart" },
      ],
    },
    { name: "External", route: "https://example.com/legacy" },
    { name: "No Route" },
  ];

  function renderTree() {
    // The tree renders only under the *current* secondary project, and
    // getCurrentProject() matches the pathname against the project hrefs, so
    // the secondary project's href must be a prefix of the pathname.
    pathname = "/docs/pluk";
    useSharedConfigMock.mockReturnValue({
      config: configWith([
        { title: "Hive", href: "/docs/hive" },
        { title: "pluk", href: "/docs/pluk", secondary: true },
      ]),
    });
    render(<RelatedProjects autoExpandLegacy legacyPageMap={legacyPageMap} />);
  }

  it("shows depth<2 items directly, with Link/anchor/# route selection", () => {
    renderTree();
    expect(screen.getByText("Guides")).toBeTruthy();
    expect(screen.getByText("Quickstart").getAttribute("href")).toBe(
      "/docs/legacy/quickstart"
    );
    expect(screen.getByText("Quickstart").getAttribute("data-next-link")).toBe(
      "true"
    );
    const external = screen.getByText("External");
    expect(external.getAttribute("href")).toBe("https://example.com/legacy");
    expect(external.getAttribute("data-next-link")).toBeNull();
    expect(screen.getByText("No Route").getAttribute("href")).toBe("#");
  });

  it("hides depth>=2 children behind an expand toggle", () => {
    renderTree();
    // "Deep" (depth 2, has children) renders as an expandable button.
    expect(screen.queryByText("Deepest")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Deep/ }));
    expect(screen.getByText("Deepest").getAttribute("href")).toBe(
      "/docs/legacy/deepest"
    );
    fireEvent.click(screen.getByRole("button", { name: /Deep/ }));
    expect(screen.queryByText("Deepest")).toBeNull();
  });

  it("does not render the tree for a non-current legacy project", () => {
    pathname = "/docs/hive";
    render(<RelatedProjects autoExpandLegacy legacyPageMap={legacyPageMap} />);
    expect(screen.queryByText("Quickstart")).toBeNull();
  });
});

describe("slim variant", () => {
  it("toggles the theme to the opposite of the resolved one", async () => {
    resolvedTheme = "dark";
    render(<RelatedProjects variant="slim" />);
    fireEvent.click(await screen.findByTitle("Change theme"));
    expect(setThemeMock).toHaveBeenCalledWith("light");
  });

  it("calls onCollapse from the expand-sidebar button and omits it otherwise", async () => {
    const onCollapse = vi.fn();
    render(<RelatedProjects variant="slim" onCollapse={onCollapse} />);
    fireEvent.click(await screen.findByTitle("Expand sidebar"));
    expect(onCollapse).toHaveBeenCalledTimes(1);

    cleanup();
    render(<RelatedProjects variant="slim" />);
    await screen.findByTitle("Change theme");
    expect(screen.queryByTitle("Expand sidebar")).toBeNull();
  });
});
