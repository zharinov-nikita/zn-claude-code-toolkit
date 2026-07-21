/**
 * PreToolUse hook (Bash|PowerShell): denies `git commit -m` whenever the
 * message cannot survive shell quoting, and tells Claude to use `-F <file>`.
 *
 * A multi-line commit body typed as a command-line argument is shell-specific:
 * `@'...'@` is a here-string in PowerShell only, `<<EOF` a heredoc in POSIX
 * shells only. Feeding one to the other silently mangles the message instead of
 * failing — a PowerShell here-string sent to bash lands in the commit as a bare
 * `@` on the first and last line, because bash strips the quotes and keeps the
 * `@`s as text. Writing the message to a file and passing `-F` removes the
 * shell from the equation entirely.
 *
 * Non-ASCII with `-m` is denied too: the message reaches git through the
 * console code page, which is not UTF-8 on Windows by default.
 *
 * Single-line ASCII `-m` messages stay allowed — they are safe in every shell.
 * Anything unparseable exits 0 (no decision), so the command runs normally.
 */
import { readFileSync } from "node:fs";

function asciiJson(obj: unknown): string {
  return JSON.stringify(obj).replace(
    /[^\x00-\x7f]/g,
    (ch) => `\\u${ch.charCodeAt(0).toString(16).padStart(4, "0")}`,
  );
}

let input: any;
try {
  input = JSON.parse(readFileSync(0, "utf8"));
} catch {
  process.exit(0);
}

const command: unknown = input?.tool_input?.command;
if (typeof command !== "string" || !command.trim()) process.exit(0);

/** `git commit`, also as `rtk git commit` or `git -C <path> commit`. */
const IS_GIT_COMMIT = /\bgit\b[^\n;|&]*\bcommit\b/;
if (!IS_GIT_COMMIT.test(command)) process.exit(0);

/** `-m` / `--message`, but not `--message-file` or a `-m` inside a word. */
const USES_INLINE_MESSAGE = /(?:^|\s)(?:-[a-zA-Z]*m|--message)(?:[=\s]|$)/;
if (!USES_INLINE_MESSAGE.test(command)) process.exit(0);

/** Here-string / heredoc markers: proof the message was meant to be multi-line. */
const SHELL_MULTILINE_MARKER = /@['"]|['"]@|<<[-~]?['"]?\w/;

const problem = command.includes("\n")
  ? "the message spans multiple lines"
  : SHELL_MULTILINE_MARKER.test(command)
    ? "the command carries here-string / heredoc markers"
    : /[^\x00-\x7f]/.test(command)
      ? "the message contains non-ASCII characters"
      : "";

if (!problem) process.exit(0);

process.stdout.write(
  asciiJson({
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason: `Blocked: \`git commit -m\` where ${problem}. Such a message depends on the shell and gets mangled silently (a PowerShell here-string \`@'...'@\` run under bash leaves a bare \`@\` as the first and last line of the commit). Write the message with the Write tool to a file (e.g. .git/COMMIT_MSG.txt), run \`git commit -F <that file>\`, then delete it. Single-line ASCII \`-m\` messages are fine.`,
    },
  }),
);
process.exit(0);
