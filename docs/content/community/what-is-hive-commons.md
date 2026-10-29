# What is Hive Commons?

**Hive Commons** is a family of open source tools for getting real work out of AI coding agents, with **Hive** as the flagship tool. The rest of the family is listed afterwards.

## What Hive is

**Hive** is a **co-maintainer system** for your GitHub projects. It lets you **run governed agents** against real project work, continuously. Point it at a repo and it watches the things that pile up — issues, pull requests, failing CI, CVEs, dependabot alerts — and sends AI coding agents (Claude, Copilot, Codex, Antigravity, Goose...) to deal with them: triage, fixes, reviews, releases. You decide how much it is allowed to do. **Agents do the chores, while you decide what matters.**

## "I already use an agent. How is this different?"

A terminal agent is a power tool: you hold it, aim it, and it stops when you stop. Hive is the workshop that runs the power tools for you — on three rules the industry is only now discovering:

1. **Short-lived agents.** Every task starts a fresh agent with a clean context and ends it. No "long-running" agent drifting for hours.
2. **External context.** What the agent needs to know lives outside the model — in your repo, your knowledge base, your audit trail — and is re-injected each time, so nothing is forgotten and nothing is hallucinated from stale memory.
3. **Prompts driven by deterministic facts.** The instructions an agent gets are templates filled from real data (the issue, the CI log, the diff, the trust level), not hand-tuned prose.

Around that, Hive:

- **Picks the work** from your real queue, not from a chat prompt.
- **Sets the limits in code.** Six trust levels from the **AI Codebase Maturity Model (ACMM)** — a framework for how much autonomy a codebase is ready to give agents ([levels](/docs/hive/acmm-policy-matrix) · [paper](https://arxiv.org/abs/2604.09388)): L1 advise-only → L6 merge on green CI. Each level gets exactly the GitHub permissions it needs and no more.
- **Checks before and after.** Deterministic filters decide what an agent may see; gates (tests, coverage, review, security) decide what may land. The model only makes the judgment calls in between.
- **Writes it all down.** Every action in an audit log, owned by a named human.
- **Runs around the clock** across many repos and many agents.

Deterministic where it can be, a model only where it must be — that hybrid is what makes the output trustworthy. Same agents you use today — governed, scheduled, scoped and accountable. The payoff: a solo or three-person project keeps up with a busy queue (the boring stuff shifts left), and a new contributor can start on curated work in minutes instead of spending weeks learning the codebase.

## Hub and spoke

- **Spoke** — one running Hive, serving your repo(s). It's where agents actually work. Runs on your Kubernetes cluster, Podman, or Docker Compose.
- **Hub** — the control plane for many spokes: registers, provisions, upgrades and watches them; fleet view, leaderboards, routes contributor compute to the hives that need it.

A spoke works alone. A hub is how you see and manage a fleet of them.

## Contributor relay: a swarm working on your behalf

Your own agents are only the start. The [**contributor relay**](/docs/hive/contributor-relay) lets anyone who wants to help your project **donate their compute and model tokens** without you handing out anything:

- **They bring their own agent.** A contributor runs one command on their laptop, cluster, or Compose box; it connects outbound to your hive, takes one curated task at a time, and runs *their* CLI with *their* model and *their* subscription.
- **Their secrets never reach you.** API keys and CLI logins stay on the contributor's machine. The hive never sees them.
- **Your forge settings never change.** Nobody is added as a collaborator. For each task the hive mints a short-lived, task-scoped GitHub token so the PR can be opened, then it expires. Revoke a contributor and their access is gone.
- **Your prompts, your limits.** Contributors work the queue you curated, under the same trust level, filters and gates as your resident agents. You decide which repos, labels and models are acceptable; they decide how to get it done.

The result is an **elastic swarm**: a three-person project can have a dozen contributors' agents grinding its backlog overnight, each accountable to a named human, and the maintainers still hold every merge decision. The hub's leaderboard credits the people who donated the work.

## Hive the project vs the hosted service

- **Hive the project**: Apache-2.0 code in the [hivecommons/hive](https://github.com/hivecommons/hive) repository. Run it yourself.
- **Hive the hosted service**: [hive.hivecommons.dev](https://hive.hivecommons.dev) — a hub we operate so you can onboard a spoke without a cluster. Same software, one deployment of it.

## Does Hive fit my project?

**Do I need a paid agent subscription?** No. Hive drives the agent CLIs you already have (Claude, Copilot, Codex, Antigravity, Goose) *or* any OpenAI-compatible model through its [Model Gateway](/docs/hive/agent-configuration#methods-subscription-clis-vs-self-hosted-inference) (OpenRouter key, no CLI login). Contributors can bring their own.

**Who tells it what to work on?** Your backlog does. The [Governor](/docs/hive/governor) reads your issues/PRs/CI, filters them deterministically (labels, areas, complexity), and only hands agents work you have allowed. You choose the areas (e.g. CI, deps, security, packaging) and the trust level. Nothing is invented.

**We require design discussion before non-trivial PRs.** That is a trust level, not a workaround: [*Measured* mode](/docs/hive/acmm-policy-matrix#policy-modes) = agents may only file findings and proposals as issues — no code, no PRs — so the discussion happens first; *Holdgated* = PRs are opened with a `hold` label and a human must review and release; *Full* (L6) = merge on green. Start at Measured. You never have to move up.

**Can it open PRs to our upstream repo?** Yes, if you install it there. Or run it on a fork ([`upstream_watch`](https://github.com/hivecommons/hive/blob/v5/src/docs/upstream-watch.md) keeps the fork current) and push reviewed PRs upstream yourself.

**Do maintainers have to run it?** A maintainer configures it (or uses the hosted hub). Optionally, outside contributors can work your curated queue through the [contributor relay](#contributor-relay-a-swarm-working-on-your-behalf) with their own models and compute, under your prompts and limits, without repo permissions.

**We already use AI PR reviewers (Copilot, cubic).** Keep them. Hive's main job is the maintenance work that then gets reviewed (triage, fixes, CI repair, deps, CVEs). It also ships its own [Reviewer agent](/docs/hive/acmm-policy-matrix) that reads your repo's conventions and leaves a verdict on each PR — it advises, it never merges on its own, and it sits alongside the reviewers you already run.

**Our AI policy needs an "Assisted-by" trailer.** [`governor.attribution_trailer`](/docs/hive/governor) (default on) stamps AI-assistance attribution on every commit.

**Showcase in 5 steps:** fork → pick one clear issue → set Hive to Holdgated on that area → review the PR it opens → push upstream if you like it. That is the intended first run.

## The rest of the family

| Project | What it does | Docs |
|---|---|---|
| [**Hive**](https://github.com/hivecommons/hive) — flagship | Governed agents that work real GitHub queues. | [Hive docs](/docs/hive/overview/introduction) |
| [**Crux**](https://github.com/hivecommons/crux) | The agent runtime inside Hive, split out for reuse: starts, supervises and sends work to AI coding agents. | [Crux docs](/docs/crux/overview/introduction) |
| [**Spektacular (Spek)**](https://github.com/hivecommons/spektacular) | Spec-driven development: markdown spek → reviewed plan → agent implementation. | [Spektacular docs](/docs/spektacular/overview/introduction) · [spektacular.dev](https://spektacular.dev) |
| [**hotshot**](https://github.com/hivecommons/hotshot) | Screenshots that land directly in an AI coding assistant's terminal. | [hotshot docs](/docs/hotshot/overview/introduction) |
| [**pluk**](https://github.com/hivecommons/pluk) | Structured event streaming for tmux sessions running AI coding agents. | [pluk docs](/docs/pluk/overview/introduction) |
| [**promptargs**](https://github.com/hivecommons/promptargs) | Template expansion for prompts across Claude Code, Copilot, Goose, Bob, and others. | [promptargs docs](/docs/promptargs/overview/introduction) |
| [**rationguard**](https://github.com/hivecommons/rationguard) | Detects and rebuts rationalization patterns in agent output. | [rationguard docs](/docs/rationguard/overview/introduction) |
| [**dibs**](https://github.com/hivecommons/dibs) | Contributor attribution for the AI-agent era: your idea, your credit, their code. | [dibs docs](/docs/dibs/overview/introduction) |

## Where next

- [Getting started](/docs/hive/getting-started)
- [Hive introduction](/docs/hive/overview/introduction)
- [Architecture](/docs/hive/architecture)
- [Join Hive Commons](/docs/community/join-hive-commons)
- [CNCF Sandbox application](https://github.com/cncf/sandbox/issues/516)
