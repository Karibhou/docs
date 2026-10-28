> **Synced from Hive.** This page is pulled from [hivecommons/hive@v5](https://github.com/hivecommons/hive/blob/v5/src/docs/README.md) during the docs build. Edit the canonical source in the Hive repository.

# Hive introduction

Hive is a co-maintainer for your GitHub project that never sleeps. Point it at a repo and it watches the things that pile up — issues, pull requests, failing CI, CVEs, dependabot alerts — then sends AI coding agents (Claude, Copilot, Codex, Antigravity, Goose…) to deal with them: triage, fixes, reviews, releases.

You decide how much it is allowed to do. Humans keep every decision that matters; agents do the chores.

A terminal agent is a power tool: you hold it, aim it, and it stops when you stop. Hive is the workshop that runs the power tools for you on three rules:

1. **Short-lived agents.** Every task starts a fresh agent with a clean context and ends it.
2. **External context.** What the agent needs to know lives outside the model and is re-injected each time.
3. **Prompts driven by deterministic facts.** Instructions are templates filled from real data, not hand-tuned prose.

## Core concepts

- **[Hive and spoke](/docs/hive/architecture#8-hub--spoke):** a spoke is the running hive that serves repositories; a hub can register, provision, and observe multiple spokes.
- **[Agents](/docs/hive/agent-configuration):** configured AI workers with scopes, models, cadences, and permissions for specific lanes of work.
- **[Governor](/docs/hive/architecture#3-the-governor-loop--from-queue-depth-to-a-kick):** the scheduler and policy loop that decides what work is actionable and when agents should be kicked.
- **[ACMM levels](/docs/hive/acmm-policy-matrix):** the **AI Codebase Maturity Model** — six levels that map how mature a codebase's tests, reviews and security posture are to what agents may observe, propose, open, review, or merge ([paper](https://arxiv.org/abs/2604.09388)).
- **[Hub](https://github.com/hivecommons/hive/blob/v5/src/docs/hosted-hub.md):** the hosted or self-hosted control plane for onboarding hives, heartbeats, fleet views, and hosted-spoke lifecycle.
- **[Contributors and ClankeR relay](/docs/hive/contributor-relay):** a way for trusted contributors to donate compute and run delegated work through hub-mediated roles.

## How it works

1. Connect a repository through the Forge App and configure the project, agents, model backends, and desired ACMM level.
2. The Governor enumerates actionable work and applies deterministic filters before any agent sees a task.
3. Agents receive bounded kicks, work in their configured lanes, and use Hive relays for audited writes such as issues, pull requests, reviews, or merges.
4. Dashboards, logs, fleet health, and hub heartbeats show what happened and what still needs human attention.

## Ways to run Hive

- **Hosted Hive Hub:** start at [`https://hive.hivecommons.dev`](https://hive.hivecommons.dev) and follow the [hosted onboarding guide](https://github.com/hivecommons/hive/blob/v5/src/docs/hosted-hub.md) for the no-cluster path.
- **Self-hosted:** run your own spoke on [Kubernetes](https://github.com/hivecommons/hive/blob/v5/src/docs/kubernetes-deployment.md), [Docker Compose](https://github.com/hivecommons/hive/blob/v5/src/docs/quickstart-docker-compose.md), or [Podman](https://github.com/hivecommons/hive/blob/v5/src/docs/quickstart-podman.md), or operate a [self-hosted hub](https://github.com/hivecommons/hive/blob/v5/src/docs/hub-deployment.md) for a fleet.

## Get started

Start with [Zero to Automation: Getting Started with Hive](/docs/hive/getting-started). If you want the hosted path, read [Hosted Hive Hub onboarding](https://github.com/hivecommons/hive/blob/v5/src/docs/hosted-hub.md) next.

## Where to go next

- [Architecture](/docs/hive/architecture)
- [Integrations](https://github.com/hivecommons/hive/blob/v5/src/docs/integrations.md) — backends, trackers, forges and sandboxes Hive works with, at a glance.
- [Getting started](/docs/hive/getting-started)
- [Operator reference](https://github.com/hivecommons/hive/blob/v5/src/docs/operator-reference.md)
- [GitHub webhooks: cadence, patch and reconcile](https://github.com/hivecommons/hive/blob/v5/src/docs/webhooks.md) — polling fallback, webhook patch and reconcile, and the state-accuracy guarantees.
- [Dashboard sections explained](/docs/hive/dashboard-sections) — what each dashboard section shows and what to do about it.
- [Hive on your iPhone Home Screen](https://github.com/hivecommons/hive/blob/v5/src/docs/ios-widget.md) — a Home Screen widget with issue/PR counts and sparklines (Scriptable, no server change).
- [Dashboard settings explained](https://github.com/hivecommons/hive/blob/v5/src/docs/settings.md) — what each Settings tab controls and where each setting is documented.
- [Maintainer commands](https://github.com/hivecommons/hive/blob/v5/src/docs/maintainer-commands.md) — slash commands for un-parking
  issues, requesting help, confirming fixes, reopening issues, and using label
  or assignment helpers.
- [Release channels](/docs/hive/release-channels) — what `stable`, `candidate`, and `edge` each mean and what to expect from them.
- [Security model](/docs/hive/security-model) — agent safety control inventory, threats, enforcement modes, residual gaps and operator audit checklist.
- Security docs rule: `SECURITY.md` and every `src/docs/security*.md` / `ioscan*.md` page, plus `landscape.md`, must score Flesch-Kincaid grade 11 or lower (CI: `src/scripts/check-security-docs-readability.sh`).
- Security docs rot rule: the same pages carry a `Last reviewed: YYYY-MM-DD` line in their first 15 lines, no older than 120 days, and may not say an item is "tracked in" / "in progress" / "planned" against an issue that is already closed (CI: `src/scripts/check-security-docs-rot.sh`).
- [Data collection and telemetry](https://github.com/hivecommons/hive/blob/v5/src/docs/telemetry.md)
- [Securing your hive: a first-time operator's guide](/docs/hive/securing-your-hive)
- [Community and support](https://github.com/hivecommons/hive/blob/v5/src/docs/community.md)
- [Documentation map](/docs/hive/documentation-map)

Current docs target branch `v5`; use the [documentation map](/docs/hive/documentation-map) for v2 → v4 and v4 → v5 migration pointers.
