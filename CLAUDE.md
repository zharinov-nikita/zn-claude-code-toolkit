# zn-claude-code-toolkit

This repository is both a Claude Code plugin (`zn`) and the marketplace that ships it
(`zn-claude-code-toolkit`). See `README.md` for the structure and the release flow.

## Local development

The plugin is **copied into the plugin cache on install**, so editing the working tree changes
nothing in the running session — the cache still holds the old copy. Every change has to be pulled
through the marketplace before it takes effect.

### After every commit — always print the update instructions

Whenever a commit lands in this repository, end the reply with the block below, verbatim, without
waiting to be asked. It is the only way the user learns that the working tree and the installed
plugin have drifted apart.

> Чтобы подтянуть изменения в установленный плагин:
>
> ```text
> /plugin marketplace update zn-claude-code-toolkit
> /reload-plugins
> ```
>
> Если изменения не подхватились — например, `version` в `.claude-plugin/plugin.json` не менялся,
> а Claude Code отдаёт обновление только при её росте — переустанови:
>
> ```text
> /plugin uninstall zn@zn-claude-code-toolkit
> /plugin install zn@zn-claude-code-toolkit
> /reload-plugins
> ```
>
> В крайнем случае, если плагин так и не обновился: закрыть Claude Code,
> `rm -rf ~/.claude/plugins/cache`, запустить заново и поставить плагин ещё раз.

Adjust the block when it would be wrong:

- Name the components that actually changed and how to verify them — a skill by its `/zn:<name>`
  invocation, a hook by the behaviour it enforces.
- If the commit touched only `README.md`, `CLAUDE.md`, `CHANGELOG.md`, `scripts/`, or the dev toolchain
  (`biome.json`, `tsconfig.json`, `lefthook.yml`, `package.json` dev deps), nothing ships to the
  cache — say so instead of printing the block.
- `/reload-plugins` applies hooks, skills, agents and MCP servers without a restart, but it warns
  and refuses when a plugin's MCP tools are not deferred; `--force` applies it anyway at the cost of
  a cache miss on the whole conversation.

The rule does not apply to a session started with `claude --plugin-dir .` — that loads the working
tree directly, so `/reload-plugins` alone is enough and no marketplace step is involved.

## Registering a hook

A hook is not active until its JSON file is listed in the `hooks` array of
`.claude-plugin/plugin.json`. Dropping a file into `hooks/` does nothing on its own. When adding a
hook, also document it in the `## Tools` section of `README.md`.
