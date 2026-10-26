import { SidebarContainer } from '@/components/docs/SidebarContainer'
import { buildPageMap } from '../page-map'
import type { ProjectId } from '@/config/versions'

type Props = {
  children: React.ReactNode
  params: Promise<{ slug: string[] }>
}

/** Detect project from the first URL segment */
function getProjectFromSlug(slug: string[]): ProjectId {
  if (slug.length > 0) {
    if (slug[0] === 'hotshot') return 'hotshot'
    if (slug[0] === 'pluk') return 'pluk'
    if (slug[0] === 'rationguard') return 'rationguard'
    if (slug[0] === 'promptargs') return 'promptargs'
    if (slug[0] === 'dibs') return 'dibs'
    if (slug[0] === 'crux') return 'crux'
    if (slug[0] === 'spektacular') return 'spektacular'
  }
  return 'hive'
}

interface PageMapNode {
  kind?: string
  name: string
  route?: string
  title?: string
  children?: PageMapNode[]
  frontMatter?: Record<string, unknown>
  [key: string]: unknown
}

/**
 * Check if a node is a Meta node. Nextra's normalizePageMap strips the
 * `kind: 'Meta'` field, leaving nodes with only a `data` property and
 * no `name`/`route`. Detect both raw and normalized Meta nodes.
 */
function isMetaNode(item: PageMapNode): boolean {
  if (item.kind === 'Meta') return true
  // Nextra-normalized Meta: has `data` but no `name` and no `route`
  if ('data' in item && !item.name && !item.route) return true
  return false
}

/**
 * Recursively strip Meta nodes from the page map — they are only used by
 * Nextra's built-in sidebar and add ~30-40 % to the serialized RSC payload.
 * Our custom DocsSidebar skips Meta nodes anyway (kind === 'Meta' → return null).
 */
function stripMetaNodes(items: PageMapNode[]): PageMapNode[] {
  return (items || [])
    .filter((item: PageMapNode) => !isMetaNode(item))
    .map((item: PageMapNode) =>
      item.children
        ? { ...item, children: stripMetaNodes(item.children) }
        : item
    )
}

/**
 * Nested layout for /docs/[...slug] routes.
 *
 * Unlike the top-level /docs/layout.tsx which wraps the entire page shell
 * (html, body, navbar, footer), this layout is responsible for the sidebar
 * and content area. It reads the slug to determine the active project and
 * builds ONLY that project's page map — reducing the serialized RSC payload
 * from ~52 KB (all 6 projects) to ~5-15 KB (one project).
 */
export default async function SlugLayout({ children, params }: Props) {
  const { slug } = await params
  const projectId = getProjectFromSlug(slug)

  // Build only the current project's page map and strip Meta nodes
  const { pageMap } = buildPageMap(projectId)
  const slimPageMap = stripMetaNodes(pageMap as PageMapNode[])

  return (
    <>
      <SidebarContainer pageMap={slimPageMap} projectId={projectId} />
      <div className="flex-1 min-w-0 flex flex-row">
        {children}
      </div>
    </>
  )
}
