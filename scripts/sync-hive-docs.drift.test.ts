import { describe, expect, it } from "vitest";
import {
  addToHiveNav,
  detectDrift,
  formatDriftReport,
  healFilesList,
  parseAllowlist,
  rewriteLinks,
} from "./sync-hive-docs";

// Unit tests for the sync-hive-docs file-list drift check (#612). The
// end-to-end report/heal behaviour of main() is covered in
// scripts/sync-hive-docs.main.test.ts.

const synced = [
  "README.md",
  "landscape.md",
  "integrations/work-source-providers.md",
  "integrations/spektacular.md",
];

function refs(entries: Record<string, string[]>): Map<string, Set<string>> {
  return new Map(Object.entries(entries).map(([k, v]) => [k, new Set(v)]));
}

describe("detectDrift", () => {
  it("reports an unlisted sibling of a synced subdirectory page", () => {
    const drift = detectDrift({
      synced,
      upstream: [...synced, "integrations/forges.md"],
      referenced: new Map(),
      allowlist: new Set(),
    });
    expect(drift).toEqual([
      {
        source: "integrations/forges.md",
        reason: "unlisted-sibling",
        referencedBy: [],
      },
    ]);
  });

  it("ignores root-level pages nothing links to, non-markdown files and directories without synced pages", () => {
    const drift = detectDrift({
      synced,
      upstream: [
        ...synced,
        "orphan.md",
        "integrations/logo.svg",
        "design/crux.md",
      ],
      referenced: new Map(),
      allowlist: new Set(),
    });
    expect(drift).toEqual([]);
  });

  it("reports a referenced-but-unsynced page with the pages linking to it", () => {
    const drift = detectDrift({
      synced,
      upstream: [...synced, "operations.md"],
      referenced: refs({ "operations.md": ["landscape.md", "README.md"] }),
      allowlist: new Set(),
    });
    expect(drift).toEqual([
      {
        source: "operations.md",
        reason: "referenced",
        referencedBy: ["README.md", "landscape.md"],
      },
    ]);
  });

  it("merges a sibling that is also linked into one entry, sorted by path", () => {
    const drift = detectDrift({
      synced,
      upstream: [...synced, "integrations/forges.md", "integrations/cline.md"],
      referenced: refs({ "integrations/forges.md": ["landscape.md"] }),
      allowlist: new Set(),
    });
    expect(drift).toEqual([
      {
        source: "integrations/cline.md",
        reason: "unlisted-sibling",
        referencedBy: [],
      },
      {
        source: "integrations/forges.md",
        reason: "unlisted-sibling",
        referencedBy: ["landscape.md"],
      },
    ]);
  });

  it("skips links to pages missing upstream, but keeps them when upstream is unknown", () => {
    const referenced = refs({ "missing.md": ["landscape.md"] });
    expect(
      detectDrift({
        synced,
        upstream: synced,
        referenced,
        allowlist: new Set(),
      })
    ).toEqual([]);
    expect(detectDrift({ synced, referenced, allowlist: new Set() })).toEqual([
      {
        source: "missing.md",
        reason: "referenced",
        referencedBy: ["landscape.md"],
      },
    ]);
  });

  it("suppresses allowlisted entries", () => {
    const drift = detectDrift({
      synced,
      upstream: [...synced, "integrations/cline.md", "operations.md"],
      referenced: refs({ "operations.md": ["README.md"] }),
      allowlist: parseAllowlist(
        "# intentional\n\noperations.md  # stays on GitHub\nintegrations/cline.md\n"
      ),
    });
    expect(drift).toEqual([]);
  });
});

describe("parseAllowlist", () => {
  it("drops comments and blank lines and trims entries", () => {
    expect([
      ...parseAllowlist("# head\n a.md \n\nb/c.md # why\n#x.md\n"),
    ]).toEqual(["a.md", "b/c.md"]);
  });
});

describe("healFilesList", () => {
  it("appends each drift entry to the files list, leaving existing entries as they are", () => {
    const list = [
      { source: "README.md", target: "readme.md" },
      { source: "integrations/spektacular.md", comment: "kept" },
    ];
    const healed = healFilesList(list, [
      {
        source: "integrations/cline.md",
        reason: "unlisted-sibling",
        referencedBy: [],
      },
      {
        source: "operations.md",
        reason: "referenced",
        referencedBy: ["README.md"],
      },
    ]);
    expect(healed).toEqual([
      ...list,
      { source: "integrations/cline.md" },
      { source: "operations.md" },
    ]);
    expect(list).toHaveLength(2);
  });

  it("maps a README.md sibling to a lowercase target", () => {
    const healed = healFilesList(
      [],
      [
        {
          source: "guides/README.md",
          reason: "unlisted-sibling",
          referencedBy: [],
        },
      ]
    );
    expect(healed).toEqual([
      { source: "guides/README.md", target: "guides/readme.md" },
    ]);
  });
});

describe("formatDriftReport", () => {
  it("lists each entry with why it was reported", () => {
    const report = formatDriftReport({
      drift: [
        {
          source: "integrations/forges.md",
          reason: "unlisted-sibling",
          referencedBy: ["landscape.md", "work-sources.md"],
        },
        {
          source: "operations.md",
          reason: "referenced",
          referencedBy: ["README.md"],
        },
      ],
      upstreamListed: true,
    });
    expect(report).toBe(
      [
        "### sync-hive-docs file-list drift",
        "",
        "2 upstream page(s) are not in `scripts/sync-hive-docs.files.json`. The scheduled refresh adds them; list intentional omissions in `scripts/sync-hive-docs.unsynced-allowlist.txt`:",
        "",
        "- `integrations/forges.md` — unlisted sibling of synced pages; linked from landscape.md, work-sources.md",
        "- `operations.md` — linked from README.md",
        "",
      ].join("\n")
    );
  });

  it("notes healed pages and a missing upstream listing", () => {
    const report = formatDriftReport({
      drift: [],
      healed: [
        {
          source: "integrations/cline.md",
          reason: "unlisted-sibling",
          referencedBy: [],
        },
      ],
      upstreamListed: false,
    });
    expect(report).toContain(
      "Upstream `src/docs` could not be listed; only linked pages were checked."
    );
    expect(report).toContain(
      "Healed: appended 1 page(s) to `scripts/sync-hive-docs.files.json`, synced them and added them to NAV_STRUCTURE_HIVE in `src/app/docs/page-map.ts`:\n\n- `integrations/cline.md` — unlisted sibling of synced pages\n"
    );
    expect(report).toContain("No unlisted upstream pages.");
  });
});

describe("rewriteLinks unsynced-reference collection", () => {
  it("records src/docs markdown pages that Case 2 pushed to GitHub, per linking page", () => {
    const unsynced = new Map<string, Set<string>>();
    const out = rewriteLinks(
      [
        "[a](integrations/forges.md) [b](./integrations/forges.md#x)",
        "[c](architecture.md) [d](../../bin/README.md) [e](assets/logo.svg)",
        "",
      ].join("\n"),
      "src/docs/landscape.md",
      unsynced
    );
    rewriteLinks(
      "[f](forges.md)",
      "src/docs/integrations/work-source-providers.md",
      unsynced
    );

    expect(out).toContain(
      "[a](https://github.com/hivecommons/hive/blob/v5/src/docs/integrations/forges.md)"
    );
    expect(out).toContain("[c](/docs/hive/architecture)");
    expect([...unsynced.keys()]).toEqual(["integrations/forges.md"]);
    expect([...unsynced.get("integrations/forges.md")!].sort()).toEqual([
      "integrations/work-source-providers.md",
      "landscape.md",
    ]);
  });
});

describe("addToHiveNav", () => {
  const pageMap = [
    "const NAV_STRUCTURE_HIVE = [",
    "  {",
    "    title: 'Reference',",
    "    items: [",
    "      { 'Environment variable reference': 'env-vars.md' },",
    "    ]",
    "  }",
    "]",
    "",
    "// hotshot Navigation Structure",
    "const NAV_STRUCTURE_HOTSHOT = [",
    "  { title: 'Other', items: [",
    "    ] }",
    "]",
    "",
  ].join("\n");

  it("appends a new entry to the last section of the hive nav", () => {
    const out = addToHiveNav(pageMap, [
      { title: "Forges", target: "integrations/forges.md" },
    ]);
    expect(out).toContain(
      "      { 'Environment variable reference': 'env-vars.md' },\n" +
        "      { 'Forges': 'integrations/forges.md' },\n    ]\n  }\n]"
    );
    expect(out.split("NAV_STRUCTURE_HOTSHOT")[1]).toBe(
      pageMap.split("NAV_STRUCTURE_HOTSHOT")[1]
    );
  });

  it("does not duplicate a target already in the nav", () => {
    const out = addToHiveNav(pageMap, [
      { title: "Env", target: "env-vars.md" },
    ]);
    expect(out).toBe(pageMap);
    const once = addToHiveNav(pageMap, [{ title: "A", target: "a.md" }]);
    expect(addToHiveNav(once, [{ title: "A", target: "a.md" }])).toBe(once);
  });

  it("uses the README -> readme target from healFilesList", () => {
    const [entry] = healFilesList(
      [],
      [
        {
          source: "adr/README.md",
          reason: "unlisted-sibling",
          referencedBy: [],
        },
      ]
    );
    const out = addToHiveNav(pageMap, [
      { title: "ADR index", target: entry.target ?? entry.source },
    ]);
    expect(out).toContain("{ 'ADR index': 'adr/readme.md' },");
  });

  it("inserts after a trailing nested sub-list, not inside it", () => {
    const nested = pageMap.replace(
      "      { 'Environment variable reference': 'env-vars.md' },\n",
      "      { 'Environment variable reference': 'env-vars.md' },\n" +
        "      { title: 'ADRs', items: [\n" +
        "        { '0001 First': 'adr/0001-first.md' },\n" +
        "      ] },\n"
    );
    const out = addToHiveNav(nested, [{ title: "New", target: "new.md" }]);
    expect(out).toContain(
      "      ] },\n      { 'New': 'new.md' },\n    ]\n  }\n]"
    );
  });

  it("escapes quotes in titles", () => {
    const out = addToHiveNav(pageMap, [{ title: "Don't", target: "d.md" }]);
    expect(out).toContain("{ 'Don\\'t': 'd.md' },");
  });
});
