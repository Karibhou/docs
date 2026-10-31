> **Synced from Hive.** This page is pulled from [hivecommons/hive@v5](https://github.com/hivecommons/hive/blob/v5/src/docs/labels-and-control-signals.md) during the docs build. Edit the canonical source in the Hive repository.

# Hive Labels and Control Signals

This is the operator view of Hive labels: if you add or remove a label, this is what the v5 code does. It also calls out non-label controls that look like labels from the dashboard.

The page is split into one file per area under [`labels-and-control-signals/`](https://github.com/hivecommons/hive/blob/v5/src/docs/labels-and-control-signals/) so concurrent edits do not collide. Every section keeps its heading and anchor inside its page.

## Pages

| Page | Covers |
|---|---|
| [`labels-and-control-signals/reference.md`](/docs/hive/labels-and-control-signals/reference) | First use, label axes, categories and the full reference table |
| [`labels-and-control-signals/stage-labels.md`](/docs/hive/labels-and-control-signals/stage-labels) | Stage labels (`stage/NNN-*`) and the pipeline state machine |
| [`labels-and-control-signals/glossary-and-operations.md`](/docs/hive/labels-and-control-signals/glossary-and-operations) | Decision glossary, blockers, matching rules, config, question auto-close, lifecycle examples and follow-ups |

## Sections

- <a id="first-use-choose-the-control"></a>[First use: choose the control](/docs/hive/labels-and-control-signals/reference#first-use-choose-the-control)
- <a id="label-axes"></a>[Label axes](/docs/hive/labels-and-control-signals/reference#label-axes)
- <a id="categories"></a>[Categories](/docs/hive/labels-and-control-signals/reference#categories)
- <a id="reference-table"></a>[Reference table](/docs/hive/labels-and-control-signals/reference#reference-table)
- <a id="stage-labels-stagennn--the-pipeline-state-machine"></a>[Stage labels (`stage/NNN-*`): the pipeline state machine](/docs/hive/labels-and-control-signals/stage-labels#stage-labels-stagennn--the-pipeline-state-machine)
- <a id="decision-glossary"></a>[Decision glossary](/docs/hive/labels-and-control-signals/glossary-and-operations#decision-glossary)
- <a id="blockers-hiveblocker-marker"></a>[Blockers (`hive:blocker` marker)](/docs/hive/labels-and-control-signals/glossary-and-operations#blockers-hiveblocker-marker)
- <a id="how-labels-reach-agents"></a>[How labels reach agents](/docs/hive/labels-and-control-signals/glossary-and-operations#how-labels-reach-agents)
- <a id="matching-rules"></a>[Matching rules](/docs/hive/labels-and-control-signals/glossary-and-operations#matching-rules)
- <a id="config-that-changes-label-behavior"></a>[Config that changes label behavior](/docs/hive/labels-and-control-signals/glossary-and-operations#config-that-changes-label-behavior)
- <a id="question-auto-close"></a>[Question auto-close](/docs/hive/labels-and-control-signals/glossary-and-operations#question-auto-close)
- <a id="lifecycle-examples"></a>[Lifecycle examples](/docs/hive/labels-and-control-signals/glossary-and-operations#lifecycle-examples)
- <a id="non-label-equivalents"></a>[Non-label equivalents](/docs/hive/labels-and-control-signals/glossary-and-operations#non-label-equivalents)
- <a id="repo-card-legend-vocabulary"></a>[Repo-card legend vocabulary](/docs/hive/labels-and-control-signals/glossary-and-operations#repo-card-legend-vocabulary)
- <a id="documented-inconsistencies-and-follow-ups"></a>[Documented inconsistencies and follow-ups](/docs/hive/labels-and-control-signals/glossary-and-operations#documented-inconsistencies-and-follow-ups)

<a id="the-regressed-marker-when-it-is-set-when-it-clears"></a>The `regressed` marker rules are in [stage labels](/docs/hive/labels-and-control-signals/stage-labels#the-regressed-marker-when-it-is-set-when-it-clears).
