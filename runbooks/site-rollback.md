# Docs site rollback

Use this when a production deploy of the docs site serves broken pages, wrong
or missing synced content, or broken navigation. The site is built by Netlify
(`netlify.toml`) from `main`; every deploy is kept and can be re-published.

## 1. Triage (5 minutes)

1. Confirm the symptom on the live site, not only on a deploy preview.
2. Find the first bad deploy in the Netlify deploy list and the commit it built.
3. Decide whether the cause is site code in this repo or content synced at
   build time from a project repo (hive, hotshot, pluk, rationguard,
   promptargs, dibs, Crux, Spektacular). Every sync step in `prebuild` runs
   through `scripts/run-sync-step.ts`, so a failed sync (an unreachable project
   repo) **fails the build** — a red deploy may be caused by a broken sync
   source, not only by site code. Only the meeting-recordings refresh always
   falls back to committed data. `DOCS_SYNC_OPTIONAL=1` keeps committed
   content but is local/offline only; CI and Netlify always use the strict
   behavior.

## 2. Mitigate: restore the last good deploy

1. In Netlify, open the site's Deploys list and select the last deploy that
   rendered correctly.
2. Choose **Publish deploy**. This switches production to that build without
   a rebuild and also pauses auto-publishing, so a new push to `main` will not
   overwrite the rollback.
3. Verify the live site: the home page, `/docs/hive/overview/introduction`,
   a page from each synced project, and a 404 URL (the branded
   `public/404.html` should render).

## 3. Fix forward

1. Revert the offending commit on a branch, or fix it, and open a PR
   (DCO-signed: `git commit -s`).
2. Run the local gates from `CONTRIBUTING.md` (`npm run build`,
   `npm run check-links`, `npx vitest run --coverage`).
3. After the PR merges and the new deploy is verified on its deploy preview,
   choose **Start auto publishing** in Netlify to resume normal deploys.

## 4. If bad content came from a project repo

Fix it in the source repo (content is synced from there), then trigger a
rebuild of this site. Do not hand-edit synced content under `docs/`; the next
sync overwrites it.

## 5. NPS relay function

`netlify/functions/nps.mts` is deployed with the site, so rolling back the
site also rolls back the function. Hub pull routes answering 503 means the
`NPS_RELAY_HUB_SECRET_SHA256` site environment variable is unset; that is a
configuration issue, not a deploy regression.

## 6. After the incident

Record what happened, the time to restore, and the follow-up fixes. Use the
postmortem template in `hivecommons/hive` if the outage reached users.
