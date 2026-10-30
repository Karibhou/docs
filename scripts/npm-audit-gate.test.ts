import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  collectAdvisories,
  evaluateAudit,
  ghsaIdFromUrl,
  loadExceptions,
  main,
  validateAuditReport,
  type AuditException,
} from "./npm-audit-gate";

const BRACES_URL = "https://github.com/advisories/GHSA-vfj7-8cjw-p6xm";

// Shape mirrors `npm audit --omit=dev --json` for a transitive chain
// nextra -> fast-glob -> micromatch -> braces where only braces carries the
// advisory object; the rest list their vulnerable dependency as a string.
const REPORT = {
  auditReportVersion: 2,
  vulnerabilities: {
    braces: {
      name: "braces",
      severity: "high",
      via: [
        {
          source: 1105443,
          name: "braces",
          title: "braces vulnerable to stack-exhaustion denial of service",
          url: BRACES_URL,
          severity: "high",
          range: "*",
        },
      ],
    },
    micromatch: { name: "micromatch", severity: "high", via: ["braces"] },
    "fast-glob": { name: "fast-glob", severity: "high", via: ["micromatch"] },
    nextra: { name: "nextra", severity: "high", via: ["fast-glob"] },
    "some-lib": {
      name: "some-lib",
      severity: "moderate",
      via: [
        {
          source: 42,
          name: "some-lib",
          title: "ReDoS",
          url: "https://github.com/advisories/GHSA-aaaa-bbbb-cccc",
          severity: "moderate",
        },
      ],
    },
  },
};

const NOW = new Date("2026-10-03T00:00:00Z");

function exception(over: Partial<AuditException> = {}): AuditException {
  return {
    id: "GHSA-vfj7-8cjw-p6xm",
    package: "braces",
    reason: "no patched release",
    expires: "2027-01-01",
    ...over,
  };
}

describe("ghsaIdFromUrl", () => {
  it("extracts and upper-cases the GHSA id", () => {
    expect(ghsaIdFromUrl(BRACES_URL)).toBe("GHSA-VFJ7-8CJW-P6XM");
  });
  it("returns null for non-GHSA urls or undefined", () => {
    expect(ghsaIdFromUrl("https://example.com/x")).toBeNull();
    expect(ghsaIdFromUrl(undefined)).toBeNull();
  });
});

describe("collectAdvisories", () => {
  it("collects only root advisory objects, deduplicated", () => {
    const advs = collectAdvisories(REPORT);
    expect(advs.map(a => a.id).sort()).toEqual([
      "GHSA-AAAA-BBBB-CCCC",
      "GHSA-VFJ7-8CJW-P6XM",
    ]);
    const braces = advs.find(a => a.package === "braces")!;
    expect(braces.severity).toBe("high");
    expect(braces.url).toBe(BRACES_URL);
  });
  it("tolerates an empty report and advisories without urls", () => {
    expect(collectAdvisories({})).toEqual([]);
    const advs = collectAdvisories({
      vulnerabilities: { x: { severity: "low", via: [{ source: 7 }] } },
    });
    expect(advs).toEqual([
      { id: "npm-7", package: "x", severity: "low", title: "", url: "" },
    ]);
  });

  it("keeps each package when the same GHSA is a root advisory under two packages", () => {
    // Each affected package must retain its own severity and exception scope.
    const advs = collectAdvisories({
      vulnerabilities: {
        "pkg-a": {
          name: "pkg-a",
          severity: "high",
          via: [{ name: "pkg-a", url: BRACES_URL, severity: "high" }],
        },
        "pkg-b": {
          name: "pkg-b",
          severity: "critical",
          via: [{ name: "pkg-b", url: BRACES_URL, severity: "critical" }],
        },
      },
    });
    expect(advs).toEqual([
      expect.objectContaining({
        id: "GHSA-VFJ7-8CJW-P6XM",
        package: "pkg-a",
        severity: "high",
      }),
      expect.objectContaining({
        id: "GHSA-VFJ7-8CJW-P6XM",
        package: "pkg-b",
        severity: "critical",
      }),
    ]);
  });

  it("deduplicates repeated advisory objects for the same package", () => {
    const via = { name: "pkg-a", url: BRACES_URL, severity: "high" };
    expect(
      collectAdvisories({
        vulnerabilities: { "pkg-a": { via: [via, via] } },
      })
    ).toHaveLength(1);
  });

  it("falls back to npm-unknown, the parent severity, then info", () => {
    const advs = collectAdvisories({
      vulnerabilities: {
        // No url and no source: id must still be stable and non-empty.
        x: { severity: "Moderate", via: [{}] },
        // Neither via nor parent carries a severity: default to info.
        y: { via: [{ source: 9 }] },
        // A package entry with no via list contributes nothing.
        z: { severity: "low" },
      },
    });
    expect(advs).toEqual([
      {
        id: "npm-unknown",
        package: "x",
        severity: "moderate",
        title: "",
        url: "",
      },
      { id: "npm-9", package: "y", severity: "info", title: "", url: "" },
    ]);
  });
});

describe("evaluateAudit", () => {
  it("blocks high advisories with no exception and ignores lower ones", () => {
    const r = evaluateAudit(REPORT, [], "high", NOW);
    expect(r.blocking.map(a => a.id)).toEqual(["GHSA-VFJ7-8CJW-P6XM"]);
    expect(r.belowLevel.map(a => a.id)).toEqual(["GHSA-AAAA-BBBB-CCCC"]);
    expect(r.excepted).toEqual([]);
  });

  it("passes when every high advisory is covered by an active exception", () => {
    const r = evaluateAudit(REPORT, [exception()], "high", NOW);
    expect(r.blocking).toEqual([]);
    expect(r.excepted.map(a => a.id)).toEqual(["GHSA-VFJ7-8CJW-P6XM"]);
    expect(r.unused).toEqual([]);
  });

  it("matches ids case-insensitively and without a package filter", () => {
    const r = evaluateAudit(
      REPORT,
      [exception({ id: "ghsa-vfj7-8cjw-p6xm", package: undefined })],
      "high",
      NOW
    );
    expect(r.blocking).toEqual([]);
  });

  it("treats an empty package as an unscoped exception", () => {
    const r = evaluateAudit(REPORT, [exception({ package: "" })], "high", NOW);
    expect(r.blocking).toEqual([]);
    expect(r.unused).toEqual([]);
  });

  it("does not apply an exception scoped to a different package", () => {
    const r = evaluateAudit(
      REPORT,
      [exception({ package: "micromatch" })],
      "high",
      NOW
    );
    expect(r.blocking.map(a => a.id)).toEqual(["GHSA-VFJ7-8CJW-P6XM"]);
    expect(r.unused).toHaveLength(1);
  });

  it("honours one scoped exception per package for the same GHSA", () => {
    const report = {
      vulnerabilities: {
        "pkg-a": {
          via: [{ name: "pkg-a", url: BRACES_URL, severity: "high" }],
        },
        "pkg-b": {
          via: [{ name: "pkg-b", url: BRACES_URL, severity: "high" }],
        },
      },
    };
    const r = evaluateAudit(
      report,
      [exception({ package: "pkg-a" }), exception({ package: "pkg-b" })],
      "high",
      NOW
    );
    expect(r.excepted.map(a => a.package)).toEqual(["pkg-a", "pkg-b"]);
    expect(r.blocking).toEqual([]);
    expect(r.unused).toEqual([]);
  });

  it("lets a scoped exception and an unscoped one for the same GHSA coexist", () => {
    const report = {
      vulnerabilities: {
        "pkg-a": {
          via: [{ name: "pkg-a", url: BRACES_URL, severity: "high" }],
        },
        "pkg-b": {
          via: [{ name: "pkg-b", url: BRACES_URL, severity: "high" }],
        },
      },
    };
    const r = evaluateAudit(
      report,
      [exception({ package: "pkg-a" }), exception({ package: undefined })],
      "high",
      NOW
    );
    expect(r.excepted.map(a => a.package)).toEqual(["pkg-a", "pkg-b"]);
    expect(r.blocking).toEqual([]);
    expect(r.unused).toEqual([]);
  });

  it("reports an unscoped exception as unused when a scoped one already covers the only package", () => {
    // The scoped entry wins the match, so the wildcard is redundant and must
    // be flagged rather than silently counted as used by the same advisory.
    const r = evaluateAudit(
      REPORT,
      [exception({ package: "braces" }), exception({ package: undefined })],
      "high",
      NOW
    );
    expect(r.excepted.map(a => a.package)).toEqual(["braces"]);
    expect(r.unused).toEqual([exception({ package: undefined })]);
  });

  it.each(["moderate", "high"])(
    "keeps the second package blocking with a %s first package and scoped exception",
    severity => {
      const report = {
        vulnerabilities: {
          "pkg-a": { via: [{ name: "pkg-a", url: BRACES_URL, severity }] },
          "pkg-b": {
            via: [{ name: "pkg-b", url: BRACES_URL, severity: "critical" }],
          },
        },
      };
      const r = evaluateAudit(
        report,
        [exception({ package: "pkg-a" })],
        "high",
        NOW
      );
      expect(r.blocking).toEqual([
        expect.objectContaining({ package: "pkg-b", severity: "critical" }),
      ]);
      expect(r.excepted.map(a => a.package)).toEqual(
        severity === "high" ? ["pkg-a"] : []
      );
      expect(r.belowLevel.map(a => a.package)).toEqual(
        severity === "moderate" ? ["pkg-a"] : []
      );
    }
  );

  it("reports expired exceptions and keeps the advisory blocking", () => {
    const r = evaluateAudit(
      REPORT,
      [exception({ expires: "2026-01-01" })],
      "high",
      NOW
    );
    expect(r.expired).toHaveLength(1);
    expect(r.blocking).toHaveLength(1);
  });

  it("flags malformed entries", () => {
    const r = evaluateAudit(
      REPORT,
      [
        exception({ id: "CVE-2024-1" }),
        exception({ reason: "" }),
        exception({ expires: "not-a-date" }),
        { id: "GHSA-vfj7-8cjw-p6xm", reason: "ok" } as AuditException,
      ],
      "high",
      NOW
    );
    expect(r.invalid).toHaveLength(4);
  });

  it("reports unused active exceptions", () => {
    const r = evaluateAudit(
      REPORT,
      [exception(), exception({ id: "GHSA-zzzz-zzzz-zzzz", package: "nope" })],
      "high",
      NOW
    );
    expect(r.unused.map(e => e.id)).toEqual(["GHSA-zzzz-zzzz-zzzz"]);
  });

  it("honours the level threshold", () => {
    expect(evaluateAudit(REPORT, [], "moderate", NOW).blocking).toHaveLength(2);
    expect(evaluateAudit(REPORT, [], "critical", NOW).blocking).toHaveLength(0);
  });

  it("rejects unknown levels", () => {
    expect(() => evaluateAudit(REPORT, [], "severe", NOW)).toThrow(
      /Unknown audit level/
    );
  });

  it("treats an unrecognised advisory severity as below every level", () => {
    // Documents the current contract: a severity string the gate does not
    // know ranks as 0 and is reported under belowLevel rather than blocking,
    // even at the lowest configured level.
    const report = {
      vulnerabilities: {
        odd: {
          name: "odd",
          via: [
            {
              name: "odd",
              url: "https://github.com/advisories/GHSA-dddd-eeee-ffff",
              severity: "unusual",
            },
          ],
        },
      },
    };
    const r = evaluateAudit(report, [], "low", NOW);
    expect(r.blocking).toEqual([]);
    expect(r.belowLevel.map(a => a.id)).toEqual(["GHSA-DDDD-EEEE-FFFF"]);
  });
});

describe("loadExceptions", () => {
  let dir: string;
  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "npm-audit-gate-"));
  });
  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("returns [] when the file is missing", () => {
    expect(loadExceptions(path.join(dir, "none.json"))).toEqual([]);
  });
  it("parses an array", () => {
    const f = path.join(dir, "ex.json");
    fs.writeFileSync(f, JSON.stringify([exception()]));
    expect(loadExceptions(f)).toHaveLength(1);
  });
  it("rejects a non-array document", () => {
    const f = path.join(dir, "ex.json");
    fs.writeFileSync(f, "{}");
    expect(() => loadExceptions(f)).toThrow(/expected a JSON array/);
  });
});

describe("main", () => {
  let dir: string;
  let cwdSpy: ReturnType<typeof vi.spyOn>;
  let exitSpy: ReturnType<typeof vi.spyOn>;
  let logSpy: ReturnType<typeof vi.spyOn>;
  let errSpy: ReturnType<typeof vi.spyOn>;

  function write(rel: string, data: unknown) {
    const abs = path.join(dir, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, JSON.stringify(data));
    return abs;
  }

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "npm-audit-gate-main-"));
    cwdSpy = vi.spyOn(process, "cwd").mockReturnValue(dir);
    exitSpy = vi
      .spyOn(process, "exit")
      .mockImplementation((() => undefined) as never);
    logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    cwdSpy.mockRestore();
    exitSpy.mockRestore();
    logSpy.mockRestore();
    errSpy.mockRestore();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("exits 2 without a report argument", () => {
    main([]);
    expect(exitSpy).toHaveBeenCalledWith(2);
  });

  it("exits 1 on an unacknowledged high advisory", () => {
    const report = write("audit.json", REPORT);
    main([report]);
    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(errSpy.mock.calls.flat().join("\n")).toMatch(/without an exception/);
  });

  it("passes when the exceptions file covers the advisory and warns on unused", () => {
    const report = write("audit.json", REPORT);
    write(".github/npm-audit-exceptions.json", [
      exception(),
      exception({ id: "GHSA-zzzz-zzzz-zzzz", package: "nope" }),
    ]);
    main([report, "--level=high"]);
    expect(exitSpy).not.toHaveBeenCalled();
    const out = logSpy.mock.calls.flat().join("\n");
    expect(out).toMatch(/Acknowledged 1 advisory/);
    expect(out).toMatch(
      /::warning::Unused npm audit exception GHSA-zzzz-zzzz-zzzz \(nope\)/
    );
    expect(out).toMatch(/Ignoring 1 advisory/);
    expect(out).toMatch(/passed at level "high"/);
  });

  it("prints an unused unscoped exception with a * package marker", () => {
    const report = write("audit.json", REPORT);
    write(".github/npm-audit-exceptions.json", [
      exception(),
      exception({ id: "GHSA-zzzz-zzzz-zzzz", package: undefined }),
    ]);
    main([report, "--level=high"]);
    expect(exitSpy).not.toHaveBeenCalled();
    expect(logSpy.mock.calls.flat().join("\n")).toMatch(
      /::warning::Unused npm audit exception GHSA-zzzz-zzzz-zzzz \(\*\) — remove it\./
    );
  });

  it("omits the Ignoring line when nothing sits below the level", () => {
    const report = write("audit.json", REPORT);
    write(".github/npm-audit-exceptions.json", [
      exception(),
      exception({ id: "GHSA-aaaa-bbbb-cccc", package: "some-lib" }),
    ]);
    main([report, "--level=moderate"]);
    expect(exitSpy).not.toHaveBeenCalled();
    const out = logSpy.mock.calls.flat().join("\n");
    expect(out).toMatch(/Acknowledged 2 advisory/);
    expect(out).not.toMatch(/Ignoring/);
    expect(out).toMatch(/passed at level "moderate"/);
  });

  it("fails on expired and malformed exceptions", () => {
    const report = write("audit.json", REPORT);
    write(".github/npm-audit-exceptions.json", [
      exception({ expires: "2000-01-01" }),
      { id: "nope" },
    ]);
    main([report]);
    expect(exitSpy).toHaveBeenCalledWith(1);
    const err = errSpy.mock.calls.flat().join("\n");
    expect(err).toMatch(/Expired npm audit exceptions/);
    expect(err).toMatch(/Malformed exception entries/);
  });

  it("exits 1 on the error document npm writes when the audit fails", () => {
    const report = write("audit.json", {
      message:
        "request to https://registry.npmjs.org failed, reason: ECONNREFUSED",
      error: { summary: "", detail: "" },
    });
    main([report]);
    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(errSpy.mock.calls.flat().join("\n")).toMatch(
      /did not produce a report: request to .* ECONNREFUSED/
    );
    expect(logSpy.mock.calls.flat().join("\n")).not.toMatch(/passed/);
  });

  it("exits 1 when the report has no vulnerabilities object", () => {
    const report = write("audit.json", {});
    main([report]);
    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(errSpy.mock.calls.flat().join("\n")).toMatch(
      /did not produce a report: report has no "vulnerabilities" object/
    );
  });

  it("still passes a valid report with no vulnerabilities", () => {
    const report = write("audit.json", { vulnerabilities: {} });
    main([report]);
    expect(exitSpy).not.toHaveBeenCalled();
    expect(logSpy.mock.calls.flat().join("\n")).toMatch(/passed at level/);
  });
});

describe("validateAuditReport", () => {
  it("rejects non-objects", () => {
    expect(validateAuditReport(null)).toMatch(/not a JSON object/);
    expect(validateAuditReport([])).toMatch(/not a JSON object/);
    expect(validateAuditReport("x")).toMatch(/not a JSON object/);
  });

  it("surfaces npm's message, summary and detail", () => {
    expect(
      validateAuditReport({
        message: "boom",
        error: { summary: "sum", detail: "det" },
      })
    ).toBe("boom — sum — det");
  });

  it("accepts a report with a vulnerabilities object", () => {
    expect(validateAuditReport({ vulnerabilities: {} })).toBeNull();
  });
});
