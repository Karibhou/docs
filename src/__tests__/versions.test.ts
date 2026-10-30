import { describe, it, expect } from "vitest";
import {
  PROJECTS,
  PRODUCTION_URL,
  NETLIFY_SITE_NAME,
  getProjectFromPath,
  getProject,
  getAllProjects,
  getDefaultVersion,
  getCurrentVersion,
  getBranchForVersion,
  getVersionFromBranch,
  getAllVersions,
  isVersionBranch,
  getVersionUrl,
  getProjectVersions,
  isVersionMigrated,
  CURRENT_VERSION,
  type ProjectId,
  type VersionKey,
} from "../config/versions";

describe("getProjectFromPath", () => {
  it.each([
    ["/docs/hotshot", "hotshot"],
    ["/docs/hotshot/getting-started", "hotshot"],
    ["/docs/pluk", "pluk"],
    ["/docs/rationguard/install", "rationguard"],
    ["/docs/promptargs", "promptargs"],
    ["/docs/dibs", "dibs"],
    ["/docs/crux", "crux"],
    ["/docs/crux/getting-started", "crux"],
    ["/docs/spektacular/api", "spektacular"],
  ] as const)("maps %s to project %s", (pathname, id) => {
    expect(getProjectFromPath(pathname).id).toBe(id);
  });

  it("defaults to hive for the docs root and unknown paths", () => {
    expect(getProjectFromPath("/docs").id).toBe("hive");
    expect(getProjectFromPath("/docs/architecture").id).toBe("hive");
    expect(getProjectFromPath("/").id).toBe("hive");
    expect(getProjectFromPath("").id).toBe("hive");
  });

  it("does not match project names outside the /docs prefix", () => {
    expect(getProjectFromPath("/hotshot").id).toBe("hive");
  });
});

describe("getProject / getAllProjects", () => {
  it("returns the config for each declared project id", () => {
    for (const id of Object.keys(PROJECTS) as ProjectId[]) {
      expect(getProject(id)).toBe(PROJECTS[id]);
      expect(getProject(id).id).toBe(id);
    }
  });

  it("getAllProjects returns every project exactly once", () => {
    const all = getAllProjects();
    expect(all).toHaveLength(Object.keys(PROJECTS).length);
    expect(new Set(all.map(p => p.id)).size).toBe(all.length);
  });

  it("lists Crux immediately after Hive", () => {
    expect(
      getAllProjects()
        .slice(0, 2)
        .map(project => project.id)
    ).toEqual(["hive", "crux"]);
  });

  it("every project declares exactly one default version", () => {
    for (const project of getAllProjects()) {
      const defaults = Object.values(project.versions).filter(v => v.isDefault);
      expect(defaults, `project ${project.id}`).toHaveLength(1);
    }
  });
});

describe("hive backwards-compatible version helpers", () => {
  it("getDefaultVersion returns latest", () => {
    expect(getDefaultVersion()).toBe("latest");
  });

  it("getCurrentVersion mirrors CURRENT_VERSION and the hive project", () => {
    expect(getCurrentVersion()).toBe(CURRENT_VERSION);
    expect(getCurrentVersion()).toBe(PROJECTS.hive.currentVersion);
  });

  it("getBranchForVersion returns the configured branch for latest", () => {
    expect(getBranchForVersion("latest")).toBe(
      PROJECTS.hive.versions.latest.branch
    );
  });

  it("getBranchForVersion falls back to main for unknown versions", () => {
    expect(getBranchForVersion("nope" as VersionKey)).toBe("main");
  });

  it("getAllVersions returns key plus the version info fields", () => {
    const all = getAllVersions();
    expect(all.length).toBeGreaterThan(0);
    const latest = all.find(v => v.key === "latest");
    expect(latest).toBeDefined();
    expect(latest!.branch).toBe(PROJECTS.hive.versions.latest.branch);
    expect(latest!.isDefault).toBe(true);
  });
});

describe("getVersionFromBranch", () => {
  it("maps main and master to latest", () => {
    expect(getVersionFromBranch("main")).toBe("latest");
    expect(getVersionFromBranch("master")).toBe("latest");
  });

  it("returns null for unknown branches", () => {
    expect(getVersionFromBranch("feature/foo")).toBeNull();
    expect(getVersionFromBranch("")).toBeNull();
  });

  it("returns null for docs/* branches with no matching version entry", () => {
    expect(getVersionFromBranch("docs/9.9.9")).toBeNull();
  });

  it("maps hive release branches to their version keys", () => {
    // v5 feeds the `stable` channel and is the sync-hive-docs default ref;
    // if it stops resolving, the version selector loses its default entry.
    expect(getVersionFromBranch("v5")).toBe("latest");
    expect(getVersionFromBranch("v6")).toBe("v6");
    expect(getVersionFromBranch("v4")).toBe("v4");
  });

  it("maps docs/<version-key> branches to the version key", () => {
    expect(getVersionFromBranch("docs/v6")).toBe("v6");
    expect(getVersionFromBranch("docs/latest")).toBe("latest");
  });
});

describe("isVersionBranch", () => {
  it("accepts main and docs/* branches", () => {
    expect(isVersionBranch("main")).toBe(true);
    expect(isVersionBranch("docs/1.2.3")).toBe(true);
  });

  it("accepts configured Hive version branches", () => {
    expect(isVersionBranch(PROJECTS.hive.versions.latest.branch)).toBe(true);
  });

  it("rejects everything else", () => {
    expect(isVersionBranch("master")).toBe(false);
    expect(isVersionBranch("feature/docs")).toBe(false);
    expect(isVersionBranch("")).toBe(false);
  });
});

describe("getVersionUrl", () => {
  it("returns the production URL with pathname for unknown version keys", () => {
    expect(getVersionUrl("nope", "/docs/x")).toBe(`${PRODUCTION_URL}/docs/x`);
  });

  it("returns the production URL for latest", () => {
    expect(getVersionUrl("latest")).toBe(`${PRODUCTION_URL}/docs`);
    expect(getVersionUrl("latest", "/docs/architecture", "hotshot")).toBe(
      `${PRODUCTION_URL}/docs/architecture`
    );
  });

  it("builds a Netlify branch-deploy URL for non-default branch versions", () => {
    const projects = { ...PROJECTS };
    // Simulate a versioned entry the way a docs/x.y.z branch would be configured.
    projects.hive.versions["v0-test"] = {
      label: "v0 test",
      branch: "docs/0.28.0",
      isDefault: false,
    };
    try {
      expect(getVersionUrl("v0-test", "/docs")).toBe(
        `https://docs-0-28-0--${NETLIFY_SITE_NAME}.netlify.app/docs`
      );
    } finally {
      delete projects.hive.versions["v0-test"];
    }
  });

  it("prefers an externalUrl when the version declares one", () => {
    PROJECTS.spektacular.versions["ext-test"] = {
      label: "ext",
      branch: "main",
      isDefault: false,
      externalUrl: "https://spektacular.dev",
    };
    try {
      expect(getVersionUrl("ext-test", "/docs", "spektacular")).toBe(
        "https://spektacular.dev"
      );
    } finally {
      delete PROJECTS.spektacular.versions["ext-test"];
    }
  });
});

describe("getProjectVersions", () => {
  it("returns key + info for each version of a project", () => {
    const versions = getProjectVersions("hive");
    expect(versions.map(v => v.key)).toContain("latest");
    const latest = versions.find(v => v.key === "latest")!;
    expect(latest.isDefault).toBe(true);
  });
});

describe("isVersionMigrated", () => {
  it("latest and legacy are always available", () => {
    expect(isVersionMigrated("latest")).toBe(true);
    expect(isVersionMigrated("legacy", "hotshot")).toBe(true);
  });

  it("other versions are available only when declared", () => {
    expect(isVersionMigrated("v0.1", "hive")).toBe(false);
  });
});
