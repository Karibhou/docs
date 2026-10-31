import type { NextConfig } from "next";
import nextra from "nextra";

import createNextIntlPlugin from "next-intl/plugin";

const withNextra = nextra({
  latex: true,
  search: {
    codeblocks: false,
  },
});

const nextConfig: NextConfig = {
  images: {
    unoptimized: true,
  },
  experimental: {
    optimizePackageImports: ["@/components"],
  },
  pageExtensions: ["js", "jsx", "ts", "tsx", "md", "mdx"],
  // Do not advertise the framework on every response (x-powered-by).
  poweredByHeader: false,
  async headers() {
    // Content-Security-Policy for the docs site.
    // - default-src 'self': blocks all unlisted resource types by default.
    // - script-src includes 'unsafe-inline' because Next.js/Nextra inject
    //   inline <script> tags for hydration and i18n. A nonce-based CSP is
    //   preferable long-term; 'unsafe-inline' is the pragmatic starting point
    //   that does not break existing functionality. 'unsafe-eval' is excluded
    //   (not needed by any current dependency). 'wasm-unsafe-eval' allows
    //   the Mermaid WASM renderer.
    // - style-src 'unsafe-inline': required by Tailwind CSS and the inline
    //   <style> blocks Mermaid injects into rendered SVGs.
    // - img-src includes data: for base64-encoded diagrams and blob: for
    //   canvas snapshots; https: covers external avatars/badges in docs content.
    // - connect-src covers the docs search API, GitHub API (version data),
    //   img.shields.io (navbar GitHub stats, useGithubStats.ts), the production
    //   docs host (shared.json fetched on preview deploys), and analytics.
    // - worker-src blob: is required by the Mermaid diagram renderer.
    // - frame-ancestors 'none' replaces X-Frame-Options: DENY (equivalent
    //   but CSP-native; X-Frame-Options kept for older browser compat).
    const csp = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval' https://www.googletagmanager.com https://www.google-analytics.com",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data:",
      "connect-src 'self' https://api.github.com https://img.shields.io https://docs.hivecommons.dev https://www.google-analytics.com",
      "worker-src blob:",
      "frame-src https://www.youtube-nocookie.com",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; ");

    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          { key: "Content-Security-Policy", value: csp },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
        ],
      },
    ];
  },
  async rewrites() {
    return [
      {
        // Serve docs images from docs/content folder
        source: "/docs-images/:path*",
        destination: "/api/docs-image/:path*",
      },
    ];
  },
  async redirects() {
    return [
      {
        source: "/code",
        destination: "https://github.com/hivecommons",
        permanent: true,
      },
    ];
  },
};

const configWithNextra = withNextra(nextConfig);

// Note: Route-level exclusion is handled in src/proxy.ts (matcher excludes /docs)
const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

export default withNextIntl(configWithNextra);
