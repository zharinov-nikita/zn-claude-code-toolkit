/**
 * PreToolUse hook (Bash|PowerShell): runs `rtk hook claude` and repoints every
 * rewritten command at the plugin-private binary.
 *
 * rtk rewrites `git status` into `rtk git status`, which assumes rtk sits in
 * PATH. Ours lives in ${CLAUDE_PLUGIN_DATA}/bin, so each `rtk` token has to be
 * swapped for an absolute path. Two things make that non-trivial:
 *
 *   - rtk rewrites every segment of a chain: `git status && git diff` becomes
 *     `rtk git status && rtk git diff`, so a single replacement is not enough;
 *   - `rtk` can legitimately appear as an argument (`rtk grep rtk README.md`),
 *     so a blind global replacement would corrupt it.
 *
 * Hence substitution happens only in command position: at the start of the
 * string or right after a shell separator.
 *
 * Exits 0 with no output whenever anything is missing or unexpected: the
 * command then runs unfiltered instead of failing.
 */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const RTK_TIMEOUT_MS = 10_000;

const dataDir = process.env.CLAUDE_PLUGIN_DATA ?? "";
if (!dataDir) process.exit(0);

const binPath = join(
  dataDir,
  "bin",
  process.platform === "win32" ? "rtk.exe" : "rtk",
);
if (!existsSync(binPath)) process.exit(0); // not downloaded yet

let raw = "";
try {
  raw = readFileSync(0, "utf8");
} catch {
  process.exit(0);
}

let input: any;
try {
  input = JSON.parse(raw);
} catch {
  process.exit(0);
}

const toolInput = input?.tool_input;
const command: unknown = toolInput?.command;
if (typeof command !== "string" || !command.trim()) process.exit(0);

const isPowerShell = input?.tool_name === "PowerShell";
const unixPath = binPath.replace(/\\/g, "/");

/**
 * Single quotes, because a double-quoted path would let both shells expand `$`
 * and (in PowerShell) backtick escapes inside it. Escaping differs: PowerShell
 * doubles the quote, POSIX shells close and reopen the literal.
 */
const invocation = isPowerShell
  ? `& '${unixPath.replace(/'/g, "''")}'`
  : `'${unixPath.replace(/'/g, "'\\''")}'`;

/** A `rtk` token that starts a command: string start, or after a shell separator. */
const RTK_IN_COMMAND_POSITION = /(^|&&|\|\||[;|&({])(\s*)rtk(?=\s|$)/g;

function repoint(cmd: string): string {
  return cmd.replace(
    RTK_IN_COMMAND_POSITION,
    (_match, separator: string, space: string) =>
      `${separator}${space}${invocation}`,
  );
}

const res = spawnSync(binPath, ["hook", "claude"], {
  input: raw,
  encoding: "utf8",
  timeout: RTK_TIMEOUT_MS,
});

let payload: any = null;
const out = res.stdout?.trim();
if (out) {
  try {
    payload = JSON.parse(out);
  } catch {
    process.exit(0);
  }
}

// Fall back to the original command: rtk stays silent when it has nothing to
// rewrite, yet the user may already have typed `rtk ...` themselves.
const rewritten: unknown = payload?.hookSpecificOutput?.updatedInput?.command;
const source = typeof rewritten === "string" ? rewritten : command;

if (!RTK_IN_COMMAND_POSITION.test(source)) {
  // Nothing of ours to fix. Anything rtk decided (a deny, a future field) is
  // passed through untouched rather than swallowed.
  if (payload) process.stdout.write(JSON.stringify(payload));
  process.exit(0);
}
RTK_IN_COMMAND_POSITION.lastIndex = 0; // the /g flag makes .test() stateful

const updatedCommand = repoint(source);
if (payload?.hookSpecificOutput?.updatedInput) {
  payload.hookSpecificOutput.updatedInput.command = updatedCommand;
} else {
  payload = {
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecisionReason: "RTK path resolution",
      updatedInput: { ...toolInput, command: updatedCommand },
    },
  };
}
process.stdout.write(JSON.stringify(payload));
process.exit(0);
