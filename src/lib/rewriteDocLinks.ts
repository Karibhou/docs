/**
 * Rewrites relative Markdown doc links to absolute /docs/ routes.
 *
 * Pages are served at a flat route (/docs/hive/architecture) and at nav-alias
 * routes one level deeper (/docs/hive/operations/governor).  A relative href
 * such as `architecture` resolves correctly only at the flat route, so at an
 * alias route it 404s.  Resolving the link against the source file's directory
 * and emitting a root-absolute route works at both.
 *
 * Fenced code blocks and inline code are left untouched.
 *
 * @param content  Markdown/MDX source string.
 * @param baseDir  Directory of the source file relative to docs/content/ (e.g.
 *                 "hive").  Pass an empty string for files directly under
 *                 docs/content/.
 */
const DOC_EXT = /\.mdx?$/i;
const ANY_EXT = /\.[a-z0-9]+$/i;
const SCHEME = /^[a-z][a-z0-9+.-]*:/i;

function resolveDocTarget(target: string, baseDir: string): string | null {
  if (
    target === "" ||
    target.startsWith("/") ||
    target.startsWith("#") ||
    target.startsWith("?") ||
    SCHEME.test(target)
  ) {
    return null;
  }
  const suffixIdx = target.search(/[#?]/);
  const pathPart = suffixIdx === -1 ? target : target.slice(0, suffixIdx);
  const suffix = suffixIdx === -1 ? "" : target.slice(suffixIdx);
  // Only doc links: .md/.mdx or extensionless. Assets keep their extension.
  if (!DOC_EXT.test(pathPart) && ANY_EXT.test(pathPart)) return null;

  const segments: string[] = [];
  const parts = [
    ...(baseDir ? baseDir.split("/") : []),
    ...pathPart.replace(DOC_EXT, "").split("/"),
  ];
  for (const part of parts) {
    if (part === "" || part === ".") continue;
    if (part === "..") {
      // Escapes docs/content: leave the original reference unchanged.
      if (segments.length === 0) return null;
      segments.pop();
    } else {
      segments.push(part);
    }
  }
  return `/docs/${segments.join("/")}${suffix}`;
}

// Splits an optional CommonMark title (` "..."` or ` '...'`) off a destination.
function splitTitle(raw: string): { dest: string; title: string } {
  const m = /^(\S+)(\s+(?:"[^"]*"|'[^']*'))$/.exec(raw);
  return m ? { dest: m[1], title: m[2] } : { dest: raw, title: "" };
}

function rewriteText(text: string, baseDir: string): string {
  const inline = text.replace(
    /(?<!!)\[([^\]]*)\]\(([^)]+)\)/g,
    (match, label: string, inner: string) => {
      const { dest, title } = splitTitle(inner.trim());
      const resolved = resolveDocTarget(dest, baseDir);
      return resolved === null ? match : `[${label}](${resolved}${title})`;
    }
  );
  return inline.replace(
    /^( {0,3}\[[^\]]+\]:[ \t]*)(\S+)([ \t].*)?$/gm,
    (match, head: string, dest: string, rest: string | undefined) => {
      const resolved = resolveDocTarget(dest, baseDir);
      return resolved === null ? match : `${head}${resolved}${rest ?? ""}`;
    }
  );
}

// Rewrites a prose segment, skipping inline code spans.
function rewriteProse(text: string, baseDir: string): string {
  return text
    .split(/(`+[^`]*?`+)/)
    .map((chunk, i) => (i % 2 === 1 ? chunk : rewriteText(chunk, baseDir)))
    .join("");
}

export function rewriteRelativeDocLinks(
  content: string,
  baseDir: string
): string {
  const lines = content.split("\n");
  const out: string[] = [];
  let prose: string[] = [];
  let fence: string | null = null;

  const flush = () => {
    if (prose.length) out.push(rewriteProse(prose.join("\n"), baseDir));
    prose = [];
  };

  for (const line of lines) {
    const m = /^ {0,3}(`{3,}|~{3,})/.exec(line);
    if (fence === null) {
      if (m) {
        flush();
        fence = m[1];
        out.push(line);
      } else {
        prose.push(line);
      }
    } else {
      out.push(line);
      if (m && m[1][0] === fence[0] && m[1].length >= fence.length) {
        fence = null;
      }
    }
  }
  flush();
  return out.join("\n");
}
