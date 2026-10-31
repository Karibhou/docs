> **Synced from Hive.** This page is pulled from [hivecommons/hive@v5](https://github.com/hivecommons/hive/blob/v5/src/docs/documentation-map.md) during the docs build. Edit the canonical source in the Hive repository.

# Documentation map

Use this map when you already know the area you need and want the full Hive documentation catalog.

**New to Hive?** Use the [introduction](/docs/hive/readme#get-started) to choose hosting,
then [Getting started](/docs/hive/getting-started) for your first session. This catalog
is a reference, not a reading order.

Descriptions below name the task; implementation keys and incident history
belong in the destination. **Operator**, **developer**, **design/proposal**,
and **historical** labels distinguish pages that are not installation steps.

Documentation for the current Hive line (branch `v5`; the code and docs live under the `src/` directory). The `v2` branch was retired in August 2026 — operators upgrading a v2 deployment should start with the [v2 → v4 migration guide](https://github.com/hivecommons/hive/blob/v5/src/docs/migration-v2-v4.md), and v4 operators should use the [v4 → v5 migration guide](https://github.com/hivecommons/hive/blob/v5/src/docs/migration-v4-v5.md).

## Operations

### First installation

- [Hosted Hive Hub onboarding](https://github.com/hivecommons/hive/blob/v5/src/docs/hosted-hub.md) — signing in at `https://hive.hivecommons.dev`, requesting a hosted hive, installing the GitHub App, configuring model gateways and Copilot login, reading `/fleet`, and fixing common setup problems.
- [Docker Compose quick start](https://github.com/hivecommons/hive/blob/v5/src/docs/quickstart-docker-compose.md) — default standalone installation, prerequisites, and verification.
- [Podman quick start](https://github.com/hivecommons/hive/blob/v5/src/docs/quickstart-podman.md) — standalone Quadlet/systemd installation, with rootless/rootful prerequisites.
- [Kubernetes deployment](https://github.com/hivecommons/hive/blob/v5/src/docs/kubernetes-deployment.md) — standalone cluster installation, storage, authentication, and dashboard access. Related: [health checks](https://github.com/hivecommons/hive/blob/v5/src/docs/health-checks.md).
- [Manual provisioning](/docs/hive/manual-provisioning) — **Operator:** choose standalone Kubernetes, hub-reachable provisioning, or heartbeat-only provisioning.

### Configuration and day-to-day control

- [Self-hosted hub deployment](https://github.com/hivecommons/hive/blob/v5/src/docs/hub-deployment.md) — `HIVE_MODE=hub`, hub storage, heartbeat secrets, and SaaS spoke registration.
- [`CAP_NET_ADMIN` and self-hosted spokes](/docs/hive/net-admin-requirement) — **Operator:** diagnose fail-closed startup, grant required network capabilities, or understand the explicit advisory-only opt-out.
- [Config layering](https://github.com/hivecommons/hive/blob/v5/src/docs/config-layering.md) — how ConfigMap seed, PVC dashboard overlay, and runtime config interact.
- [Operator reference](https://github.com/hivecommons/hive/blob/v5/src/docs/operator-reference.md) — top-level config blocks, hive flags/env, GitHub token scopes, and image provenance.
- [Running a hive at ACMM Level 6](/docs/hive/running-at-level-6) — preparation, GitHub/coverage/knowledge/Hive/ClankeR settings, weekly routine, and incident recovery.
- [Maintainer commands](https://github.com/hivecommons/hive/blob/v5/src/docs/maintainer-commands.md) — slash-command reference for `/hive approve`, `/hive decision`, `/hive help`, `/fixed`, `/reopen`, and label/assignment helpers.
- [Token mint](https://github.com/hivecommons/hive/blob/v5/src/docs/token-mint.md) — the opt-in `mint:` block (`pkg/mint`): what a minted token grants, key lifecycle, and the trust boundary an operator must get right before enabling it. Companion to [ADR-0007](/docs/hive/adr/0007-token-mint).
- [Changelog](https://github.com/hivecommons/hive/blob/v5/CHANGELOG.md) — recent user-visible changes and release notes.
- [Work-source terminology](https://github.com/hivecommons/hive/blob/v5/src/docs/work-source-terminology.md) — glossary and audit notes for keeping user-facing copy neutral across GitHub, GitLab, Gitea, Linear, Jira, and future work sources.

### Releases and release-maintainer policy

- [Release channels](/docs/hive/release-channels) — `stable`/`candidate`/`edge` moving image tags, per-line channel ownership (`v5` → `candidate`/`latest`, `v6` → `edge`, `v4` → none), switching a hive to a channel, the version pill, and the timeline for when a hive follows `stable` after the tag moves.
- [Digest-verifiable rollback](https://github.com/hivecommons/hive/blob/v5/src/docs/release-rollback.md) — **Operator:** pin all three images to prior builds, stop conflicting automation, and verify running digests.
- [Outcome benchmarks](https://github.com/hivecommons/hive/blob/v5/src/docs/benchmarks/README.md) — compare change quality, review, timing, and cost from stored evidence; includes monthly reports and generated README cards.
- [v5 GA readiness bar](https://github.com/hivecommons/hive/blob/v5/src/docs/v5-ga.md) — measurable release-train, migration, safety, and governance criteria that must be evidenced before v5 can be promoted beyond the active-development `edge` channel.
- [v5 GA candidate week sequencing](https://github.com/hivecommons/hive/blob/v5/src/docs/v5-candidate-week.md) — dependency-ordered plan for the remaining human-gated GA-bar steps: candidate-SHA designation, candidate-pinned measurements, the two bound exercises, and the v4 freeze evaluation.
- [Stable soak and promotion policy (v5 line)](/docs/hive/operations/stable-soak-and-promotion-policy) — **Release maintainer:** normal promotion gates, emergency checklist, closure evidence, and per-image rollback ledger.
- [HiveCommons migration tracker](https://github.com/hivecommons/hive/blob/v5/src/docs/hivecommons-migration.md) — phased org/package migration status, operator promises, and sequenced closeout checklist.
- [v4 → v5 forward-port sync policy](https://github.com/hivecommons/hive/blob/v5/src/docs/v5-sync-policy.md) — proposed cadence, ownership, merge-commit top-up procedure, and the PR/review contract for keeping `v5` topped up with `v4`; protects the v5 GA bar from unbounded drift.
- [v4 feature-freeze execution runbook](https://github.com/hivecommons/hive/blob/v5/src/docs/v4-freeze-runbook.md) — **Release maintainer / migration record:** declare the freeze, redirect work, and carry eligible fixes forward.
- [v5 migration — operator announcement](https://github.com/hivecommons/hive/blob/v5/src/docs/v5-migration-announcement.md) — **draft, do not publish** until #7721 Phase 0 completes: the migration-week announcement text (channel table before/after, per-selection operator actions, security-fix policy while `stable` lags, rollback, key dates) and the marshal's publication checklist.
- [dibs domain cutover](https://github.com/hivecommons/hive/blob/v5/src/docs/dibs-domain-cutover.md) — staged operator sequence for moving dibs to `dibs.hivecommons.dev`, including DNS, Let's Encrypt quota hold, Certificate/Ingress manifests, redirect verification, and rollback.
- [Serving spokes from the fleet wildcard certificate](https://github.com/hivecommons/hive/blob/v5/src/docs/spoke-wildcard-tls.md) — how to point a cluster's provisioned spokes at the wildcard instead of one certificate per hive, the two cluster prerequisites that must hold first, and which hosts a wildcard cannot cover.
- [Tagged releases](https://github.com/hivecommons/hive/blob/v5/src/docs/releases.md) — **Release maintainer:** trigger/version rules, manual recovery, channel relationship, and release SBOM artifacts.
- [Release sentinel](https://github.com/hivecommons/hive/blob/v5/src/docs/release-sentinel.md) — **Opt-in; off by default:** bounded repair for failing release CI, human escalation, and separately opted-in retagging.
- [Dashboard-triggered standalone upgrades](https://github.com/hivecommons/hive/blob/v5/src/docs/dashboard-standalone-upgrades.md) — the dashboard upgrade button for standalone (Compose/Podman-Quadlet) hives: the `HIVE_DEPLOYMENT_RUNTIME`/`HIVE_DEPLOYMENT_PODMAN_MODE` runtime contract, the closed host-side helper (`hive-dashboard-upgrade-helper.sh`), and why an unproven runtime deliberately hides the button.
### Dashboards and integration reference

- [Work source providers](/docs/hive/integrations/work-source-providers) — **Developer:** implement an adapter. To configure an existing tracker, use [Work sources](/docs/hive/work-sources).
- [Forges: GitLab, Gitea and Forgejo](https://github.com/hivecommons/hive/blob/v5/src/docs/integrations/forges.md) — `project.forge`, the `gitlab:`/`gitea:` keys, which `pkg/forge` operations each adapter supports, which governor writes already use them, and how the dashboard shows the forge.
- [Hive Labels and Control Signals](/docs/hive/labels-and-control-signals) — authoritative operator reference for labels, holds, approvals, contributor skip labels, planning labels, and dashboard bands. The old [Hive issue labels](https://github.com/hivecommons/hive/blob/v5/src/docs/issue-labels.md) page redirects here.
- [GitHub webhooks: cadence, patch and reconcile](https://github.com/hivecommons/hive/blob/v5/src/docs/webhooks.md) — configure event-driven updates, understand snapshot accuracy, and diagnose fallback to polling.
- [Spoke dashboard](https://github.com/hivecommons/hive/blob/v5/src/docs/dashboard.md) — the static dashboard FAQ panel contract: not ACMM-gated, no JS/fetch, grouped L1-L6/runs/contributors/claims/cost help, and guarded config-key references.
- [Dashboard sections explained](/docs/hive/dashboard-sections) — plain-language operator help for every dashboard section: what it shows, how its numbers are worked out, what to do about them, when it appears, and which settings change it. The **?** mark on each section title opens its entry.
- [Dashboard settings explained](https://github.com/hivecommons/hive/blob/v5/src/docs/settings.md) — one entry per Settings tab: what it controls and which guide explains it. The **?** mark next to each setting opens its guide or this page.
- [Dashboard feedback](https://github.com/hivecommons/hive/blob/v5/src/docs/feedback.md) — reporting bugs and requesting features from the spoke dashboard, including diagnostics, screenshot handling, hub relay, user-auth, and fallback issue paths.
- [Dashboard source layout](https://github.com/hivecommons/hive/blob/v5/src/docs/dashboard-source-layout.md) — `static/index.html` is generated from per-area CSS/JS/HTML sources in `static-src/` via `make dashboard-gen`; how to edit, add an area, and resolve merge conflicts.
- [Dashboard design system](https://github.com/hivecommons/hive/blob/v5/src/docs/dashboard-design-system.md) — shared token catalogue, component variants, migration rules, ratchet plan, and #8536 theme override contract for spoke, contributor, and hub dashboard surfaces.
- [Dashboard glossary and sidebar IA](/docs/hive/dashboard-glossary) — the operator-facing names used by the dashboard and the ADR-0018 sidebar information architecture.
- [The `auto-update` Compose profile](https://github.com/hivecommons/hive/blob/v5/src/docs/auto-update-profile.md) — what unattended Watchtower updates cost you, what the Docker socket proxy does and does **not** fix, and why Kubernetes should not use this profile at all.
- [Environment variable reference](/docs/hive/env-vars) — centralized list of runtime, deployment, hub, backup, and contributor environment variables.
### Recovery, moves, and fleet health

- [DiskPressure recovery runbook](https://github.com/hivecommons/hive/blob/v5/src/docs/diskpressure-recovery-runbook.md) — diagnose storage eviction, recover safely, and expand or migrate volumes.
- [Agent backend-auth failure recovery runbook](https://github.com/hivecommons/hive/blob/v5/src/docs/backend-auth-recovery-runbook.md) — identify affected agents, re-authenticate the backend, and clear recovered fleet reports.
- [Troubleshooting](/docs/hive/troubleshooting) — container logs, config validation, agent tmux sessions, dashboard auth, GitHub credential checks, and GitHub App workflow-permission push rejections.
- [Admin MCP reference](https://github.com/hivecommons/hive/blob/v6/src/docs/admin-mcp.md) (v6) — diagnostic reads for logs, startup output, request logs, agent terminals and kick logs, and crash/restart/memory evidence via the admin MCP: `log_sources`, `log_read` and its diagnostic read companions, and what still needs a host shell.
- [Community and support](https://github.com/hivecommons/hive/blob/v5/src/docs/community.md) — Discord, contributor portal, issue tracker, and where to ask Hive Commons questions.
- [Integration guide](/docs/hive/integration-guide) — third-party extension surfaces for work source providers, ClankeR/Flue-style external execution, and Spektacular-backed Project Inception.
- [Cross-cluster migration](https://github.com/hivecommons/hive/blob/v5/src/docs/cross-cluster-migration.md) — the manual procedure for moving a hive between clusters.
- [Self-hosted Kubernetes cluster move](https://github.com/hivecommons/hive/blob/v5/src/docs/move-kubernetes.md) — moving a self-hosted (non-hub) Kubernetes hive between clusters: which PVC/Secret/ConfigMap paths hold identity and state, a generic `kubectl`-based PVC copy, target prerequisites, and verification.
- [Hub-registered hive cutover](https://github.com/hivecommons/hive/blob/v5/src/docs/move-hub-registered-cutover.md) — cross-cutting rules for any hub-registered hive's move: what identity is, how the hub reads heartbeat/`dashboard_url`, why source and target must never run concurrently, the required cutover order, and rollback.
- [Moving a Hive between hosts, same runtime](https://github.com/hivecommons/hive/blob/v5/src/docs/move-host.md) — **Documented, not executed:** preserve identity/state on Compose or Quadlet moves; stop the source before starting the target.
- [Cross-runtime moves](https://github.com/hivecommons/hive/blob/v5/src/docs/move-cross-runtime.md) — Podman → Docker (the reverse of `backup-restore.md`'s executed Docker → Podman migration), and Compose/Quadlet ↔ Kubernetes: volume ↔ PVC, secrets ↔ Kubernetes Secrets, and which host-bound settings must change. Documented, not executed.
- [v2 → v4 migration](https://github.com/hivecommons/hive/blob/v5/src/docs/migration-v2-v4.md) — upgrading a v2 deployment: the config is compatible unmodified, and what actually changes is the image tag, the published `7681` port, and the Compose/Kubernetes security settings.
- [v4 → v5 migration](https://github.com/hivecommons/hive/blob/v5/src/docs/migration-v4-v5.md) — upgrading a v4 deployment before the 2026-12-21 EOL: channel/tag changes, additive config deltas, Kubernetes/Compose/Podman rollout steps, verification, and digest rollback.
- [Major-version upgrade guide](https://github.com/hivecommons/hive/blob/v5/UPGRADE.md) — preparing for v4 → v5 and future major-version boundaries.
- [Dashboard route and health checks](https://github.com/hivecommons/hive/blob/v5/src/docs/health-checks.md) — `dashboard-route-rbac.yaml`, `route_exists`, listener probes, and alert behavior.
- [Fleet health: the verdict and remediation hints](https://github.com/hivecommons/hive/blob/v5/src/docs/fleet-health.md) — read green/amber/red/unknown health states and choose the matching recovery action.
- [Fleet drift signals](https://github.com/hivecommons/hive/blob/v5/src/docs/fleet-drift-signals.md) — interpret deviation badges and identify whether the owner or hub operator must act.
- [Fleet self-reporting (`governor.fleet_report`)](https://github.com/hivecommons/hive/blob/v5/src/docs/fleet-report.md) — **Off by default:** preview or opt in to reports about failures caused by Hive. Explains sent data, duplicate-report handling, and recovery records.
- [Push-reported cluster node health](https://github.com/hivecommons/hive/blob/v5/src/docs/push-reported-node-health.md) — how spokes on clusters the hub cannot `kubectl` push node health in their heartbeat (`hub.cluster_id` / `HIVE_CLUSTER_ID`, the heartbeat node-health block, and how the hub merges it into cluster views).
- [Agent self-healing watchdog](https://github.com/hivecommons/hive/blob/v5/src/docs/agent-watchdog.md) — **Observe mode by default:** diagnose stalled/crashing agents and review proposed restarts before enabling repair.
- [Audit log format](https://github.com/hivecommons/hive/blob/v5/src/docs/audit-log.md) — parse action records, actors, targets, and rotation limits; lookback varies with log volume.
- [Per-repo agent pause](https://github.com/hivecommons/hive/blob/v5/src/docs/repo-pause.md) — pause one repository, understand enforcement, and see what reads/operator actions remain allowed.
- [Token-access audit log](https://github.com/hivecommons/hive/blob/v5/src/docs/token-access-log.md) — **Owner reference:** inspect credential-access records and understand retention and coverage gaps.
- [Per-repo agents](https://github.com/hivecommons/hive/blob/v5/src/docs/per-repo-agents.md) — scope specialists to repositories, preserve operator-owned scopes, and understand enforcement limits.

### Agent writes and network reference
- [`hive-open-pr`](https://github.com/hivecommons/hive/blob/v5/src/docs/hive-open-pr.md) — how agents open pull requests as the App bot instead of via `gh pr create`: the flags, the UID-ownership anchor that makes the request forge-resistant, and the asynchronous contract (exit `0` means requested, not opened).
- [`hive-merge`](https://github.com/hivecommons/hive/blob/v5/src/docs/hive-merge.md) — how agents merge pull requests as the App bot instead of the GitHub MCP `merge_pull_request` tool: the flags, the F4 target-binding (pinned head SHA + governor merge-eligible list), and the retry/re-engagement behavior when required checks are still red.
- [Native merge queue](https://github.com/hivecommons/hive/blob/v5/src/docs/native-merge-queue.md) — how the auto-merge lanes enqueue eligible PRs into GitHub's native merge queue (App auth only), the `native-merge-queued`/`native-merge-queue-*` stage reasons, and how Hive withdraws only its own entries when a gate breaks.
- [`hive-open-issue`](https://github.com/hivecommons/hive/blob/v5/src/docs/hive-open-issue.md) — **Agent/developer reference:** request issue creation, comments, or claims through the App bot, with deduplication and retries.
- [Review-bot threads on hive-mediated PRs](https://github.com/hivecommons/hive/blob/v5/src/docs/review-bot-threads.md) — route bot feedback back to the authoring agent while protecting human review threads.
- [Network and port requirements](https://github.com/hivecommons/hive/blob/v5/src/docs/network-requirements.md) — inbound ports, proxy paths, egress, and firewall guidance.
- [TLS, HTTPS, and certificates](https://github.com/hivecommons/hive/blob/v5/src/docs/tls-setup.md) — termination patterns and certificate ownership.
- [Security notes](https://github.com/hivecommons/hive/blob/v5/src/docs/security.md) — log scrubbing and secret redaction guarantees/limits.
- [Token collection and usage tracking](https://github.com/hivecommons/hive/blob/v5/src/docs/token-tracking.md) — session JSONL, `/api/cost`, and hub usage rollups.
- [Notifications](https://github.com/hivecommons/hive/blob/v5/src/docs/notifications.md) — ntfy, Slack, and Discord alert channels, plus the two-way [Discord bot](https://github.com/hivecommons/hive/blob/v5/discord/README.md).
- [State-triggered hooks](https://github.com/hivecommons/hive/blob/v5/src/docs/hooks.md) — declarative `transition → action` rules, the transition catalog, the vetted action set, and the security model (RFC #4001).
- [CEL-based agent triggers](https://github.com/hivecommons/hive/blob/v5/src/docs/cel-triggers.md) — the `triggers:` config key: declarative CEL rules that kick an agent on a normalized source-control event, additive to built-in label/governor triggering, the `event.*` field reference, and the fail-closed compile/runtime contract.

### Long-running work and external execution
- [Long-running runs](https://github.com/hivecommons/hive/blob/v5/src/docs/runs.md) — how a run starts, including default-off triage admission and inception completion admitting an explicit GitHub issue into the first `spec` lease.
- [Spektacular (Spek) stage runner](/docs/hive/integrations/spektacular) — **Operator; opt-in:** configure and monitor Hive's `spec` → `plan` → `implement` stages. Artifact design: [run artifacts](https://github.com/hivecommons/hive/blob/v5/src/docs/design/run-artifacts.md).
- [ClankeR and Flue-style external execution](/docs/hive/integrations/clanker-flue) — how the contributor relay and `pkg/extwork` let an external engine receive bounded work, report status, and return digest-verified receipts without repository credentials.
- [Spektacular and Project Inception](/docs/hive/integrations/spektacular) — **Developer integration:** CLI status, final-plan import, and inception admission; not the operator stage-runner setup above.
- [vibe-kanban mirror and dispatch](https://github.com/hivecommons/hive/blob/v5/src/docs/vibe-kanban.md) — default-off side-car that mirrors one repository's admitted hive queue onto a local vibe-kanban board, records board pick-ups as shadow executions, and documents the opt-in `pkg/extwork/vibekanban` report-only workspace dispatch adapter.
- [Audit campaign](https://github.com/hivecommons/hive/blob/v5/src/docs/audit-campaign.md) — **Owner-triggered; publication off by default:** run report-only inspections with credential guards, stage receipts, and explicit publication gates.
- [Public snapshots](https://github.com/hivecommons/hive/blob/v5/src/docs/snapshots.md) — read-only `/snapshot`, custom CSS, and frame-ancestor sharing.
- [hivectl](/docs/hive/hivectl) — command-line client for the dashboard API, including
  [`hivectl tui`](/docs/hive/hivectl#tui--live-terminal-dashboard), the full-screen
  terminal dashboard: keybindings, pane cadence, and v1 boundaries. See
  [the design record](https://github.com/hivecommons/hive/blob/v5/src/docs/design/tui.md) for the reasoning behind it.
- [`bd` beads CLI](https://github.com/hivecommons/hive/blob/v5/src/docs/beads-cli.md) — work-ledger and knowledge command reference for operators and contributors.
- [`crux` CLI](https://github.com/hivecommons/hive/blob/v5/src/docs/crux-cli.md) — run, list, tail, kick and stop agents through `crux.Runtime` with no governor or dashboard; definition formats, the control socket served by `crux run`, and why the runtime being in-process shapes it.
- [`crux serve`: the runtime over a local API](https://github.com/hivecommons/hive/blob/v5/src/docs/crux-serve.md) — **Developer:** operate the runtime server through its authenticated API, event stream, CLI, or Go client.
- [Publishing Crux](https://github.com/hivecommons/hive/blob/v5/src/docs/crux-publish.md) — how `hivecommons/crux` is produced from `src/crux` (plain copy, module path rewritten, fast-forward commits), what is preserved there, the `CRUX_SYNC_TOKEN` credential, manual sync and how a `crux/vX.Y.Z` tag becomes a release.
### Backup and API reference

- [Backup and restore](/docs/hive/backup-dr) — choose runtime-specific backups, encryption, safe restoration, and migration. Covers identity checks and rootless ownership traps.
- [Hub disaster recovery](https://github.com/hivecommons/hive/blob/v5/docs/HUB_DISASTER_RECOVERY.md) — the hub-level runbook that goes beyond per-hive backup: hub backup and key escrow, spoke fleet recovery, Slack blast, and the full rebuild-from-zero procedure after a catastrophic loss.
- [Deployment helper scripts](https://github.com/hivecommons/hive/blob/v5/src/docs/deployment-scripts.md) — the all-in-one LXC setup, Proxmox LXC, and blue-green Compose helpers. All are Docker-only; the page states each script's runtime scope and where a Podman operator should go instead.
- [Streaming the Activity Monitor](https://github.com/hivecommons/hive/blob/v5/src/docs/streaming-the-activity-monitor.md) — put the dashboard's stage tracker on an unattended 24/7 Twitch stream: Twitch-side setup, the `hive-stream` image and Kustomize overlay, verification and troubleshooting.
- [`bin/` pipeline script index](https://github.com/hivecommons/hive/blob/v5/bin/README.md) — map of the deterministic pipeline and operational scripts, grouped by function.
- [Dashboard API reference](https://github.com/hivecommons/hive/blob/v5/src/docs/api-reference.md) — pragmatic route index for dashboard and hub endpoints; one page per area under `api-reference/` (health, auth, configuration, agents, ACMM, cost, knowledge, contribute, nous, inception, beads, misc, hub SaaS, hub server).
- [Dashboard OpenAPI spec](https://github.com/hivecommons/hive/blob/v5/dashboard/openapi.json) — machine-readable REST API reference for integrations.
- [ioscan status](https://github.com/hivecommons/hive/blob/v5/src/docs/ioscan.md) — the untrusted-input scanner/canary feature (live and default-on in v4).
- [Deployment scripts](https://github.com/hivecommons/hive/blob/v5/src/deploy/README.md) — inventory of deployment helpers, including dashboard TTY panes and `hive-panes`.

## Contributors and access

- [Getting started as a first-time contributor](https://github.com/hivecommons/hive/blob/v5/docs/getting-started-contributing.md) — the end-to-end path for a first code or documentation contribution, tying the reference docs together and answering the Hive-specific questions they don't.
- [Local development](https://github.com/hivecommons/hive/blob/v5/docs/development.md) — the local workflow for contributing to the Go codebase on `v4`: prerequisites, build, and test loop.
- [ClankeR contributor relay](/docs/hive/contributor-relay) — local contributor setup, multi-hub subscriptions, moving a relay to another machine, and role requests.
- [Hive-curated good first issues](https://github.com/hivecommons/hive/blob/v5/src/docs/good-first-issue.md) — find or configure contributor-friendly work, welcome comments, relay links, and qualification rules.
- [Backend smoke](https://github.com/hivecommons/hive/blob/v5/src/docs/backend-smoke.md) — **CI-maintainer reference, not an operator task:** interpret CLI integration canaries and their failure reports.
- [CLI pins and the automated pin bump](https://github.com/hivecommons/hive/blob/v5/src/docs/cli-pins.md) — **Maintainer:** update pinned CLI versions/digests through tested, labelled PRs.
- [Contributor trust tiers and delegated agent roles](https://github.com/hivecommons/hive/blob/v5/src/docs/contributor-trust-and-roles.md) — newcomer/contributor/trusted/merger/advisor semantics, **Acting as**, grants, and delegatable roles.
- [Credly badges](https://github.com/hivecommons/hive/blob/v5/src/docs/credly-badges.md) — planned integration design; currently a placeholder mapping only.
- [Battle Log and Hive of the Week](https://github.com/hivecommons/hive/blob/v5/src/docs/hive-of-the-week.md) — the public showpiece feed for leaderboard pages: scrubbed activity feed, the featured project with embed snippets, and the Gource log.
- [Contributor social cards](https://github.com/hivecommons/hive/blob/v5/src/docs/social-cards.md) — public cacheable 1200×630 SVG cards and share landing pages for players, achievements, and leaderboards.

## Configuration and agents

- [Agent configuration](/docs/hive/agent-configuration) — agent fields, methods, models, pins, cadences, caveman mode, ACMM packs, and live-linked `definition_source` (with its seed-only trust model).
- [Formal verification](https://github.com/hivecommons/hive/blob/v5/src/docs/formal-verification.md) — the optional L5/L6 `quality.formal` capability for agent-authored Spin/Promela models, reporting-only CI, and deduplicated counterexample issues.
- [Advisory digest](https://github.com/hivecommons/hive/blob/v5/src/docs/advisory.md) — what the digest shows (`max_findings`, `show_all`), how stale findings are marked unverified, and which positive signals retire findings.
- [Advisory digest staleness](https://github.com/hivecommons/hive/blob/v5/src/docs/advisory-staleness.md) — when the hub raises the stale-advisory pill and alert, the gates that deliberately suppress it (undelivered App, App cannot write, all agents quiet), and the admin diagnostics that measure hidden staleness.
- [Guide flow-health diagnosis](https://github.com/hivecommons/hive/blob/v5/src/docs/guide-flow-health.md) — the `HIVE_FLOW:` kick signal and its field contract (`surge`, `mttm_sample`, `oldest_actionable`, …), the surge-coach lens that prioritizes a documentation finding under sustained congestion, and the bucketed finding/follow-up policy, without a new agent, timer, or permission grant.
- [Governor mode thresholds](https://github.com/hivecommons/hive/blob/v5/src/docs/governor-thresholds.md) — how idle/quiet/busy/surge thresholds scale with repo count, the `threshold_scaling` curves, and when explicit thresholds win.
- [Large-spoke scale envelope](https://github.com/hivecommons/hive/blob/v5/src/docs/scale-envelope.md) — understand tested backlog scale, prompt limits, caching, and configurable versus fixed caps.
- [Supervisor agent](https://github.com/hivecommons/hive/blob/v5/src/docs/supervisor.md) — supervisor policy modes, bead roles, and when to enable the orchestration lane.
- [Telemetry agent](https://github.com/hivecommons/hive/blob/v5/src/docs/telemetry.md) — the L5/L6-only opt-in observability agent, ACMM level gating, and the `project_observability` opt-in flow.
- [NPS feedback prompt](https://github.com/hivecommons/hive/blob/v5/src/docs/nps.md) - the dashboard's opt-in NPS question: what is collected (no user identity), how it reaches the hub (directly, or through the opt-in relay for standalone hives), why only hub admins can read it, and the `hub.nps_enabled` / `HIVE_NPS_ENABLED` switch.
- [Operations agent](https://github.com/hivecommons/hive/blob/v5/src/docs/operations.md) — the L5/L6-only opt-in operational-readiness agent (health checks, SLOs, runbooks), ACMM level gating, and the `project_observability` opt-in flow.
- [Custom dashboard stylesheets](https://github.com/hivecommons/hive/blob/v5/src/docs/custom-stylesheets.md) — operator-supplied CSS for the dashboard and public snapshot.
- [Branding a hive](https://github.com/hivecommons/hive/blob/v5/src/docs/branding.md) — persistent per-deployment name, mark, and colours via `<data>/branding/branding.json` and `custom.css` (`HIVE_BRANDING_JSON`/`HIVE_BRANDING_CSS`); distinct from the per-request `?style=` stylesheets above.
- [Portable AgentDefinition format](https://github.com/hivecommons/hive/blob/v5/src/AGENT-DEFINITION.md) — standalone YAML schema for importing/exporting agent definitions.
- [Knowledge connectors](https://github.com/hivecommons/hive/blob/v5/src/docs/knowledge-connectors.md) — **Owner configuration:** connect, validate, and sync external document/wiki sources; includes scope and API reference.
- [Knowledge curator](https://github.com/hivecommons/hive/blob/v5/src/docs/knowledge-curator.md) — configure fact extraction, sources, vaults, document imports, code maps, and retention.
- [Knowledge confidence scoring](https://github.com/hivecommons/hive/blob/v5/src/docs/knowledge-confidence.md) — interpret confidence badges and score explanations.
- [Knowledge lifecycle states](https://github.com/hivecommons/hive/blob/v5/src/docs/knowledge-lifecycle.md) — approve, deprecate, or supersede facts and keep stale knowledge out of prompts.
- [Scoped knowledge table of contents](https://github.com/hivecommons/hive/blob/v5/src/docs/knowledge-toc.md) — **Developer reference:** list and read knowledge through API/MCP.
- [Public knowledge MCP endpoint](/docs/hive/public-knowledge-mcp) — the owner-switched, read-only `POST /mcp/knowledge` surface that lets any external agent (Goose, Claude, Copilot) read a hive's operational knowledge without a session; what is and is not exposed, and client configuration.
- [Skill registry](https://github.com/hivecommons/hive/blob/v5/src/docs/skills.md) — opt agents into reusable skills; covers registry/repository lookup, live reload, and whole-skill size limits.
- [House style](https://github.com/hivecommons/hive/blob/v5/src/docs/house-style.md) — the short how-to-change section that opens every kick; repo `HIVE_STYLE.md` > `project.style` > built-in, size-capped and ioscan-checked.
- [AGENTS.md repo instructions](https://github.com/hivecommons/hive/blob/v5/src/docs/agents-md.md) — add repository instructions and skills to kicks; requires a configured local checkout.
- [Agent peer-awareness logging (pluk)](https://github.com/hivecommons/hive/blob/v5/src/docs/agent-logging.md) — pluk log format, `hive-panes`, availability, and retention.
- [Experiment Lab (Nous)](https://github.com/hivecommons/hive/blob/v5/src/docs/strategy-lab.md) — experiment lifecycle, dashboard/API configuration, fast-fail bounds, and the gate-decision flow. No `nous:` block in `hive.yaml`.
- [Hive-self background experiments (Nous)](https://github.com/hivecommons/hive/blob/v5/src/docs/nous-hive-self-experiments.md) — background-only self-improvement experiment mode, outcome questions (including user satisfaction), cohorts, guardrails, and auto-revert. Hidden from spoke dashboards and Experiment Lab.
- [GitHub write surface](https://github.com/hivecommons/hive/blob/v5/src/docs/github-write-surface.md) — inventory agent and system writes, their audit coverage, and opt-in per-lane restrictions.
- [Compact GitHub CLI reads (`hive-gh`) and one-line denials](https://github.com/hivecommons/hive/blob/v5/src/docs/github-cli-compact.md) — **Agent/developer reference:** compact output fields, full-read escape hatch, and denial codes.
- [GitHub App setup](https://github.com/hivecommons/hive/blob/v5/src/docs/github-app-setup.md) — the Forge App on GitHub and GitHub Enterprise: app creation, permissions, Setup URL, and `/gh-setup`.
- [Forge setup: GitLab, Gitea, and Forgejo](https://github.com/hivecommons/hive/blob/v5/src/docs/forge-app-setup.md) — **Adapter/reference only:** explains configured adapter surfaces and why a complete hive still requires GitHub.
- [ACMM policy matrix](/docs/hive/acmm-policy-matrix) — capability levels and policy modes.
- [ACMM level-up advisor](https://github.com/hivecommons/hive/blob/v5/src/docs/acmm-advisor.md) — the advisory-only `pkg/acmmadvisor` computation behind `GET /api/acmm-recommendation`: the signals it measures, per-level thresholds, and why it never changes the applied level.
- [ACMM waivers](https://github.com/hivecommons/hive/blob/v5/src/docs/acmm-waivers.md) — record criteria satisfied outside the repo; a waiver can restore green status, never advance a level.
- [Inception](https://github.com/hivecommons/hive/blob/v5/src/docs/inception.md) — operator guide to the L1 brainstorm/inception workflow: phases, API, and template variables.
- [Planning intelligence](https://github.com/hivecommons/hive/blob/v5/src/docs/planning-intelligence.md) — how a large GitHub issue becomes an epic the architect lane decomposes into child beads, the human plan-review gate that withholds those children until approved, and stall-replan.
- [Review swarm](https://github.com/hivecommons/hive/blob/v5/src/docs/review-swarm.md) — the five review perspectives, the verdict collector and its report contract, and the opt-in merge-gate integration and bounded auto-fix cycle for review findings.
- [Swarm mode](https://github.com/hivecommons/hive/blob/v5/src/docs/swarm.md) — focusing the hive on one repository for a bounded window: Discord announcements, theming (`swarm:` config, `HIVE_SWARM_EVENT_NAME` / `HIVE_SWARM_CALL_TO_ARMS`), the `/api/leaderboard/swarm` endpoint and scoring.
- [Review evidence bundle](https://github.com/hivecommons/hive/blob/v5/src/docs/review-evidence.md) — the per-PR evidence bundle schema (v1), canonical hash, Ed25519 signing, offline verification, and retention design.
- [Evidence reporting](https://github.com/hivecommons/hive/blob/v5/src/docs/evidence.md) — the guarded control-arm (`control_window: on|off`) evidence report: per-repository outcome comparison, the minimum-denominator rule, and why it is reporting groundwork rather than an enabled experiment.
- [SOC 2 control mapping (not a compliance claim)](https://github.com/hivecommons/hive/blob/v5/src/docs/soc2-control-mapping.md) — maps common auditor change-management questions to bundle fields, with sample policy language and the gaps Hive does not cover.
- [Duplicate PR sweep](https://github.com/hivecommons/hive/blob/v5/src/docs/duplicate-sweep.md) — **Opt-in; recommendations only:** identify overlapping PRs and suggest which to keep. Never closes them automatically.
- [Upstream watch](https://github.com/hivecommons/hive/blob/v5/src/docs/upstream-watch.md) — the opt-in `upstream_watch` block (per-repo `upstream` or the GitHub fork parent, `sources`, `pr_labels`, `max_issues_per_run`, `label`) and the poll loop it drives: classification, fork applicability, labelled `upstream:` issues with a hidden `upstream-ref` marker, dedupe and dismissal, and the `/data/upstream-watch.json` state file.
- [Hold-gated review queue triage](https://github.com/hivecommons/hive/blob/v5/src/docs/review-queue-triage.md) — the triage-class policy for the human review queue (T0 fixes, T1 behavior-adjacent, T2 additive), the shipped `review_class` presentational sort in `last-actionable.json` and the dashboard PR list, and the open mechanism options awaiting maintainer decisions (#6183).
- [Retro lane](https://github.com/hivecommons/hive/blob/v5/src/docs/retro-lane.md) — the opt-in (`retro.enabled`) post-completion pass that reconstructs a record for each closed bead and flags patterns such as excessive fix attempts or kicks; deterministic by default, with LLM analysis separately opt-in.
- [Work sources](/docs/hive/work-sources) — `governor.work_source`: the four `type` options (`github` default, `github_projects`, `linear`, `jira`), Jira Cloud/Data Center deployment modes, config fields, required credentials, and priority/hold-label mapping per source.
- [Linear agent integration](https://github.com/hivecommons/hive/blob/v5/src/docs/linear-agent.md) — joining a Linear workspace as a first-class agent member: webhook verification, the 10-second session acknowledgement, which hive agent takes sessions, and narrating completion back as agent activities.
- [Lite enrollment](https://github.com/hivecommons/hive/blob/v5/src/docs/lite-enrollment.md) — the zero-repo-secret on-ramp: `hivectl enroll OWNER/REPO` adds a repo to a spoke's `project.repos`, with prerequisites and the hosted lite-spoke path.
- [ACMM policy fragments](https://github.com/hivecommons/hive/blob/v5/examples/acmm/README.md) — per-level ACMM policy references.
- [Sandbox isolation and agent guardrails](https://github.com/hivecommons/hive/blob/v5/src/docs/sandbox-isolation.md) — isolation layers and operator guardrail notes.
- [Per-agent gh restrictions](https://github.com/hivecommons/hive/blob/v5/config/restrictions/README.md) — file-based wrapper denials in `/etc/hive/restrictions/`.
- [Podman rootless CI](https://github.com/hivecommons/hive/blob/v5/src/docs/podman-rootless-ci.md) — rootless Podman contract for `contribute-hive`.
- [Podman Quadlet `.kube` compatibility spike](https://github.com/hivecommons/hive/blob/v5/src/docs/podman-quadlet-kube-spike.md) — why the standalone Kubernetes overlay is not a safe direct source for Podman units.
- [Podman ownership and cleanup contract](https://github.com/hivecommons/hive/blob/v5/src/docs/podman-ownership-cleanup.md) — the labels that mark a resource Hive-owned and the guard that keeps Podman/Buildah cleanup from reaching the operator's other containers, Distroboxes, and images.
- [Podman preflight: SELinux, mounts, secrets, and ports](https://github.com/hivecommons/hive/blob/v5/src/docs/podman-preflight-host.md) — read-only diagnostics for SELinux state and mount labeling, configuration/secrets readability, and published host-port availability, with remediation that never disables SELinux or widens a secret.
- [Podman preflight: subordinate IDs, graphroot, and networking](https://github.com/hivecommons/hive/blob/v5/src/docs/podman-preflight-ids.md) — read-only diagnostics for rootless subordinate UID/GID delegation, unsupported (NFS and other distributed) container storage, and the rootless network backend/helper, with remediation that never edits `/etc/subuid` or `/etc/subgid`.
- [CLI backend setup](https://github.com/hivecommons/hive/blob/v5/docs/backend-setup.md) — setup notes for Claude, Copilot, Goose, Bob, Pi, Codex, and Aider.
- [Backend support tiers and acceptance bar](https://github.com/hivecommons/hive/blob/v5/src/docs/backend-support-tiers.md) — **Developer policy:** qualify a CLI backend's confinement, authentication, unattended operation, and required evidence.
- [Gap analysis: Claude Managed Agents](https://github.com/hivecommons/hive/blob/v5/src/docs/backend-gap-claude-managed-agents.md) — **Design/evaluation:** compare hosted execution with the acceptance bar; direct GitHub egress limits authority to advisory.
- [Gap analysis: OpenAI Agents API](https://github.com/hivecommons/hive/blob/v5/src/docs/backend-gap-openai-agents-api.md) — **Design/evaluation:** assess hosted tools, metering, and write paths outside Hive's proxy.
- [Omnigent CLI contract and policy composition](https://github.com/hivecommons/hive/blob/v5/src/docs/backend-omnigent-cli-contract.md) — **Experimental/unconfined backend reference:** launch contract, credentials, safety flags, refusal gate, and policy composition.
- [Inference backends](https://github.com/hivecommons/hive/blob/v5/docs/inference-backends.md) — vLLM, llm-d, LiteLLM, and Model Gateway troubleshooting.
- [apiproxy](https://github.com/hivecommons/hive/blob/v5/src/docs/apiproxy.md) — Anthropic-compatible proxy logging and deployment notes.
- [Outreach anti-spam ruleset](https://github.com/hivecommons/hive/blob/v5/docs/outreach-antispam.md) — the deduplication and anti-spam rules the outreach agent operates under across awesome lists, project issues, directories, and community threads.
- [v1 to v2 migration](https://github.com/hivecommons/hive/blob/v5/docs/migration-v1-v2.md) — **historical.** Both ends of this migration are retired; v2 was retired in August 2026. Kept for operators still on v1, who should read it alongside [v2 → v4 migration](https://github.com/hivecommons/hive/blob/v5/src/docs/migration-v2-v4.md) above. New deployments do not need it.

## Architecture and design

- [What Hive is](https://github.com/hivecommons/hive/blob/v5/src/docs/what-is-hive.md) — product fit, hosting choices, concepts, permission levels, related projects, and community entry points.
- [Architecture](/docs/hive/architecture) — process model, governor loop, guardrails, hub/spoke, and walkthrough.
- [Automatic repo ACMM onboarding reconciler](https://github.com/hivecommons/hive/blob/v5/src/docs/design/repo-acmm-onboarding.md) — proposed design for per-repo ACMM targets, gap-to-work reconciliation, human hand-off, waivers, and anti-gaming controls (RFC #6235).
- [Hive federation design](https://github.com/hivecommons/hive/blob/v5/docs/federation-design.md) — the multi-hive registry: live `/api/hives` endpoints, project onboarding, contributor flow across hubs, and what remains future design work.
- [Public roadmap](/docs/hive/roadmap) — available foundations, current/future direction, release-line status, completed work, and dated decision evidence. Not a delivery promise.
- [Integrations](https://github.com/hivecommons/hive/blob/v5/src/docs/integrations.md) — one page of logos and status (Supported / Opt-in / Planned) for agent backends, work sources, forges, sandboxes and upstream projects.
- [Landscape and positioning](/docs/hive/landscape) — how Hive's operations-plane design compares to nearby agentic orchestration tools, with public references per project. Explicitly time-sensitive; check the conducted date in its header before quoting product details.
- [CNCF sandbox onboarding status](https://github.com/hivecommons/hive/blob/v5/src/docs/cncf-sandbox-onboarding.md) — repo-local map of the onboarding tracker and repository evidence (LICENSE, governance, security, OWNERS, DCO).
- [CNCF reference architecture](https://github.com/hivecommons/hive/blob/v5/src/docs/cncf-reference-architecture.md) — CNCF submission/reference template.
- [Podman CI runner map](https://github.com/hivecommons/hive/blob/v5/src/docs/podman-ci-runner-map.md) — measured hosted-runner capabilities and which Podman lane goes where; SELinux is the only lane needing non-hosted infrastructure.
- [CI runner labels](https://github.com/hivecommons/hive/blob/v5/src/docs/ci-runner-labels.md) — how `runs-on:` picks the self-hosted fleet, why a fork must degrade to a GitHub-hosted runner, and the one variable `hivecommons` sets.
- [Gate-integrity invariants for agent lanes](https://github.com/hivecommons/hive/blob/v5/src/docs/design/gate-integrity-invariants.md) — proposed write-gate rules for agent lanes: no history rewrites on branches a lane did not create, no sign-off on other authors' commits, and hold-gated demotion for gate manipulation.
- [Crux: the agent runtime boundary](https://github.com/hivecommons/hive/blob/v5/src/docs/design/crux.md) — **Design record:** runtime separation, module boundary, staged rollout, and naming decision.
- [Design documents](https://github.com/hivecommons/hive/blob/v5/src/docs/design/README.md) — browse records labelled shipped, partly shipped, design-only, or historical; proposals are not current behavior.
- [Discord reaction-consensus issue promotion](https://github.com/hivecommons/hive/blob/v5/src/docs/design/discord-issue-promotion.md) — proposed design for turning Discord reaction consensus into an audited Hive label write that composes with `project.issue_filter.require_labels` (RFC #6239).
- [GitHub @-mention triggers](https://github.com/hivecommons/hive/blob/v5/src/docs/design/github-mention-triggers.md) — **v6 development branch only:** summon agents from issues/PRs with the existing permission guards; not a v5 feature.
- [Podman Compose-provider selection spike](https://github.com/hivecommons/hive/blob/v5/src/docs/podman-compose-provider-spike.md) — why `podman compose` must name its provider explicitly, and which provider needs no Docker tooling.
- [Sourcing token metering from ccusage behind a tokens.Source seam](https://github.com/hivecommons/hive/blob/v5/src/docs/design/token-metering-ccusage.md) — proposed design for ccusage-backed token metering with attribution preservation, Bob fallback, and cutover diagnostics (RFC #6234).
- [Trajectory review](https://github.com/hivecommons/hive/blob/v5/src/docs/trajectory-review.md) — trajectory safety lane and review signals.
- [Central stage engine implementation plan](https://github.com/hivecommons/hive/blob/v5/src/docs/stage-engine-plan.md) — companion to [ADR-0025](/docs/hive/adr/0025-central-stage-engine): the PR-by-PR plan that landed `pkg/stageengine` as the single writer of `stage/*` labels.
- [Podman Quadlet `.container`/`.pod` spike](https://github.com/hivecommons/hive/blob/v5/src/docs/podman-quadlet-container-pod-spike.md) — feasibility result for explicit Quadlet units: readiness via `Notify=healthy`, the startup-timeout trap, and what the generator does not validate.

## Historical/design notes

Some documents describe planned or design-only work rather than live features. Those pages are marked at the top, for example [Credly badges](https://github.com/hivecommons/hive/blob/v5/src/docs/credly-badges.md). The longer-form design records under [`design/`](https://github.com/hivecommons/hive/blob/v5/src/docs/design/README.md) are a whole directory of these: each entry in that index carries a status, because those pages are the reference record of a decision and are deliberately not rewritten as later stages ship.

## Security (v5)

- [Securing your hive: a first-time operator's guide](/docs/hive/securing-your-hive) — decision-oriented walkthrough of ACMM level, reporter trust, and repo scope: starting postures, the #9758/#9762 real-world walk-through, Q&A, a pre-L6 checklist, and a glossary.
- [Security model — agent safety inventory](/docs/hive/security-model) — threat/control/verification table; runtime, context, credential, code-admission, contributor, detection, platform and human-control layers; residual gaps and running-hive audit steps.
- [Hive trust levels vs Copilot assisted permissions](/docs/hive/copilot-permissions-comparison) — compare per-action permissions with Hive's levels, lanes, proxy, holds, and review gates.
- [Compliance controls](https://github.com/hivecommons/hive/blob/v5/src/docs/compliance.md) — map framework controls to settings, inspect posture, and understand coverage gaps. **Not a certification.**
- [Security threat model](/docs/hive/security-threat-model) — actors, boundaries, layered defenses, known gaps, and reporting.
- [OSS Scanner threat model](https://github.com/hivecommons/hive/blob/v5/.oss-scanner/threat_model.md) — the scanner-facing companion kept at the repository root with [its Dockerfile](https://github.com/hivecommons/hive/blob/v5/.oss-scanner/Dockerfile): where untrusted input enters, which packages matter most, how to exercise a hive offline, and the severity rubric used to triage findings from [Anthropic's OSS Scanner](https://red.anthropic.com/oss-scanner/).
- [Security response process](https://github.com/hivecommons/hive/blob/v5/src/docs/security-response.md) — report a vulnerability, identify responders, follow handling/escalation steps, and understand commitments and limits.
- [CNCF TAG-Security self-assessment](https://github.com/hivecommons/hive/blob/v5/src/docs/security-self-assessment.md) — the CNCF Incubation self-assessment artifact: metadata, actors/actions/goals, critical security components with file/line citations, project compliance, secure development practices, vulnerability response process, and the three most significant known weaknesses stated plainly.
- [ioscan red-team evaluation](https://github.com/hivecommons/hive/blob/v5/src/docs/ioscan-red-team.md) — measured adversarial/benign test results, false positives, known gaps, and containment evidence.
- [CNCF General Technical Review](https://github.com/hivecommons/hive/blob/v5/src/docs/general-technical-review.md) — the full Day 0/1/2 GTR questionnaire answered against this repository, cited file-by-file, with every currently-unanswerable question marked `[NEEDS OPERATOR INPUT]` rather than guessed at.
- [Heartbeat bearer cutover](https://github.com/hivecommons/hive/blob/v5/src/docs/heartbeat-bearer-cutover.md) — retiring the fleet-wide heartbeat bearer, whose possession proves only "some provisioned spoke" and lets any spoke heartbeat as any hive, in favour of the per-hive key — without re-provisioning the fleet, and the precondition that gates the removal.
- [Rootless Podman startup and exit-77 behavior](https://github.com/hivecommons/hive/blob/v5/src/docs/podman-rootless-startup-spike.md) — measured rootless matrix: fail-closed exit 77, gate installation under `--cap-add NET_ADMIN`, proven interception, and what is still unproven.
- [IPv6 egress-gate bypass](https://github.com/hivecommons/hive/blob/v5/src/docs/podman-ipv6-egress-bypass.md) — measured: the forced-proxy redirect is IPv4-only, so agent traffic to `:443` over IPv6 never meets it (5 IPv6 connections, 0 redirects; 5 IPv4 connections, 5 redirects, same run). Names the fix slice.
- [Rootful Podman egress-gate baseline](https://github.com/hivecommons/hive/blob/v5/src/docs/podman-rootful-egress-baseline.md) — the rootful baseline the rootless result is measured against: fail-closed exit 77, redirect and ambient-capability evidence, and `SO_MARK` isolated from the owner-UID exemption.
- [Podman support matrix: rootful/rootless × enforcing/advisory](https://github.com/hivecommons/hive/blob/v5/src/docs/podman-support-matrix.md) — the support statement for standalone Hive under Podman: which of the four combinations is supported, experimental, or a deliberate unenforced choice, what evidence settles each, and the gaps carried forward.
- [Release qualification: SELinux-enforcing Podman](https://github.com/hivecommons/hive/blob/v5/src/docs/podman-selinux-release-qualification.md) — **Release maintainer:** qualify mounts, labels, and secret access on an enforcing host; unavailable evidence stays UNEXECUTED.
- [`hive-data` under SELinux enforcing](https://github.com/hivecommons/hive/blob/v5/src/docs/podman-volume-persistence.md) — understand volume labels, ownership, persistence, destructive actions, and the difference from bind-mount relabeling.
- [SELinux AVC evidence, and the hive-launch group secret](https://github.com/hivecommons/hive/blob/v5/src/docs/podman-selinux-avc-evidence.md) — **Evidence reference:** inspect actual access-denial records and group-secret behavior rather than inferring safety from exit status.
- [Standalone Hive under Podman: the Quadlet units](https://github.com/hivecommons/hive/blob/v5/src/docs/podman-standalone-quadlet.md) — operate Hive and its gateway in either root mode; includes health, port-boundary, and Docker-free execution evidence.
- [Quadlet lifecycle: stop, start, restart, recreate, and boot persistence](https://github.com/hivecommons/hive/blob/v5/src/docs/podman-quadlet-lifecycle.md) — interpret lifecycle states and probe results; reboot persistence is not inferred from `is-enabled`.

- [Host-execution capability matrix](https://github.com/hivecommons/hive/blob/v5/src/docs/podman-host-execution-gap.md) — **Host-scoped evidence:** see measured runtime/kernel capabilities and why some reboot tests were not executed.
- [Quadlet update and rollback: moving the image, and getting back](https://github.com/hivecommons/hive/blob/v5/src/docs/podman-quadlet-update-rollback.md) — update or roll back by digest with the helper; includes failed-update timing and data-preservation evidence in both root modes.

- [Health-aware auto-update: whether it works on this unit, and what it costs](https://github.com/hivecommons/hive/blob/v5/src/docs/podman-auto-update.md) — **Opt-in:** inspect rollback behavior, recurring bad-update downtime, digest-pin precedence, and measured results in both root modes.
- [Architecture Decision Records](/docs/hive/adr/readme) — lightweight ADR process and records 0001-0017.
- [Intent verification](https://github.com/hivecommons/hive/blob/v5/src/docs/intent-verification.md) — tier-based change authorization for merge eligibility.
- [Rootless Podman CI seam](https://github.com/hivecommons/hive/blob/v5/src/docs/podman-rootless-ci.md) — documented test intent and static contract for contributor-container runtime handling.
- [Release-line carry-forward guard](https://github.com/hivecommons/hive/blob/v5/src/docs/release-line-guard.md) — the nine workflows pinned to hardcoded version-branch names, the single source of truth they are asserted against, and what to edit when a new release line is cut.
