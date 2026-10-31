> **Synced from Hive.** This page is pulled from [hivecommons/hive@v5](https://github.com/hivecommons/hive/blob/v5/src/docs/adr/0003-acmm-autonomy-levels.md) during the docs build. Edit the canonical source in the Hive repository.

# ADR-0003: ACMM autonomy levels

Status: Accepted (retroactive)

**ACMM** is the **AI Codebase Maturity Model**. Its levels are an operator's
autonomy choice; a mode is one agent's allowed actions. In operator terms,
`ADVISORY` means observe, `ISSUES_ONLY` (measured) means file issues,
`ISSUES_AND_PRS` (holdgated) means propose code without merging, and
`ISSUES_PRS_MERGE` (full) permits merging subject to the merge gates.
The [policy matrix](/docs/hive/acmm-policy-matrix) is the current per-level roster,
including the review-only `converse` capability.

## Context

Hive needs one operator-facing control for how autonomous agents may be. The
reference architecture describes ACMM as the human-selected dial that maps to
per-agent modes, and the policy matrix defines which agents may only advise,
file issues, open hold-gated PRs, or auto-merge at each level
([architecture §6](/docs/hive/architecture#6-acmm--controlling-agent-autonomy),
[ACMM policy matrix](/docs/hive/acmm-policy-matrix)). The same modes feed the
layered guardrails in [architecture §5](/docs/hive/architecture#5-layered-guardrails-defense-in-depth).

## Decision

Use ACMM levels L1-L6 as the public autonomy model. Levels map
deterministically to per-agent modes: advisory, issues-only/measured,
issues-and-PRs/holdgated, and issues-PRs-merge/full. Raising the level is a
human decision. `supervisor` remains advisory at every level, and `brainstorm`
never receives GitHub write authority.

## Consequences

Operators can reason about fleet risk through one level instead of many
independent toggles. The same mode value drives prompt templates, credential
scope, CLI deny lists, and proxy rules, which reduces configuration drift. The
cost is that unusual deployments may need explicit per-agent overrides, and any
new agent role must be placed deliberately in the matrix before it receives
write or merge authority.
