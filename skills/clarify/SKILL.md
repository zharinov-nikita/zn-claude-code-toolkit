---
name: clarify
description: Interrogate a vague task until it has exactly one reading, write the understanding as a short spec, then get it confirmed before any work starts. Use when the user asks to clarify a task, says the request is vague or half-baked, wants requirements pinned down before any code is written, asks what is unclear or what is missing, or wants the task broken down before planning. Not for producing options when the user has no idea yet - that is the zn:ideas skill. Triggers on "уточняющие вопросы", "задай уточняющие вопросы", "уточни", "разбери задачу", "что непонятно", "задача расплывчатая", "clarify", "ask clarifying questions", "pin down requirements".
---

# Clarify a task until it has one reading

Natural language is underspecified by default. "Cut the loaf in half" — lengthwise or
crosswise? Both readings are literally correct and produce different loaves. Acting on
an unstated reading produces output that is internally coherent but possibly wrong,
which is worse than a visible error: it looks right and hides the moment the user could
have corrected the intent.

This skill runs a deliberate interrogation. Speed is explicitly not the goal — one extra
round of questions costs seconds, a misread task costs the whole build-discard-rebuild
cycle.

## Procedure

Run these steps in order. Do not skip steps 2 and 6. When no task is on the table yet — a bare
manual invocation — ask what the task is as free text, then start at step 1.

### 1. Enumerate the forks

Construct at least two concrete readings of the request. For each dimension in the
checklist below, ask internally: do two plausible answers here produce different
artifacts? If yes, that dimension is a fork. Write the forks down before doing anything
else.

### 2. Close what the repository already answers

Read the code, `CLAUDE.md`, existing patterns, and the conversation history. Resolve
every fork that the project answers on its own. Never spend a question on something
already written down — an answer derived from the repo is more reliable than one
recalled by the user.

State briefly which forks got closed this way and by what evidence.

### 3. Ask about the remainder

Ask through the `AskUserQuestion` tool, never as text with numbered options. Up to 4
questions per round in a single call, highest-impact first, 2-4 options each carrying
its consequence, the recommended one first.

When the tool is unavailable — subagents and headless runs do not have it — stop rather
than improvise: return the open forks to the caller and let the caller ask.

### 4. Re-run step 1 against the answers

Each answer opens new forks. "Crosswise" invites "two pieces or several slices?".
Treat every answer as a new request and enumerate again. A single round of questions is
the first round, not a discharged obligation — stopping while forks remain is the same
silent guess, one step later.

### 5. Write the spec

When no result-changing ambiguity remains, produce a short written understanding — in
the reply, not as a file on disk. The headings below are the structure, not the wording:
write them in the session response language.

```markdown
## Task
<one sentence, unambiguous>

## Decisions
- <fork> → <chosen answer> (asked / derived from <file>)

## Out of scope
- <what is explicitly excluded>

## Done when
- <how completion is judged>
```

Keep it under a page. The spec is a readback, not a verdict: it exposes the reading that
was arrived at, in a form short enough to check before any code exists. Out of scope must
name boundaries the user implied but never said, and Done when must be checkable — a spec
that only rephrases the request under headings proves nothing.

### 6. Get the reading confirmed, then hand off

Never treat the spec as agreed by default. Close with **one** `AskUserQuestion` question
whose options fold the verdict and the next step together, so a rejected spec never drags
a next step along with it:

- `Верно → сначала план` (recommended) — enter native plan mode with `EnterPlanMode`, draft
  the implementation plan into the plan file on top of the confirmed spec, then send it for
  approval with `ExitPlanMode`, which reads the plan back from that file. Do not write the
  plan as a plain reply.
- `Верно → сразу реализация` — for tasks small enough not to need a plan.
- `Нужны правки` — the reading is wrong.

On `Нужны правки`, apply the correction and re-issue the spec. Route it through step 4
only when the correction itself opens a new fork; a one-word fix goes straight back to
step 5. A correction here is the skill working, not a failure. On a second round of
corrections, stop questioning: apply what was said, list the remaining assumptions, and
move on.

Do not start editing files on the strength of the spec alone. The spec settles *what*, a
plan settles *how*, and skipping the handoff collapses the two.

Two branches replace the question entirely:

- **Already in plan mode** — the spec belongs in the plan, and approval goes through
  `ExitPlanMode`, not `AskUserQuestion`. The mode is already active; do not call
  `EnterPlanMode` again.
- **`AskUserQuestion` unavailable** (subagents, headless) — emit the spec, mark it
  explicitly as unconfirmed, and end. Let the caller confirm.

## Checklist of dimensions

Walk every line in step 1:

- **Object and scope** — what exactly, in which files, one occurrence or every similar one.
- **Approach** — library, pattern, placement in the architecture, when not derivable from the project.
- **Behaviour** — edge cases, error handling, what happens to existing data.
- **Non-functional** — backward compatibility, performance, migration coverage.
- **Done criterion** — what makes the task finished.
- **Depth and audience** — for explanations and written answers, when a terse and a thorough version differ in kind.

## When to stop asking

Stop when every remaining difference is one of these:

- All readings converge on the same artifact.
- The answer is already in the code, `CLAUDE.md`, or this session — read it instead.
- The user already answered it; re-asking is forbidden.
- The difference is cosmetic and free to revert (local variable name, import order).
- The user asked to stop asking — then proceed, but list every assumption taken, as a
  separate block, so each one can be contested.

Outside those cases, resolve doubt with a question rather than a guess. When unsure
whether a question is warranted, ask it.

**Never leave an assumption unstated.** If a choice gets made without a question, name
it explicitly in the reply. An unspoken assumption is worse than a redundant question.

## Worked example

> — Разрежь булку хлеба пополам.

1. Forks: direction of the cut; number of resulting pieces.
2. Nothing in the repo answers either.
3. Ask direction → "поперёк".
4. Re-run: "поперёк" opens "two pieces or slices?" → ask → "два куска".
5. Spec: "Режу поперёк, два равных куска."
6. Confirm the reading and ask what follows — plan first (enter native plan mode), or cut
   straight away.

Counter-example — `переименуй параметр x в count в counter.ts` has one reading. No
forks, no questions, execute directly.
