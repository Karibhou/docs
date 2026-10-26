import { describe, it, expect } from "vitest";
import {
  PROJECTS,
  rewriteLinks,
  syncedHeader,
  type ProjectSync,
} from "./sync-sibling-docs";

const SIBLING_PROJECTS = [
  "hotshot",
  "pluk",
  "rationguard",
  "promptargs",
  "dibs",
  "crux",
  "spektacular",
];

function project(id: string): ProjectSync {
  const p = PROJECTS.find(x => x.project === id);
  if (!p) throw new Error(`no project ${id}`);
  return p;
}

describe("PROJECTS", () => {
  it("lists every sibling project exactly once", () => {
    expect(PROJECTS.map(p => p.project)).toEqual(SIBLING_PROJECTS);
  });

  it("syncs the dibs roadmap and public reference pages but not internal notes", () => {
    expect(project("dibs").files.map(f => [f.source, f.target])).toEqual([
      ["README.md", "readme.md"],
      ["ROADMAP.md", "roadmap.md"],
      ["docs/credit-wall-api.md", "credit-wall-api.md"],
      ["docs/mcp-registry.md", "mcp-registry.md"],
    ]);
  });

  it("requires a readme for every project", () => {
    for (const p of PROJECTS) {
      expect(p.files.some(f => f.target === "readme.md" && f.required)).toBe(
        true
      );
    }
  });

  it("pulls Spektacular from both the repo and the website", () => {
    const spek = project("spektacular");
    const targets = spek.files.map(f => f.target);
    expect(targets).toEqual([
      "readme.md",
      "knowledge-base.md",
      "getting-started.md",
      "unknown-criteria.md",
    ]);
    const website = spek.files.filter(f => f.repo);
    expect(website.map(f => f.repo!.repo)).toEqual([
      "spektacular-website",
      "spektacular-website",
    ]);
    for (const f of website) {
      expect(f.format).toBe("mdx");
      expect(f.siteBase).toBe("https://spektacular.dev");
      expect(f.assetsRoot).toBe("public");
    }
    expect(spek.canonicalSite).toBe("https://spektacular.dev");
  });
});

describe("syncedHeader", () => {
  it("names the per-file repo and links the canonical page for website-sourced pages", () => {
    const spek = project("spektacular");
    const tutorial = spek.files.find(f => f.target === "getting-started.md")!;
    const header = syncedHeader(spek, tutorial);
    expect(header).toContain("Synced from spektacular-website.");
    expect(header).toContain(
      "spektacular-website/blob/main/src/content/tutorials/getting-started.mdx"
    );
    expect(header).toContain(
      "[spektacular.dev](https://spektacular.dev/tutorials/getting-started/)"
    );
    expect(header).toContain("canonical copy");
  });

  it("adds the canonical-site note to the overview page", () => {
    const spek = project("spektacular");
    const readme = spek.files.find(f => f.target === "readme.md")!;
    expect(syncedHeader(spek, readme)).toContain(
      "[spektacular.dev](https://spektacular.dev)"
    );
  });

  it("omits the note for projects without a canonical site", () => {
    const pluk = project("pluk");
    expect(syncedHeader(pluk, pluk.files[0])).not.toContain("Also published");
  });
});

describe("rewriteLinks", () => {
  const spek = project("spektacular");

  it("routes a link to a synced page to its docs route", () => {
    expect(rewriteLinks("[kb](docs/knowledge-base.md#tags)", spek)).toBe(
      "[kb](/docs/spektacular/knowledge-base#tags)"
    );
  });

  it("sends other relative links to the file's own repo", () => {
    const tutorial = spek.files.find(f => f.target === "getting-started.md")!;
    expect(rewriteLinks("[x](../foo.md)", spek, tutorial)).toBe(
      "[x](https://github.com/hivecommons/spektacular-website/blob/main/src/content/foo.md)"
    );
    expect(rewriteLinks("[lic](LICENSE)", spek)).toBe(
      "[lic](https://github.com/hivecommons/spektacular/blob/main/LICENSE)"
    );
  });

  it("only routes to synced pages from the same repo as the file", () => {
    const other = { owner: "hivecommons", repo: "other", branch: "main" };
    const multi = {
      ...spek,
      files: [
        { source: "README.md", target: "readme.md" },
        { source: "README.md", target: "other-readme.md", repo: other },
      ],
    };
    expect(rewriteLinks("[r](README.md)", multi, multi.files[0])).toBe(
      "[r](/docs/spektacular/readme)"
    );
    expect(rewriteLinks("[r](README.md)", multi, multi.files[1])).toBe(
      "[r](/docs/spektacular/other-readme)"
    );
    expect(rewriteLinks("[r](docs/x.md)", multi, multi.files[1])).toBe(
      "[r](https://github.com/hivecommons/other/blob/main/docs/x.md)"
    );
  });

  it("leaves absolute and anchor links alone", () => {
    const src = "[a](https://x.y) [b](#c) [d](/docs/hive)";
    expect(rewriteLinks(src, spek)).toBe(src);
  });

  it("routes a synced page without an anchor and strips a leading ./", () => {
    expect(rewriteLinks("[kb](./docs/knowledge-base.md)", spek)).toBe(
      "[kb](/docs/spektacular/knowledge-base)"
    );
  });

  it("strips .mdx as well as .md from a synced target's route", () => {
    const mdx: ProjectSync = {
      ...spek,
      files: [
        { source: "docs/guide.md", target: "guide.mdx", required: false },
      ],
    };
    expect(rewriteLinks("[g](docs/guide.md#top)", mdx)).toBe(
      "[g](/docs/spektacular/guide#top)"
    );
  });

  it("matches synced pages case-insensitively", () => {
    expect(rewriteLinks("[kb](Docs/Knowledge-Base.MD)", spek)).toBe(
      "[kb](/docs/spektacular/knowledge-base)"
    );
  });

  it("points relative image sources at raw.githubusercontent", () => {
    expect(rewriteLinks("![logo](./assets/logo.png)", spek)).toBe(
      "![logo](https://raw.githubusercontent.com/hivecommons/spektacular/main/assets/logo.png)"
    );
  });

  it("uses the file's own repo for image sources of website-sourced pages", () => {
    // Resolved against the page's own directory, as GitHub would.
    const tutorial = spek.files.find(f => f.target === "getting-started.md")!;
    expect(rewriteLinks("![shot](img/shot.png)", spek, tutorial)).toBe(
      "![shot](https://raw.githubusercontent.com/hivecommons/spektacular-website/main/src/content/tutorials/img/shot.png)"
    );
    expect(rewriteLinks("![shot](../../img/shot.png)", spek, tutorial)).toBe(
      "![shot](https://raw.githubusercontent.com/hivecommons/spektacular-website/main/src/img/shot.png)"
    );
  });

  it("never routes an image to a docs route even if its path is a synced page", () => {
    // Images are always raw-linked; the synced-route lookup is for links only.
    expect(rewriteLinks("![kb](docs/knowledge-base.md)", spek)).toBe(
      "![kb](https://raw.githubusercontent.com/hivecommons/spektacular/main/docs/knowledge-base.md)"
    );
  });

  it("leaves absolute and anchor image sources alone", () => {
    const src = "![a](https://x.y/a.png) ![b](/img/b.png)";
    expect(rewriteLinks(src, spek)).toBe(src);
  });

  it("resolves ../ links against the source file's directory", () => {
    const kb = spek.files.find(f => f.target === "knowledge-base.md")!;
    expect(rewriteLinks("[readme](../README.md#install)", spek, kb)).toBe(
      "[readme](/docs/spektacular/readme#install)"
    );
    expect(rewriteLinks("[cmd](../cmd/main.go)", spek, kb)).toBe(
      "[cmd](https://github.com/hivecommons/spektacular/blob/main/cmd/main.go)"
    );
    expect(rewriteLinks("[sib](./other.md)", spek, kb)).toBe(
      "[sib](https://github.com/hivecommons/spektacular/blob/main/docs/other.md)"
    );
  });

  it("keeps a ?query suffix and still routes synced pages", () => {
    expect(
      rewriteLinks("[kb](docs/knowledge-base.md?plain=1#tags)", spek)
    ).toBe("[kb](/docs/spektacular/knowledge-base?plain=1#tags)");
    expect(rewriteLinks("[lic](LICENSE?plain=1)", spek)).toBe(
      "[lic](https://github.com/hivecommons/spektacular/blob/main/LICENSE?plain=1)"
    );
  });

  it("rewrites reference-style link definitions", () => {
    const kb = spek.files.find(f => f.target === "knowledge-base.md")!;
    const md =
      'See [readme] and [cmd].\n\n[readme]: ../README.md\n[cmd]: ../cmd/main.go "entry"\n[site]: https://spektacular.dev\n';
    expect(rewriteLinks(md, spek, kb)).toBe(
      'See [readme] and [cmd].\n\n[readme]: /docs/spektacular/readme\n[cmd]: https://github.com/hivecommons/spektacular/blob/main/cmd/main.go "entry"\n[site]: https://spektacular.dev\n'
    );
  });

  it("resolves ../ and keeps ?query on raw image sources", () => {
    const kb = spek.files.find(f => f.target === "knowledge-base.md")!;
    expect(rewriteLinks("![d](../assets/d.svg?raw=1)", spek, kb)).toBe(
      "![d](https://raw.githubusercontent.com/hivecommons/spektacular/main/assets/d.svg?raw=1)"
    );
  });

  it("rewrites inline links with a title", () => {
    expect(rewriteLinks('[kb](docs/knowledge-base.md "KB")', spek)).toBe(
      '[kb](/docs/spektacular/knowledge-base "KB")'
    );
  });

  it("is idempotent", () => {
    const kb = spek.files.find(f => f.target === "knowledge-base.md")!;
    const md =
      "[a](../README.md) [b](../cmd/main.go) ![c](img.png)\n[d]: ../LICENSE\n";
    const once = rewriteLinks(md, spek, kb);
    expect(rewriteLinks(once, spek, kb)).toBe(once);
  });
});
