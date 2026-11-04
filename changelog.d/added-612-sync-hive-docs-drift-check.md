- `scripts/sync-hive-docs.ts` now reports file-list drift after every sync:
  upstream `src/docs/<dir>/*.md` pages next to synced pages, and `src/docs`
  pages that synced pages link to, that are missing from the list (now in
  `scripts/sync-hive-docs.files.json`). It is report-only in builds (stdout and
  `$GITHUB_STEP_SUMMARY`, exit 0); `SYNC_HIVE_DOCS_HEAL=1` or `--heal` appends
  the drift to the list and syncs the new pages. Intentional omissions go in
  `scripts/sync-hive-docs.unsynced-allowlist.txt` (hivecommons/docs#612).
