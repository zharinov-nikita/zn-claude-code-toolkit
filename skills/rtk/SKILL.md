---
name: rtk
description: Report or inspect rtk token savings. Use when the user asks how many tokens were saved, wants rtk savings analytics or history, asks about rtk adoption across sessions, wants to find missed rtk optimization opportunities, compares Claude Code spending against savings, or needs to run a command unfiltered for debugging. Triggers on "rtk", "token savings", "how much did I save", "rtk gain", "rtk discover".
---

# rtk meta commands

rtk is a CLI proxy that filters and summarizes command output before it reaches the
context (60-90% fewer tokens on dev operations). This plugin ships its own rtk binary
in the plugin data directory - it is **not** on PATH, so always invoke it by full path:

```bash
"${CLAUDE_PLUGIN_DATA}/bin/rtk" <command>
```

On PowerShell, prefix with the call operator:

```powershell
& "${CLAUDE_PLUGIN_DATA}/bin/rtk" <command>
```

## Analytics

```bash
"${CLAUDE_PLUGIN_DATA}/bin/rtk" gain             # token savings summary
"${CLAUDE_PLUGIN_DATA}/bin/rtk" gain --history   # per-command usage with savings
"${CLAUDE_PLUGIN_DATA}/bin/rtk" session          # rtk adoption across Claude Code sessions
"${CLAUDE_PLUGIN_DATA}/bin/rtk" discover         # missed savings in Claude Code history
"${CLAUDE_PLUGIN_DATA}/bin/rtk" cc-economics     # spending (ccusage) vs savings
```

## Escape hatches

```bash
"${CLAUDE_PLUGIN_DATA}/bin/rtk" proxy <cmd>   # run unfiltered, still tracked
"${CLAUDE_PLUGIN_DATA}/bin/rtk" run <cmd>     # run raw: no filtering, no tracking
```

Use `proxy` or `run` when a filter mangles output you need verbatim.

## Everyday commands need no action

The `rtk-proxy` PreToolUse hook rewrites ordinary commands automatically -
`git status` becomes an rtk-filtered call before it executes. Just write normal
commands; do not prefix them with rtk by hand.

## Troubleshooting

- **Binary missing**: it is downloaded on session start by the `rtk-install` hook.
  A failed download leaves commands unfiltered - restart the session to retry, and
  check that the machine can reach `github.com`.
- **Name collision**: an unrelated project (Rust Type Kit) also publishes `rtk` on
  crates.io. If a system-wide `rtk` on PATH lacks `gain`, that is the wrong binary -
  the plugin's copy under `${CLAUDE_PLUGIN_DATA}/bin` is the correct one.
