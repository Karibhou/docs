/**
 * Convert an Astro/MDX content page into plain Markdown that the docs site
 * can render.
 *
 * The docs site compiles synced pages with nextra's MDX compiler, so anything
 * the source page imports (Astro components, `export const components`) would
 * fail to resolve here. This module:
 *
 *  - lifts the frontmatter `title` / `summary` (or `description`) into an H1
 *    and an italic lede, matching the convention of the other synced pages
 *  - strips `import` / `export` statements
 *  - rewrites the handful of known block components (`<Step>`, `<AgentBlock>`)
 *    and self-closing components (`<YouTubeVideo>`) into Markdown equivalents
 *  - flattens any other component to its text content and records a note so
 *    the sync log shows exactly what was lost
 *  - rewrites site-absolute links (`/install/`) to the canonical site and
 *    hands site-absolute image paths (`/images/...`) to a caller-supplied
 *    rewriter so the assets can be copied next to the synced page
 *  - escapes stray braces outside code so MDX does not treat them as
 *    expressions
 *
 * Fenced code blocks are never parsed for components or rewritten.
 */

import { FenceTracker } from "./markdown-fences";

export interface MdxConvertOptions {
  /** Canonical site the page is published on, e.g. https://spektacular.dev. */
  siteBase: string;
  /** Site-absolute path prefix that identifies a static asset. */
  imagePrefix?: string;
  /**
   * Called for every image whose src starts with `imagePrefix`; the returned
   * value replaces the src. Defaults to stripping the leading slash so the
   * image is served relative to the synced page.
   */
  rewriteImage?: (src: string) => string;
}

export interface MdxConversion {
  markdown: string;
  title?: string;
  description?: string;
  /** Site-absolute image paths encountered (before rewriting). */
  images: string[];
  /** Human-readable notes about constructs that were dropped or flattened. */
  notes: string[];
}

const DEFAULT_IMAGE_PREFIX = "/images/";
// A JSX tag on a line of its own: `<Name attrs>`, `<Name attrs />` or `</Name>`.
const BLOCK_OPEN_RE = /^\s*<([A-Z][A-Za-z0-9.]*)((?:\s+[^>]*?)?)\s*(\/?)>\s*$/;
const BLOCK_CLOSE_RE = /^\s*<\/([A-Z][A-Za-z0-9.]*)\s*>\s*$/;
const INLINE_TAG_RE = /<\/?([A-Z][A-Za-z0-9.]*)(?:\s+[^>]*?)?\s*\/?>/g;
const IMPORT_RE = /^import\b[\s\S]*?;[ \t]*$/gm;
const EXPORT_RE =
  /^export\s+(?:const|let|var|default|function)\b[\s\S]*?;[ \t]*$/gm;
const JSX_COMMENT_RE = /\{\/\*[\s\S]*?\*\/\}/g;
const SECONDS_PER_MINUTE = 60;

export const AGENT_LABELS: Record<string, string> = {
  claude: "Claude Code",
  bob: "Bob",
  codex: "Codex",
};

type Attrs = Record<string, string | number | boolean>;

// ---------------------------------------------------------------------------
// Frontmatter
// ---------------------------------------------------------------------------

export function splitFrontmatter(src: string): {
  data: Record<string, string>;
  body: string;
} {
  const m = src.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!m) return { data: {}, body: src };
  const data: Record<string, string> = {};
  for (const line of m[1].split(/\r?\n/)) {
    const kv = line.match(/^([A-Za-z_][\w-]*):\s*(.*)$/);
    if (!kv) continue;
    let value = kv[2].trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    data[kv[1]] = value;
  }
  return { data, body: src.slice(m[0].length) };
}

// ---------------------------------------------------------------------------
// Attribute parsing
// ---------------------------------------------------------------------------

export function parseAttrs(raw: string): Attrs {
  const attrs: Attrs = {};
  const re =
    /([A-Za-z_][\w-]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|\{([^}]*)\}))?/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw)) !== null) {
    const [, name, dq, sq, expr] = m;
    if (dq !== undefined) attrs[name] = dq;
    else if (sq !== undefined) attrs[name] = sq;
    else if (expr !== undefined) {
      const trimmed = expr.trim();
      if (trimmed === "true") attrs[name] = true;
      else if (trimmed === "false") attrs[name] = false;
      else if (/^-?\d+(\.\d+)?$/.test(trimmed)) attrs[name] = Number(trimmed);
      else attrs[name] = trimmed.replace(/^["']|["']$/g, "");
    } else attrs[name] = true;
  }
  return attrs;
}

// ---------------------------------------------------------------------------
// Component renderers
// ---------------------------------------------------------------------------

function formatTimestamp(seconds: number): string {
  const m = Math.floor(seconds / SECONDS_PER_MINUTE);
  const s = seconds % SECONDS_PER_MINUTE;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function renderYouTube(attrs: Attrs): string {
  const url = typeof attrs.url === "string" ? attrs.url : "";
  const start = typeof attrs.start === "number" ? attrs.start : undefined;
  const href =
    start !== undefined
      ? `${url}${url.includes("?") ? "&" : "?"}t=${start}`
      : url;
  const label =
    start !== undefined
      ? `Watch this section on YouTube (from ${formatTimestamp(start)})`
      : "Watch this section on YouTube";
  return `[${label}](${href})`;
}

function renderStep(attrs: Attrs, inner: string): string {
  const number = attrs.number !== undefined ? String(attrs.number) : "";
  const heading = typeof attrs.heading === "string" ? attrs.heading : "";
  const title =
    number && heading
      ? `Step ${number}: ${heading}`
      : heading || `Step ${number}`;
  return `### ${title}\n\n${inner.trim()}`;
}

function renderAgentBlock(attrs: Attrs, inner: string): string {
  const id = typeof attrs.for === "string" ? attrs.for : "";
  const label =
    AGENT_LABELS[id] ?? (id ? id[0].toUpperCase() + id.slice(1) : "Agent");
  return `**${label}**\n\n${inner.trim()}`;
}

// ---------------------------------------------------------------------------
// Block-level component conversion (line based, fence aware)
// ---------------------------------------------------------------------------

function dedent(lines: string[]): string[] {
  let min = Infinity;
  for (const l of lines) {
    if (l.trim() === "") continue;
    const indent = l.match(/^[ \t]*/)![0].length;
    if (indent < min) min = indent;
  }
  if (!Number.isFinite(min) || min === 0) return lines;
  return lines.map(l => (l.trim() === "" ? "" : l.slice(min)));
}

function findClose(lines: string[], from: number, name: string): number {
  let depth = 0;
  const fences = new FenceTracker();
  for (let i = from; i < lines.length; i++) {
    if (fences.next(lines[i]) !== "outside") continue;
    const open = lines[i].match(BLOCK_OPEN_RE);
    if (open && open[1] === name && open[3] !== "/") depth++;
    const close = lines[i].match(BLOCK_CLOSE_RE);
    if (close && close[1] === name) {
      if (depth === 0) return i;
      depth--;
    }
  }
  return -1;
}

function convertBlocks(lines: string[], notes: string[]): string[] {
  const out: string[] = [];
  const fences = new FenceTracker();

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (fences.next(line) !== "outside") {
      out.push(line);
      continue;
    }

    const open = line.match(BLOCK_OPEN_RE);
    if (open) {
      const [, name, rawAttrs, selfClose] = open;
      const attrs = parseAttrs(rawAttrs);
      if (selfClose === "/") {
        if (name === "YouTubeVideo") {
          out.push(renderYouTube(attrs));
        } else {
          notes.push(
            `dropped self-closing component <${name} /> (no Markdown equivalent)`
          );
        }
        continue;
      }
      const closeIdx = findClose(lines, i + 1, name);
      if (closeIdx === -1) {
        notes.push(
          `unterminated <${name}> at line ${i + 1}; tag removed, content kept`
        );
        continue;
      }
      const inner = convertBlocks(
        dedent(lines.slice(i + 1, closeIdx)),
        notes
      ).join("\n");
      if (name === "Step") out.push(renderStep(attrs, inner));
      else if (name === "AgentBlock") out.push(renderAgentBlock(attrs, inner));
      else {
        notes.push(`flattened unknown component <${name}> to its text content`);
        out.push(inner.trim());
      }
      i = closeIdx;
      continue;
    }

    if (BLOCK_CLOSE_RE.test(line)) {
      notes.push(`stray closing tag removed at line ${i + 1}: ${line.trim()}`);
      continue;
    }

    out.push(line);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Inline pass (links, images, leftovers) with code protected
// ---------------------------------------------------------------------------

function withCodeProtected(src: string, fn: (s: string) => string): string {
  const slots: string[] = [];
  const keep = (m: string) => {
    slots.push(m);
    return `\u0000${slots.length - 1}\u0000`;
  };
  let s = src
    .replace(/^([ \t]*)(`{3,}|~{3,})[\s\S]*?^\1\2[ \t]*$/gm, keep)
    .replace(/`[^`\n]*`/g, keep);
  s = fn(s);
  return s.replace(/\u0000(\d+)\u0000/g, (_, i) => slots[Number(i)]);
}

export function convertMdxToMarkdown(
  src: string,
  opts: MdxConvertOptions
): MdxConversion {
  const notes: string[] = [];
  const images: string[] = [];
  const imagePrefix = opts.imagePrefix ?? DEFAULT_IMAGE_PREFIX;
  const rewriteImage =
    opts.rewriteImage ?? ((s: string) => s.replace(/^\//, ""));
  const siteBase = opts.siteBase.replace(/\/$/, "");

  const { data, body } = splitFrontmatter(src);
  const title = data.title;
  const description = data.summary ?? data.description;

  let text = withCodeProtected(body, s =>
    s.replace(IMPORT_RE, "").replace(EXPORT_RE, "").replace(JSX_COMMENT_RE, "")
  );

  text = convertBlocks(text.split("\n"), notes).join("\n");

  text = withCodeProtected(text, s => {
    // Inline components left inside paragraphs: keep the text, drop the tags.
    s = s.replace(INLINE_TAG_RE, (m, name: string) => {
      notes.push(`removed inline tag ${m.trim()} (<${name}>)`);
      return "";
    });
    // Images first so a linked image is rewritten before the enclosing link.
    s = s.replace(
      /!\[([^\]]*)\]\(([^)\s]+)((?:\s+"[^"]*")?)\)/g,
      (m, alt, href, tail) => {
        if (!href.startsWith(imagePrefix)) return m;
        images.push(href);
        return `![${alt}](${rewriteImage(href)}${tail})`;
      }
    );
    // Links; the text may be an already-rewritten image.
    s = s.replace(
      /(?<!!)\[((?:!\[[^\]]*\]\([^)]*\)|[^\]])*)\]\(([^)\s]+)((?:\s+"[^"]*")?)\)/g,
      (m, text, href, tail) =>
        href.startsWith("/") ? `[${text}](${siteBase}${href}${tail})` : m
    );
    // Stray braces would be parsed as MDX expressions.
    s = s.replace(/[{}]/g, c => (c === "{" ? "&#123;" : "&#125;"));
    return s;
  });

  text = text.replace(/\n{3,}/g, "\n\n").trim();

  const head: string[] = [];
  if (title) head.push(`# ${title}`);
  if (description) head.push(`_${description}_`);
  const markdown = [...head, text].filter(Boolean).join("\n\n") + "\n";

  return { markdown, title, description, images, notes };
}
