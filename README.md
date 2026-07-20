# zn-claude-code-toolkit

Personal toolkit plugin for Claude Code. A growing collection of assorted tools: skills, agents, hooks, and integrations.

## Installation

From GitHub (once the repo is pushed):

```
/plugin marketplace add zharinov-nikita/zn-claude-code-toolkit
/plugin install zn-claude-code-toolkit@zn-claude-code-toolkit
```

Local development:

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
    ├── inject-language.json
    ├── inject-git-rules.json
    └── git-rules.md    # Rules text injected by inject-git-rules
```

## Tools

| Tool | Type | Description |
|------|------|-------------|
| inject-language | Hook (UserPromptSubmit) | Injects a response-language instruction into context on every prompt |
| inject-git-rules | Hook (UserPromptSubmit) | Injects git commit rules (Conventional Commits, English messages, no co-author trailers, no commits without permission) on every prompt |

### inject-language

Makes Claude Code always respond in your chosen language. Configuration — a single env var:

```
ZN_RESPONSE_LANGUAGE=Русский   # free-form: English, Deutsch, ...
```

When the variable is not set, the hook stays silent and Claude Code behaves as usual.

No scripts, no runtime dependencies — a plain `echo` inside the hook config. On Windows the command runs in Git Bash (Claude Code's default hook shell). Hooks load on session start — restart Claude Code after installing or changing the variable.

### inject-git-rules

Injects git rules into context on every prompt — always on while the plugin is enabled:

- never commit or push without the user's explicit permission;
- commit messages in English, Conventional Commits format;
- no co-author trailers (`Co-Authored-By`, "Generated with").

The injected text lives in [`hooks/git-rules.md`](hooks/git-rules.md) — edit it to change the rules.
