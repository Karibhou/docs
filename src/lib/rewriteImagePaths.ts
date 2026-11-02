/**
 * Rewrites relative image paths in Markdown content to absolute /docs-images/ API paths.
 *
 * Relative paths like `images/foo.png` or `./images/foo.png` fail to load when the page
 * is served from a docs route because the browser resolves them against the page URL
 * instead of the filesystem location of the source file.  The /docs-images/* rewrite
 * rule in next.config.ts proxies these requests to /api/docs-image/* which serves
 * static assets from docs/content/.
 *
 * Fenced code blocks and inline code are left untouched.
 *
 * @param content  Raw Markdown/MDX source string.
 * @param baseDir  Directory of the source file relative to docs/content/ (e.g. "console"
 *                 or "hive").  Pass an empty string when the file lives directly
 *                 under docs/content/.
 */
function rewriteText(text: string, baseDir: string): string {
  return text.replace(
    /!\[([^\]]*)\]\(([^)]+)\)/g,
    (match, alt: string, src: string) => {
      const raw = src.trim();
      // Split an optional CommonMark title (` "..."` or ` '...'`) off the destination.
      const titleMatch = /^(\S+)(\s+(?:"[^"]*"|'[^']*'))$/.exec(raw);
      const trimmed = titleMatch ? titleMatch[1] : raw;
      const title = titleMatch ? titleMatch[2] : "";
      // Leave absolute URLs, absolute paths, data URIs, and anchor-only refs unchanged.
      if (
        trimmed.startsWith("/") ||
        /^https?:\/\//.test(trimmed) ||
        trimmed.startsWith("data:") ||
        trimmed.startsWith("#")
      ) {
        return match;
      }
      // Pure string normalisation (this module may run in the browser).
      const segments: string[] = [];
      const parts = [
        ...(baseDir ? baseDir.split("/") : []),
        ...trimmed.split("/"),
      ];
      for (const part of parts) {
        if (part === "" || part === ".") continue;
        if (part === "..") {
          // Escapes docs/content: leave the original reference unchanged.
          if (segments.length === 0) return match;
          segments.pop();
        } else {
          segments.push(part);
        }
      }
      return `![${alt}](/docs-images/${segments.join("/")}${title})`;
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

export function rewriteRelativeImagePaths(
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
