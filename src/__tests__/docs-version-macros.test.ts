import { describe, expect, it } from "vitest";
import { templateVariables } from "../app/docs/[...slug]/page";
import { CURRENT_VERSION } from "../config/versions";

describe("documentation version macros", () => {
  it("uses the current version without inventing a release branch or double prefix", () => {
    const vars = templateVariables();
    expect(vars["config.ks_branch"]).toBe("main");
    expect(vars["config.ks_tag"]).toBe(`v${CURRENT_VERSION.replace(/^v/, "")}`);
    expect(vars["config.ks_latest_release"]).toBe(CURRENT_VERSION);
    expect(vars["config.ks_latest_regular_release"]).toBe(CURRENT_VERSION);
  });
});
