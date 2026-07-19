# zn-claude-code-toolkit

Personal toolkit plugin for Claude Code. A growing collection of assorted tools: skills, agents, hooks, and integrations.

## Installation (local)

```bash
claude --plugin-dir C:\Users\NikitaDev\Desktop\projects\zn-claude-code-toolkit
```

## Structure

```
zn-claude-code-toolkit/
├── .claude-plugin/
│   └── plugin.json     # Plugin manifest
├── skills/             # Skills and slash commands (added as needed)
├── agents/             # Subagents (added as needed)
└── hooks/              # One JSON file per hook, listed in plugin.json "hooks" array
    └── inject-language.json
```

## Tools

| Tool | Type | Description |
|------|------|-------------|
| inject-language | Hook (UserPromptSubmit) | Injects a response-language instruction into context on every prompt |

### inject-language

Makes Claude Code always respond in your chosen language. Configuration — a single env var:

```
ZN_RESPONSE_LANGUAGE=Русский   # free-form: English, Deutsch, ...
```

When the variable is not set, the hook stays silent and Claude Code behaves as usual.

No scripts, no runtime dependencies — a plain `echo` inside `hooks.json`. On Windows the command runs in Git Bash (Claude Code's default hook shell). Hooks load on session start — restart Claude Code after installing or changing the variable.
