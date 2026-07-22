---
name: ideas
description: Turn a half-formed wish into 3-4 deliberately different, concrete options, let the user pick, then go deep on the pick. Use when the user wants something but cannot say what it should be or how it should look, asks for options or approaches, wants ideas thrown at them, or is choosing between shapes rather than implementations. Not for narrowing down an idea that already exists in one shape - that is the zn:clarify skill - and not for a how-to question that has a single answer. Triggers on "предложи варианты", "накидай идей", "придумай", "помоги придумать", "какие есть варианты", "что посоветуешь", "хочу что-то, но не знаю что", "не знаю, как это должно выглядеть", "не знаю с чего начать", "предложи решения", "brainstorm", "propose options", "what are my options".
---

# Propose options for a half-formed wish

The user knows the itch, not the shape, so asking "so what do you want?" fails by
construction. Recognition works where recall does not: put concrete, genuinely different
candidates in front of them instead.

## Boundary

- One idea that reads two ways → `zn:clarify`. It converges: interrogates until a single
  reading survives.
- A need with no idea attached → this skill. It diverges: manufactures the candidates
  the user could not.
- A question with one right answer → neither. `добавь в README таблицу с хуками` or
  `как отменить последний коммит` have a known shape; answer directly instead of
  manufacturing options nobody asked for.

Order matters: `ideas` first, `clarify` after. Running `clarify` on an unformed wish
produces questions that all bottom out in "не знаю".

## Procedure

### 1. Name the need, not the stated solution

One sentence: what changes for the user once this works. If the request already names a
mechanism — "хочу хук, который…" — state the need behind it; the mechanism becomes one
option among several, not the frame.

Print that sentence as the first line of the reply. If it is wrong, everything below it
is wrong, and it costs one line to correct.

### 2. Ground before inventing

A few tool calls, not a research project:

- **The repository** — `CLAUDE.md`, existing skills and hooks, dependencies. Does
  something here already solve part of this?
- **Prior art** — `WebSearch` when the answer turns on a tool or library choice and
  memory would only produce a guess.

Skip either when the wish is plainly out of its reach. Say what grounding turned up: an
option resting on something that already exists is worth more than an invented one.

### 3. Spread the options along one axis

3-4 options differing in kind, not degree. Choose the axis first, then place options on
it, so the set covers the space instead of clustering:

- **Effort** — a ten-minute hack / a proper solution / a serious build.
- **Where it lives** — an existing tool / configuration / a new component.
- **How much control stays with the user** — automatic / prompted / manual.

Test each pair: if two options produce nearly the same artifact, one is dead weight —
replace it.

One of the 3-4 must reframe the problem: satisfy the need without doing the thing that
was asked for, up to and including "не строить ничего, вот почему" — the cheapest way to
discover that the frame itself is off.

### 4. Make every option tangible

Up to about six lines each. The labels below are the structure, not the wording: write
them in the session response language.

- **Name** — short, memorable, so the user can refer back to it.
- **What it is** — one sentence.
- **What it looks like in use** — a call, a fragment of output, a slice of config.
- **Cost** — to build, and to live with afterwards.
- **What you pay with** — what it forecloses, what gets worse.

The third line is what makes recognition possible. Keep the whole set to one screen, and
do not add a scoring table — ranking is step 5's job, in one place.

### 5. Let the user pick

One `AskUserQuestion` call, one question, options = the proposals, the recommended one
first with the reason for the recommendation spelled out in its description.

Above the question, in the reply text, say two things: options can be combined, and
"ничего из этого" is a legitimate answer — step 6 handles it. Say both in the text, not
as extra options: the tool caps a question at 4, which the proposals already fill.

When `AskUserQuestion` is unavailable — subagents, headless runs — emit the set as text
and end the turn in the same reply. Do not go looking for the tool and do not announce
its absence twice: the caller picks.

### 6. When nothing fits, diverge once more

A rejected set means the axis missed, not that the options were poor. Ask what was wrong
with the set as a whole, pick a different axis in step 3, produce one new set.

Do not produce a third. After two misses the need itself is unclear — invoke the
`zn:clarify` skill through the `Skill` tool and hand over.

### 7. Go deep on the pick

The chosen option is a direction, not a spec. Now converge: forks inside the option,
what the repository already answers, the remainder as a question, a short spec, handoff
to a plan.

That is exactly the `clarify` procedure. Invoke the `zn:clarify` skill through the
`Skill` tool and run its steps 1-6 against the chosen option; do not restate them here.

## Anti-patterns

- **Three flavours of one idea** — A, A′, A″. That is an implementation comparison, and
  it belongs after the shape is settled, not before.
- **Options with no price** — a proposal that costs nothing decides nothing.
- **Asking "а чего ты хочешь?"** — the skill was invoked precisely because there is no
  answer to that.
- **A research report instead of a set of proposals** — grounding is minutes.
- **Ranking so hard it picks for the user** — recommend, do not decide.

## Worked example

> — Хочу видеть, сколько токенов жрут мои сессии, но не знаю в каком виде.

1. Need: заметить перерасход вовремя, а не постфактум.
2. Grounding: `rtk gain` уже собирает часть данных (`skills/rtk/SKILL.md`) — считать
   с нуля не нужно.
3. Axis: в какой момент человек узнаёт цифру.
4. Options:
   - **Строка статуса** — цифра всегда на глазах; `statusline` в настройках; дёшево;
     платишь постоянным шумом и одной цифрой без разбивки.
   - **Отчёт по требованию** — скилл поверх `rtk gain --history`; видно детали;
     платишь тем, что надо вспомнить и спросить.
   - **Порог и оповещение** — Stop-хук, который бьёт тревогу при превышении; узнаёшь
     ровно тогда, когда важно; платишь подбором порога и ложными срабатываниями.
   - **Ничего не строить** — `rtk cc-economics` руками раз в неделю; ноль работы;
     платишь тем, что узнаёшь через неделю.
5. Спросить, отметив, что строку статуса и порог можно совместить.
