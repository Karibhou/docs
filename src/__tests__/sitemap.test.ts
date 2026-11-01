import { afterEach, describe, expect, it, vi } from "vitest";
import fs from "fs";
import path from "path";
import sitemap from "../app/sitemap";
import { PROJECTS, type ProjectId } from "../config/versions";

const SITE_URL = "https://docs.hivecommons.dev";

const PROJECT_IDS = Object.keys(PROJECTS);
const REDIRECT_ONLY_URLS = [
  SITE_URL,
  `${SITE_URL}/en`,
  `${SITE_URL}/docs`,
  ...PROJECT_IDS.map(id => `${SITE_URL}/docs/${id}`),
];

describe("sitemap", () => {
  it("uses absolute production URLs for docs routes", () => {
    const urls = sitemap().map(entry => entry.url);

    expect(urls.every(url => url.startsWith(`${SITE_URL}/docs/`))).toBe(true);
  });

  it("lists pages for every project in PROJECTS", () => {
    const urls = sitemap().map(entry => entry.url);

    for (const projectId of Object.keys(PROJECTS) as ProjectId[]) {
      const projectBasePath = PROJECTS[projectId].basePath;
      expect(
        urls.some(url => url.startsWith(`${SITE_URL}/docs/${projectBasePath}/`))
      ).toBe(true);
    }
  });

  it("omits redirect-only URLs", () => {
    const urls = sitemap().map(entry => entry.url);

    expect(urls).not.toEqual(expect.arrayContaining([SITE_URL]));
    for (const url of REDIRECT_ONLY_URLS) {
      expect(urls).not.toContain(url);
    }
  });

  it("includes canonical targets with carried-over priorities and no duplicates", () => {
    const entries = sitemap();
    const urls = entries.map(entry => entry.url);
    const byUrl = new Map(entries.map(entry => [entry.url, entry]));

    expect(
      byUrl.get(`${SITE_URL}/docs/community/what-is-hive-commons`)?.priority
    ).toBe(1.0);
    for (const project of PROJECT_IDS) {
      expect(
        byUrl.get(`${SITE_URL}/docs/${project}/overview/introduction`)?.priority
      ).toBe(0.9);
    }
    expect(urls).toEqual(
      expect.arrayContaining([
        `${SITE_URL}/docs/hive/overview/architecture`,
        `${SITE_URL}/docs/hive/reference/architecture-decision-records/0001-record-architecture-decisions`,
      ])
    );
    expect(new Set(urls).size).toBe(urls.length);
  });

  it("includes shared general sections once and omits unlinked file-path routes", () => {
    const urls = sitemap().map(entry => entry.url);

    expect(urls).toEqual(
      expect.arrayContaining([
        `${SITE_URL}/docs/community/meetings`,
        `${SITE_URL}/docs/community/join-hive-commons`,
        `${SITE_URL}/docs/community/what-is-hive-commons`,
      ])
    );
    expect(new Set(urls).size).toBe(urls.length);
    expect(urls).not.toContain(`${SITE_URL}/docs/hive/architecture`);
    expect(urls).not.toContain(`${SITE_URL}/docs/hive/community/meetings`);
  });

  it("does not include shared partials or image assets as docs pages", () => {
    const urls = sitemap().map(entry => entry.url);

    expect(urls).not.toContain(`${SITE_URL}/docs/common-subs/coming-soon`);
    expect(urls.some(url => url.includes("/common-subs/"))).toBe(false);
    expect(urls.some(url => url.includes("/images/"))).toBe(false);
  });
});

describe("sitemap generated from fixture content", () => {
  const realCwd = process.cwd();
  let fixtureRoot: string | undefined;

  function write(relPath: string, content = "# stub\n") {
    if (!fixtureRoot) throw new Error("fixtureRoot not initialized");
    const full = path.join(fixtureRoot, relPath);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, content);
    return full;
  }

  afterEach(() => {
    vi.restoreAllMocks();
    if (fixtureRoot) {
      fs.rmSync(fixtureRoot, { recursive: true, force: true });
      fixtureRoot = undefined;
    }
  });

  it("maps navigation-linked files to routes, priorities, and frequencies", () => {
    fixtureRoot = fs.mkdtempSync(path.join(realCwd, ".sitemap-fixture-"));
    write("docs/content/hive/architecture.md");
    write("docs/content/hive/unlinked/page.md");
    vi.spyOn(process, "cwd").mockReturnValue(fixtureRoot);

    const entries = sitemap();
    const byUrl = new Map(entries.map(entry => [entry.url, entry]));
    const arch = byUrl.get(`${SITE_URL}/docs/hive/overview/architecture`);

    for (const url of REDIRECT_ONLY_URLS) {
      expect(byUrl.has(url)).toBe(false);
    }
    expect(arch?.priority).toBe(0.7);
    expect(arch?.changeFrequency).toBe("weekly");
    expect(arch).not.toHaveProperty("lastModified");
    expect(byUrl.has(`${SITE_URL}/docs/hive/architecture`)).toBe(false);
    expect(byUrl.has(`${SITE_URL}/docs/hive/unlinked/page`)).toBe(false);
  });

  it("omits generated routes and redirect-only URLs for missing content", () => {
    fixtureRoot = fs.mkdtempSync(path.join(realCwd, ".sitemap-empty-"));
    vi.spyOn(process, "cwd").mockReturnValue(fixtureRoot);

    const urls = sitemap().map(entry => entry.url);

    expect(urls.some(url => url.includes("/docs/hive/"))).toBe(false);
    for (const url of REDIRECT_ONLY_URLS) {
      expect(urls).not.toContain(url);
    }
  });
});
