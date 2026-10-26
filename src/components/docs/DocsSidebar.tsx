"use client";

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronRight, ChevronDown, FileText } from 'lucide-react';
import { useDocsMenu } from './DocsProvider';
import { SidebarFooter } from './SidebarFooter';

interface MenuItem {
  name: string;
  route?: string;
  title?: string;
  children?: MenuItem[];
  frontMatter?: Record<string, unknown>;
  kind?: string;
  theme?: { collapsed?: boolean };
}

interface DocsSidebarProps {
  pageMap: MenuItem[];
  className?: string;
  projectId?: string;
}

// General sections that appear in every project's pageMap — show once at bottom
const GENERAL_SECTION_SLUGS = ['contributing', 'community', 'news'] as const;
const GENERAL_SECTION_NAMES = GENERAL_SECTION_SLUGS.map(
  (slug) => slug.charAt(0).toUpperCase() + slug.slice(1),
);

// Project display order and labels — each with a landing href for navigation links
const PRIMARY_PROJECTS = [
  { id: 'hive', label: 'Hive', href: '/docs/hive/overview/introduction' },
  { id: 'hotshot', label: 'hotshot', href: '/docs/hotshot/overview/introduction' },
  { id: 'pluk', label: 'pluk', href: '/docs/pluk/overview/introduction' },
  { id: 'rationguard', label: 'rationguard', href: '/docs/rationguard/overview/introduction' },
  { id: 'promptargs', label: 'promptargs', href: '/docs/promptargs/overview/introduction' },
  { id: 'dibs', label: 'dibs', href: '/docs/dibs/overview/introduction' },
  { id: 'crux', label: 'Crux', href: '/docs/crux/overview/introduction' },
  { id: 'spektacular', label: 'Spektacular', href: '/docs/spektacular/overview/introduction' },
] as const;

// Key prefix for project-level collapse state (avoids collision with nav item keys)
const PROJECT_KEY_PREFIX = '__project_';
const GENERAL_SECTION_PATH_REGEX = new RegExp(
  `^/docs/(${GENERAL_SECTION_SLUGS.join('|')})(/|$)`,
);

function getGeneralSectionSlugFromPath(path: string): string | null {
  const match = path.match(GENERAL_SECTION_PATH_REGEX);
  return match?.[1] ?? null;
}

function getProjectItems(items: MenuItem[]): MenuItem[] {
  return items.filter(item => !GENERAL_SECTION_NAMES.includes(item.name || item.title || ''));
}

function getGeneralSections(items: MenuItem[]): MenuItem[] {
  return items.filter(item => GENERAL_SECTION_NAMES.includes(item.name || item.title || ''));
}

// Find the first navigable route in a menu item's children
function getFirstChildRoute(item: MenuItem): string | undefined {
  if (!item.children) return undefined;
  for (const child of item.children) {
    if (child.kind === 'Meta' || child.kind === 'Separator') continue;
    const nested = child.children ? getFirstChildRoute(child) : undefined;
    if (nested) return nested;
    if (child.route && child.route !== '#') return child.route;
  }
  return undefined;
}

export function DocsSidebar({ pageMap, className, projectId }: DocsSidebarProps) {
  const pathname = usePathname();
  const sidebarRef = useRef<HTMLElement>(null);
  const isDocsGuide = pathname === '/docs/introduction';
  const {
    sidebarCollapsed,
    toggleSidebar,
    menuOpen,
    toggleMenu,
    bannerDismissed,
    navCollapsed: collapsed,
    setNavCollapsed: setCollapsed,
    toggleNavCollapsed,
    navInitialized
  } = useDocsMenu();

  // Stable layout values - only recalculate on resize or banner change
  const [layoutValues, setLayoutValues] = useState({ top: '4rem', height: 'calc(100vh - 4rem)' });

  const calculateOffsets = () => {
    const navbar = document.querySelector('.nextra-nav-container') as HTMLElement | null;
    if (!navbar) return;

    const navbarBottomY = navbar.getBoundingClientRect().bottom;

    setLayoutValues({
      top: `${navbarBottomY}px`,
      height: `calc(100vh - ${navbarBottomY}px)`
    });
  };

  useEffect(() => {
    let ticking = false;

    const onScroll = () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(() => {
          calculateOffsets();
          ticking = false;
        });
      }
    };

    const LAYOUT_INIT_DELAY_MS = 300;
    const t = setTimeout(calculateOffsets, LAYOUT_INIT_DELAY_MS);

    window.addEventListener('resize', calculateOffsets);
    window.addEventListener('scroll', onScroll, { passive: true });

    return () => {
      clearTimeout(t);
      window.removeEventListener('resize', calculateOffsets);
      window.removeEventListener('scroll', onScroll);
    };
  }, [bannerDismissed]);

  // Store initial pathname for initialization
  const initialPathnameRef = useRef(pathname);

  // Initialize collapsed state once on mount
  useEffect(() => {
    if (navInitialized.current) return;
    navInitialized.current = true;

    const initialCollapsed = new Set<string>();
    const pathToActive = new Set<string>();
    const currentPath = initialPathnameRef.current;

    // Determine active project from pathname
    const activeProjectId = projectId || 'hive';

    // Keep non-active project sections collapsed by default
    for (const proj of PRIMARY_PROJECTS) {
      const isProjectLink = currentPath === '/docs/introduction' || proj.id !== activeProjectId;
      if (isProjectLink) {
        initialCollapsed.add(`${PROJECT_KEY_PREFIX}${proj.id}`);
      }
    }

    // For the active project, find the path to the active page and collapse non-active folders
    const activeItems = getProjectItems(pageMap);
    const activeParentKey = `${PROJECT_KEY_PREFIX}${activeProjectId}`;

    function findActivePath(items: MenuItem[], parentKey: string): boolean {
      for (const item of items) {
        const itemKey = `${parentKey}-${item.name}`;
        if (item.route && currentPath === item.route) {
          return true;
        }
        if (item.children) {
          const childActive = findActivePath(item.children, itemKey);
          if (childActive) {
            pathToActive.add(itemKey);
            return true;
          }
        }
      }
      return false;
    }

    function collapseAll(items: MenuItem[], parentKey: string) {
      for (const item of items) {
        const itemKey = `${parentKey}-${item.name}`;
        const hasChildren = item.children && item.children.length > 0;
        if (hasChildren) {
          const shouldStayExpanded = item.theme?.collapsed === false;
          if (!pathToActive.has(itemKey) && !shouldStayExpanded) {
            initialCollapsed.add(itemKey);
          }
          if (item.children) {
            collapseAll(item.children, itemKey);
          }
        }
      }
    }

    findActivePath(activeItems, activeParentKey);
    collapseAll(activeItems, activeParentKey);

    // Also handle general sections
    const generalSections = getGeneralSections(pageMap);
    const currentGeneralSectionSlug = getGeneralSectionSlugFromPath(currentPath);
    const isViewingGeneralSection = Boolean(currentGeneralSectionSlug);

    for (const section of generalSections) {
      const sectionKey = section.name;
      const sectionSlug = (section.name || section.title || '').toLowerCase();
      const isCurrent = isViewingGeneralSection && sectionSlug === currentGeneralSectionSlug;
      if (!isCurrent) {
        initialCollapsed.add(sectionKey);
      }
      if (isCurrent && section.children) {
        findActivePath(section.children, sectionKey);
        collapseAll(section.children, sectionKey);
      }
    }

    setCollapsed(initialCollapsed);
  }, [pageMap, projectId, navInitialized, setCollapsed]);

  const toggleCollapse = (itemKey: string) => {
    toggleNavCollapsed(itemKey);
  };

  const renderMenuItem = (item: MenuItem, depth: number = 0, parentKey: string = '') => {
    const hasChildren = item.children && item.children.length > 0;
    const itemKey = parentKey ? `${parentKey}-${item.name}` : item.name;
    const isCollapsed = collapsed.has(itemKey);
    const isActive = item.route && pathname === item.route;
    const displayTitle = item.title || item.name;

    // Skip separator, meta items, and items without title/name
    if (item.kind === 'Separator' || item.kind === 'Meta' || !displayTitle || displayTitle.trim() === '') {
      return null;
    }

    // Skip index files and hidden items
    if (item.name === 'index' || item.name === '_meta' || item.route === '#') {
      return null;
    }

    return (
      <div key={itemKey} className="relative">
        <div className="flex items-center group relative">
          {/* Vertical line for nested items */}
          {depth > 0 && (
            <div
              className="absolute left-0 top-0 bottom-0 w-px bg-line"
              style={{ left: `${(depth - 1) * 16 + 20}px` }}
            />
          )}

          {/* Folder or Page */}
          {hasChildren ? (() => {
            const firstRoute = getFirstChildRoute(item);
            return firstRoute ? (
              <div
                className="flex items-center gap-0 px-3 py-1.5 text-[13px] font-normal text-ink-2  hover:bg-bg-2 hover:bg-bg-2 rounded-md transition-colors w-full relative z-10"
                style={{ paddingLeft: `${depth * 16 + 12}px` }}
              >
                <Link
                  href={firstRoute}
                  prefetch
                  onClick={() => { if (isCollapsed) toggleCollapse(itemKey); }}
                  className="flex-1 min-w-0 truncate hover:text-ink"
                >
                  {displayTitle}
                </Link>
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    toggleCollapse(itemKey);
                  }}
                  className="ks-sidebar-chevron ml-auto shrink-0 p-0.5 rounded hover:bg-bg-3 transition-colors"
                  aria-label={isCollapsed ? 'Expand section' : 'Collapse section'}
                >
                  {isCollapsed ? (
                    <ChevronRight className="w-3.5 h-3.5 text-ink-3 -2 transition-transform duration-200" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5 text-ink-3 -2 transition-transform duration-200" />
                  )}
                </button>
              </div>
            ) : (
              <button
                onClick={() => toggleCollapse(itemKey)}
                className="flex items-center gap-2 px-3 py-1.5 text-[13px] font-normal text-ink-2  hover:text-ink hover:bg-bg-2 hover:bg-bg-2 rounded-md transition-colors text-left w-full relative z-10"
                style={{ paddingLeft: `${depth * 16 + 12}px` }}
              >
                <span className="flex-1 truncate">{displayTitle}</span>
                <span className="ml-auto shrink-0">
                  {isCollapsed ? (
                    <ChevronRight className="w-3.5 h-3.5 text-ink-3 -2 transition-transform duration-200" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5 text-ink-3 -2 transition-transform duration-200" />
                  )}
                </span>
              </button>
            );
          })() : (
            <Link
              href={item.route || '#'}
              prefetch
              className={`
                flex items-center gap-2 px-3 py-1.5 text-[13px] rounded-md transition-colors relative z-10 w-full
                ${
                  isActive
                    ? 'font-medium text-honey bg-bg-3'
                    : 'font-normal text-ink-2  hover:text-ink hover:bg-bg-2 hover:bg-bg-2'
                }
              `}
              style={{ paddingLeft: `${depth * 16 + 12}px` }}
            >
              <FileText
                className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-honey' : 'text-ink-3 -2'}`}
              />
              <span className="flex-1 truncate">{displayTitle}</span>
            </Link>
          )}
        </div>

        {/* Render children */}
        {hasChildren && (
          <div
            className={`
              relative overflow-hidden transition-all duration-300 ease-in-out
              ${isCollapsed ? 'max-h-0 opacity-0' : 'max-h-[2000px] opacity-100'}
            `}
          >
            <div
              className="absolute left-0 top-0 bottom-0 w-px bg-line"
              style={{ left: `${depth * 16 + 20}px` }}
            />
            {item.children!.map(child => renderMenuItem(child, depth + 1, itemKey))}
          </div>
        )}
      </div>
    );
  };

  // Render the active project's nav tree (full expandable tree from pageMap)
  const renderActiveProjectTree = (projId: string, label: string, depth: number = 0) => {
    const items = getProjectItems(pageMap);
    if (items.length === 0) return null;

    const sectionKey = `${PROJECT_KEY_PREFIX}${projId}`;
    const isExpanded = !collapsed.has(sectionKey);

    return (
      <div key={projId} className="relative">
        <button
          onClick={() => toggleCollapse(sectionKey)}
          className="flex items-center gap-2 px-3 py-2 text-[13px] rounded-md transition-colors text-left w-full font-semibold text-honey bg-bg-3"
          style={{ paddingLeft: `${depth * 16 + 12}px` }}
        >
          <span className="flex-1 truncate">{label}</span>
          <span className="ml-auto shrink-0">
            {isExpanded ? (
              <ChevronDown className="w-3.5 h-3.5 transition-transform duration-200" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5 transition-transform duration-200" />
            )}
          </span>
        </button>

        <div
          className={`
            relative overflow-hidden transition-all duration-300 ease-in-out
            ${isExpanded ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'}
          `}
        >
          {items.map(item => renderMenuItem(item, depth + 1, sectionKey))}
        </div>
      </div>
    );
  };

  // Render a non-active project as a navigation link (no tree — loads on click)
  const renderProjectLink = (projId: string, label: string, href: string, depth: number = 0) => {
    const sectionKey = `${PROJECT_KEY_PREFIX}${projId}`;
    const isExpanded = !collapsed.has(sectionKey);

    return (
      <div key={projId} className="relative">
        <div
          className="flex items-center gap-2 px-3 py-2 text-[13px] rounded-md transition-colors text-left w-full font-medium text-ink-2  hover:bg-bg-2 hover:bg-bg-2"
          style={{ paddingLeft: `${depth * 16 + 12}px` }}
        >
          <Link
            href={href}
            prefetch
            onClick={() => { if (!isExpanded) toggleCollapse(sectionKey); }}
            className="flex-1 min-w-0 truncate"
          >
            {label}
          </Link>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              toggleCollapse(sectionKey);
            }}
            className="ks-sidebar-chevron ml-auto shrink-0 p-0.5 rounded hover:bg-bg-3 transition-colors"
            aria-label={isExpanded ? 'Collapse section' : 'Expand section'}
          >
            {isExpanded ? (
              <ChevronDown className="w-3.5 h-3.5 text-ink-3 -2 transition-transform duration-200" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5 text-ink-3 -2 transition-transform duration-200" />
            )}
          </button>
        </div>

        <div
          className={`
            relative overflow-hidden transition-all duration-300 ease-in-out
            ${isExpanded ? 'max-h-40 opacity-100' : 'max-h-0 opacity-0'}
          `}
        >
          <Link
            href={href}
            prefetch
            className="flex items-center gap-2 px-3 py-1.5 text-[13px] rounded-md transition-colors w-full font-normal text-ink-2  hover:text-ink hover:bg-bg-2 hover:bg-bg-2"
            style={{ paddingLeft: `${(depth + 1) * 16 + 12}px` }}
          >
            <FileText className="w-3.5 h-3.5 shrink-0 text-ink-3 -2" />
            <span className="flex-1 truncate">Overview</span>
          </Link>
        </div>
      </div>
    );
  };

  // Render a project — full tree if active, navigation link if not
  // When viewing docs guide, treat all projects as non-active (show as links)
  const renderProject = (proj: { id: string; label: string; href: string }, depth: number = 0) => {
    if (proj.id === projectId && !isDocsGuide) {
      return renderActiveProjectTree(proj.id, proj.label, depth);
    }
    return renderProjectLink(proj.id, proj.label, proj.href, depth);
  };

  // Render full sidebar (expanded state)
  const renderFullSidebar = () => {
    // General sections (Contributing, Community, News) from current project's pageMap
    const generalSections = getGeneralSections(pageMap);

    return (
      <>
        {/* Mobile close button - visible only on mobile */}
        <div className="lg:hidden flex items-center justify-end px-3 py-2 border-b border-line">
          <button
            onClick={toggleMenu}
            className="p-1.5 rounded-md text-ink-2 hover:text-ink hover:bg-bg-2 transition-colors"
            aria-label="Close sidebar"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Scrollable navigation area */}
        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
          <nav className="px-3 pt-6 pb-6 w-full">
            {/* General sections — Community first, so visitors meet Hive Commons before any project */}
            <div className="space-y-1">
              {generalSections.map(item => renderMenuItem(item))}
            </div>

            {/* Separator */}
            <div className="border-t border-line my-4" />

            {/* Primary projects — active shows tree, others show link */}
            <div className="space-y-1">
              {PRIMARY_PROJECTS.map(proj => renderProject(proj))}
            </div>
          </nav>
        </div>
        <SidebarFooter onCollapse={toggleSidebar} isMobile={menuOpen} />
      </>
    );
  };

  // Render slim sidebar (collapsed state) - Desktop only
  const renderSlimSidebar = () => (
    <div className="flex flex-col h-full">
      <div className="flex-1"></div>
      <SidebarFooter onCollapse={toggleSidebar} isMobile={menuOpen} variant="slim" />
    </div>
  );

  return (
    <aside
      ref={sidebarRef}
      data-sidebar="docs"
      className={`
        fixed lg:sticky left-0
        shadow-sm
        flex flex-col
        overflow-hidden
        transition-all duration-300 ease-in-out
        bg-bg
        border-r border-line
        ${menuOpen ? 'translate-x-0 w-60 z-30' : '-translate-x-full w-0 lg:translate-x-0 z-20'}
        ${sidebarCollapsed ? 'lg:w-16' : 'lg:w-60'}
        ${className || ''}
      `}
      style={{
        top: layoutValues.top,
        height: layoutValues.height,
        maxHeight: layoutValues.height,
        boxShadow: '1px 0 3px 0 rgba(0,0,0,0.04)',
        backgroundColor: 'var(--background)',
      }}
      suppressHydrationWarning
    >
      {/* Full Sidebar Content */}
      <div className={`
        flex flex-col h-full
        transition-all duration-300 ease-in-out
        ${sidebarCollapsed ? 'opacity-0 pointer-events-none' : 'opacity-100'}
      `}>
        {renderFullSidebar()}
      </div>

      {/* Slim Sidebar Content - Desktop only */}
      <div className={`
        hidden lg:flex flex-col h-full absolute inset-0
        transition-all duration-300 ease-in-out
        ${sidebarCollapsed ? 'opacity-100' : 'opacity-0 pointer-events-none'}
      `}>
        {renderSlimSidebar()}
      </div>
    </aside>
  );
}
