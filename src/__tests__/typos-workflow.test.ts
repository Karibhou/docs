import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// typecheck.yml pre-installs the typos binary into a cache keyed by version
// (#688). The version is written in three places that nothing ties together:
// the cache key, the release download URL and the crate-ci/typos action pin.
// A Dependabot bump of the `uses:` line alone would leave the cache serving
// the old binary while the action reports the new version, so pin the three
// together here.
const workflow = readFileSync(
  join(__dirname, "../../.github/workflows/typecheck.yml"),
  "utf8"
);

function single(pattern: RegExp, label: string): string {
  const matches = [...workflow.matchAll(pattern)];
  expect(matches, `${label}: expected exactly one match`).toHaveLength(1);
  return matches[0][1];
}

describe("typecheck.yml typos pre-install", () => {
  const pinned = single(
    /uses: crate-ci\/typos@[0-9a-f]{40} # (v\d+\.\d+\.\d+)\n/g,
    "crate-ci/typos action pin"
  );
  const cacheKey = single(
    /key: typos-(v\d+\.\d+\.\d+)-\$\{\{ runner\.os \}\}-x86_64\n/g,
    "actions/cache key"
  );
  const urlMatches = [
    ...workflow.matchAll(
      /https:\/\/github\.com\/crate-ci\/typos\/releases\/download\/(v\d+\.\d+\.\d+)\/typos-(v\d+\.\d+\.\d+)-x86_64-unknown-linux-musl\.tar\.gz/g
    ),
  ];

  it("downloads from exactly one release URL", () => {
    expect(urlMatches).toHaveLength(1);
  });

  it("keys the cache on the pinned action version", () => {
    expect(cacheKey).toBe(pinned);
  });

  it("downloads the pinned action version", () => {
    const [, tag, asset] = urlMatches[0];
    expect(tag).toBe(pinned);
    expect(asset).toBe(pinned);
  });

  it("installs into the path the action checks before downloading", () => {
    // crate-ci/typos skips its own wget when $RUNNER_TEMP/typos is executable
    // (#686); caching anywhere else would still download every run.
    expect(workflow).toContain("path: ${{ runner.temp }}/typos\n");
    expect(workflow).toContain('tar -xz -C "$RUNNER_TEMP" ./typos\n');
    expect(workflow).toContain('chmod +x "$RUNNER_TEMP/typos"\n');
  });

  it("only downloads on a cache miss", () => {
    expect(workflow).toContain(
      "if: steps.typos-cache.outputs.cache-hit != 'true'\n"
    );
    expect(workflow).toContain("id: typos-cache\n");
  });
});
