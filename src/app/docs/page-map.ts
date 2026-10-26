import { normalizePageMap } from 'nextra/page-map'
import fs from 'fs'
import path from 'path'
import { type ProjectId } from '@/config/versions'

// Local docs path - docs are now in this repository
export const docsContentPath = path.join(process.cwd(), 'docs', 'content')
export const basePath = 'docs'

// Get content path for a project
export function getContentPath(projectId: ProjectId): string {
  switch (projectId) {
    case 'hotshot':
      return path.join(process.cwd(), 'docs', 'content', 'hotshot')
    case 'pluk':
      return path.join(process.cwd(), 'docs', 'content', 'pluk')
    case 'rationguard':
      return path.join(process.cwd(), 'docs', 'content', 'rationguard')
    case 'promptargs':
      return path.join(process.cwd(), 'docs', 'content', 'promptargs')
    case 'dibs':
      return path.join(process.cwd(), 'docs', 'content', 'dibs')
    case 'crux':
      return path.join(process.cwd(), 'docs', 'content', 'crux')
    case 'spektacular':
      return path.join(process.cwd(), 'docs', 'content', 'spektacular')
    case 'hive':
    default:
      return path.join(process.cwd(), 'docs', 'content', 'hive')
  }
}

// Get base path for a project
export function getBasePath(projectId: ProjectId): string {
  switch (projectId) {
    case 'hotshot':
      return 'docs/hotshot'
    case 'pluk':
      return 'docs/pluk'
    case 'rationguard':
      return 'docs/rationguard'
    case 'promptargs':
      return 'docs/promptargs'
    case 'dibs':
      return 'docs/dibs'
    case 'crux':
      return 'docs/crux'
    case 'spektacular':
      return 'docs/spektacular'
    case 'hive':
    default:
      return 'docs/hive'
  }
}

// Strong types for page-map nodes
type MdxPageNode = { kind: 'MdxPage'; name: string; route: string }
type FolderNode = { kind: 'Folder'; name: string; route: string; children: PageMapNode[]; theme?: { collapsed?: boolean } }
type MetaNode = { kind: 'Meta'; data: Record<string, string> }
type PageMapNode = MdxPageNode | FolderNode | MetaNode

// Recursively get all markdown files from the local docs directory
function getAllDocFiles(dir: string, baseDir: string = dir): string[] {
  const files: string[] = []

  if (!fs.existsSync(dir)) {
    return files
  }

  const entries = fs.readdirSync(dir, { withFileTypes: true })

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)
    const relativePath = path.relative(baseDir, fullPath)

    if (entry.isDirectory()) {
      // Skip hidden directories and node_modules
      if (!entry.name.startsWith('.') && entry.name !== 'node_modules') {
        files.push(...getAllDocFiles(fullPath, baseDir))
      }
    } else if (entry.isFile() && (entry.name.endsWith('.md') || entry.name.endsWith('.mdx'))) {
      // Normalize to forward slashes for cross-platform consistency
      files.push(relativePath.replace(/\\/g, '/'))
    }
  }

  return files
}

// Navigation structure based on mkdocs.yml
type NavItem = { [title: string]: string | NavItem[] }

const NAV_STRUCTURE_HIVE: Array<{ title: string; items: NavItem[] }> = [
  {
    title: 'Overview',
    items: [
      { 'Introduction': 'readme.md' },
      { 'Getting Started': 'getting-started.md' },
      { 'Documentation Map': 'documentation-map.md' },
      { 'Supported agents & inference engines': 'integrations.md' },
      { 'Architecture': 'architecture.md' },
      { 'Roadmap': 'roadmap.md' },
      { 'Landscape': 'landscape.md' },
    ]
  },
  {
    title: 'Getting started',
    items: [
      { 'Manual provisioning': 'manual-provisioning.md' },
      { 'Network admin requirement': 'net-admin-requirement.md' },
    ]
  },
  {
    title: 'Operations',
    items: [
      { 'Agent Definition YAML': 'agent-definition-yaml.md' },
      { 'Variable Substitution': 'variable-substitution.md' },
      { 'Governor': 'governor.md' },
      { 'hivectl': 'hivectl.md' },
      { 'Agent configuration': 'agent-configuration.md' },
      { 'Contributor relay': 'contributor-relay.md' },
      { 'Using Spektacular with Hive': 'spektacular-runs.md' },
      { 'The agent Terminal window': 'agent-terminal.md' },
      { 'Troubleshooting': 'troubleshooting.md' },
      { 'Release channels': 'release-channels.md' },
      { 'Stable soak and promotion policy': 'stable-soak-policy.md' },
      { 'Backup and disaster recovery': 'backup-dr.md' },
      { 'Running on macOS': 'macos.md' },
      { 'Running at ACMM Level 6': 'running-at-level-6.md' },
    ]
  },
  {
    title: 'Dashboard',
    items: [
      { 'Dashboard sections explained': 'dashboard-sections.md' },
      { 'Dashboard glossary': 'dashboard-glossary.md' },
      { 'Labels and control signals': 'labels-and-control-signals.md' },
    ]
  },
  {
    title: 'Integrating with Hive',
    items: [
      { 'Integration guide': 'integration-guide.md' },
      { 'Public knowledge MCP endpoint': 'public-knowledge-mcp.md' },
      { 'Work-source providers': 'integrations/work-source-providers.md' },
      { 'Clanker (Flue-style) interface': 'integrations/clanker-flue.md' },
      { 'Spektacular project inception': 'integrations/spektacular.md' },
    ]
  },
  {
    title: 'Security',
    items: [
      { 'Securing your hive': 'securing-your-hive.md' },
      { 'Security model': 'security-model.md' },
      { 'Security threat model': 'security-threat-model.md' },
      { 'ACMM policy matrix': 'acmm-policy-matrix.md' },
    ]
  },
  {
    title: 'Reference',
    items: [
      { 'Architecture Decision Records': [
        { 'ADR index': 'adr/readme.md' },
        { '0001 Record architecture decisions': 'adr/0001-record-architecture-decisions.md' },
        { '0002 MITM proxy network enforcement': 'adr/0002-mitm-proxy-network-enforcement.md' },
        { '0003 ACMM autonomy levels': 'adr/0003-acmm-autonomy-levels.md' },
        { '0004 Beads work ledger': 'adr/0004-beads-work-ledger.md' },
        { '0005 Forge abstraction': 'adr/0005-forge-abstraction.md' },
        { '0006 Planning intelligence': 'adr/0006-planning-intelligence.md' },
        { '0007 Token mint': 'adr/0007-token-mint.md' },
        { '0008 ioscan untrusted input': 'adr/0008-ioscan-untrusted-input.md' },
        { '0009 Trajectory review': 'adr/0009-trajectory-review.md' },
        { '0010 Escalation circuit breaker': 'adr/0010-escalation-circuit-breaker.md' },
        { '0011 Knowledge system': 'adr/0011-knowledge-system.md' },
        { '0012 Skill registry': 'adr/0012-skill-registry.md' },
        { '0013 CEL triggers': 'adr/0013-cel-triggers.md' },
        { '0014 Hub-spoke': 'adr/0014-hub-spoke.md' },
        { '0015 CSP style-src scope': 'adr/0015-csp-style-src-scope.md' },
        { '0016 CSP script-src scope': 'adr/0016-csp-script-src-scope.md' },
        { '0017 Podman Quadlet lifecycle': 'adr/0017-podman-quadlet-lifecycle.md' },
        { '0018 Dashboard design tokens': 'adr/0018-dashboard-design-tokens.md' },
        { '0019 Escalation over stalling': 'adr/0019-escalation-over-stalling.md' },
        { '0020 Spek continuous convergence': 'adr/0020-spek-continuous-convergence.md' },
        { '0022 Opt-in earned Codex reset redemption': 'adr/0022-opt-in-earned-codex-reset-redemption.md' },
        { '0023 Trusted-author automerge': 'adr/0023-trusted-author-automerge.md' },
        { '0024 Provider credential lifecycle': 'adr/0024-provider-credential-lifecycle.md' },
        { '0025 Central stage engine': 'adr/0025-central-stage-engine.md' },
      ] },
      { 'Environment variable reference': 'env-vars.md' },
    ]
  }
]

// hotshot Navigation Structure
const NAV_STRUCTURE_HOTSHOT: Array<{ title: string; items: NavItem[] }> = [
  {
    title: 'Overview',
    items: [
      { 'Introduction': 'readme.md' },
      { 'Roadmap': 'roadmap.md' },
    ]
  },
  {
    title: 'Platforms',
    items: [
      { 'Linux': 'linux.md' },
      { 'Windows': 'windows.md' },
    ]
  }
]

// pluk Navigation Structure
const NAV_STRUCTURE_PLUK: Array<{ title: string; items: NavItem[] }> = [
  {
    title: 'Overview',
    items: [
      { 'Introduction': 'readme.md' },
      { 'Roadmap': 'roadmap.md' },
    ]
  }
]

// rationguard Navigation Structure
const NAV_STRUCTURE_RATIONGUARD: Array<{ title: string; items: NavItem[] }> = [
  {
    title: 'Overview',
    items: [
      { 'Introduction': 'readme.md' },
    ]
  }
]

// promptargs Navigation Structure
const NAV_STRUCTURE_PROMPTARGS: Array<{ title: string; items: NavItem[] }> = [
  {
    title: 'Overview',
    items: [
      { 'Introduction': 'readme.md' },
    ]
  }
]

// dibs Navigation Structure
const NAV_STRUCTURE_DIBS: Array<{ title: string; items: NavItem[] }> = [
  {
    title: 'Overview',
    items: [
      { 'Introduction': 'readme.md' },
      { 'Roadmap': 'roadmap.md' },
    ]
  },
  {
    title: 'Reference',
    items: [
      { 'Credit-wall API': 'credit-wall-api.md' },
      { 'MCP registry': 'mcp-registry.md' },
    ]
  }
]

// Crux Navigation Structure
const NAV_STRUCTURE_CRUX: Array<{ title: string; items: NavItem[] }> = [
  {
    title: 'Overview',
    items: [
      { 'Introduction': 'readme.md' },
    ]
  }
]

// Spektacular Navigation Structure (canonical site: https://spektacular.dev)
// readme.md and knowledge-base.md are synced from hivecommons/spektacular; the
// tutorials are converted from MDX in hivecommons/spektacular-website.
const NAV_STRUCTURE_SPEKTACULAR: Array<{ title: string; items: NavItem[] }> = [
  {
    title: 'Overview',
    items: [
      { 'Introduction': 'readme.md' },
    ]
  },
  {
    title: 'Tutorials',
    items: [
      { 'Getting started': 'getting-started.md' },
      { 'Unknown criteria': 'unknown-criteria.md' },
    ]
  },
  {
    title: 'Guides',
    items: [
      { 'Knowledge base': 'knowledge-base.md' },
    ]
  }
]

// Shared sections that appear once, below the projects, in every sidebar.
// Files live in docs/content/<section>/ (not synced from any project) and
// are routed at /docs/<section>/... — see GENERAL_SECTION_DIRS.
const GENERAL_SECTION_DIRS = ['contributing', 'community', 'news'] as const
const NAV_STRUCTURE_GENERAL: Array<{ title: string; items: NavItem[] }> = [
  {
    title: 'Community',
    items: [
      { 'What is Hive Commons?': 'community/what-is-hive-commons.md' },
      { 'Join Hive Commons': 'community/join-hive-commons.md' },
      { 'Community meetings': 'community/meetings.md' },
    ]
  }
]

export function isGeneralSectionFile(file: string): boolean {
  return GENERAL_SECTION_DIRS.some(dir => file.startsWith(`${dir}/`))
}

// Get navigation structure for a project
function getNavStructure(projectId: ProjectId): Array<{ title: string; items: NavItem[] }> {
  return [...getProjectNavStructure(projectId), ...NAV_STRUCTURE_GENERAL]
}

function getProjectNavStructure(projectId: ProjectId): Array<{ title: string; items: NavItem[] }> {
  switch (projectId) {
    case 'hotshot':
      return NAV_STRUCTURE_HOTSHOT
    case 'pluk':
      return NAV_STRUCTURE_PLUK
    case 'rationguard':
      return NAV_STRUCTURE_RATIONGUARD
    case 'promptargs':
      return NAV_STRUCTURE_PROMPTARGS
    case 'dibs':
      return NAV_STRUCTURE_DIBS
    case 'crux':
      return NAV_STRUCTURE_CRUX
    case 'spektacular':
      return NAV_STRUCTURE_SPEKTACULAR
    case 'hive':
    default:
      return NAV_STRUCTURE_HIVE
  }
}

export function buildPageMap(projectId: ProjectId = 'hive') {
  const contentPath = getContentPath(projectId)
  const projectBasePath = getBasePath(projectId)
  const navStructure = getNavStructure(projectId)

  // Project files plus the shared general-section files from docs/content/.
  const allDocFiles = [
    ...getAllDocFiles(contentPath),
    ...getAllDocFiles(docsContentPath).filter(isGeneralSectionFile),
  ]
  const processedFiles = new Set<string>()
  const routeMap: Record<string, string> = {}
  const _pageMap: PageMapNode[] = []

  function buildNavNodes(items: NavItem[], parentSlug: string): PageMapNode[] {
    const nodes: PageMapNode[] = []
    const meta: Record<string, string> = {}

    for (const item of items) {
      // Object with title: path or title: children
      const title = Object.keys(item)[0]
      const value = (item as Record<string, string | NavItem[]>)[title]

      if (typeof value === 'string') {
        // It's a file path
        if (allDocFiles.includes(value)) {
          processedFiles.add(value)
          // Use /docs path for general sections, project path for everything else
          const isGeneralSection = value.startsWith('contributing/') || value.startsWith('community/') || value.startsWith('news/')
          const baseName = value.replace(/\.(md|mdx)$/i, '').split('/').pop()!
          const slug = isGeneralSection
            ? baseName
            : title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
          const basePathForRoute = isGeneralSection ? 'docs' : projectBasePath
          const route = `/${basePathForRoute}/${parentSlug ? parentSlug + '/' : ''}${slug}`
          routeMap[`${parentSlug ? parentSlug + '/' : ''}${slug}`] = value
          nodes.push({ kind: 'MdxPage', name: title, route })
          meta[title] = title
        }
      } else if (Array.isArray(value)) {
        // It's a folder with children
        const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
        const newParentSlug = parentSlug ? `${parentSlug}/${slug}` : slug
        const children = buildNavNodes(value, newParentSlug)
        if (children.length > 0) {
          // Use /docs path for general sections, project path for everything else
          // Check both direct string entries and nested values in objects
          const isGeneralSection = Array.isArray(value) &&
            value.some(v =>
              // Check if any value in the entry starts with a general section path
              Object.values(v).some(val =>
                typeof val === 'string' &&
                (val.startsWith('contributing/') || val.startsWith('community/') || val.startsWith('news/'))
              )
            )
          const basePathForRoute = isGeneralSection ? 'docs' : projectBasePath
          nodes.push({
            kind: 'Folder',
            name: title,
            route: `/${basePathForRoute}/${newParentSlug}`,
            children
          })
          meta[title] = title
        }
      }
    }

    if (Object.keys(meta).length > 0) {
      nodes.unshift({ kind: 'Meta', data: meta })
    }

    return nodes
  }

  // Build navigation from navStructure (project-specific)
  for (const category of navStructure) {
    const categorySlug = category.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    const children = buildNavNodes(category.items, categorySlug)

    if (children.length > 0) {
      // Use /docs path for general sections, project path for project-specific sections
      const isGeneralSection = ['Contributing', 'Community', 'News'].includes(category.title)
      const basePath = isGeneralSection ? 'docs' : projectBasePath

      const folderNode: FolderNode = {
        kind: 'Folder',
        name: category.title,
        route: `/${basePath}/${categorySlug}`,
        children
      }

      // Set theme for first category to be expanded
      if (category.title === 'Welcome' || category.title === 'Overview') {
        folderNode.theme = { collapsed: false }
      }

      _pageMap.push(folderNode)
    }
  }

  // Add top-level meta - only categories that produced a folder, since
  // normalizePageMap rejects meta keys that point at a missing page.
  const meta: Record<string, string> = {}
  for (const node of _pageMap) {
    if (node.kind === 'Folder') meta[node.name] = node.name
  }
  _pageMap.unshift({ kind: 'Meta', data: meta })

  // Populate routeMap with all files for fallback resolution (needed for link rewriting)
  for (const fp of allDocFiles) {
    const noExt = fp.replace(/\.(md|mdx)$/i, '')
    if (!routeMap[noExt]) {
      routeMap[noExt] = fp
    }
  }

  const pageMap = normalizePageMap(_pageMap)

  return { pageMap, routeMap, filePaths: allDocFiles, contentPath }
}

// For backwards compatibility, export a function that doesn't need branch parameter
export async function buildPageMapForBranch() {
  return buildPageMap()
}
