# Hive Commons Documentation

<p align="center">
  <img src="./public/hive-commons-logo.png" alt="Hive Commons Logo" width="160"/>
</p>

<h2 align="center">Documentation for the Hive Commons projects</h2>

Official documentation site for [Hive Commons](https://hivecommons.dev), served at
[docs.hivecommons.dev](https://docs.hivecommons.dev). It covers:

- **[Hive](https://github.com/hivecommons/hive)** — autonomous AI agent fleets for your repositories
- **[hotshot](https://github.com/hivecommons/hotshot)** — screenshots straight into your AI coding terminal
- **[pluk](https://github.com/hivecommons/pluk)** — pub-sub event streaming for AI agent tmux sessions
- **[rationguard](https://github.com/hivecommons/rationguard)** — detect and rebut rationalization patterns in AI agent output
- **[promptargs](https://github.com/hivecommons/promptargs)** — template expansion for AI prompts
- **[dibs](https://github.com/hivecommons/dibs)** — claim ideas so contributors get credit when agents implement them
- **[Crux](https://github.com/hivecommons/crux)** — standalone runtime for AI coding agents
- **[Spektacular (Spek)](https://github.com/hivecommons/spektacular)** — spec-driven development for AI coding agents (canonical site: [spektacular.dev](https://spektacular.dev))

## How content is sourced

Hive, hotshot, pluk, rationguard, promptargs, dibs, Crux, and Spektacular docs are
**single-sourced from their repositories** and pulled at build time:

- `scripts/sync-hive-docs.ts` pulls Hive docs from `hivecommons/hive` (`src/docs/`, branch `v5`;
  override with `HIVE_DOCS_OWNER` / `HIVE_DOCS_REPO` / `HIVE_DOCS_REF`).
- `scripts/sync-sibling-docs.ts` pulls the hotshot, pluk, rationguard, promptargs, dibs, Crux, and Spektacular docs from their repos.
  Spektacular also pulls its tutorials from `hivecommons/spektacular-website` (MDX, converted to Markdown by
  `scripts/mdx-to-markdown.ts`; override the ref with `SPEKTACULAR_WEBSITE_DOCS_REF`).
  Override the org for all sibling repos with `SIBLING_DOCS_OWNER` (default `hivecommons`), or the
  branch/ref for an individual project with `HOTSHOT_DOCS_REF`, `PLUK_DOCS_REF`,
  `RATIONGUARD_DOCS_REF`, `PROMPTARGS_DOCS_REF`, `DIBS_DOCS_REF`, `CRUX_DOCS_REF`, or `SPEKTACULAR_DOCS_REF`.

Edit the canonical source in the project repository — not the synced copies under
`docs/content/`. If a sync source is unreachable at build time, the build fails so
stale content is never deployed silently. For offline local work, set
`DOCS_SYNC_OPTIONAL=1` to keep the committed copies instead (CI and Netlify always use
the strict behavior). Only the meeting-recordings refresh always falls back to its
committed data.

## Development

Requires Node.js 22.19 or newer (`.nvmrc` pins 22, matching CI).

```bash
npm install
npm run dev        # http://localhost:3000
```

The site is Next.js + Nextra, deployed on Netlify (site `hivecommons-docs`).
Navigation is defined in `src/app/docs/page-map.ts`; project registry in
`src/config/versions.ts`.

## Observability

The site exposes per-instance API metrics via `/api/metrics` in Prometheus text format.
The endpoint serves bounded, in-process counters and histograms for the `search` and
`docs-image` API handlers only (not static assets or page traffic).

**Scope and durability:** The registry is process-local with no configured exporter or
backend. On Netlify, instances are ephemeral, so the `/api/metrics` snapshot is not
durable or site-wide. It is suitable only for immediate, per-instance instrumentation
during development or local testing.

**Site-wide telemetry:** If persistent, aggregated request telemetry is needed, use a
deployment-supported collection path — for example, Netlify's platform-native traffic
analytics, or an explicitly operator-configured scraper/aggregator that polls `/api/metrics`
across instances and persists data to a central observability backend.

**Readiness check:** `/api/healthz` reports whether the instance can actually serve
docs content. It verifies that the local docs content tree (`docsContentPath` in
`src/app/docs/page-map.ts`) exists, is a directory, and is non-empty — the dependency
every page render and `/api/search` read from at request time. It returns
`{"status": "ok"}` with HTTP 200 when that check passes, or
`{"status": "unhealthy", "reason": "<cause>"}` with HTTP 503 otherwise (for example a
bad build, a failed volume mount, or an incomplete version-branch checkout). This
guards against an instance returning 200 on its normal routes while actually serving
broken or empty documentation.

## Runbooks

If a deploy ships broken pages or missing content, start at [`runbooks/README.md`](runbooks/README.md); it indexes the [site rollback runbook](runbooks/site-rollback.md).

## Contributing

PRs welcome. Sign your commits (DCO): `git commit -s`.

## License

Apache 2.0
