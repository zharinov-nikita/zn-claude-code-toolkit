# zn-claude-code-toolkit

Personal toolkit plugin for Claude Code. A growing collection of assorted tools: skills, agents, hooks, and integrations.

## Installation

From GitHub (once the repo is pushed):

```text
/plugin marketplace add zharinov-nikita/zn-claude-code-toolkit
/plugin install zn-claude-code-toolkit@zn-claude-code-toolkit
```

Local development:

```bash
claude --plugin-dir C:\Users\NikitaDev\Desktop\projects\zn-claude-code-toolkit
```

## Development

Dev toolchain (`bun install` first): [Biome](https://biomejs.dev) for JSON/TS lint+format, `tsc` for type checking, markdownlint for Markdown, PSScriptAnalyzer for PowerShell (install once: `Install-Module PSScriptAnalyzer -Scope CurrentUser`).

```bash
bun run check      # all checks: json, ts, md, ps
bun run fix        # apply Biome autofixes
```

## Structure

```text
zn-claude-code-toolkit/
├── .claude-plugin/
│   └── plugin.json     # Plugin manifest
├── skills/             # Skills and slash commands (added as needed)
├── agents/             # Subagents (added as needed)
└── hooks/              # One JSON file per hook, listed in plugin.json "hooks" array
    ├── inject-*.json   # Context-injection hooks (UserPromptSubmit)
    ├── enforce-ask-user-question.json
    ├── desktop-watcher.json
    ├── rules/          # Markdown rule texts injected by inject-* hooks
    └── scripts/        # Script-backed hooks
        ├── enforce-ask-user-question.ts   # Stop-hook logic (bun)
        └── desktop/    # Virtual-desktop watcher (Windows): ps1 scripts + bin/VirtualDesktop.exe
```

## Tools

| Tool | Type | Description |
| ------ | ------ | ------------- |
| inject-language | Hook (UserPromptSubmit) | Injects a response-language instruction into context on every prompt (env-driven) |
| inject-git-rules | Hook (UserPromptSubmit) | Git rules: Conventional Commits, English messages, no co-author trailers, no commits without permission |
| inject-response-style | Hook (UserPromptSubmit) | Response style: bottom line first, length follows complexity, no filler |
| inject-human-language | Hook (UserPromptSubmit) | Live language: no bureaucratic cliches, short sentences (Russian-oriented) |
| inject-ask-questions | Hook (UserPromptSubmit) | Choice questions must go through the AskUserQuestion tool |
| inject-grounding | Hook (UserPromptSubmit) | Verify APIs/configs via ctx7 CLI and web search instead of memory |
| inject-gui-launch | Hook (UserPromptSubmit) | GUI launch rules for the virtual-desktop watcher (Windows only) |
| enforce-ask-user-question | Hook (Stop) | Blocks answers ending with a textual multiple-choice question; requires bun |
| validate-json | Hook (PostToolUse) | Validates .json files right after Write/Edit and feeds syntax errors back to Claude; requires bun |
| desktop-watcher | Hook (SessionStart + Pre/PostToolUse) | Moves GUI windows opened by the session to Claude's virtual desktop (Windows only) |

### inject-language

Makes Claude Code always respond in your chosen language. Configuration — a single env var:

```text
ZN_RESPONSE_LANGUAGE=Русский   # free-form: English, Deutsch, ...
```

When the variable is not set, the hook stays silent and Claude Code behaves as usual.

No scripts, no runtime dependencies — a plain `echo` inside the hook config. On Windows the command runs in Git Bash (Claude Code's default hook shell). Hooks load on session start — restart Claude Code after installing or changing the variable.

### Rule-injection hooks (inject-*)

Each hook `cat`s one markdown file from `hooks/rules/` into context on every prompt — always on while the plugin is enabled. Edit the corresponding file in `hooks/rules/` to change a rule; remove a hook entry from `plugin.json` to disable one entirely.

- `git.md` — never commit/push without permission; Conventional Commits; English messages; no co-author trailers
- `response-style.md` — bottom line first, no filler
- `human-language.md` — live conversational language, no bureaucratese (written for Russian)
- `ask-questions.md` — choice questions only via the AskUserQuestion tool
- `grounding.md` — verify library APIs via ctx7 CLI / web search instead of answering from memory (expects [Context7 CLI](https://context7.com) installed)
- `gui-launch.md` — GUI launch rules for the desktop watcher; injected on Windows only

### enforce-ask-user-question

Stop hook: if the final answer ends with a textual multiple-choice question, blocks the stop and forces re-asking via the AskUserQuestion tool. Requires [bun](https://bun.sh); silently skipped when bun is missing.

### validate-json

PostToolUse hook on Write/Edit: parses the touched `.json` file and, on a syntax error, blocks with the error message so Claude fixes it immediately. Skips JSONC-by-convention files (`tsconfig*.json`, `jsconfig*.json`, `devcontainer.json`, `.vscode/`, `.zed/`, `*.jsonc`). Requires [bun](https://bun.sh); silently skipped when bun is missing.

### desktop-watcher (Windows only)

Background watcher that moves GUI windows opened by the session onto the virtual desktop hosting the Claude Code window. `SessionStart` spawns the watcher; `PreToolUse`/`PostToolUse` on Bash/PowerShell refresh the activity marker it uses to catch non-descendant windows. Ships `hooks/scripts/desktop/` with the ps1 scripts and `bin/VirtualDesktop.exe`. No-ops on non-Windows platforms.
