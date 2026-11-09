// @vitest-environment jsdom
//
// Covers the non-WebGL animation components (previously 0%):
//  - GridLines: builds one SVG with horizontalLines + verticalLines <line>
//    children, applies stroke props, honours 0-line props, wires `speed`
//    into the container animation and clears + rebuilds on prop change
//  - StarField: star count follows the density map (100/150/200), comets
//    follow showComets/cometCount, every star gets exactly one size class,
//    and a re-render replaces rather than appends
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

import GridLines from "@/components/animations/GridLines";
import StarField from "@/components/animations/StarField";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

// jsdom reorders the `animation` shorthand on serialization (jsdom 31 puts
// the name last) and may fold a separately-set `animation-delay` back into
// it, so assert that every expected token is present rather than comparing
// the exact string.
function expectAnimation(el: Element, expected: string) {
  const tokens = (s: string) => s.trim().split(/\s+/);
  const actual = tokens((el as HTMLElement | SVGElement).style.animation);
  expect(actual).toEqual(expect.arrayContaining(tokens(expected)));
}

describe("GridLines", () => {
  it("renders one svg with horizontal + vertical lines and default stroke props", () => {
    const { container } = render(<GridLines />);
    const svgs = container.querySelectorAll("svg");
    expect(svgs).toHaveLength(1);
    const lines = svgs[0].querySelectorAll("line");
    expect(lines).toHaveLength(40);

    const horizontal = [...lines].filter(
      l => l.getAttribute("x1") === "0" && l.getAttribute("x2") === "100%"
    );
    const vertical = [...lines].filter(
      l => l.getAttribute("y1") === "0" && l.getAttribute("y2") === "100%"
    );
    expect(horizontal).toHaveLength(20);
    expect(vertical).toHaveLength(20);

    // Spacing is 100 / n percent; the i-th line sits at i * spacing.
    expect(horizontal[0].getAttribute("y1")).toBe("0%");
    expect(horizontal[1].getAttribute("y1")).toBe("5%");
    expect(vertical[3].getAttribute("x1")).toBe("15%");

    for (const l of lines) {
      expect(l.getAttribute("stroke")).toBe("#6366F1");
      expect(l.getAttribute("stroke-width")).toBe("0.5");
      expect(l.getAttribute("stroke-opacity")).toBe("0.2");
    }
    expectAnimation(svgs[0], "move-diagonal 5s linear infinite");
  });

  it("applies custom stroke, speed, opacity and className props", () => {
    const { container } = render(
      <GridLines
        className="extra"
        horizontalLines={3}
        verticalLines={2}
        strokeColor="#ff0000"
        strokeWidth={2}
        strokeOpacity={0.9}
        speed={12}
        opacity={0.5}
      />
    );
    const root = container.firstElementChild as HTMLElement;
    expect(root.className).toContain("extra");
    expect(root.style.opacity).toBe("0.5");

    const svg = container.querySelector("svg")!;
    expectAnimation(svg, "move-diagonal 12s linear infinite");
    const lines = svg.querySelectorAll("line");
    expect(lines).toHaveLength(5);
    expect(lines[0].getAttribute("stroke")).toBe("#ff0000");
    expect(lines[0].getAttribute("stroke-width")).toBe("2");
    expect(lines[0].getAttribute("stroke-opacity")).toBe("0.9");
    // Pulse animation staggers by 0.2s per line within each orientation.
    expect(lines[1].style.animationDelay).toBe("0.2s");
    expectAnimation(lines[1], "gridPulse 4s infinite alternate ease-in-out");
  });

  it("renders an empty svg when both line counts are 0", () => {
    const { container } = render(
      <GridLines horizontalLines={0} verticalLines={0} />
    );
    const svg = container.querySelector("svg")!;
    expect(svg).toBeTruthy();
    expect(svg.querySelectorAll("line")).toHaveLength(0);
  });

  it("clears and rebuilds the grid when a line count changes", () => {
    const { container, rerender } = render(
      <GridLines horizontalLines={2} verticalLines={2} />
    );
    expect(container.querySelectorAll("line")).toHaveLength(4);

    rerender(<GridLines horizontalLines={5} verticalLines={1} />);
    expect(container.querySelectorAll("svg")).toHaveLength(1);
    expect(container.querySelectorAll("line")).toHaveLength(6);
  });
});

describe("StarField", () => {
  const stars = (c: HTMLElement) => c.querySelectorAll(".star");
  const comets = (c: HTMLElement) => c.querySelectorAll(".comet");

  it("defaults to 100 low-density stars and 3 comets", () => {
    const { container } = render(<StarField />);
    expect(stars(container)).toHaveLength(100);
    expect(comets(container)).toHaveLength(3);
    const root = container.firstElementChild as HTMLElement;
    expect(root.style.zIndex).toBe("1");
    expect(root.className).toContain("pointer-events-none");
  });

  it.each([
    ["medium", 150],
    ["high", 200],
  ] as const)("density=%s renders %i stars", (density, count) => {
    const { container } = render(<StarField density={density} />);
    expect(stars(container)).toHaveLength(count);
  });

  it("honours cometCount and suppresses comets when showComets=false", () => {
    const a = render(<StarField cometCount={7} />);
    expect(comets(a.container)).toHaveLength(7);
    cleanup();

    const b = render(<StarField showComets={false} cometCount={7} />);
    expect(comets(b.container)).toHaveLength(0);
    expect(stars(b.container)).toHaveLength(100);
  });

  it("gives every star exactly one size class and positions/animation timings", () => {
    const { container } = render(<StarField />);
    const sizeClasses = [
      "star-tiny",
      "star-small",
      "star-medium",
      "star-large",
    ];
    for (const star of stars(container)) {
      const hit = sizeClasses.filter(c => star.classList.contains(c));
      expect(hit).toHaveLength(1);
      const el = star as HTMLElement;
      expect(el.style.left).toMatch(/%$/);
      expect(el.style.top).toMatch(/%$/);
      expect(el.style.animationDelay).toMatch(/s$/);
      expect(el.style.animationDuration).toMatch(/s$/);
    }
    const cometSizes = ["comet-small", "comet-medium", "comet-large"];
    for (const comet of comets(container)) {
      expect(cometSizes.filter(c => comet.classList.contains(c))).toHaveLength(
        1
      );
    }
  });

  it("covers every star and comet size bucket across the random distribution", () => {
    // Walk Math.random through each size threshold so all four star buckets
    // (<0.6, <0.85, <0.95, else) and three comet buckets (<0.5, <0.8, else)
    // are exercised deterministically. Each star consumes 5 random values
    // and each comet 4, so the sequence length is coprime with both to keep
    // the size draw from landing on the same value every time.
    const seq = [0.1, 0.7, 0.9, 0.99, 0.3, 0.6, 0.85];
    let i = 0;
    vi.spyOn(Math, "random").mockImplementation(() => seq[i++ % seq.length]);
    const { container } = render(<StarField cometCount={8} />);
    for (const cls of [
      "star-tiny",
      "star-small",
      "star-medium",
      "star-large",
    ]) {
      expect(container.querySelector(`.${cls}`)).not.toBeNull();
    }
    for (const cls of ["comet-small", "comet-medium", "comet-large"]) {
      expect(container.querySelector(`.${cls}`)).not.toBeNull();
    }
  });

  it("replaces rather than appends when density changes", () => {
    const { container, rerender } = render(<StarField density="low" />);
    expect(stars(container)).toHaveLength(100);
    rerender(<StarField density="high" cometCount={1} />);
    expect(stars(container)).toHaveLength(200);
    expect(comets(container)).toHaveLength(1);
  });
});
