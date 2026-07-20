/**
 * PostToolUse hook (Write|Edit): validates a .json file right after Claude
 * writes or edits it. On a parse error, exits with code 2 and the error on
 * stderr, which Claude Code feeds back to the model for an immediate fix.
 *
 * Skips JSONC-by-convention files (tsconfig/jsconfig, .vscode/, .zed/,
 * devcontainer.json, *.jsonc) where comments and trailing commas are legal.
 */
import { readFileSync } from "node:fs";

let input: any = {};
try {
  input = JSON.parse(readFileSync(0, "utf8"));
} catch {
  process.exit(0); // no/invalid stdin - never break the tool flow
}

const filePath: string | undefined = input?.tool_input?.file_path;
if (!filePath || !/\.json$/i.test(filePath)) process.exit(0);

// JSONC-by-convention locations: comments are legal there, plain JSON.parse is not applicable
const norm = filePath.replace(/\\/g, "/").toLowerCase();
const jsoncAllowed =
  /(^|\/)(tsconfig[^/]*|jsconfig[^/]*|devcontainer)\.json$/.test(norm) ||
  norm.includes("/.vscode/") ||
  norm.includes("/.zed/");
if (jsoncAllowed) process.exit(0);

let raw = "";
try {
  raw = readFileSync(filePath, "utf8");
} catch {
  process.exit(0); // file deleted/unreadable - not our concern
}
if (raw.charCodeAt(0) === 0xfeff) raw = raw.slice(1); // tolerate BOM

try {
  JSON.parse(raw);
} catch (e) {
  process.stderr.write(
    `Invalid JSON in ${filePath}: ${(e as Error).message}. Fix the syntax error you just introduced.`,
  );
  process.exit(2);
}
process.exit(0);
