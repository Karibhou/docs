// @vitest-environment jsdom
//
// Covers src/components/Footer.tsx (previously 0%):
//  - brand description, section headings, and copyright with current year
//  - internal docs links go through getLocalizedUrl; external links carry
//    target="_blank" + rel="noopener noreferrer"
//  - newsletter form: empty/whitespace email is a no-op, a real email
//    triggers the "not available yet" alert and clears the field
//  - back-to-top button: hidden at the top, shown after scrolling past
//    300px, hidden again on return, and click smooth-scrolls to the top
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import en from "../../messages/en.json";

vi.mock("@/components/index", () => ({
  GridLines: (props: { horizontalLines?: number; verticalLines?: number }) => (
    <div
      data-testid="grid-lines"
      data-h={props.horizontalLines}
      data-v={props.verticalLines}
    />
  ),
  StarField: (props: { density?: string; cometCount?: number }) => (
    <div
      data-testid="star-field"
      data-density={props.density}
      data-comets={props.cometCount}
    />
  ),
}));

vi.mock("@/i18n/navigation", () => ({
  Link: ({
    href,
    children,
    ...rest
  }: React.PropsWithChildren<{ href: string } & Record<string, unknown>>) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

vi.mock("next-intl", async () => {
  const messages = (await import("../../messages/en.json")).default as {
    footer: Record<string, string>;
  };
  return {
    useTranslations:
      (ns: string) => (key: string, params?: Record<string, unknown>) => {
        const table = ns === "footer" ? messages.footer : {};
        let msg = table[key] ?? key;
        for (const [k, v] of Object.entries(params ?? {})) {
          msg = msg.replace(`{${k}}`, String(v));
        }
        return msg;
      },
  };
});

import Footer from "@/components/Footer";

const footerMsgs = en.footer as Record<string, string>;

let alertSpy: ReturnType<typeof vi.spyOn>;
let scrollToSpy: ReturnType<typeof vi.fn>;

function setScrollY(value: number) {
  Object.defineProperty(window, "scrollY", {
    value,
    writable: true,
    configurable: true,
  });
}

beforeEach(() => {
  alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {});
  scrollToSpy = vi.fn();
  window.scrollTo = scrollToSpy as unknown as typeof window.scrollTo;
  setScrollY(0);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("Footer content", () => {
  it("renders brand, section headings, and the year-substituted copyright", () => {
    render(<Footer />);
    expect(screen.getByAltText("Hive Commons logo")).toBeTruthy();
    expect(screen.getByText(footerMsgs.description)).toBeTruthy();
    for (const heading of [
      footerMsgs.docs,
      footerMsgs.gettingStarted,
      footerMsgs.resources,
    ]) {
      expect(screen.getByRole("heading", { name: heading })).toBeTruthy();
    }
    const year = String(new Date().getFullYear());
    const copyright = footerMsgs.copyright.replace("{year}", year);
    expect(screen.getByText(copyright)).toBeTruthy();
    expect(copyright).toContain(year);
  });

  it("renders internal docs links and external links with safe attributes", () => {
    render(<Footer />);
    const releaseLink = screen.getByRole("link", {
      name: footerMsgs.releasesNotes,
    });
    expect(releaseLink.getAttribute("href")).toBe(
      "https://github.com/hivecommons/hive/releases"
    );
    expect(releaseLink.getAttribute("target")).toBe("_blank");
    expect(releaseLink.getAttribute("rel")).toBe("noopener noreferrer");

    const liveDemo = screen.getByRole("link", { name: footerMsgs.liveDemo });
    expect(liveDemo.getAttribute("href")).toBe("https://hivecommons.dev");
    expect(liveDemo.getAttribute("rel")).toBe("noopener noreferrer");

    expect(
      screen.getByRole("link", { name: footerMsgs.news }).getAttribute("href")
    ).toBe("/docs/news/latest-news");
    // getLocalizedUrl passes relative URLs through unchanged
    expect(
      screen
        .getByRole("link", { name: footerMsgs.overview })
        .getAttribute("href")
    ).toBe("/docs");

    const socials = screen
      .getAllByRole("link")
      .filter(a => a.getAttribute("href") === "https://github.com/hivecommons");
    expect(socials.length).toBeGreaterThanOrEqual(4);
  });

  it("renders the background animation layers", () => {
    render(<Footer />);
    expect(screen.getByTestId("star-field").getAttribute("data-density")).toBe(
      "low"
    );
    expect(screen.getByTestId("grid-lines").getAttribute("data-h")).toBe("21");
    expect(screen.getByTestId("grid-lines").getAttribute("data-v")).toBe("15");
  });
});

describe("newsletter subscribe form", () => {
  function emailInput(): HTMLInputElement {
    return screen.getByPlaceholderText(
      footerMsgs.emailPlaceholder
    ) as HTMLInputElement;
  }
  function form(): HTMLFormElement {
    return document.getElementById("newsletter-form") as HTMLFormElement;
  }

  it("ignores submission when the email is empty", () => {
    render(<Footer />);
    fireEvent.submit(form());
    expect(alertSpy).not.toHaveBeenCalled();
  });

  it("ignores submission when the email is only whitespace", () => {
    render(<Footer />);
    fireEvent.change(emailInput(), { target: { value: "   " } });
    fireEvent.submit(form());
    expect(alertSpy).not.toHaveBeenCalled();
    // type="email" value sanitization strips whitespace, so the guard
    // sees an empty string and leaves state untouched
    expect(emailInput().value).toBe("");
  });

  it("alerts that subscriptions are unavailable and clears a real email", () => {
    render(<Footer />);
    fireEvent.change(emailInput(), { target: { value: "bee@example.com" } });
    expect(emailInput().value).toBe("bee@example.com");
    fireEvent.submit(form());
    expect(alertSpy).toHaveBeenCalledTimes(1);
    expect(alertSpy).toHaveBeenCalledWith(
      "Subscriptions are not available yet. Please try again later."
    );
    expect(emailInput().value).toBe("");
  });
});

describe("back-to-top button", () => {
  function button(): HTMLButtonElement {
    return screen.getByRole("button", {
      name: footerMsgs.backToTop,
    }) as HTMLButtonElement;
  }

  it("starts hidden via the initial scroll check", () => {
    render(<Footer />);
    expect(button().style.opacity).toBe("0");
    expect(button().style.transform).toBe("translateY(10px)");
  });

  it("appears past 300px of scroll and hides again on return", () => {
    render(<Footer />);
    setScrollY(400);
    fireEvent.scroll(window);
    expect(button().style.opacity).toBe("1");
    expect(button().style.transform).toBe("translateY(-30px)");

    setScrollY(120);
    fireEvent.scroll(window);
    expect(button().style.opacity).toBe("0");
    expect(button().style.transform).toBe("translateY(10px)");
  });

  it("smooth-scrolls to the top when clicked", () => {
    render(<Footer />);
    fireEvent.click(button());
    expect(scrollToSpy).toHaveBeenCalledWith({ top: 0, behavior: "smooth" });
  });

  it("removes scroll and click listeners on unmount", () => {
    const windowRemoveSpy = vi.spyOn(window, "removeEventListener");
    const { unmount } = render(<Footer />);
    const buttonRemoveSpy = vi.spyOn(button(), "removeEventListener");

    unmount();

    expect(windowRemoveSpy).toHaveBeenCalledWith(
      "scroll",
      expect.any(Function)
    );
    expect(buttonRemoveSpy).toHaveBeenCalledWith("click", expect.any(Function));
  });
});
