> **Synced from spektacular-website.** This page is pulled from [hivecommons/spektacular-website@main](https://github.com/hivecommons/spektacular-website/blob/main/src/content/tutorials/unknown-criteria.mdx) during the docs build. Edit the canonical source in the spektacular-website repository.
>
> Also published at [spektacular.dev](https://spektacular.dev/tutorials/unknown-criteria/), which is the canonical copy of this documentation.

# Dealing with unknown criteria

_How you can use a spec-driven development flow when the criteria for a feature are unknown or incomplete._

Read the [getting-started tutorial](https://spektacular.dev/tutorials/getting-started) first.
This is a case study in investigating an unclear problem before writing
requirements, not a setup guide. **SDD** means spec-driven development.
**Spek** is the tool; a **spek** is its requirements document. `spec` commands
operate that workflow, while the `spek-new` skill is the agent-side instruction
set that guides you through it.

A question I often ask myself when I am working on a project is "Should I be
using spec driven development for this problem?". The answer is usually yes, but
sometimes I do not have a clear idea of what the criteria for the work are.

## Three kinds of work

Broadly I think most of the activities that I carry out when coding fall into
the following three categories:
1. I know what the criteria for the work are, and I can write a spek for
   it.
2. Small bugs or minor changes where I have a fair idea of the problem and the
   solution.
3. Something is wrong and I don't know what the problem is or what the solution is.

In the first case, I can use the Spektacular (Spek) workflow to write a spek
and then implement it. In the second case, vibe coding is probably appropriate,
and way quicker than writing a specification. In the third case, the temptation
is to start working with the agent to investigate and fix the problem. However,
all of the detail around this work is not captured in a spek and plan
and so it may not adhere to the team's coding standards and practices, and the
code that is produced may not be maintainable or testable. I am basically vibe
coding my way to another problem.

## A bug in Spek

Let's look at a concrete example. I was recently working on what I believed to be
a bug in Spek when starting a new specification with
the Bob agent. The way that Spek works is that internally the skills are
deliberately very simple: they only instruct the agent to do a single task.
Further instructions are provided to the agent once it has completed the task.
By following this approach, and using a state machine to control the flow of the
agent, it avoids a common problem in large, complex skills: the agent can skip a
step or go off on a tangent. The state machine approach keeps it focused on the
task at hand.

An example of one of these skill prompts looks like this. The main idea is
that a finite-state machine (FSM: a workflow with allowed next steps) checks
transitions; an “event” is a request to move to one of those steps.

<details>
<summary>Optional reference: the internal prompt from this investigation</summary>

```markdown
**You are writing a spec, not a plan.** A spec captures *what* is being built and the direction the user has *already decided* — requirements, acceptance criteria, constraints, and any high-level technical direction. It does **not** design the *how*, and it does **not** investigate the codebase: do not read source files, run code searches, or ground decisions in specific files, types, or functions. That grounding is the plan workflow's `discovery` step. Stay at spec altitude in every step that follows.

#...

Once you are satisfied with the overview, move to the next step by running the command:

spektacular spec goto --data '{"step":"requirements"}'
---

**Before you advance:** refresh `.spektacular/working-context.md` with your cross-cutting working context only — the key decisions and substitutions made, the answers the user gave to your questions, and learnings worth carrying forward. Keep it to learnings and decisions, not a transcript and not a copy of content already captured elsewhere (such as a section's own working file). Use your own file tools. This file is git-tracked, and a resumed session reads it back to pick up where you left off, so keep it current every time before running the `goto` command above.

```

</details>

When the agent calls `spektacular spec goto --data '{"step":"requirements"}'`,
the state machine validates the agent's current state and requested next step,
and if everything is valid, it returns the next prompt.

What I saw was that Bob was trying to call the goto command, but with a
completely incorrect step.

Having an understanding of how Spek works, I did a little manual poking
through the codebase looking for any obvious problems, but I could not find
anything. Next, I turned to my coding agent.

## Asking the agent to investigate

```markdown
Let's do some investigation into a bug, when I was running with Bob yesterday I
noticed that it got stuck in a loop, it was unable to advance to the next step
and actually made a step up. Because of the state machine it was not able to
progress so went into a loop to search and find out what the next step was, it
did eventually find this but I don't understand why it needed to as the next
steps are clearly marked. I have not seen this behaviour with Claude.
```

The agent examined the code and returned a fix:

```markdown
# The fix
Make the invalid-goto error self-correcting: when the FSM rejects an event,
catch it and append the legal move. Turn event acceptance_criteria inappropriate
in current state overview into something like event acceptance_criteria
inappropriate in current state overview; the next valid step is "requirements",
run: spec goto --data '{"step":"requirements"}'
```

Now, experience and seeing the issue firsthand makes me think that this is
probably what happened. The temptation is to just accept the fix and move on:
this code change probably does not require a spek and a plan, and in
reality, I estimated I could change the code myself in about 30 seconds.
That is an estimate about this particular fix, not a promised effort for
similar problems. But experience
also tells me that this is not the end of the story: my gut tells me that
there is more than one error message like this in the codebase. So let's ask
the agent to look at the code and tell me if there are any other similar
issues.

## Widening the scope

So I ask the agent:

```markdown
How many more places are there errors surfaced to the agent like this?
```

It responded that there were three other places in the codebase where this
was happening: the new specification, plan, and implementation phases. But I
know there are other places that probably surface poor error messages to the
agent, for example, the knowledge base. So let me ask another question:

```markdown
Let's look at all errors across the entire codebase where an error is surfaced to the agent.
```

The agent now goes away and does quite a bit more work, and the reality is
that it finds that most of the errors surfaced by Spek are not very
helpful. It is also quite a bit of work that should be fixed with SDD, not
just a quick fix. So, let's get the agent to write a full spek for
this work; we can then review it and implement it.

```markdown
We should write a spek using the spek-new skill that ensures all error
messages emitted from the system are meaningful to an AI agent and which provide
enough diagnostic information to allow it to find a solution.
```

## Writing the speks

The agent then uses the skill and creates a spek. Upon reviewing this
spek, one of the Non-Goals actually surfaces something interesting,
something I had been thinking about myself.

```markdown
## Non-Goals

A debug or session action-log for reconstructing agent behavior after the fact
is out of scope; it is left for a separate, future spek.
```

So, whilst there is context for all of this, let's get the agent to write a
spek for what it thinks would be a useful debug or session logging
feature.

```markdown
Can you also write a second specification regarding debug/session logging; you
should ensure that the output from the logging prioritises agent consumption
over human consumption.
```

We now have two new speks that improve both the error logging and
the diagnostic information that Spek produces, both of which will make
it easier to fix future problems.

I can now share these speks with the team to get their feedback before
I go ahead and implement them.

## Conclusion

In this article, we have seen how we can work with the agent to investigate a
problem and then use the agent to write a spek for the work that needs
to be completed. In this particular instance, starting with Spec Driven
Development would not have been helpful, as I did not have a clear idea of the
problem or enough information to write a spek. However, by using the
agent to investigate and determine scope and potential root cause, it then
turns the activity of writing the spek into a trivial task of asking
the agent to do it.

Not all tasks require spec driven development, and spec driven development is
not always the best starting approach; however, the workflow is flexible: you
can always start ad hoc and end up with the quality and maintainability of a
spek and plan.
