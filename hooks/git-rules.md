# Git rules

These rules apply to all git operations in every project.

## Committing
- **Never commit without the user's explicit permission.** Do not run `git commit` (or `git commit --amend`) on your own initiative. Stage and prepare changes if helpful, but wait for the user to say to commit.
- Do not `git push` without explicit permission either.

## Commit messages
- **Always write commit messages in English**, regardless of the conversation language.
- **Never add a co-author trailer** (no `Co-Authored-By`, no "Generated with" attribution).
- Use **Conventional Commits** format: `<type>(<optional scope>): <short summary>`.
  - Summary in imperative mood, lowercase, no trailing period.
  - Allowed types:
    - `feat` — a new feature
    - `fix` — a bug fix
    - `chore` — tooling, config, deps, housekeeping
    - `refactor` — code change that neither fixes a bug nor adds a feature
    - `docs` — documentation only
    - `style` — formatting, whitespace (no logic change)
    - `test` — adding or fixing tests
    - `perf` — performance improvement
    - `build` — build system or external dependencies
    - `ci` — CI configuration

### Examples
```
feat(auth): add login via email
fix(planner): correct task sorting by date
chore: update dependencies
refactor(db): extract query builder
docs: add setup instructions to readme
```
