/**
 * SessionStart hook: keeps a private rtk binary inside ${CLAUDE_PLUGIN_DATA}.
 *
 * The binary is never installed into PATH - it lives next to the plugin and is
 * removed together with it when the plugin is uninstalled. rtk-hook.ts calls it
 * by absolute path.
 *
 * Always exits 0 and prints nothing: a missing network or a failed download
 * must never break a session, it only means commands run unfiltered.
 */
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  readdirSync,
  renameSync,
  rmSync,
  statSync,
  utimesSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";

const REPO = "rtk-ai/rtk";
const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;
const NETWORK_TIMEOUT_MS = 20_000;
const PROBE_TIMEOUT_MS = 5_000;

/** Release asset name per platform/arch; unsupported pairs are not installable. */
const ASSETS: Record<string, string> = {
  "win32:x64": "rtk-x86_64-pc-windows-msvc.zip",
  "darwin:arm64": "rtk-aarch64-apple-darwin.tar.gz",
  "darwin:x64": "rtk-x86_64-apple-darwin.tar.gz",
  "linux:x64": "rtk-x86_64-unknown-linux-musl.tar.gz",
  "linux:arm64": "rtk-aarch64-unknown-linux-gnu.tar.gz",
};

/**
 * Silences rtk's false "No hook installed" warning on Windows.
 *
 * rtk only recognizes a hook whose command is exactly `<path>/rtk hook claude`
 * in ~/.claude/settings.json. Ours is a bun wrapper declared in plugin.json, so
 * the check can never match - yet the hook is installed and working. rtk rate
 * limits the warning to once a day via the mtime of this marker, but it writes
 * an empty buffer, which leaves LastWriteTime untouched on NTFS: the limit never
 * kicks in and the warning is printed on every single command.
 *
 * Touching the marker ourselves restores the intended once-a-day behaviour.
 * Only the timestamp matters - rtk reads the file's metadata, never its content.
 *
 * Runs before every early exit below: in a typical session the binary is already
 * up to date and main() returns immediately.
 */
function silenceHookWarning(): void {
  if (process.platform !== "win32") return; // the empty-write bug is NTFS-specific
  const localAppData = process.env.LOCALAPPDATA;
  if (!localAppData) return;

  // Mirrors rtk's own dirs::data_local_dir()/rtk/.hook_warn_last
  const marker = join(localAppData, "rtk", ".hook_warn_last");
  const now = new Date();
  if (existsSync(marker)) {
    utimesSync(marker, now, now);
    return;
  }
  mkdirSync(join(localAppData, "rtk"), { recursive: true });
  writeFileSync(marker, "\n"); // non-empty, or the write leaves mtime alone
}

try {
  silenceHookWarning();
} catch {
  // Cosmetic only: a missing directory or denied write must not break startup.
}

const dataDir = process.env.CLAUDE_PLUGIN_DATA ?? "";
const assetName = ASSETS[`${process.platform}:${process.arch}`] ?? "";
if (!dataDir || !assetName) process.exit(0);

const isWindows = process.platform === "win32";
const binName = isWindows ? "rtk.exe" : "rtk";
const binDir = join(dataDir, "bin");
const binPath = join(binDir, binName);
const stampPath = join(dataDir, ".rtk-checked");

/** Recent successful check with the binary in place - skip the network entirely. */
function checkedRecently(): boolean {
  if (!existsSync(binPath)) return false;
  try {
    return Date.now() - statSync(stampPath).mtimeMs < CHECK_INTERVAL_MS;
  } catch {
    return false;
  }
}

function installedVersion(): string | null {
  if (!existsSync(binPath)) return null;
  // A corrupt binary that never exits would otherwise stall session startup.
  const res = spawnSync(binPath, ["--version"], {
    encoding: "utf8",
    timeout: PROBE_TIMEOUT_MS,
  });
  return res.stdout?.match(/(\d[\w.-]*)/)?.[1] ?? null;
}

/** Locate the extracted binary; archives keep it at the root, but don't rely on it. */
function findBinary(dir: string): string | null {
  for (const entry of readdirSync(dir, {
    withFileTypes: true,
    recursive: true,
  })) {
    if (entry.isFile() && entry.name === binName)
      return join(entry.parentPath, entry.name);
  }
  return null;
}

/** Single-quoted PowerShell literal: the only escape inside one is a doubled quote. */
function psLiteral(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

function extract(archive: string, dest: string): boolean {
  const res = isWindows
    ? spawnSync(
        "powershell",
        [
          "-NoProfile",
          "-ExecutionPolicy",
          "Bypass",
          "-Command",
          `Expand-Archive -LiteralPath ${psLiteral(archive)} -DestinationPath ${psLiteral(dest)} -Force`,
        ],
        { encoding: "utf8" },
      )
    : spawnSync("tar", ["-xzf", archive, "-C", dest], { encoding: "utf8" });
  return res.status === 0;
}

/** Never let a hanging connection stall session startup. */
function get(url: string, init?: RequestInit): Promise<Response> {
  return fetch(url, {
    ...init,
    signal: AbortSignal.timeout(NETWORK_TIMEOUT_MS),
  });
}

/**
 * Latest tag from the redirect `/releases/latest` issues, the way rtk's own
 * install.sh does it - the REST API is rate limited to 60 requests/hour per IP,
 * shared with every other tool hitting GitHub from this machine.
 */
async function latestTag(): Promise<string | null> {
  const res = await get(`https://github.com/${REPO}/releases/latest`, {
    method: "HEAD",
    redirect: "manual",
  });
  const location = res.headers.get("location") ?? res.url;
  // Any tag shape, not just strict semver: pre-releases must not silently stall updates.
  return location.match(/\/releases\/tag\/([^/?#]+)\/?$/)?.[1] ?? null;
}

async function main(): Promise<void> {
  if (checkedRecently()) return;

  const tag = await latestTag();
  if (!tag) return;
  const latest = tag.replace(/^v/, "");

  // Already on the latest release - just refresh the stamp.
  if (installedVersion() === latest) {
    writeFileSync(stampPath, latest);
    return;
  }

  const base = `https://github.com/${REPO}/releases/download/${tag}`;
  const [archiveRes, sumsRes] = await Promise.all([
    get(`${base}/${assetName}`),
    get(`${base}/checksums.txt`),
  ]);
  if (!archiveRes.ok || !sumsRes.ok) return;

  const archiveBytes = Buffer.from(await archiveRes.arrayBuffer());
  const expected = (await sumsRes.text())
    .split("\n")
    .map((line) => line.trim().split(/\s+/))
    .find((parts) => parts[1] === assetName)?.[0];
  const actual = createHash("sha256").update(archiveBytes).digest("hex");
  if (!expected || expected !== actual) return;

  // Per-process staging dir: concurrent sessions must not wipe each other's work.
  const work = join(dataDir, `.rtk-tmp-${process.pid}`);
  rmSync(work, { recursive: true, force: true });
  mkdirSync(work, { recursive: true });
  try {
    const archivePath = join(work, assetName);
    writeFileSync(archivePath, archiveBytes);
    if (!extract(archivePath, work)) return;

    const extracted = findBinary(work);
    if (!extracted) return;

    mkdirSync(binDir, { recursive: true });
    if (!isWindows) chmodSync(extracted, 0o755);
    // rename replaces the target atomically, so a failure leaves the old binary intact
    renameSync(extracted, binPath);

    writeFileSync(stampPath, latest);
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

try {
  await main();
} catch {
  // Silent by design: no stamp is written, so the next session retries.
}
process.exit(0);
