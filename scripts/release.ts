/**
 * Release script: bumps the version, regenerates CHANGELOG.md, commits and tags.
 *
 * Usage: bun scripts/release.ts [major|minor|patch|X.Y.Z] [--dry-run]
 *
 * The version lives in .claude-plugin/plugin.json (what Claude Code shows to
 * users) and is mirrored into package.json. Both are patched with a targeted
 * regex so key order and formatting stay untouched.
 *
 * Nothing is pushed: `git push --follow-tags` stays a manual step.
 */
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

const MANIFESTS = [".claude-plugin/plugin.json", "package.json"];
const CHANGELOG = "CHANGELOG.md";
const SEMVER = /^\d+\.\d+\.\d+$/;
const VERSION_FIELD = /("version"\s*:\s*")[^"]*(")/;

/** Runs a command, returns trimmed stdout, aborts the release on failure. */
function run(command: string): string {
  const result = spawnSync(command, { shell: true, encoding: "utf8" });
  if (result.status !== 0) {
    fail(`${command}\n${result.stderr?.trim() ?? ""}`);
  }
  return result.stdout.trim();
}

function fail(message: string): never {
  console.error(`release: ${message}`);
  process.exit(1);
}

const argv = process.argv.slice(2);
const dryRun = argv.includes("--dry-run");
const bumpArg = argv.find((arg) => !arg.startsWith("--"));

if (
  bumpArg &&
  !SEMVER.test(bumpArg) &&
  !["major", "minor", "patch"].includes(bumpArg)
) {
  fail(`unknown argument "${bumpArg}", expected major|minor|patch|X.Y.Z`);
}

if (run("git status --porcelain") !== "") {
  fail("working tree is dirty - commit or stash first");
}

const hasTags = run("git tag --list v[0-9]*") !== "";

let version: string;
if (bumpArg && SEMVER.test(bumpArg)) {
  version = bumpArg;
} else if (!hasTags) {
  // First release: nothing to bump from, git-cliff would default to 0.1.0.
  version = "1.0.0";
} else {
  const strategy = bumpArg ?? "auto";
  version = run(`bunx git-cliff --bumped-version --bump ${strategy}`).replace(
    /^v/,
    "",
  );
  if (!SEMVER.test(version)) {
    fail(`could not determine the next version (git-cliff said "${version}")`);
  }
}

const tag = `v${version}`;
if (hasTags && run(`git tag --list ${tag}`) !== "") {
  fail(`tag ${tag} already exists`);
}

if (dryRun) {
  console.log(`next version: ${version}`);
  console.log(run(`bunx git-cliff --tag ${tag} --unreleased`));
  process.exit(0);
}

for (const path of MANIFESTS) {
  const source = readFileSync(path, "utf8");
  if (!VERSION_FIELD.test(source)) {
    fail(`no "version" field in ${path}`);
  }
  writeFileSync(path, source.replace(VERSION_FIELD, `$1${version}$2`));
}

run(`bunx git-cliff --tag ${tag} --output ${CHANGELOG}`);
// git-cliff appends a newline after the footer, leaving a trailing blank line
// that markdownlint (MD012) rejects - and the release commit runs the linter.
writeFileSync(CHANGELOG, readFileSync(CHANGELOG, "utf8").replace(/\n+$/, "\n"));

run(`git add ${CHANGELOG} ${MANIFESTS.join(" ")}`);
run(`git commit -m "chore(release): ${tag}"`);
run(`git tag -a ${tag} -m "${tag}"`);

console.log(`released ${tag} - push it with: git push --follow-tags`);
