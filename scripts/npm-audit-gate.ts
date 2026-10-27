/**
 * npm audit gate with a reviewed exceptions list.
 *
 * WHY: `npm audit --audit-level=high` exits non-zero for ANY high advisory,
 * including transitive ones with no patched release (e.g. an advisory whose
 * vulnerable range is `*`). Such a finding would block every PR until an
 * upstream release exists, with no way to acknowledge it. This script reads
 * `npm audit --json` output and fails only on advisories at or above the
 * threshold that are NOT listed in `.github/npm-audit-exceptions.json`.
 *
 * Every exception must carry a GHSA id, a reason, and an `expires` date; an
 * expired exception fails the gate so acknowledged findings are re-reviewed
 * rather than silently forgotten.
 *
 * A file that is not an audit report (e.g. the error document npm writes when
 * the registry is unreachable) fails the gate rather than passing it.
 *
 * Usage: npx tsx scripts/npm-audit-gate.ts <audit.json> [--level=high]
 */
import fs from "fs";
import path from "path";
import { pathToFileURL } from "url";

export const SEVERITY_RANK: Record<string, number> = {
  info: 0,
  low: 1,
  moderate: 2,
  high: 3,
  critical: 4,
};

export interface AuditException {
  id: string;
  package?: string;
  reason: string;
  expires: string;
}

export interface Advisory {
  id: string;
  package: string;
  severity: string;
  title: string;
  url: string;
}

interface AuditVia {
  source?: number;
  name?: string;
  title?: string;
  url?: string;
  severity?: string;
}

interface AuditReport {
  vulnerabilities?: Record<
    string,
    { name?: string; severity?: string; via?: Array<AuditVia | string> }
  >;
}

/**
 * Return why `report` is not a usable `npm audit --json` report, or null when
 * it is. npm writes `{ message, error: { summary, detail } }` to stdout when
 * the audit request itself fails, which must not be read as "no advisories".
 */
export function validateAuditReport(report: unknown): string | null {
  if (typeof report !== "object" || report === null || Array.isArray(report)) {
    return "report is not a JSON object";
  }
  const doc = report as Record<string, unknown>;
  const vulns = doc.vulnerabilities;
  if (typeof vulns === "object" && vulns !== null && !Array.isArray(vulns)) {
    return null;
  }
  const err = (doc.error ?? {}) as { summary?: unknown; detail?: unknown };
  const parts = [doc.message, err.summary, err.detail].filter(
    (p): p is string => typeof p === "string" && p.length > 0
  );
  return parts.length > 0
    ? parts.join(" — ")
    : 'report has no "vulnerabilities" object';
}

export function ghsaIdFromUrl(url: string | undefined): string | null {
  const m = /GHSA-[0-9a-z]{4}-[0-9a-z]{4}-[0-9a-z]{4}/i.exec(url ?? "");
  return m ? m[0].toUpperCase() : null;
}

/**
 * Collect root advisories from an `npm audit --json` report. Packages that are
 * only vulnerable because they depend on a vulnerable package carry string
 * entries in `via`; those are derived and are covered by their root advisory.
 * Deduplicate by advisory id and package so each affected package is evaluated.
 */
export function collectAdvisories(report: AuditReport): Advisory[] {
  const seen = new Map<string, Advisory>();
  for (const [pkgName, vuln] of Object.entries(report.vulnerabilities ?? {})) {
    for (const via of vuln.via ?? []) {
      if (typeof via === "string") continue;
      const id = ghsaIdFromUrl(via.url) ?? `npm-${via.source ?? "unknown"}`;
      const packageName = via.name ?? vuln.name ?? pkgName;
      const key = `${id}:${packageName}`;
      if (seen.has(key)) continue;
      seen.set(key, {
        id,
        package: packageName,
        severity: (via.severity ?? vuln.severity ?? "info").toLowerCase(),
        title: via.title ?? "",
        url: via.url ?? "",
      });
    }
  }
  return [...seen.values()];
}

export interface GateResult {
  blocking: Advisory[];
  excepted: Advisory[];
  belowLevel: Advisory[];
  expired: AuditException[];
  unused: AuditException[];
  invalid: string[];
}

export function evaluateAudit(
  report: AuditReport,
  exceptions: AuditException[],
  level: string,
  now: Date = new Date()
): GateResult {
  const threshold = SEVERITY_RANK[level.toLowerCase()];
  if (threshold === undefined) {
    throw new Error(`Unknown audit level "${level}"`);
  }

  const invalid: string[] = [];
  const active = new Map<string, AuditException>();
  const expired: AuditException[] = [];
  for (const ex of exceptions) {
    if (!ex.id || !/^GHSA-/i.test(ex.id) || !ex.reason || !ex.expires) {
      invalid.push(JSON.stringify(ex));
      continue;
    }
    const expires = new Date(ex.expires);
    if (Number.isNaN(expires.getTime())) {
      invalid.push(JSON.stringify(ex));
      continue;
    }
    if (expires.getTime() < now.getTime()) {
      expired.push(ex);
      continue;
    }
    active.set(ex.id.toUpperCase(), ex);
  }

  const blocking: Advisory[] = [];
  const excepted: Advisory[] = [];
  const belowLevel: Advisory[] = [];
  const used = new Set<string>();
  for (const adv of collectAdvisories(report)) {
    if ((SEVERITY_RANK[adv.severity] ?? 0) < threshold) {
      belowLevel.push(adv);
      continue;
    }
    const ex = active.get(adv.id);
    if (ex && (!ex.package || ex.package === adv.package)) {
      used.add(adv.id);
      excepted.push(adv);
    } else {
      blocking.push(adv);
    }
  }
  const unused = [...active.values()].filter(
    ex => !used.has(ex.id.toUpperCase())
  );

  return { blocking, excepted, belowLevel, expired, unused, invalid };
}

export function loadExceptions(file: string): AuditException[] {
  if (!fs.existsSync(file)) return [];
  const parsed = JSON.parse(fs.readFileSync(file, "utf8"));
  if (!Array.isArray(parsed)) {
    throw new Error(`${file}: expected a JSON array of exceptions`);
  }
  return parsed as AuditException[];
}

function fmt(adv: Advisory): string {
  return `  ${adv.id}  ${adv.package} (${adv.severity})  ${adv.title}\n    ${adv.url}`;
}

export function main(argv: string[] = process.argv.slice(2)): void {
  const levelArg = argv.find(a => a.startsWith("--level="));
  const level = levelArg ? levelArg.slice("--level=".length) : "high";
  const reportFile = argv.find(a => !a.startsWith("--"));
  if (!reportFile) {
    console.error(
      "usage: npx tsx scripts/npm-audit-gate.ts <audit.json> [--level=high]"
    );
    process.exit(2);
    return;
  }

  const parsed: unknown = JSON.parse(fs.readFileSync(reportFile, "utf8"));
  const invalidReason = validateAuditReport(parsed);
  if (invalidReason !== null) {
    console.error(`❌ npm audit did not produce a report: ${invalidReason}`);
    process.exit(1);
    return;
  }
  const report = parsed as AuditReport;
  const exceptionsFile = path.join(
    process.cwd(),
    ".github",
    "npm-audit-exceptions.json"
  );
  const exceptions = loadExceptions(exceptionsFile);
  const result = evaluateAudit(report, exceptions, level);

  if (result.excepted.length > 0) {
    console.log(
      `Acknowledged ${result.excepted.length} advisory(ies) via ${path.relative(
        process.cwd(),
        exceptionsFile
      )}:`
    );
    for (const adv of result.excepted) console.log(fmt(adv));
  }
  if (result.belowLevel.length > 0) {
    console.log(
      `Ignoring ${result.belowLevel.length} advisory(ies) below "${level}".`
    );
  }
  for (const ex of result.unused) {
    console.log(`::warning::Unused npm audit exception ${ex.id} — remove it.`);
  }

  let failed = false;
  if (result.invalid.length > 0) {
    failed = true;
    console.error(
      "\n❌ Malformed exception entries (need id, reason, expires):"
    );
    for (const raw of result.invalid) console.error(`  ${raw}`);
  }
  if (result.expired.length > 0) {
    failed = true;
    console.error(
      "\n❌ Expired npm audit exceptions (re-review and extend or remove):"
    );
    for (const ex of result.expired) {
      console.error(`  ${ex.id}  expired ${ex.expires}  ${ex.reason}`);
    }
  }
  if (result.blocking.length > 0) {
    failed = true;
    console.error(
      `\n❌ ${result.blocking.length} advisory(ies) at or above "${level}" without an exception:`
    );
    for (const adv of result.blocking) console.error(fmt(adv));
    console.error(
      "\nFix by upgrading the dependency, or — only when no patched release " +
        "exists — add a reviewed entry with a reason and expiry to " +
        ".github/npm-audit-exceptions.json."
    );
  }

  if (failed) {
    process.exit(1);
    return;
  }
  console.log(`✅ npm audit gate passed at level "${level}".`);
}

// Run only when executed directly (allows importing for tests).
if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main();
}
