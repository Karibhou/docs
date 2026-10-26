# Contributing to Hive Commons Docs

Thank you for helping improve the Hive Commons documentation site
([docs.hivecommons.dev](https://docs.hivecommons.dev)).

- Hive, hotshot, pluk, rationguard, promptargs, dibs, Crux, and Spektacular page content is
  synced from the project repositories at build time — edit it there (see
  README "How content is sourced").
- Site code, navigation, and layout changes belong in this repository.
- Sign your commits with the DCO: `git commit -s`.
- Operating the deployed site (for example rolling back a bad deploy): see [`runbooks/`](runbooks/README.md).
- Open an issue at https://github.com/hivecommons/docs/issues for anything unclear.

## Before you open a PR

From a fresh checkout, install the exact dependency set and run the local
validation commands that cover the PR gates. You need Node.js 22.19 or newer
(the `engines` field in `package.json`; `.nvmrc` pins 22, which CI also uses):

```bash
npm ci
npm run lint:md      # markdownlint for docs content
npm run type-check    # TypeScript without emitting files
npm test              # Vitest unit tests
npx vitest run --coverage   # what CI runs: tests plus the coverage gate
npm run check-links   # internal docs links
npm run lint          # ESLint for src/, scripts/ and netlify/
npm run format        # Prettier; CI runs format:check, so run this before pushing
npm run build         # production build and doc-sync scripts
typos                 # spell check (https://github.com/crate-ci/typos); not an npm script
```

The TypeScript & Lint Check workflow also runs `typos` with the configuration in
`_typos.toml`. Synced docs under `docs/content/` are excluded there — fix their
spelling in the project repository. Add genuine false positives to
`[default.extend-words]`.

The Internal Links CI gate re-syncs Hive docs with `npm run sync-hive-docs` and sibling-project docs with `npm run sync-sibling-docs` before running `npm run check-links`, so a local `check-links` alone validates only the committed snapshot. To reproduce the gate exactly, run the sync scripts first (both require network access; they fall back to the committed content offline).

The Vitest workflow runs `npx vitest run --coverage`, which fails if coverage
falls below the thresholds in `vitest.config.ts` (lines, functions, branches,
statements) across `src/`, `scripts/` and `netlify/`. Add tests alongside new
code in those directories.

To preview the docs locally while editing, run:

```bash
npm run dev
```

Then open the local URL printed by Next.js, usually
<http://localhost:3000>. For a production-style preview, run
`npm run build` followed by `npm run start`.

User-visible changes also need a changelog fragment under `changelog.d/`
(`<category>-<slug>.md`, body a `- ` bullet list — see
`changelog.d/README.md`); `npm test` rejects malformed fragments.

`npm run build` fails if a doc-sync step in `prebuild` fails. When working
offline, set `DOCS_SYNC_OPTIONAL=1` (for example
`DOCS_SYNC_OPTIONAL=1 npm run build`) to keep the committed content instead.
CI and Netlify always use the strict behavior.
Sync fetches time out after 30s by default; set `DOCS_SYNC_FETCH_TIMEOUT_MS`
(milliseconds) to change that.

## Code review requirements

A PR merges once it passes the CI gates defined in `.github/workflows/` — Build,
Internal Links, Markdown Lint, TypeScript & Lint Check, and Vitest — and every
commit is DCO-signed (`git commit -s`).

Build also checks that a Bot-authored PR's head branch is skipped by
`netlify.toml`'s `[context.deploy-preview].ignore` rule. If a new bot lane fails
this check, add its pattern to that rule and a case to
`src/__tests__/netlify-deploy-preview-ignore.test.ts`. Human-authored PRs are
exempt from the CI gate; Netlify itself still matches branch patterns regardless
of author. This check detects drift but cannot cancel a preview already started
by Netlify's PR integration.

The PR template's Security Considerations checklist is scoped to this repo's
actual security-sensitive surface: the Netlify serverless function in
`netlify/nps-relay/` (the NPS relay — see the `[functions]` comment in
`netlify.toml`), and dependency bumps (`npm audit`, Dependabot PRs). This repo
has no Dockerfiles or Kubernetes manifests, so those checklist items do not
apply here — leave them unchecked as the template instructs.
