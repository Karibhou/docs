- `sync-sibling-docs` now removes a previously synced optional page when its
  upstream source answers 404 (hivecommons/docs#542). Previously the stale page
  stayed published indefinitely. Any other non-OK answer (rate limit, 5xx)
  still keeps the committed copy.
