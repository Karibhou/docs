import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

const footerPath = path.join(
  process.cwd(),
  "src/components/docs/DocsFooter.tsx"
);

describe("DocsFooter copy and links", () => {
  const footer = fs.readFileSync(footerPath, "utf8");

  it("uses Hive Commons project copy instead of KubeStellar Console leftovers", () => {
    expect(footer).toContain(
      "Hive Commons is an open source home for projects"
    );
    expect(footer).not.toMatch(
      /Console|MCP server|A2A agent|Kubernetes orchestration|multi-cluster management/i
    );
  });

  it("links to Hive Commons projects and community resources", () => {
    expect(footer).toContain('href="/docs/hive/overview/introduction"');
    expect(footer).toContain('href="/docs/crux/overview/introduction"');
    expect(footer).toContain('href="/docs/hotshot/overview/introduction"');
    expect(footer).toContain('href="/docs/pluk/overview/introduction"');
    expect(footer).toContain('href="/docs/rationguard/overview/introduction"');
    expect(footer).toContain('href="/docs/promptargs/overview/introduction"');
    expect(footer).toContain('href="/docs/spektacular/overview/introduction"');
    expect(footer).toContain('href="/docs/dibs/overview/introduction"');
    expect(footer).toContain('href="/docs/community/meetings"');
    expect(footer).toContain('href="https://hive.hivecommons.dev"');
    expect(footer).toContain('href="https://hivecommons.dev/discord"');
    expect(footer).toContain('href="https://hivecommons.dev/tv"');
  });

  it("keeps social links accessible and removes unsupported networks", () => {
    expect(footer).toContain('aria-label="Hive Commons on GitHub"');
    expect(footer).toContain('aria-label="Hive Commons on YouTube"');
    expect(footer).toContain('aria-label="Hive Commons Discord"');
    expect(footer).not.toContain('aria-label="X (Twitter)"');
    expect(footer).not.toContain('aria-label="LinkedIn"');
  });
});
