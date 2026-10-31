// Guards the hand-maintained routing and security-header invariants in
// next.config.ts. The file is outside the coverage include (it is not under
// src/, scripts/ or netlify/) and is only evaluated by `next build`, which no
// PR check runs, so a weakened CSP, a dropped HSTS header or a rewrite that
// no longer points at a real route handler would otherwise reach production
// unnoticed.
//
// nextra and next-intl's plugin are mocked as identity wrappers: the test is
// about the config object this repository writes, not about what those
// frameworks add to it.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("nextra", () => ({
  default: () => (config: unknown) => config,
}));
vi.mock("next-intl/plugin", () => ({
  default: () => (config: unknown) => config,
}));

const REPO_ROOT = join(__dirname, "..", "..");

type HeaderRule = { source: string; headers: { key: string; value: string }[] };
type Rewrite = { source: string; destination: string };
type Redirect = { source: string; destination: string; permanent: boolean };

let headerRules: HeaderRule[];
let rewrites: Rewrite[];
let redirects: Redirect[];
let pageExtensions: string[];
let poweredByHeader: boolean | undefined;
let siteHeaders: Map<string, string>;
let csp: Map<string, string[]>;

beforeAll(async () => {
  const { default: config } = await import("../../next.config");
  headerRules = await config.headers!();
  rewrites = (await config.rewrites!()) as Rewrite[];
  redirects = (await config.redirects!()) as Redirect[];
  pageExtensions = config.pageExtensions!;
  poweredByHeader = config.poweredByHeader;

  const siteWide = headerRules.find(r => r.source === "/(.*)");
  expect(siteWide, "a site-wide header rule for /(.*)").toBeDefined();
  siteHeaders = new Map(siteWide!.headers.map(h => [h.key, h.value]));

  csp = new Map();
  for (const directive of siteHeaders
    .get("Content-Security-Policy")!
    .split(";")) {
    const [name, ...sources] = directive.trim().split(/\s+/);
    csp.set(name, sources);
  }
});

describe("next.config.ts site-wide security headers", () => {
  it("applies exactly one header rule, scoped to every route", () => {
    expect(headerRules).toHaveLength(1);
    expect(headerRules[0].source).toBe("/(.*)");
    // No header key is listed twice; a duplicate would make the effective
    // value browser-dependent.
    const keys = headerRules[0].headers.map(h => h.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("sets the clickjacking, sniffing, referrer and permissions headers", () => {
    expect(siteHeaders.get("X-Frame-Options")).toBe("DENY");
    expect(siteHeaders.get("X-Content-Type-Options")).toBe("nosniff");
    expect(siteHeaders.get("Referrer-Policy")).toBe(
      "strict-origin-when-cross-origin"
    );
    const permissions = siteHeaders.get("Permissions-Policy")!;
    for (const feature of ["camera", "microphone", "geolocation"]) {
      expect(permissions).toContain(`${feature}=()`);
    }
  });

  it("does not advertise the framework via x-powered-by", () => {
    // Next.js defaults poweredByHeader to true; the flag must be set
    // explicitly to false, not merely left undefined.
    expect(poweredByHeader).toBe(false);
  });

  it("sends HSTS for at least one year with includeSubDomains and preload", () => {
    const hsts = siteHeaders.get("Strict-Transport-Security")!;
    const maxAge = Number(/max-age=(\d+)/.exec(hsts)?.[1]);
    // hstspreload.org requires >= 31536000 (one year) plus both flags.
    expect(maxAge).toBeGreaterThanOrEqual(31_536_000);
    expect(hsts).toContain("includeSubDomains");
    expect(hsts).toContain("preload");
  });
});

describe("next.config.ts Content-Security-Policy", () => {
  it("is well-formed: unique directives, each with at least one source", () => {
    const raw = siteHeaders.get("Content-Security-Policy")!;
    const names = raw.split(";").map(d => d.trim().split(/\s+/)[0]);
    expect(new Set(names).size).toBe(names.length);
    for (const [name, sources] of csp) {
      expect(name, "directive name").toMatch(/^[a-z-]+$/);
      expect(sources.length, `${name} has sources`).toBeGreaterThan(0);
    }
  });

  it("keeps the fail-closed baseline directives", () => {
    expect(csp.get("default-src")).toEqual(["'self'"]);
    expect(csp.get("frame-ancestors")).toEqual(["'none'"]);
    expect(csp.get("base-uri")).toEqual(["'self'"]);
    expect(csp.get("form-action")).toEqual(["'self'"]);
    expect(csp.get("object-src") ?? ["'none'"]).toEqual(["'none'"]);
  });

  it("never allows unsafe-eval, wildcard or plain-http sources", () => {
    for (const [name, sources] of csp) {
      expect(sources, name).not.toContain("'unsafe-eval'");
      expect(sources, name).not.toContain("*");
      for (const source of sources) {
        expect(source, `${name} source ${source}`).not.toMatch(/^http:/);
        // No scheme-only https: wildcard outside img-src, where it is the
        // documented allowance for external avatars and badges.
        if (name !== "img-src") {
          expect(source, `${name} source ${source}`).not.toBe("https:");
        }
      }
    }
  });

  it("confines unsafe-inline to script-src and style-src", () => {
    for (const [name, sources] of csp) {
      if (name === "script-src" || name === "style-src") continue;
      expect(sources, name).not.toContain("'unsafe-inline'");
    }
  });

  it("allows the hosts the site actually talks to", () => {
    // src/components/navbar/useGithubStats.ts and the version switcher fetch
    // GitHub; the YouTube embed on the meetings page uses the nocookie host.
    expect(csp.get("connect-src")).toContain("https://api.github.com");
    // useGithubStats.ts fetches shields.io; useSharedConfig.ts fetches the
    // production shared.json cross-origin on preview deploys.
    expect(csp.get("connect-src")).toContain("https://img.shields.io");
    expect(csp.get("connect-src")).toContain("https://docs.hivecommons.dev");
    expect(csp.get("frame-src")).toEqual(["https://www.youtube-nocookie.com"]);
    // Mermaid renders in a blob: worker and needs WASM, but not eval.
    expect(csp.get("worker-src")).toEqual(["blob:"]);
    expect(csp.get("script-src")).toContain("'wasm-unsafe-eval'");
  });
});

describe("next.config.ts routing", () => {
  it("rewrites /docs-images onto a route handler that exists", () => {
    expect(rewrites).toEqual([
      { source: "/docs-images/:path*", destination: "/api/docs-image/:path*" },
    ]);
    expect(
      existsSync(join(REPO_ROOT, "src/app/api/docs-image/[...path]/route.ts"))
    ).toBe(true);
  });

  it("keeps the /code redirect in step with netlify.toml", () => {
    // The same short URL is declared in both files (netlify.toml wins on
    // Netlify, next.config.ts everywhere else); they must not disagree.
    const toml = readFileSync(join(REPO_ROOT, "netlify.toml"), "utf8");
    const block = /\[\[redirects\]\]\s*\n\s*from = "\/code"\n([^[]*)/.exec(
      toml
    );
    expect(block, 'a [[redirects]] block for from = "/code"').not.toBeNull();
    const netlifyTo = /to = "([^"]+)"/.exec(block![1])?.[1];
    const netlifyStatus = /status = (\d+)/.exec(block![1])?.[1];

    const nextCode = redirects.find(r => r.source === "/code");
    expect(nextCode).toBeDefined();
    expect(nextCode!.destination).toBe(netlifyTo);
    expect(nextCode!.permanent).toBe(netlifyStatus === "301");
  });

  it("declares every page extension nextra and the MDX docs rely on", () => {
    // Dropping md/mdx silently turns every docs page into a 404 at build.
    for (const ext of ["js", "jsx", "ts", "tsx", "md", "mdx"]) {
      expect(pageExtensions, ext).toContain(ext);
    }
  });
});
