# Runbooks

Start here when the docs site (docs.hivecommons.dev) is broken after a deploy.

| Symptom                                                                                             | Runbook                                          |
| --------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| A deploy shipped broken pages, missing content, or a failed build is blocking updates               | [site-rollback.md](site-rollback.md)             |
| A docs API alert (`DocsApiHealthzFailing`, `DocsApiHighErrorRate`, `DocsApiSlowRequests`) is firing | [api-alerts.md](api-alerts.md)                   |
| An incident is resolved and needs a blameless postmortem                                            | [postmortem-template.md](postmortem-template.md) |
