import { NextRequest, NextResponse } from "next/server";
import { convertHtmlScriptsToJsxComments } from "@/lib/transformMdx";
import { buildPageMap, docsContentPath, basePath } from "../../docs/page-map";
import fs from "fs";
import path from "path";
import { logger } from "@/lib/logger";
import { recordApiRequest } from "@/lib/metrics";
import { PROJECTS, type ProjectId } from "@/config/versions";

const MAX_QUERY_LENGTH = 200;

interface SearchResult {
  title: string;
  url: string;
  category: string;
  content: string;
  snippet: string;
  highlightedSnippet: string;
  matchType: "title" | "content" | "category";
}

// Apply a regex removal repeatedly until the output is stable.
// Prevents bypass via nested/interleaved input (CWE-20, CodeQL js/incomplete-multi-character-sanitization).
function stripUntilStableSR(text: string, pattern: RegExp): string {
  let prev = "";
  while (text !== prev) {
    prev = text;
    text = text.replace(pattern, "");
  }
  return text;
}

// The sync scripts (scripts/sync-hive-docs.ts, scripts/sync-sibling-docs.ts)
// prepend a provenance banner that the docs page reads as metadata. It is not
// page text, so keep it out of snippets and content matches. Matches only that
// banner (plus its contiguous "Also published at" quote lines and trailing
// blank lines); other leading callouts stay searchable.
const SYNCED_BANNER_RE =
  /^> \*\*Synced from [^*\n]+\*\* This page is pulled from [^\n]*(?:\n>[^\n]*)*(?:\n[ \t]*)*/m;

function stripSyncedBanner(content: string): string {
  return content.replace(SYNCED_BANNER_RE, "");
}

function toPlainText(content: string): string {
  let text = content;

  // Remove code blocks, inline code, comments
  text = text.replace(/```[\s\S]*?```/g, "");
  text = text.replace(/`[^`]+`/g, "");
  // Loop until stable — single-pass removal of `<!--...-->` is bypassable via
  // nested input e.g. `<!-<!--` → removes inner `<!--` → reassembles to `<!--`
  // (CodeQL #11: js/incomplete-multi-character-sanitization)
  text = stripUntilStableSR(text, /<!--[\s\S]*?-->/g);

  // Images first, then links: the link pattern also matches the tail of ![alt](src)
  text = text.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, "");
  text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1");

  // Headings -> keep text
  text = text.replace(/^#{1,6}\s+(.+)$/gm, "$1");

  // Bold/italic
  text = text.replace(/\*\*([^*]+)\*\*/g, "$1");
  text = text.replace(/\*([^*]+)\*/g, "$1");
  // Underscores inside words (HIVE_DOCS_REF) are not emphasis; keep them.
  text = text.replace(/(^|[^\w])_([^_]+)_(?!\w)/g, "$1$2");

  // HR
  text = text.replace(/^---+$/gm, "");

  // Strip residual HTML tags — loop until stable to prevent nested-tag bypass
  // (CodeQL #12: js/incomplete-multi-character-sanitization)
  text = stripUntilStableSR(text, /<\/?[^>]+>/g);

  // Collapse whitespace
  text = text.replace(/\n\s*\n/g, "\n").trim();
  return text;
}

function extractTitle(md: string, fallback: string): string {
  const m = md.match(/^#\s+(.+)$/m);
  return m ? m[1].trim() : fallback;
}

// `project` is the project segment the real docs route
// (src/app/docs/[...slug]/page.tsx) adds for project pages, or null for
// shared general-section pages that live directly under docs/content/.
function routeKeyToUrl(routeKey: string, project: string | null): string {
  const prefix = project ? `${basePath}/${project}` : basePath;
  return routeKey ? `/${prefix}/${routeKey}` : `/${prefix}`;
}

interface LocalFile {
  content: string;
  project: string | null;
}

function tryRead(fullPath: string): string | null {
  try {
    if (fs.existsSync(fullPath)) return fs.readFileSync(fullPath, "utf-8");
  } catch {
    // Treat unreadable files as missing
  }
  return null;
}

// buildPageMap(projectId) returns routeMap values relative to
// docs/content/<projectId>/, except for shared general-section pages
// (community/, etc.) which live directly under docs/content/. For hive, try
// the shared root first, then the project root, mirroring getPageContent() in
// src/app/docs/[...slug]/page.tsx. Sibling projects only probe their own
// directory, so shared general-section entries are indexed once (under hive).
function readLocalFile(projectId: string, filePath: string): LocalFile | null {
  if (projectId === "hive") {
    const shared = tryRead(path.join(docsContentPath, filePath));
    if (shared !== null) return { content: shared, project: null };
  }
  const own = tryRead(path.join(docsContentPath, projectId, filePath));
  return own !== null ? { content: own, project: projectId } : null;
}

interface IndexedDoc {
  title: string;
  url: string;
  category: string;
  text: string;
  lowerText: string;
  titleLower: string;
}

// Content is immutable at build time, so build the index once per process.
let searchIndex: IndexedDoc[] | null = null;

function buildSearchIndex(): IndexedDoc[] {
  const docs: IndexedDoc[] = [];
  for (const projectId of Object.keys(PROJECTS) as ProjectId[]) {
    const { routeMap } = buildPageMap(projectId);
    // routeMap lists nav routes first, then flat fallback aliases for the same
    // file; index each file once, under its navigation route.
    const seenFiles = new Set<string>();
    for (const [routeKey, filePath] of Object.entries(routeMap) as Array<
      [string, string]
    >) {
      const file = readLocalFile(projectId, filePath);
      if (!file) continue;
      const { content: raw, project } = file;
      if (seenFiles.has(filePath)) continue;
      seenFiles.add(filePath);

      const text = toPlainText(
        convertHtmlScriptsToJsxComments(stripSyncedBanner(raw))
      );

      const fallbackTitle =
        routeKey
          .split("/")
          .pop()
          ?.replace(/-/g, " ")
          .replace(/\b\w/g, c => c.toUpperCase()) || "Untitled";
      const title = extractTitle(raw, fallbackTitle);

      const category =
        routeKey
          .split("/")[0]
          ?.replace(/-/g, " ")
          .replace(/\b\w/g, c => c.toUpperCase()) || "Docs";

      docs.push({
        title,
        url: routeKeyToUrl(routeKey, project),
        category,
        text,
        lowerText: text.toLowerCase(),
        titleLower: title.toLowerCase(),
      });
    }
  }
  return docs;
}

/** HTML-encode special characters so they render as text in innerHTML */
function htmlEncode(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export async function GET(request: NextRequest) {
  const startedAt = performance.now();
  let status = 200;
  try {
    const sp = request.nextUrl.searchParams;
    const queryRaw = sp.get("q") || "";
    const query = queryRaw.toLowerCase().trim().slice(0, MAX_QUERY_LENGTH);
    if (!query) return NextResponse.json({ results: [], count: 0 });

    searchIndex ??= buildSearchIndex();

    const results: SearchResult[] = [];

    for (const doc of searchIndex) {
      const { text, title, category } = doc;
      const hay = doc.lowerText;
      const titleMatch = doc.titleLower.includes(query);
      const contentMatch = hay.includes(query);
      if (!titleMatch && !contentMatch) continue;

      let snippet = "";
      let highlightedSnippet = "";
      if (contentMatch) {
        const idx = hay.indexOf(query);
        const start = Math.max(0, idx - 60);
        const end = Math.min(text.length, idx + query.length + 80);
        snippet =
          (start > 0 ? "..." : "") +
          text.slice(start, end) +
          (end < text.length ? "..." : "");

        // Highlight on the raw snippet and HTML-encode each segment, so entities
        // are never split by <mark> and docs content cannot become live HTML.
        // Only the <mark>/<\/mark> tags we insert are trusted raw HTML.
        const rx = new RegExp(
          `(${query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`,
          "gi"
        );
        highlightedSnippet = snippet
          .split(rx)
          .map((part, i) =>
            i % 2 === 1 ? `<mark>${htmlEncode(part)}</mark>` : htmlEncode(part)
          )
          .join("");
      } else {
        snippet = text.slice(0, 140) + (text.length > 140 ? "..." : "");
        highlightedSnippet = htmlEncode(snippet);
      }

      results.push({
        title,
        url: doc.url,
        category,
        content: text.slice(0, 500),
        snippet,
        highlightedSnippet,
        matchType: titleMatch ? "title" : "content",
      });
    }

    // Sort: title matches first, then by title alphabetically
    results.sort((a, b) => {
      if (a.matchType === "title" && b.matchType !== "title") return -1;
      if (a.matchType !== "title" && b.matchType === "title") return 1;
      return a.title.localeCompare(b.title);
    });

    return NextResponse.json({
      results: results.slice(0, 20),
      count: results.length,
    });
  } catch (error) {
    status = 500;
    logger.error("search request failed", {
      route: "search",
      method: "GET",
      status,
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: "Search failed", results: [], count: 0 },
      { status: 500 }
    );
  } finally {
    const durationMs = performance.now() - startedAt;
    recordApiRequest("search", "GET", status, durationMs);
  }
}
