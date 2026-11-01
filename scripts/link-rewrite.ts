/**
 * Shared link rewriting for the doc-sync scripts (sync-hive-docs.ts,
 * sync-sibling-docs.ts).
 *
 * Synced markdown is authored for GitHub's file browser, where relative links
 * resolve against the file's location in its source repository. On the docs
 * site those links 404, so each relative target is resolved against the
 * source file's directory (normalising `./` and `../`) to a repo-root-relative
 * path, then:
 *
 *   - if the caller's `resolveSyncedRoute` maps it to a published page, it
 *     becomes that site route;
 *   - otherwise it becomes an absolute GitHub blob URL on the synced branch.
 *
 * Any `#fragment` / `?query` suffix is preserved. Absolute URLs (any scheme),
 * protocol-relative `//` URLs, root-absolute `/...` paths and pure `#anchor`
 * links are left untouched, which also makes the pass idempotent.
 *
 * Both inline links `[text](target "title")` and reference-style definitions
 * `[id]: target` are rewritten. When `rawBase` is set, relative inline image
 * sources `![alt](src)` are pointed at raw file URLs instead.
 */
import path from "path";
import { mapOutsideFences } from "./markdown-fences";

export interface LinkRewriteOptions {
  /** Repo-root-relative path of the file whose content is being rewritten. */
  sourceRepoPath: string;
  /** `https://github.com/<owner>/<repo>/blob/<branch>` for unsynced targets. */
  blobBase: string;
  /**
   * Return the site route for a link target, or `undefined` if the target is
   * not a synced page. `resolved` is the normalised repo-root-relative path;
   * `pathPart` is the link's original path (without suffix).
   */
  resolveSyncedRoute: (
    resolved: string,
    pathPart: string
  ) => string | undefined;
  /**
   * `https://raw.githubusercontent.com/<owner>/<repo>/<branch>`. When set,
   * relative inline image sources are rewritten to raw URLs (never to a site
   * route). When unset, images are treated like any other link.
   */
  rawBase?: string;
}

// Split a link target into its path portion and a preserved `#fragment` /
// `?query` suffix so only the path is rewritten.
export function splitSuffix(target: string): {
  pathPart: string;
  suffix: string;
} {
  const match = target.match(/^([^?#]*)([?#].*)?$/);
  return { pathPart: match?.[1] ?? target, suffix: match?.[2] ?? "" };
}

// Resolve a relative link target against the source file's directory. Returns
// null when the target must be left untouched.
function resolveRelative(
  target: string,
  sourceRepoPath: string
): { pathPart: string; resolved: string; suffix: string } | null {
  const trimmed = target.trim();
  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) return null; // http:, mailto:, etc.
  if (trimmed.startsWith("//")) return null;
  if (trimmed.startsWith("/")) return null; // root-absolute site path
  if (trimmed.startsWith("#")) return null;
  if (trimmed === "") return null;

  const { pathPart, suffix } = splitSuffix(trimmed);
  if (pathPart === "") return null; // e.g. a lone `?query`

  const sourceDir = path.posix.dirname(sourceRepoPath);
  const resolved = path.posix.normalize(path.posix.join(sourceDir, pathPart));
  return { pathPart, resolved, suffix };
}

// Rewrite a single link target. Returns the original target unchanged when no
// rewrite applies.
export function rewriteLinkTarget(
  target: string,
  opts: LinkRewriteOptions
): string {
  const rel = resolveRelative(target, opts.sourceRepoPath);
  if (!rel) return target;
  const route = opts.resolveSyncedRoute(rel.resolved, rel.pathPart);
  if (route !== undefined) return `${route}${rel.suffix}`;
  return `${opts.blobBase}/${rel.resolved}${rel.suffix}`;
}

// Rewrite a single image source to a raw file URL. Returns the original
// source unchanged when no rewrite applies.
export function rewriteImageTarget(
  target: string,
  sourceRepoPath: string,
  rawBase: string
): string {
  const rel = resolveRelative(target, sourceRepoPath);
  if (!rel) return target;
  return `${rawBase}/${rel.resolved}${rel.suffix}`;
}

// Apply link rewriting to a file's markdown content.
// Fenced code blocks are left byte-for-byte unchanged.
export function rewriteMarkdownLinks(
  content: string,
  opts: LinkRewriteOptions
): string {
  return mapOutsideFences(content, text => rewriteLinksInText(text, opts));
}

function rewriteLinksInText(text: string, opts: LinkRewriteOptions): string {
  let out = text;

  // Images first: they become absolute raw URLs, which the link pass below
  // then leaves untouched.
  if (opts.rawBase !== undefined) {
    const rawBase = opts.rawBase;
    out = out.replace(
      /(!\[[^\]]*\]\()(\s*)([^)\s]+)([^)]*)(\))/g,
      (_full, open, lead, targetRaw, rest, close) => {
        const rewritten = rewriteImageTarget(
          targetRaw,
          opts.sourceRepoPath,
          rawBase
        );
        return `${open}${lead}${rewritten}${rest}${close}`;
      }
    );

    // Raw HTML `<img src="...">` (README logos are usually written this way
    // for width/height control). Relative sources otherwise resolve against
    // the site route and 404.
    out = out.replace(
      /(<img\b[^>]*?\ssrc=)(["'])([^"']+)\2/gi,
      (_full, prefix, quote, src) =>
        `${prefix}${quote}${rewriteImageTarget(src, opts.sourceRepoPath, rawBase)}${quote}`
    );
  }

  // Inline links: [text](target) and [text](target "title"). The target is
  // everything up to the first space (before an optional title) or the
  // closing paren.
  out = out.replace(
    /(\]\()(\s*)([^)\s]+)([^)]*)(\))/g,
    (_full, open, lead, targetRaw, rest, close) => {
      const rewritten = rewriteLinkTarget(targetRaw, opts);
      return `${open}${lead}${rewritten}${rest}${close}`;
    }
  );

  // Reference-style link definitions: `[id]: target` (optionally followed by a
  // title) at the start of a line.
  out = out.replace(
    /^(\s*\[[^\]]+\]:\s*)(\S+)(.*)$/gm,
    (_full, prefix, targetRaw, rest) => {
      const rewritten = rewriteLinkTarget(targetRaw, opts);
      return `${prefix}${rewritten}${rest}`;
    }
  );

  return out;
}
