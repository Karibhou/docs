// @vitest-environment jsdom
//
// Covers the branches of src/components/docs/DocsSidebar.tsx that
// DocsChrome.behavior.test.tsx leaves untouched:
//  - mount-time collapse state: the folder chain leading to the active page
//    stays open (findActivePath), siblings collapse (collapseAll), and
//    `theme.collapsed === false` pins a folder open
//  - general sections (Community/Contributing/News): expanded only when the
//    current path is inside them, with their own nested active-path handling
//  - getFirstChildRoute(): recursion through nested folders and the
//    no-navigable-route fallback that renders a plain toggle button
//  - folder <Link> click expands a collapsed folder without re-collapsing an
//    open one; the chevron button toggles either way
//  - hidden items (index, _meta, '#', Separator, Meta, blank title) are not
//    rendered
//  - active-project header button collapses/expands the whole tree; the tree
//    is omitted when the pageMap has no project items
//  - non-active project rows: label link expands a collapsed row, chevron
//    toggles, and the docs guide path renders every project as a link
//  - scroll handling: requestAnimationFrame-throttled offset recalculation
//  - mobile close button and SidebarFooter collapse wiring through DocsProvider
import React, { type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...rest
  }: {
    href?: string;
    children?: ReactNode;
  }) => (
    <a
      href={href}
      {...Object.fromEntries(
        Object.entries(rest).filter(([key]) => key !== "prefetch")
      )}
    >
      {children}
    </a>
  ),
}));

let pathname = "/docs/hive/overview/introduction";
vi.mock("next/navigation", () => ({
  usePathname: () => pathname,
}));

import { DocsProvider } from "../components/docs/DocsProvider";
import { DocsSidebar } from "../components/docs/DocsSidebar";

type MenuItem = React.ComponentProps<typeof DocsSidebar>["pageMap"][number];

function renderSidebar(pageMap: MenuItem[], projectId = "hive") {
  return render(
    <DocsProvider>
      <DocsSidebar pageMap={pageMap} projectId={projectId} />
    </DocsProvider>
  );
}

/** The chevron <button> in the same row as the given label text. */
function chevronFor(label: string): HTMLButtonElement {
  const row = screen.getByText(label).closest("div");
  const button = row?.querySelector("button");
  if (!button) throw new Error(`no chevron button in row for "${label}"`);
  return button;
}

/** The collapsible children container that follows the row for `label`. */
function childrenContainerFor(label: string): HTMLElement {
  const row = screen.getByText(label).closest("div")!.parentElement!;
  const container = row.nextElementSibling as HTMLElement | null;
  if (!container) throw new Error(`no children container after "${label}"`);
  return container;
}

const projectTree: MenuItem[] = [
  { name: "Overview", route: "/docs/hive/overview/introduction" },
  {
    name: "Guides",
    children: [
      { name: "index", route: "/docs/hive/guides" },
      { name: "_meta", kind: "Meta" },
      { name: "Install", route: "/docs/hive/guides/install" },
      {
        name: "Advanced",
        children: [
          { name: "Tuning", route: "/docs/hive/guides/advanced/tuning" },
        ],
      },
    ],
  },
  {
    name: "Reference",
    children: [{ name: "CLI", route: "/docs/hive/reference/cli" }],
  },
  {
    name: "Pinned",
    theme: { collapsed: false },
    children: [{ name: "Always", route: "/docs/hive/pinned/always" }],
  },
  {
    name: "Community",
    children: [
      { name: "Meetings", route: "/docs/community/meetings" },
      {
        name: "Events",
        children: [{ name: "Summit", route: "/docs/community/events/summit" }],
      },
    ],
  },
  {
    name: "Contributing",
    children: [{ name: "Guide", route: "/docs/contributing/guide" }],
  },
];

beforeEach(() => {
  pathname = "/docs/hive/overview/introduction";
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  document.body.innerHTML = "";
});

describe("DocsSidebar initial collapse state", () => {
  it("opens the folder chain to the active page and collapses the rest", () => {
    pathname = "/docs/hive/guides/advanced/tuning";
    renderSidebar(projectTree);

    expect(chevronFor("Guides").getAttribute("aria-label")).toBe(
      "Collapse section"
    );
    expect(chevronFor("Advanced").getAttribute("aria-label")).toBe(
      "Collapse section"
    );
    expect(chevronFor("Reference").getAttribute("aria-label")).toBe(
      "Expand section"
    );

    const active = screen.getByRole("link", { name: "Tuning" });
    expect(active.className).toContain("text-honey");
    expect(screen.getByRole("link", { name: "CLI" }).className).not.toContain(
      "text-honey"
    );
  });

  it("keeps theme.collapsed === false folders open when they are not on the active path", () => {
    renderSidebar(projectTree);

    expect(chevronFor("Pinned").getAttribute("aria-label")).toBe(
      "Collapse section"
    );
    expect(chevronFor("Guides").getAttribute("aria-label")).toBe(
      "Expand section"
    );
  });

  it("collapses general sections unless the current path is inside one", () => {
    renderSidebar(projectTree);

    expect(chevronFor("Community").getAttribute("aria-label")).toBe(
      "Expand section"
    );
    expect(chevronFor("Contributing").getAttribute("aria-label")).toBe(
      "Expand section"
    );
  });

  it("expands the current general section and its active sub-folder only", () => {
    pathname = "/docs/community/events/summit";
    renderSidebar(projectTree);

    expect(chevronFor("Community").getAttribute("aria-label")).toBe(
      "Collapse section"
    );
    expect(chevronFor("Events").getAttribute("aria-label")).toBe(
      "Collapse section"
    );
    expect(chevronFor("Contributing").getAttribute("aria-label")).toBe(
      "Expand section"
    );
    expect(screen.getByRole("link", { name: "Summit" }).className).toContain(
      "text-honey"
    );
  });

  it("does not render index, _meta, '#', Separator, Meta or untitled items", () => {
    const pageMap: MenuItem[] = [
      { name: "index", route: "/docs/hive" },
      { name: "_meta", kind: "Meta" },
      { name: "Hidden", route: "#" },
      { name: "Sep", kind: "Separator" },
      { name: "", route: "/docs/hive/blank" },
      { name: "   ", route: "/docs/hive/spaces" },
      { name: "Visible", route: "/docs/hive/visible" },
    ];
    renderSidebar(pageMap);

    const hrefs = screen
      .getAllByRole("link")
      .map(link => link.getAttribute("href"));
    expect(hrefs).toContain("/docs/hive/visible");
    expect(hrefs).not.toContain("/docs/hive");
    expect(hrefs).not.toContain("#");
    expect(hrefs).not.toContain("/docs/hive/blank");
    expect(hrefs).not.toContain("/docs/hive/spaces");
    expect(screen.queryByText("Hidden")).toBeNull();
    expect(screen.queryByText("Sep")).toBeNull();
  });
});

describe("DocsSidebar folder rows", () => {
  it("links a folder to its first navigable route, recursing past Meta items and into nested folders", () => {
    const pageMap: MenuItem[] = [
      {
        name: "Deep",
        children: [
          { name: "_meta", kind: "Meta" },
          { name: "Sep", kind: "Separator" },
          { name: "Placeholder", route: "#" },
          {
            name: "Inner",
            route: "/docs/hive/deep/inner",
            children: [{ name: "Leaf", route: "/docs/hive/deep/inner/leaf" }],
          },
        ],
      },
    ];
    renderSidebar(pageMap);

    expect(
      screen.getByRole("link", { name: "Deep" }).getAttribute("href")
    ).toBe("/docs/hive/deep/inner/leaf");
  });

  it("renders a plain toggle button for a folder with no navigable route", () => {
    const pageMap: MenuItem[] = [
      {
        name: "Empty",
        children: [
          { name: "_meta", kind: "Meta" },
          { name: "Hidden", route: "#" },
        ],
      },
    ];
    renderSidebar(pageMap);

    expect(screen.queryByRole("link", { name: "Empty" })).toBeNull();
    const toggle = screen.getByRole("button", { name: "Empty" });
    const container = toggle.parentElement!.nextElementSibling as HTMLElement;
    expect(container.className).toContain("max-h-0");
    fireEvent.click(toggle);
    expect(container.className).toContain("max-h-[2000px]");
    fireEvent.click(toggle);
    expect(container.className).toContain("max-h-0");
  });

  it("expands a collapsed folder when its label link is clicked but does not collapse an open one", () => {
    renderSidebar(projectTree);

    const guides = screen.getByRole("link", { name: "Guides" });
    // The hidden index child is still the folder's first navigable route.
    expect(guides.getAttribute("href")).toBe("/docs/hive/guides");
    expect(chevronFor("Guides").getAttribute("aria-label")).toBe(
      "Expand section"
    );

    fireEvent.click(guides);
    expect(chevronFor("Guides").getAttribute("aria-label")).toBe(
      "Collapse section"
    );

    fireEvent.click(guides);
    expect(chevronFor("Guides").getAttribute("aria-label")).toBe(
      "Collapse section"
    );
  });

  it("toggles a folder from the chevron button regardless of state", () => {
    renderSidebar(projectTree);
    const container = childrenContainerFor("Guides");

    expect(container.className).toContain("max-h-0");
    fireEvent.click(chevronFor("Guides"));
    expect(container.className).toContain("max-h-[2000px]");
    fireEvent.click(chevronFor("Guides"));
    expect(container.className).toContain("max-h-0");
  });
});

describe("DocsSidebar project rows", () => {
  it("collapses and re-expands the active project tree from its header button", () => {
    renderSidebar(projectTree);

    const header = screen.getByRole("button", { name: "Hive" });
    const tree = header.nextElementSibling as HTMLElement;
    expect(tree.className).toContain("max-h-[2000px]");

    fireEvent.click(header);
    expect(tree.className).toContain("max-h-0");
    fireEvent.click(header);
    expect(tree.className).toContain("max-h-[2000px]");
  });

  it("omits the active project tree when the pageMap has only general sections", () => {
    renderSidebar([
      {
        name: "Community",
        children: [{ name: "Meetings", route: "/docs/community/meetings" }],
      },
    ]);

    expect(screen.queryByRole("button", { name: "Hive" })).toBeNull();
    expect(screen.getByRole("link", { name: "hotshot" })).toBeTruthy();
  });

  it("renders non-active projects as links whose chevron reveals an Overview link", () => {
    renderSidebar(projectTree);

    const pluk = screen.getByRole("link", { name: "pluk" });
    expect(pluk.getAttribute("href")).toBe("/docs/pluk/overview/introduction");

    const chevron = chevronFor("pluk");
    const container = pluk.parentElement!.nextElementSibling as HTMLElement;
    expect(chevron.getAttribute("aria-label")).toBe("Expand section");
    expect(container.className).toContain("max-h-0");

    fireEvent.click(chevron);
    expect(chevron.getAttribute("aria-label")).toBe("Collapse section");
    expect(container.className).toContain("max-h-40");
    expect(container.querySelector("a")?.getAttribute("href")).toBe(
      "/docs/pluk/overview/introduction"
    );

    fireEvent.click(chevron);
    expect(container.className).toContain("max-h-0");
  });

  it("expands a collapsed non-active project when its label link is clicked, and leaves an open one alone", () => {
    renderSidebar(projectTree);

    const dibs = screen.getByRole("link", { name: "dibs" });
    expect(chevronFor("dibs").getAttribute("aria-label")).toBe(
      "Expand section"
    );

    fireEvent.click(dibs);
    expect(chevronFor("dibs").getAttribute("aria-label")).toBe(
      "Collapse section"
    );

    fireEvent.click(dibs);
    expect(chevronFor("dibs").getAttribute("aria-label")).toBe(
      "Collapse section"
    );
  });

  it("treats every project as a non-active link on the docs guide page", () => {
    pathname = "/docs/introduction";
    renderSidebar(projectTree);

    expect(screen.queryByRole("button", { name: "Hive" })).toBeNull();
    expect(
      screen.getByRole("link", { name: "Hive" }).getAttribute("href")
    ).toBe("/docs/hive/overview/introduction");
    expect(chevronFor("Hive").getAttribute("aria-label")).toBe(
      "Expand section"
    );
    const projectLinks = screen
      .getAllByRole("link")
      .filter(
        link =>
          link.getAttribute("href")?.endsWith("/overview/introduction") &&
          link.textContent?.trim() !== "Overview"
      );
    expect(
      projectLinks.slice(0, 2).map(link => link.textContent?.trim())
    ).toEqual(["Hive", "Crux"]);
  });

  it("renders Hive as an expanded link row when projectId is omitted", () => {
    render(
      <DocsProvider>
        <DocsSidebar pageMap={projectTree} />
      </DocsProvider>
    );

    // Mount-time collapse treats hive as active (so it is left open), but
    // rendering compares against the undefined projectId, so no tree is shown.
    expect(screen.queryByRole("button", { name: "Hive" })).toBeNull();
    expect(screen.getByRole("link", { name: "Hive" })).toBeTruthy();
    expect(chevronFor("Hive").getAttribute("aria-label")).toBe(
      "Collapse section"
    );
    expect(chevronFor("pluk").getAttribute("aria-label")).toBe(
      "Expand section"
    );
  });
});

describe("DocsSidebar layout and chrome", () => {
  it("throttles scroll-driven offset recalculation through requestAnimationFrame", async () => {
    document.body.innerHTML = '<div class="nextra-nav-container"></div>';
    const nav = document.querySelector(".nextra-nav-container") as HTMLElement;
    let bottom = 64;
    vi.spyOn(nav, "getBoundingClientRect").mockImplementation(
      () => ({ bottom }) as DOMRect
    );
    const frames: FrameRequestCallback[] = [];
    vi.spyOn(window, "requestAnimationFrame").mockImplementation(cb => {
      frames.push(cb);
      return frames.length;
    });

    renderSidebar(projectTree);
    const aside = document.querySelector(
      'aside[data-sidebar="docs"]'
    ) as HTMLElement;
    expect(aside.style.top).toBe("4rem");

    fireEvent.scroll(window);
    fireEvent.scroll(window);
    expect(frames).toHaveLength(1);

    bottom = 96;
    await act(async () => {
      frames[0](0);
    });
    expect(aside.style.top).toBe("96px");
    expect(aside.style.height).toBe("calc(100vh - 96px)");

    fireEvent.scroll(window);
    expect(frames).toHaveLength(2);
  });

  it("leaves layout values alone when no navbar is present", async () => {
    vi.useFakeTimers();
    try {
      renderSidebar(projectTree);
      const aside = document.querySelector(
        'aside[data-sidebar="docs"]'
      ) as HTMLElement;
      await act(async () => {
        vi.advanceTimersByTime(400);
      });
      expect(aside.style.top).toBe("4rem");
      expect(aside.style.height).toBe("calc(100vh - 4rem)");
    } finally {
      vi.useRealTimers();
    }
  });

  it("closes the mobile menu from the close button and collapses via the footer", () => {
    renderSidebar(projectTree);
    const aside = document.querySelector(
      'aside[data-sidebar="docs"]'
    ) as HTMLElement;
    expect(aside.className).toContain("-translate-x-full");
    expect(aside.className).toContain("lg:w-60");

    // The close button toggles menuOpen; starting closed it opens the drawer.
    fireEvent.click(screen.getByLabelText("Close sidebar"));
    expect(aside.className).toContain("translate-x-0 w-60");
    fireEvent.click(screen.getByLabelText("Close sidebar"));
    expect(aside.className).toContain("-translate-x-full");

    const collapse = screen.getAllByRole("button", {
      name: /collapse sidebar/i,
    })[0];
    fireEvent.click(collapse);
    expect(aside.className).toContain("lg:w-16");
  });
});
