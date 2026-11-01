/**
 * Pure helpers extracted from check-internal-links.ts.
 *
 * Keeping these in a side-effect-free module lets the vitest suite import them
 * without triggering the CLI script's top-level filesystem reads (contentRoot
 * walk, page-map.ts parse). The main script re-imports and reuses them.
 *
 * All helpers here are deterministic and have no filesystem side effects.
 */
import path from "node:path";
import ts from "typescript";
import { mapOutsideFences } from "./markdown-fences";

/**
 * Convert a human-readable nav title into a URL slug.
 *
 * Mirrors the slug rule that buildPageMap() applies to NAV_STRUCTURE_* entries
 * in src/app/docs/page-map.ts, so nav-aliased routes come out the same on both
 * sides of the check.
 *
 * Rule: lowercase, collapse any run of non-[a-z0-9] to a single '-', then trim
 * leading/trailing dashes.
 */
export function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * Normalize a route for set-membership comparison.
 *
 * The link checker registers valid routes with and without a trailing slash
 * inconsistently (nav aliases vs flat routes). Comparing normalized forms
 * avoids false-positive "broken" reports for links that only differ by a
 * trailing slash. Root '/' is preserved.
 */
export function normRoute(r: string): string {
  const noSlash = r.replace(/\/+$/, "");
  return noSlash === "" ? "/" : noSlash;
}

/**
 * Should the checker skip this link target entirely?
 *
 * Returns true for:
 *   - the empty string (defensive; usually a preceding `[]()`)
 *   - any URI with an explicit scheme (`http:`, `https:`, `mailto:`, `ftp:`, …)
 *   - protocol-relative URLs (`//host/path`)
 *   - pure in-page anchors (`#section`)
 *
 * These are intentionally out of scope — either external or handled by the
 * browser, and validating them would introduce network flakiness.
 */
export function isExternalOrAnchor(target: string): boolean {
  if (target === "") return true;
  if (/^[a-z][a-z0-9+.-]*:/i.test(target)) return true;
  if (target.startsWith("//")) return true;
  if (target.startsWith("#")) return true;
  return false;
}

/**
 * Extensions treated as assets rather than doc routes.
 *
 * Asset links are served by the `/docs-images/*` rewrite (see
 * rewriteImagePaths in the docs page), not by the docs route table, so they
 * must NOT be validated against the route set.
 */
export const ASSET_EXT =
  /\.(png|jpe?g|gif|svg|webp|avif|ico|pdf|mp4|webm|mov|zip|gz|tgz|css|js|woff2?|ttf|eot)$/i;

/**
 * Map from a NAV_STRUCTURE_<X> variable name to the docs base path its
 * entries live under. Exported so the main script and its tests share
 * one source of truth (drift here would silently break nav-alias
 * resolution).
 */
export const PROJECT_FOR_NAV: Record<string, string> = {
  HIVE: "docs/hive",
  HOTSHOT: "docs/hotshot",
  PLUK: "docs/pluk",
  RATIONGUARD: "docs/rationguard",
  PROMPTARGS: "docs/promptargs",
  DIBS: "docs/dibs",
  CRUX: "docs/crux",
  SPEKTACULAR: "docs/spektacular",
  // Shared sections (Community, …) live under docs/content/<section>/ and
  // are served at /docs/<section>/<slug>.
  GENERAL: "docs",
};

/**
 * One nav-alias entry extracted from a page-map.ts NAV_STRUCTURE_* block.
 * Represents the `{ 'Title': 'file.md' }` pairs that buildPageMap() maps
 * to a nav-slug route on the site.
 */
export interface NavAliasEntry {
  /** The uppercase NAV_STRUCTURE_<name> suffix, e.g. 'HIVE'. */
  navName: string;
  /** Base path resolved via PROJECT_FOR_NAV, e.g. 'docs/hive'. */
  base: string;
  /**
   * Slugified category and folder ancestors, joined with `/`.
   */
  sectionSlug: string;
  /** The slug derived from the entry's title (via slugify()). */
  slug: string;
  /** The raw title, before slugification (kept for diagnostics). */
  title: string;
  /** The `.md`/`.mdx` file referenced by the entry, e.g. 'readme.md'. */
  file: string;
}

/**
 * Extract every nav-alias entry from a page-map.ts source string.
 *
 * This is the untangled version of the top-level regex loop that
 * check-internal-links.ts runs at startup. Keeping it pure and side-
 * effect-free lets tests feed synthetic page-map source and assert on
 * the exact set of entries produced — critical because a regex
 * regression here silently makes the link checker permissive
 * (invents nav routes that don't exist) or over-strict (misses real
 * nav routes and reports valid links as broken).
 *
 * The function does NOT filter entries by file existence — callers
 * decide whether an entry is registered as a valid route. That
 * separation makes both halves independently testable.
 *
 * Parsing rules (must mirror buildPageMap in src/app/docs/page-map.ts):
 *   - Each `const NAV_STRUCTURE_<NAME> ... = [ ... ]` block is one nav.
 *   - Each category's `title` starts the path; nested array-valued items
 *     contribute folder slugs.
 *   - Each string-valued leaf contributes exactly one route. General-section
 *     leaves use the file basename, as buildPageMap() does.
 */
export function parseNavStructures(
  pageMapSrc: string,
  projectForNav: Record<string, string> = PROJECT_FOR_NAV
): NavAliasEntry[] {
  const results: NavAliasEntry[] = [];
  const source = ts.createSourceFile(
    "page-map.ts",
    pageMapSrc,
    ts.ScriptTarget.Latest,
    true
  );
  const property = (node: ts.ObjectLiteralExpression, name: string) =>
    node.properties.find(
      (p): p is ts.PropertyAssignment =>
        ts.isPropertyAssignment(p) &&
        p.name.getText(source).replace(/^['"]|['"]$/g, "") === name
    );
  const visitItems = (
    items: ts.ArrayLiteralExpression,
    ancestors: string[],
    navName: string,
    base: string
  ) => {
    for (const item of items.elements) {
      if (!ts.isObjectLiteralExpression(item)) continue;
      for (const member of item.properties) {
        if (!ts.isPropertyAssignment(member)) continue;
        const title = ts.isStringLiteral(member.name)
          ? member.name.text
          : member.name.getText(source);
        if (ts.isArrayLiteralExpression(member.initializer)) {
          visitItems(
            member.initializer,
            [...ancestors, slugify(title)],
            navName,
            base
          );
        } else if (ts.isStringLiteral(member.initializer)) {
          const file = member.initializer.text;
          if (
            !/\.mdx?$/.test(file) ||
            file.startsWith("http") ||
            file.startsWith("/")
          )
            continue;
          const isGeneral = /^(contributing|community|news)\//.test(file);
          const slug = isGeneral
            ? path.posix.basename(file).replace(/\.mdx?$/, "")
            : slugify(title);
          results.push({
            navName,
            base: isGeneral ? "docs" : base,
            sectionSlug: ancestors.join("/"),
            slug,
            title,
            file,
          });
        }
      }
    }
  };
  for (const statement of source.statements) {
    if (
      !ts.isVariableStatement(statement) ||
      !(statement.declarationList.flags & ts.NodeFlags.Const)
    )
      continue;
    for (const declaration of statement.declarationList.declarations) {
      if (
        !ts.isIdentifier(declaration.name) ||
        !declaration.initializer ||
        !ts.isArrayLiteralExpression(declaration.initializer)
      )
        continue;
      const match = /^NAV_STRUCTURE_([A-Z_]+)$/.exec(declaration.name.text);
      const navName = match?.[1];
      const base = navName && projectForNav[navName];
      if (!navName || !base) continue;
      for (const category of declaration.initializer.elements) {
        if (!ts.isObjectLiteralExpression(category)) continue;
        const title = property(category, "title")?.initializer;
        const items = property(category, "items")?.initializer;
        if (
          title &&
          ts.isStringLiteral(title) &&
          items &&
          ts.isArrayLiteralExpression(items)
        ) {
          visitItems(items, [slugify(title.text)], navName, base);
        }
      }
    }
  }
  return results;
}

/**
 * Turn a nav-alias entry into the site route it registers.
 *
 * Kept as a tiny helper so the main script and tests both produce the
 * exact same route string for a given entry, and so a future change to
 * the route shape only has to be made in one place.
 */
export function navEntryRoute(e: NavAliasEntry): string {
  return `/${e.base}/${e.sectionSlug}/${e.slug}`;
}

/**
 * Resolve a raw markdown link target to the absolute site route it should
 * point at, or `null` if the link is not a docs route (external, anchor,
 * asset, or pure query/fragment on the current page).
 *
 * @param raw       The link target exactly as it appears in markdown.
 * @param baseRoute The site route of the file containing the link, e.g.
 *                  '/docs/hive/overview'. Used to resolve relative targets.
 *
 * The returned route is stripped of any `.md`/`.mdx` suffix (never part of a
 * real route) and of any `?query` / `#fragment` suffix, but it is NOT
 * trailing-slash-normalized — call normRoute() before set lookup.
 */
export function resolveInternalLink(
  raw: string,
  baseRoute: string
): string | null {
  if (isExternalOrAnchor(raw)) return null;

  const pathPart = raw.replace(/[?#].*$/, "");
  if (pathPart === "") return null;
  if (ASSET_EXT.test(pathPart)) return null;

  const baseDir = path.posix.dirname(baseRoute);
  let resolved: string;
  if (pathPart.startsWith("/")) {
    resolved = pathPart;
  } else {
    resolved = path.posix.normalize(path.posix.join(baseDir, pathPart));
  }
  return resolved.replace(/\.mdx?$/i, "");
}

const INLINE_LINK = /\]\(\s*([^)\s]+)(?:\s+[^)]*)?\)/g;
const REF_LINK = /^\s*\[[^\]]+\]:\s*(\S+)/gm;

/**
 * Collect inline and reference-definition link targets from markdown,
 * ignoring anything inside fenced code blocks.
 */
export function extractLinkTargets(content: string): string[] {
  const targets: string[] = [];
  mapOutsideFences(content, text => {
    for (const m of text.matchAll(INLINE_LINK)) targets.push(m[1]);
    for (const m of text.matchAll(REF_LINK)) targets.push(m[1]);
    return text;
  });
  return targets;
}
