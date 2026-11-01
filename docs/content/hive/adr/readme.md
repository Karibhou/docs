> **Synced from Hive.** This page is pulled from [hivecommons/hive@v5](https://github.com/hivecommons/hive/blob/v5/src/docs/adr/README.md) during the docs build. Edit the canonical source in the Hive repository.

# Architecture Decision Records

Hive uses lightweight Architecture Decision Records (ADRs) to capture decisions
that shape the system's security model, operating model, and long-lived APIs.
ADRs are intentionally short: enough context to understand the choice, the
chosen direction, and consequences for future changes.

**Audience and reading route:** maintainers use these records for rationale
and implementation contracts, not installation steps. Operators should start
with [Securing your hive](/docs/hive/securing-your-hive) or
[Troubleshooting](/docs/hive/troubleshooting). Read a record's current-state note
before its historical context or amendments. **Accepted** records document a
decision, not proof that a control is enabled on your deployment; **Proposed**
records are not setup instructions. Retroactive/back-filled records explain
choices already present when recorded.

Suggested first records: [autonomy levels](/docs/hive/adr/0003-acmm-autonomy-levels) for
permission boundaries, [network enforcement](/docs/hive/adr/0002-mitm-proxy-network-enforcement)
for the proxy, [work ledger](/docs/hive/adr/0004-beads-work-ledger) for agent coordination,
and [escalation](/docs/hive/adr/0019-escalation-over-stalling) for human decisions. The
numbered list remains the complete chronological index.

## Process

1. Copy the template below to `NNNN-short-title.md` using the next number.
2. Write in present tense for new decisions. For historical decisions, mark the
   status as `Accepted (retroactive)` or `Accepted (back-filled)` and cite the existing docs or code.
3. Keep each ADR focused on one decision. If a later change supersedes it, add a
   new ADR and update the older status to `Superseded by ADR-NNNN`.
4. Link ADRs from related documentation when they become operator-facing.

## Template

```markdown
# ADR-NNNN: Title

Status: Proposed | Accepted | Accepted (retroactive) | Accepted (back-filled) | Superseded by ADR-NNNN

## Context

What problem, constraint, or trade-off forced a durable architecture decision?

## Decision

What did we decide?

## Consequences

What becomes easier, harder, safer, or riskier because of this decision?
```

## Records

All records below are **Accepted** (including retroactive/back-filled records)
unless explicitly marked **Proposed**. ADR-0015/0016 preserve historical CSP
sequencing; ADR-0019/0025 give their current action/mode contract first.

- [ADR-0001: Record architecture decisions](/docs/hive/adr/0001-record-architecture-decisions)
- [ADR-0002: MITM proxy network enforcement](/docs/hive/adr/0002-mitm-proxy-network-enforcement)
- [ADR-0003: ACMM autonomy levels](/docs/hive/adr/0003-acmm-autonomy-levels)
- [ADR-0004: Beads work ledger](/docs/hive/adr/0004-beads-work-ledger)
- [ADR-0005: Forge-neutral source control interface](/docs/hive/adr/0005-forge-abstraction)
- [ADR-0006: Planning intelligence with human review](/docs/hive/adr/0006-planning-intelligence)
- [ADR-0007: Mint short-lived scoped agent credentials](/docs/hive/adr/0007-token-mint)
- [ADR-0008: Redact untrusted kick input with visible markers](/docs/hive/adr/0008-ioscan-untrusted-input)
- [ADR-0009: Trajectory review lane](/docs/hive/adr/0009-trajectory-review)
- [ADR-0010: Escalation circuit breaker for CI fix loops](/docs/hive/adr/0010-escalation-circuit-breaker)
- [ADR-0011: Knowledge system for durable agent context](/docs/hive/adr/0011-knowledge-system)
- [ADR-0012: Skill registry and BYO-agent contract](/docs/hive/adr/0012-skill-registry)
- [ADR-0013: CEL triggers over normalized forge events](/docs/hive/adr/0013-cel-triggers)
- [ADR-0014: Hub/spoke fleet over heartbeat callbacks](/docs/hive/adr/0014-hub-spoke)
- [ADR-0015: Scope `style-src` as two directives and accept inline style attributes](/docs/hive/adr/0015-csp-style-src-scope)
- [ADR-0016: Scope `script-src` as two directives, close the element half with hashes](/docs/hive/adr/0016-csp-script-src-scope)
- [ADR-0017: Quadlet `.container`/`.pod` units as the Podman persistent lifecycle](/docs/hive/adr/0017-podman-quadlet-lifecycle)
- [ADR-0018: Shared dashboard design tokens and component layer](/docs/hive/adr/0018-dashboard-design-tokens)
- [ADR-0019: Escalate to direction, spec, signal, or meta-issue instead of stalling](/docs/hive/adr/0019-escalation-over-stalling)
- [ADR-0020: Spek continuous convergence](/docs/hive/adr/0020-spek-continuous-convergence)
- [ADR-0022: Opt-in redemption of earned Codex resets](/docs/hive/adr/0022-opt-in-earned-codex-reset-redemption)
- [ADR-0023: Hive may merge PRs whose author could merge them](/docs/hive/adr/0023-trusted-author-automerge)
- [ADR-0024: Provider credential lifecycle](/docs/hive/adr/0024-provider-credential-lifecycle) — **Proposed**, not a credential-pool or refresh-service setup guide.
- [ADR-0025: One stage engine derives and writes every `stage/*` label](/docs/hive/adr/0025-central-stage-engine)
- [ADR-0026: Sandbox runtime selection](/docs/hive/adr/0026-sandbox-runtime-selection) (Proposed)
