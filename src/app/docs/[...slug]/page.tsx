import { compileMdx } from 'nextra/compile'
import { Callout, Mermaid, Tabs } from 'nextra/components'
import { evaluate } from 'nextra/evaluate'
import { useMDXComponents as getMDXComponents } from '../../../../mdx-components'
import { convertHtmlScriptsToJsxComments } from '@/lib/transformMdx'
import { sanitizeHtmlForMdx, removeCommentPatterns } from '@/lib/sanitizeHtml'
import { rewriteRelativeImagePaths } from '@/lib/rewriteImagePaths'
import { rewriteRelativeDocLinks } from '@/lib/rewriteDocLinks'
import { remarkStripMdxJs } from '@/lib/remarkStripMdxJs'
import { buildPageMap, docsContentPath, getContentPath, isGeneralSectionFile } from '../page-map'
import { CURRENT_VERSION, type ProjectId } from '@/config/versions'
import { MeetingsPage } from '@/components/community/MeetingsPage'
import fs from 'fs'
import path from 'path'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'

const HIVE_DOCS_PATH = process.env.HIVE_DOCS_PATH
const STATIC_PROJECTS: ProjectId[] = ['hive', 'hotshot', 'pluk', 'rationguard', 'promptargs', 'dibs', 'crux', 'spektacular']

const INTEGRATIONS_DESCRIPTION =
  'Hive works with Claude Code, GitHub Copilot, Codex, Antigravity, IBM Bob, Goose, vLLM, llm-d and more.'

const INTEGRATION_NAMES = [
  'Claude Code',
  'GitHub Copilot CLI',
  'Goose',
  'OpenAI Codex CLI',
  'Pi',
  'IBM Bob',
  'Aider',
  'Gemini CLI',
  'Google Antigravity CLI',
  'OpenCode',
  'Kilo Code',
  'Muse Code',
  'Oh My Pi',
  'vLLM',
  'llm-d',
  'LiteLLM',
  'IBM watsonx.ai',
  'OpenRouter',
  'Jev',
  'Flue',
  'Crustify',
  'Wavefront',
  'Anthropic',
  'OpenAI',
  'DeepSeek',
]

function integrationsJsonLd() {
  const sponsors = [
    { '@type': 'Organization', name: 'Akamai', url: 'https://www.linode.com/' },
    { '@type': 'Organization', name: 'Oracle Cloud', url: 'https://www.oracle.com/cloud/cloud-native/kubernetes-engine/' },
    { '@type': 'Organization', name: 'Cloudflare', url: 'https://www.cloudflare.com/' },
    { '@type': 'Organization', name: 'GitHub Copilot', url: 'https://github.com/features/copilot' },
    { '@type': 'Organization', name: 'Bluehost', url: 'https://www.bluehost.com/' },
  ]

  return [
    {
      '@context': 'https://schema.org',
      '@type': 'TechArticle',
      headline: 'Supported agents & inference engines',
      description: INTEGRATIONS_DESCRIPTION,
      url: 'https://docs.hivecommons.dev/docs/hive/integrations',
      about: [
        ...INTEGRATION_NAMES.map((name) => ({ '@type': 'SoftwareApplication', name })),
        { '@type': 'Organization', name: 'TypeSafe AI', url: 'https://typesafe.ai/' },
      ],
      keywords: [...INTEGRATION_NAMES, 'TypeSafe AI', 'Spektacular', 'Spek', 'speks'].join(', '),
      publisher: {
        '@type': 'Organization',
        name: 'Hive Commons',
        url: 'https://hivecommons.dev/',
      },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'SoftwareApplication',
      name: 'Hive',
      applicationCategory: 'DeveloperApplication',
      operatingSystem: 'Linux, macOS',
      license: 'https://www.apache.org/licenses/LICENSE-2.0',
      url: 'https://hive.hivecommons.dev/',
      codeRepository: 'https://github.com/hivecommons/hive',
      keywords: [...INTEGRATION_NAMES, 'TypeSafe AI', 'Spektacular', 'Spek', 'speks'].join(', '),
      featureList: [
        'Drives supported agent CLI backends including Claude Code, GitHub Copilot CLI, Goose, OpenAI Codex CLI, Google Antigravity CLI, IBM Bob and more.',
        'Routes inference through supported engines and gateways including vLLM, llm-d, LiteLLM, IBM watsonx.ai, OpenRouter, Anthropic, OpenAI and DeepSeek.',
        'Supports Jev by TypeSafe AI as a Hive v6 optional advisory smart-classifier backend.',
        'Admits report-only external execution through the Flue pilot and ready C/C++ to Rust migration graph nodes through Crustify/Wavefront.',
      ],
    },
    {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: 'Hive Commons',
      url: 'https://hivecommons.dev/',
      sponsor: sponsors,
      funder: sponsors,
    },
  ]
}

export const dynamic = 'force-static'
export const dynamicParams = false

type Props = {
  params: Promise<{ slug: string[] }>
}

// Replace template variables with actual values
function replaceTemplateVariables(content: string): string {
  // Use CURRENT_VERSION from config to support versioned documentation
  // When a version branch is created, CURRENT_VERSION is updated to that version
  const version = CURRENT_VERSION as string
  const versionBranch = version === '0.29.0' ? 'main' : `release-${version}`
  const versionTag = version === '0.29.0' ? 'latest' : `v${version}`

  const vars: Record<string, string> = {
    'config.ks_branch': versionBranch,
    'config.ks_tag': versionTag,
    'config.ks_latest_release': CURRENT_VERSION,
    'config.ks_latest_regular_release': CURRENT_VERSION,
    'config.docs_url': 'https://docs.hivecommons.dev',
    'config.repo_url': 'https://github.com/hivecommons/hive',
    'config.site_url': 'https://docs.hivecommons.dev'
  }
  
  let result = content
  for (const [key, value] of Object.entries(vars)) {
    result = result.replace(new RegExp(`\\{\\{\\s*${key.replace('.', '\\.')}\\s*\\}\\}`, 'g'), value)
  }
  
  // Remove any remaining template variables
  result = result.replace(/\{\{[^}]+\}\}/g, '')
  
  return result
}

function readLocalFile(filePath: string, contentPath: string = docsContentPath): string | null {
  // Reject path traversal attempts (mirrors protection in docs-image/route.ts)
  if (filePath.includes('..')) return null

  // Try the project-specific content path first
  const fullPath = path.join(contentPath, filePath)
  if (!fullPath.startsWith(contentPath + path.sep) && fullPath !== contentPath) return null
  try {
    if (fs.existsSync(fullPath)) {
      return fs.readFileSync(fullPath, 'utf-8')
    }
  } catch {
    // File doesn't exist in content directory
  }

  // If not found in the project directory, try the shared content root
  if (contentPath !== docsContentPath) {
    const sharedContentPath = path.join(docsContentPath, filePath)
    if (sharedContentPath.startsWith(docsContentPath + path.sep)) {
      try {
        if (fs.existsSync(sharedContentPath)) {
          return fs.readFileSync(sharedContentPath, 'utf-8')
        }
      } catch {
        // File doesn't exist in the shared content root either
      }
    }
  }

  return null
}

type PageContent = {
  content: string
  // Path of the resolved source file, relative to the content directory.
  // Used by the DocsLayout wrapper to build "edit this page" links.
  filePath: string
  // Canonical GitHub blob URL from a synced page's banner, when present.
  sourceUrl?: string
}

async function getPageContent(slug: string[], projectId?: ProjectId): Promise<PageContent | null> {
  const mdPath = slug.join('/') + '.md'

  const contentPath = projectId
    ? getContentPath(projectId)
    : docsContentPath

  // Try .md first, then .mdx
  let content = readLocalFile(mdPath, contentPath)
  if (content) return { content, filePath: mdPath }

  const mdxPath = slug.join('/') + '.mdx'
  content = readLocalFile(mdxPath, contentPath)
  if (content) return { content, filePath: mdxPath }

  // If direct lookup failed, consult the routeMap for nav-generated routes
  const mapProjectId = projectId || 'hive'
  const { routeMap } = buildPageMap(mapProjectId)
  const routeKey = slug.join('/')
  const mappedFile = routeMap[routeKey]
  if (mappedFile) {
    content = readLocalFile(mappedFile, contentPath)
    if (!content) {
      // Also try in the default docs content path (for general sections)
      content = readLocalFile(mappedFile, docsContentPath)
    }
    if (content) return { content, filePath: mappedFile }
  }

  return null
}

// Rewrite relative image paths in Markdown content to absolute /docs-images/ API paths.
// Relative paths like `images/foo.png` or `./images/foo.png` fail to load when served
// from a docs route because the browser resolves them against the page URL instead of
// the filesystem location of the source file.  The /docs-images/* rewrite rule
// (next.config.ts) proxies `/docs-images/<path>` → `/api/docs-image/<path>` which
// serves files from docs/content/.  We compute the directory of the source file
// relative to docs/content/ and use it as the base for the rewritten URL.
function sourceBaseDir(filePath: string, projectId: ProjectId | undefined): string {
  // The content root for this project (e.g. docs/content/console for projectId='console').
  const contentRoot = projectId ? getContentPath(projectId) : docsContentPath

  // Prefix from docs/content/ to the content root (e.g. 'console', 'a2a', or '').
  const contentPrefix = path.relative(docsContentPath, contentRoot).replace(/\\/g, '/')

  // Directory of the source file, relative to docs/content/.
  const fullRelPath = contentPrefix ? `${contentPrefix}/${filePath}` : filePath
  const fileDir = path.posix.dirname(fullRelPath)
  return fileDir === '.' ? '' : fileDir
}

function rewriteImagePaths(content: string, filePath: string, projectId: ProjectId | undefined): string {
  return rewriteRelativeImagePaths(content, sourceBaseDir(filePath, projectId))
}

async function buildContent(slug: string[], projectId?: ProjectId): Promise<PageContent | null> {
  const page = await getPageContent(slug, projectId)

  if (!page) return null

  let content = page.content
  content = replaceTemplateVariables(content)
  content = rewriteImagePaths(content, page.filePath, projectId)
  // Relative doc links 404 at nav-alias routes; make them root-absolute.
  content = rewriteRelativeDocLinks(content, sourceBaseDir(page.filePath, projectId))
  content = removeCommentPatterns(content)
  content = sanitizeHtmlForMdx(content)

  return { content, filePath: page.filePath, sourceUrl: syncedSourceUrl(page.content) }
}

// Synced sibling pages open with a banner written by scripts/sync-sibling-docs.ts
// whose link is the file's true home (repo, branch and un-flattened path —
// e.g. docs/knowledge-base.md, or an .mdx in a different repo). Read it back
// so the source/edit buttons point there instead of guessing from the
// flattened content path.
const SYNCED_SOURCE_RE = /^> \*\*Synced from [^*]+\*\* This page is pulled from \[[^\]]+\]\((https:\/\/github\.com\/[^)\s]+\/blob\/[^)\s]+)\)/m

export function syncedSourceUrl(content: string): string | undefined {
  const m = SYNCED_SOURCE_RE.exec(content)
  return m?.[1]
}

function getProjectFromSlug(slug: string[]): { projectId: ProjectId | undefined; docSlug: string[] } {
  const knownProjects: string[] = ['hive', 'hotshot', 'pluk', 'rationguard', 'promptargs', 'dibs', 'crux', 'spektacular']
  
  if (slug.length > 0 && knownProjects.includes(slug[0])) {
    return {
      projectId: slug[0] as ProjectId,
      docSlug: slug.slice(1)
    }
  }
  
  return { projectId: undefined, docSlug: slug }
}


export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  if (slug.join('/') === 'hive/integrations') {
    return {
      title: 'Supported agents & inference engines',
      description: INTEGRATIONS_DESCRIPTION,
      alternates: { canonical: '/docs/hive/integrations' },
      openGraph: {
        type: 'article',
        url: 'https://docs.hivecommons.dev/docs/hive/integrations',
        title: 'Supported agents & inference engines',
        description: INTEGRATIONS_DESCRIPTION,
      },
      twitter: {
        card: 'summary_large_image',
        title: 'Supported agents & inference engines',
        description: INTEGRATIONS_DESCRIPTION,
      },
      robots: { index: true, follow: true },
    }
  }
  return {}
}

export default async function DocPage({ params }: Props) {
  const { slug } = await params
  const { projectId, docSlug } = getProjectFromSlug(slug)

  const page = await buildContent(docSlug, projectId)

  if (!page) {
    notFound()
  }

  const { content, filePath } = page
  // General-section files live in this repo, not in any synced project.
  const sourceUrl = isGeneralSectionFile(filePath)
    ? `https://github.com/hivecommons/docs/blob/main/docs/content/${filePath}`
    : page.sourceUrl

  // Extract the layout wrapper (DocsLayout: prose typography, table of
  // contents, edit-page actions) so it can be rendered explicitly around the
  // MDX output. nextra's evaluate() does not apply the wrapper component
  // itself — without this the page renders as unstyled markup.
  const { wrapper: Wrapper, ...components } = getMDXComponents({
    Callout,
    Tabs,
    Mermaid,
    convertHtmlScriptsToJsxComments
  })

  if (filePath === 'community/meetings.md') {
    return (
      <Wrapper
        toc={[]}
        metadata={{ title: 'Community meetings' }}
        filePath={filePath}
        projectId={projectId ?? 'hive'}
        sourceUrl={sourceUrl}
      >
        <MeetingsPage />
      </Wrapper>
    )
  }

  let evaluated: ReturnType<typeof evaluate> | null = null
  let compilationFailed = false
  try {
    const compiled = await compileMdx(content, {
      mdxOptions: {
        // Content is synced from other repositories; never let it ship
        // JavaScript (ESM, {expressions}, JSX attribute expressions) into
        // the component that evaluate() runs below.
        remarkPlugins: [remarkStripMdxJs],
        rehypePlugins: []
      }
    })

    evaluated = evaluate(compiled, components)
  } catch {
    // If MDX compilation fails, fall back to plain text rendering
    compilationFailed = true
  }

  const MDXContent = evaluated?.default

  const isIntegrationsPage = projectId === 'hive' && filePath === 'integrations.md'

  return (
    <Wrapper
      toc={evaluated?.toc ?? []}
      metadata={evaluated?.metadata}
      filePath={filePath}
      projectId={projectId ?? 'hive'}
      sourceUrl={sourceUrl}
    >
      {isIntegrationsPage ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(integrationsJsonLd()) }}
        />
      ) : null}
      {compilationFailed || !MDXContent ? <pre>{content}</pre> : <MDXContent />}
    </Wrapper>
  )
}

export async function generateStaticParams(): Promise<Array<{ slug: string[] }>> {
  const allParams = new Map<string, { slug: string[] }>()

  function addParam(slug: string[]) {
    const normalized = slug.filter(Boolean)
    if (normalized.length > 0) {
      allParams.set(normalized.join('/'), { slug: normalized })
    }
  }
  
  function collectParams(dir: string, prefix: string[] = []) {
    if (!fs.existsSync(dir)) return
    
    const entries = fs.readdirSync(dir, { withFileTypes: true })
    for (const entry of entries) {
      if (entry.isDirectory()) {
        collectParams(path.join(dir, entry.name), [...prefix, entry.name])
      } else if (entry.name.endsWith('.md') || entry.name.endsWith('.mdx')) {
        const slug = [...prefix, entry.name.replace(/\.mdx?$/, '')]
        addParam(slug)
      }
    }
  }
  
  collectParams(docsContentPath)

  for (const projectId of STATIC_PROJECTS) {
    const { routeMap } = buildPageMap(projectId)
    for (const routeKey of Object.keys(routeMap)) {
      // General sections are routed at /docs/<section>/..., not per project;
      // collectParams(docsContentPath) above already covers them.
      if (isGeneralSectionFile(routeKey)) continue
      addParam([projectId, ...routeKey.split('/')])
    }
  }
  
  // Also add Hive docs if available
  if (HIVE_DOCS_PATH && fs.existsSync(HIVE_DOCS_PATH)) {
    const hiveEntries = fs.readdirSync(HIVE_DOCS_PATH, { withFileTypes: true })
    for (const entry of hiveEntries) {
      if (!entry.isDirectory()) continue
      const route = entry.name
      addParam(['hive', ...route.split('/')])
    }
  }

  return Array.from(allParams.values())
}
