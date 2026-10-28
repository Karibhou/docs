- The scheduled refresh workflows' `REQUIRED_CHECK_WORKFLOWS` lists are now
  covered by the vitest gate: every listed CI workflow must exist and declare
  `workflow_dispatch` (so `gh workflow run` on the bot PR branch is accepted)
  and `pull_request`, and both refresh workflows must list the same checks.
