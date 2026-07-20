# Запускает GUI-приложение и переносит его окно на тот виртуальный стол,
# где находится окно-хост текущей сессии Claude Code (терминал/Zed).
#
# Важно: у хост-процесса (Zed, Windows Terminal) может быть НЕСКОЛЬКО окон на
# разных столах, а Process.MainWindowHandle — это «последнее активное окно», то
# есть обычно окно, где сейчас пользователь. Поэтому перечисляем все окна
# процесса-предка и выбираем то, чей заголовок содержит имя папки проекта.
#
# Использование:
#   powershell -File run-on-my-desktop.ps1 -FilePath notepad.exe
#   powershell -File run-on-my-desktop.ps1 -FilePath "C:\path\app.exe" -ArgumentList "--flag" -ProjectHint myproject
param(
  [Parameter(Mandatory = $true)][string]$FilePath,
  [string[]]$ArgumentList,
  [string]$ProjectHint,   # подстрока заголовка окна сессии; по умолчанию — имя текущей папки
  [int]$TimeoutSec = 20
)

$ErrorActionPreference = "Stop"
$vd = Join-Path $PSScriptRoot "bin\VirtualDesktop.exe"
if (-not (Test-Path $vd)) { Write-Output "VirtualDesktop.exe not found next to script; aborting"; exit 1 }
if (-not $ProjectHint) { $ProjectHint = Split-Path -Leaf (Get-Location) }

Add-Type -TypeDefinition @'
using System;
using System.Text;
using System.Collections.Generic;
using System.Runtime.InteropServices;
public class WinEnum {
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

# --- 1. Окно-хост: идём по предкам, у первого процесса с окнами выбираем окно сессии ---
function Get-HostWindowHandle {
  $current = $PID
  for ($i = 0; $i -lt 15; $i++) {
    $proc = Get-CimInstance Win32_Process -Filter "ProcessId=$current" -ErrorAction SilentlyContinue
    if (-not $proc) { break }
    $wins = @()
    try { $wins = [WinEnum]::GetWindows([uint32]$current) } catch {}
    if ($wins.Count -gt 0) {
      # приоритет: окно, в заголовке которого имя папки проекта
      foreach ($w in $wins) {
        $parts = $w -split '\|', 2
        if ($parts[1] -like "*$ProjectHint*") { return [int64]$parts[0] }
      }
      if ($wins.Count -eq 1) { return [int64](($wins[0] -split '\|', 2)[0]) }
      # несколько окон, ни одно не совпало — MainWindowHandle лучше, чем ничего
      try {
        $p = Get-Process -Id $current -ErrorAction Stop
        if ([int64]$p.MainWindowHandle -ne 0) { return [int64]$p.MainWindowHandle }
      } catch {}
      return [int64](($wins[0] -split '\|', 2)[0])
    }
    if (-not $proc.ParentProcessId) { break }
    $current = $proc.ParentProcessId
  }
  return 0
}

$hostHwnd = Get-HostWindowHandle
$hostDesktop = -1
if ($hostHwnd -ne 0) {
  $null = & $vd "/GetDesktopFromWindowHandle:$hostHwnd" 2>$null
  $hostDesktop = $LASTEXITCODE  # утилита возвращает номер стола через exit code
}

# --- 2. Запуск приложения ---
if ($ArgumentList) {
  $app = Start-Process -FilePath $FilePath -ArgumentList $ArgumentList -PassThru
} else {
  $app = Start-Process -FilePath $FilePath -PassThru
}

if ($hostDesktop -lt 0) {
  Write-Output "launched '$FilePath' (pid $($app.Id)); host desktop unknown, window left as is"
  exit 0
}

# --- 3. Ждём главное окно (приложение может перепорождать процесс — ищем и по имени) ---
$exeName = [IO.Path]::GetFileNameWithoutExtension($FilePath)
$hwnd = 0
$deadline = (Get-Date).AddSeconds($TimeoutSec)
while ((Get-Date) -lt $deadline) {
  try {
    $app.Refresh()
    if (-not $app.HasExited -and [int64]$app.MainWindowHandle -ne 0) { $hwnd = [int64]$app.MainWindowHandle; break }
  } catch {}
  # fallback: одноимённый процесс с окном (single-instance приложения)
  $cand = Get-Process -Name $exeName -ErrorAction SilentlyContinue |
    Where-Object { [int64]$_.MainWindowHandle -ne 0 } |
    Sort-Object StartTime -Descending | Select-Object -First 1
  if ($cand) { $hwnd = [int64]$cand.MainWindowHandle; break }
  Start-Sleep -Milliseconds 250
}

if ($hwnd -eq 0) {
  Write-Output "launched '$FilePath' (pid $($app.Id)); no window appeared in ${TimeoutSec}s, nothing to move"
  exit 0
}

# --- 4. Переносим окно на стол хоста, если оно не там ---
$null = & $vd "/GetDesktopFromWindowHandle:$hwnd" 2>$null
if ($LASTEXITCODE -ne $hostDesktop) {
  $null = & $vd "/GetDesktop:$hostDesktop" "/MoveWindowHandle:$hwnd" 2>$null
  Write-Output "launched '$FilePath' (pid $($app.Id)), window moved to Claude's desktop #$hostDesktop"
} else {
  Write-Output "launched '$FilePath' (pid $($app.Id)), already on Claude's desktop #$hostDesktop"
}
exit 0
