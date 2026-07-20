# SessionStart hook: запускает desktop-watcher.ps1 для текущей сессии Claude Code.
# Быстро отрабатывает и выходит; вотчер живёт отдельным скрытым процессом.
$ErrorActionPreference = "SilentlyContinue"

Add-Type -TypeDefinition @'
using System;
using System.Text;
using System.Collections.Generic;
using System.Runtime.InteropServices;
public class WinSpawn {
  [DllImport("user32.dll")] static extern bool EnumWindows(EnumWindowsProc cb, IntPtr lp);
  [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
  [DllImport("user32.dll")] static extern int GetWindowText(IntPtr h, StringBuilder sb, int max);
  [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr h);
  delegate bool EnumWindowsProc(IntPtr h, IntPtr lp);
  public static List<string> GetWindows(uint targetPid) {
    var result = new List<string>();
    EnumWindows((h, lp) => {
      uint pid; GetWindowThreadProcessId(h, out pid);
      if (pid == targetPid && IsWindowVisible(h)) {
        var sb = new StringBuilder(512); GetWindowText(h, sb, 512);
        if (sb.Length > 0) result.Add(h.ToInt64() + "|" + sb.ToString());
      }
      return true;
    }, IntPtr.Zero);
    return result;
  }
}
'@

$projectHint = Split-Path -Leaf (Get-Location)

# --- 1. Найти pid процесса claude (предок) и окно-хост выше по дереву ---
$claudePid = 0
$hostHwnd = 0
$current = $PID
for ($i = 0; $i -lt 15; $i++) {
  $proc = Get-CimInstance Win32_Process -Filter "ProcessId=$current" -ErrorAction SilentlyContinue
  if (-not $proc) { break }
  if ($claudePid -eq 0 -and $proc.Name -match '^claude(\.exe)?$') { $claudePid = [int]$current }
  if ($claudePid -ne 0) {
    $wins = @()
    try { $wins = [WinSpawn]::GetWindows([uint32]$current) } catch {}
    if ($wins.Count -gt 0) {
      foreach ($w in $wins) {
        $parts = $w -split '\|', 2
        if ($parts[1] -like "*$projectHint*") { $hostHwnd = [int64]$parts[0]; break }
      }
      if ($hostHwnd -eq 0) {
        if ($wins.Count -eq 1) { $hostHwnd = [int64](($wins[0] -split '\|', 2)[0]) }
        else {
          try { $p = Get-Process -Id $current; if ([int64]$p.MainWindowHandle -ne 0) { $hostHwnd = [int64]$p.MainWindowHandle } } catch {}
          if ($hostHwnd -eq 0) { $hostHwnd = [int64](($wins[0] -split '\|', 2)[0]) }
        }
      }
      break
    }
  }
  if (-not $proc.ParentProcessId) { break }
  $current = $proc.ParentProcessId
}

if ($claudePid -eq 0 -or $hostHwnd -eq 0) { exit 0 }  # headless/не нашли — молча выходим

# --- 2. Не плодить вотчеры: маркер с pid вотчера на каждый claudePid ---
$marker = Join-Path $env:TEMP "claude-desktop-watcher-$claudePid.pid"
if (Test-Path $marker) {
  $oldPid = Get-Content $marker -ErrorAction SilentlyContinue
  if ($oldPid -and (Get-Process -Id $oldPid -ErrorAction SilentlyContinue).ProcessName -eq "powershell") { exit 0 }
}

# --- 3. Запуск вотчера скрытым отдельным процессом ---
$watcher = Join-Path $PSScriptRoot "desktop-watcher.ps1"
$p = Start-Process powershell -WindowStyle Hidden -PassThru -ArgumentList @(
  "-NoProfile", "-ExecutionPolicy", "Bypass", "-WindowStyle", "Hidden",
  "-File", $watcher, "-RootPid", $claudePid, "-HostHwnd", $hostHwnd
)
if ($p) { Set-Content -Path $marker -Value $p.Id }
exit 0
