# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-07-21

### Features

- **hooks**: Add inject-language user prompt hook
- Add marketplace manifest for plugin distribution
- **hooks**: Add inject-git-rules user prompt hook
- **hooks**: Migrate personal rules, stop hook and desktop watcher
- **hooks**: Add validate-json post-edit hook and manifest schemas

### Refactor

- **hooks**: Split hooks config into per-hook files

### Miscellaneous

- Initialize plugin scaffold
- Enable plugin-dev plugin in project settings
- Add dev lint toolchain (biome, tsc, markdownlint, psscriptanalyzer)
- Add lefthook pre-commit hooks
- Add tsconfig for type checking
- Remove virtual-desktop watcher and gui-launch hooks

[1.0.0]: https://github.com/zharinov-nikita/zn-claude-code-toolkit/tree/v1.0.0
