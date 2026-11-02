# Postmortem: <short title>

Use this after a bad deploy, a broken synced-content build, or any incident
that reached readers of docs.hivecommons.dev or the docs API. Keep it blameless
and fact-based. Related runbooks: [site-rollback.md](site-rollback.md) and
[api-alerts.md](api-alerts.md).

## Summary

One or two sentences: what broke, who was affected, how long.

## Impact

- Affected pages or endpoints (for example a synced project section, search, or the docs API):
- Detection time and who or what detected it (reader report, `DocsApi*` alert, failed Netlify build):
- Time to mitigation and time to full resolution:

## Timeline (UTC)

| Time | Event |
| ---- | ----- |
|      |       |

## Root cause

What condition made the failure possible, and why existing checks (tests,
`npm run check-links`, the coverage gate, the deploy preview) did not stop it.

## Mitigation and recovery

What was done (re-publish the last good deploy, fix forward, fix the sync
source) and which runbook step was used. Note any step that was missing or wrong.

## What went well / what went poorly

-

## Action items

| Action | Owner | Tracking issue | Due |
| ------ | ----- | -------------- | --- |
|        |       |                |     |
