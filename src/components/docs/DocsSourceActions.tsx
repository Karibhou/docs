"use client";

import { useSharedConfig } from "@/hooks/useSharedConfig";
import type { ProjectId } from "@/config/versions";
import { GitPullRequest, FileCode, AlertCircle } from "lucide-react";


// Hive has no `main` branch (default tracks the stable release branch) and its docs live under
// `src/docs`. Kept in sync with scripts/sync-hive-docs.ts. NOTE: page
// filePaths use `readme.md` (lowercased), but the canonical source is
// `README.md`; that single page's edit/source link will 404 until the
// filePath casing is reconciled.
const STATIC_EDIT_BASE_URLS: Record<ProjectId, string> = {
  hive: 'https://github.com/hivecommons/hive/edit/v5/src/docs',
  hotshot: 'https://github.com/hivecommons/hotshot/edit/main',
  pluk: 'https://github.com/hivecommons/pluk/edit/main',
  rationguard: 'https://github.com/hivecommons/rationguard/edit/main',
  promptargs: 'https://github.com/hivecommons/promptargs/edit/main',
  dibs: 'https://github.com/hivecommons/dibs/edit/main',
  crux: 'https://github.com/hivecommons/crux/edit/main',
  spektacular: 'https://github.com/hivecommons/spektacular/edit/main',
};

// Prevent path traversal
function sanitizeFilePath(filePath: string): string {
  return filePath.replace(/\.\./g, "").replace(/^\/+/, "");
}

// Force fork-based editing for ALL users (including admins)
function buildGitHubEditUrl(
  filePath: string,
  projectId: ProjectId,
  editBaseUrls?: Record<string, string>
): string | null {
  const baseUrl = editBaseUrls?.[projectId] ?? STATIC_EDIT_BASE_URLS[projectId];

  if (!baseUrl) return null;

  return `${baseUrl}/${sanitizeFilePath(filePath)}?fork=true`;
}

// Validate GitHub edit URL
function isValidGitHubEditUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return (
      parsed.protocol === "https:" &&
      parsed.hostname === "github.com" &&
      parsed.pathname.includes("/edit/")
    );
  } catch {
    return false;
  }
}

// Convert edit → blob 
function buildSourceUrl(editUrl: string): string {
  const url = new URL(editUrl);
  url.search = "";
  url.pathname = url.pathname.replace("/edit/", "/blob/");
  return url.toString();
}

// Build GitHub issue link
function buildIssueUrl(pageTitle: string, sourceUrl: string): string {
  return `https://github.com/hivecommons/docs/issues/new?title=${encodeURIComponent(
    `Docs: ${pageTitle}`
  )}&body=${encodeURIComponent(`Source file:\n${sourceUrl}`)}`;
}

type DocsSourceActionsProps = {
  filePath: string;
  projectId: ProjectId;
  pageTitle: string;
  variant?: "full" | "compact";
  /** GitHub blob URL of the true source when it differs from the content path (synced pages). */
  sourceUrl?: string;
};

// Convert a GitHub blob URL into the fork-based edit URL the buttons expect.
export function editUrlFromSource(sourceUrl: string): string | null {
  try {
    const url = new URL(sourceUrl);
    if (url.protocol !== "https:" || url.hostname !== "github.com" || !url.pathname.includes("/blob/")) {
      return null;
    }
    url.pathname = url.pathname.replace("/blob/", "/edit/");
    url.search = "?fork=true";
    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
}

export function DocsSourceActions({
  filePath,
  projectId,
  pageTitle,
  variant = "full",
  sourceUrl: syncedSourceUrl,
}: DocsSourceActionsProps) {
  const { config } = useSharedConfig();

  const editUrl =
    (syncedSourceUrl ? editUrlFromSource(syncedSourceUrl) : null) ??
    buildGitHubEditUrl(filePath, projectId, config?.editBaseUrls);

  if (!editUrl || !isValidGitHubEditUrl(editUrl)) return null;

  const safeEditUrl = new URL(editUrl).href;
  const sourceUrl = buildSourceUrl(safeEditUrl);
  const issueUrl = buildIssueUrl(pageTitle, sourceUrl);

  return (
    <div
      className={
        variant === "compact"
          ? "flex gap-2"
          : "flex flex-wrap gap-2"
      }
    >
      <ActionLink
        href={safeEditUrl}
        compact={variant === "compact"}
        title="Compose a PR"
      >
        <GitPullRequest className="h-4 w-4" />
        {variant === "full" && "Compose a PR"}
      </ActionLink>

      <ActionLink
        href={sourceUrl}
        compact={variant === "compact"}
        title="View Source"
      >
        <FileCode className="h-4 w-4" />
        {variant === "full" && "View Source"}
      </ActionLink>

      <ActionLink
        href={issueUrl}
        compact={variant === "compact"}
        title="Open Issue"
      >
        <AlertCircle className="h-4 w-4" />
        {variant === "full" && "Open Issue"}
      </ActionLink>
    </div>
  );
}

function ActionLink({
  href,
  children,
  compact,
  title,
}: {
  href: string;
  children: React.ReactNode;
  compact?: boolean;
  title?: string;
}) {
  return (
    <a
      href={href}
      title={title}
      target="_blank"
      rel="noopener noreferrer"
      className={[
        "inline-flex items-center justify-center rounded-md border font-medium transition-all duration-150",
        compact
          ? "h-11 w-11"
          : "min-w-[150px] gap-2 px-3 py-1.5 text-sm",
        "border-line text-ink bg-transparent",
        "hover:bg-bg-2 hover:border-honey-deep hover:text-honey",
        "focus:outline-none focus:ring-2 focus:ring-honey",
      ].join(" ")}
    >
      {children}
    </a>
  );
}
