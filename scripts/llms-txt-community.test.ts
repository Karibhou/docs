import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("llms.txt community links", () => {
  const llms = readFileSync(
    join(__dirname, "..", "public", "llms.txt"),
    "utf8"
  );

  it.each([
    "https://docs.hivecommons.dev/docs/community/what-is-hive-commons",
    "https://docs.hivecommons.dev/docs/community/join-hive-commons",
    "https://docs.hivecommons.dev/docs/community/meetings",
    "https://hivecommons.dev/join",
    "https://hivecommons.dev/discord",
    "https://www.twitch.tv/hivecommons",
    "https://hivecommons.dev/tv",
    "https://www.youtube.com/watch?v=uo1KGTyJJyU",
    "https://github.com/hivecommons/hive/blob/v5/ADOPTERS.md",
  ])("links to %s", url => {
    expect(llms).toContain(`](${url})`);
  });
});
