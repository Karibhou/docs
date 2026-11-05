import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("README community links", () => {
  const readme = readFileSync(join(__dirname, "..", "README.md"), "utf8");

  it.each([
    "https://hivecommons.dev/discord",
    "https://www.twitch.tv/hivecommons",
    "https://docs.hivecommons.dev/docs/community/meetings",
  ])("links to %s", url => {
    expect(readme).toContain(`](${url})`);
  });
});
