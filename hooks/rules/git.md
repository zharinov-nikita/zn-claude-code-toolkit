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

## Passing the message to git

Never type a multi-line commit message as a command-line argument. Here-string and heredoc syntax belongs to one shell only (`@'...'@` — PowerShell, `<<EOF` — POSIX shells), and the wrong pairing mangles the message silently instead of failing.

- **Multi-line or non-ASCII message** — write it to a file with the Write tool (e.g. `.git/COMMIT_MSG.txt`), run `git commit -F .git/COMMIT_MSG.txt`, then delete the file. This is shell-independent and works the same on Windows, macOS and Linux.
- **Single-line ASCII message** — `git commit -m "feat(x): …"` is fine in any shell.
- After committing a multi-line body, verify it with `git log -1 --format=%B`.

### Examples

```text
feat(auth): add login via email
fix(planner): correct task sorting by date
chore: update dependencies
refactor(db): extract query builder
docs: add setup instructions to readme
```
