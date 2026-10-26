import type { Metadata } from 'next'
import { DocsNavbar, DocsFooter } from '@/components/docs/index'
import { DocsProvider } from '@/components/docs/DocsProvider'
import { MobileOverlay } from '@/components/docs/MobileOverlay'
import localFont from "next/font/local"
import { Suspense } from 'react'
import { ThemeProvider } from "next-themes"
import "../globals.css"

// Self-hosted fonts (see src/fonts) to avoid fetching from fonts.googleapis.com at build time.
const inter = localFont({
  src: [
    { path: "../../fonts/ibm-plex-sans-400-600-normal.woff2", weight: "400 600", style: "normal" },
    { path: "../../fonts/ibm-plex-sans-400-600-italic.woff2", weight: "400 600", style: "italic" },
  ],
  variable: "--font-inter",
})

const fraunces = localFont({
  src: [{ path: "../../fonts/fraunces-600.woff2", weight: "600", style: "normal" }],
  variable: "--font-fraunces",
})

const jetbrainsMono = localFont({
  src: [{ path: "../../fonts/jetbrains-mono-100-800.woff2", weight: "100 800", style: "normal" }],
  variable: "--font-jetbrains-mono",
})

const SITE_URL = 'https://docs.hivecommons.dev'
const SITE_TITLE = 'Hive Commons Docs - AI Agent Collaboration Projects'
const SITE_DESCRIPTION =
  'Documentation for Hive Commons projects that help AI coding agents and maintainers work together: Hive, Spektacular (Spek), hotshot, pluk, promptargs, rationguard, dibs, and Crux.'

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

const DOCS_KEYWORDS = [...INTEGRATION_NAMES, 'TypeSafe AI', 'Spektacular', 'Spek', 'speks']

const INFRA_SPONSORS = [
  { '@type': 'Organization', name: 'Akamai', url: 'https://www.linode.com/' },
  { '@type': 'Organization', name: 'Oracle Cloud', url: 'https://www.oracle.com/cloud/cloud-native/kubernetes-engine/' },
  { '@type': 'Organization', name: 'Cloudflare', url: 'https://www.cloudflare.com/' },
  { '@type': 'Organization', name: 'GitHub Copilot', url: 'https://github.com/features/copilot' },
  { '@type': 'Organization', name: 'Bluehost', url: 'https://www.bluehost.com/' },
]

const DOCS_JSON_LD = [
  {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'Hive',
    applicationCategory: 'DeveloperApplication',
    operatingSystem: 'Linux, macOS',
    license: 'https://www.apache.org/licenses/LICENSE-2.0',
    url: 'https://hive.hivecommons.dev/',
    codeRepository: 'https://github.com/hivecommons/hive',
    keywords: DOCS_KEYWORDS.join(', '),
    featureList: [
      'Drives supported agent CLI backends including Claude Code, GitHub Copilot CLI, Goose, OpenAI Codex CLI, Google Antigravity CLI, IBM Bob and more.',
      'Routes inference through supported engines and gateways including vLLM, llm-d, LiteLLM, IBM watsonx.ai, OpenRouter, Anthropic, OpenAI and DeepSeek.',
      'Supports Jev by TypeSafe AI as a Hive v6 optional advisory smart-classifier backend.',
      'Admits report-only external execution through the Flue pilot and ready C/C++ to Rust migration graph nodes through Crustify/Wavefront.',
    ],
  },
  {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'Spektacular',
    alternateName: 'Spek',
    applicationCategory: 'DeveloperApplication',
    operatingSystem: 'Linux, macOS',
    license: 'https://www.apache.org/licenses/LICENSE-2.0',
    url: 'https://spektacular.dev/',
    codeRepository: 'https://github.com/hivecommons/spektacular',
    keywords: ['Spektacular', 'Spek', 'speks', 'spec-driven development', 'AI coding agents'].join(', '),
    featureList: [
      'Turns a markdown spek into a reviewed implementation plan.',
      'Drives coding agents through resumable spec, plan, and implement workflows.',
    ],
  },
  {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'Hive Commons',
    url: 'https://hivecommons.dev/',
    sponsor: INFRA_SPONSORS,
    funder: INFRA_SPONSORS,
  },
]

export const metadata: Metadata = {
  title: {
    default: SITE_TITLE,
    template: '%s | Hive Commons Docs',
  },
  description: SITE_DESCRIPTION,
  keywords: DOCS_KEYWORDS,
  metadataBase: new URL(SITE_URL),
  alternates: {
    canonical: '/docs',
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: `${SITE_URL}/docs`,
    siteName: 'Hive Commons',
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: [
      {
        url: '/hive-commons-og.png',
        width: 1200,
        height: 630,
        alt: 'Hive Commons',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: ['/hive-commons-og.png'],
  },
  robots: {
    index: true,
    follow: true,
  },
}

type Props = {
  children: React.ReactNode
}

export default async function DocsLayout({ children }: Props) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(DOCS_JSON_LD) }}
        />
      </head>
      <body className={`${inter.variable} ${fraunces.variable} ${jetbrainsMono.variable} antialiased`}>
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
          <DocsProvider>
            <div className="flex flex-col min-h-screen">
              <Suspense fallback={<div className="h-16" />}>
                <DocsNavbar />
              </Suspense>
              <div className="flex flex-1 relative">
                <MobileOverlay />
                {children}
              </div>
              <DocsFooter />
            </div>
          </DocsProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
