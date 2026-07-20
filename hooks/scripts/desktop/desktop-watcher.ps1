# Фоновый вотчер: переносит новые окна потомков процесса Claude на стол сессии.
# Запускается spawn-desktop-watcher.ps1 (SessionStart hook), живёт пока жив RootPid.
param(
  [Parameter(Mandatory = $true)][int]$RootPid,    # pid процесса claude этой сессии
  [Parameter(Mandatory = $true)][int64]$HostHwnd, # окно-хост сессии (Zed/терминал)
  [int]$PollMs = 700
)
$ErrorActionPreference = "SilentlyContinue"
$vd = Join-Path $PSScriptRoot "bin\VirtualDesktop.exe"
if (-not (Test-Path $vd)) { exit 0 }  # без утилиты столов вотчер бесполезен

Add-Type -TypeDefinition @'
using System;
using System.Text;
using System.Collections.Generic;
using System.Runtime.InteropServices;
public class WinWatch {
  [DllImport("user32.dll")] static extern bool EnumWindows(EnumWindowsProc cb, IntPtr lp);
  [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
  [DllImport("user32.dll")] static extern int GetWindowText(IntPtr h, StringBuilder sb, int max);
  [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr h);
  [DllImport("user32.dll")] public static extern bool IsWindow(IntPtr h);
  [StructLayout(LayoutKind.Sequential)] struct LASTINPUTINFO { public uint cbSize; public uint dwTime; }
  [DllImport("user32.dll")] static extern bool GetLastInputInfo(ref LASTINPUTINFO plii);
  delegate bool EnumWindowsProc(IntPtr h, IntPtr lp);
  public static bool IsAlive(long h) { return IsWindow(new IntPtr(h)); }
  // мс с последнего ввода пользователя (клавиатура/мышь)
  public static long IdleMs() {
    var lii = new LASTINPUTINFO(); lii.cbSize = (uint)Marshal.SizeOf(typeof(LASTINPUTINFO));
    if (!GetLastInputInfo(ref lii)) return long.MaxValue;
    return (long)(unchecked((uint)Environment.TickCount) - lii.dwTime);
  }
  // "hwnd|pid" всех видимых окон с заголовком
  public static List<string> Snapshot() {
    var result = new List<string>();
    EnumWindows((h, lp) => {
      if (IsWindowVisible(h)) {
        var sb = new StringBuilder(4); GetWindowText(h, sb, 4);
        if (sb.Length > 0) {
          uint pid; GetWindowThreadProcessId(h, out pid);
          result.Add(h.ToInt64() + "|" + pid);
        }
      }
      return true;
    }, IntPtr.Zero);
    return result;
  }
}
'@

function Get-DescendantPids([int]$root) {
  $all = Get-CimInstance Win32_Process | Select-Object ProcessId, ParentProcessId
  $children = @{}
  foreach ($p in $all) {
    if (-not $children.ContainsKey([int]$p.ParentProcessId)) { $children[[int]$p.ParentProcessId] = @() }
    $children[[int]$p.ParentProcessId] += [int]$p.ProcessId
  }
  $set = New-Object System.Collections.Generic.HashSet[int]
  $queue = New-Object System.Collections.Queue
  $queue.Enqueue($root)
  while ($queue.Count -gt 0) {
    $cur = $queue.Dequeue()
    if (-not $set.Add($cur)) { continue }
    if ($children.ContainsKey($cur)) { foreach ($c in $children[$cur]) { $queue.Enqueue($c) } }
  }
  return $set
}

# Активность сессии: PreToolUse/PostToolUse-хуки обновляют этот файл. Если окно
# появилось в течение ACTIVITY_WINDOW секунд после команды — переносим его, даже
# когда процесс не потомок (store-приложения, терминал, уже запущенный браузер).
$activityFile = Join-Path $env:TEMP "claude-tool-activity.txt"
$activityWindowSec = 10
# Системные окна, которые юзер открывает сам — их не таскаем никогда
$blacklist = @("explorer", "searchhost", "startmenuexperiencehost", "shellexperiencehost", "textinputhost", "taskmgr", "lockapp")

# стартовый снапшот: существующие окна не трогаем
$known = New-Object System.Collections.Generic.HashSet[long]
foreach ($w in [WinWatch]::Snapshot()) { $null = $known.Add([long]($w -split '\|')[0]) }

while ($true) {
  if (-not (Get-Process -Id $RootPid -ErrorAction SilentlyContinue)) { break }  # сессия умерла
  if (-not [WinWatch]::IsAlive($HostHwnd)) { break }                            # окно-хост закрыто

  $snap = [WinWatch]::Snapshot()
  $fresh = @()
  foreach ($w in $snap) {
    $parts = $w -split '\|'
    if ($known.Add([long]$parts[0])) { $fresh += , @([long]$parts[0], [int]$parts[1]) }
  }

  if ($fresh.Count -gt 0) {
    $desc = Get-DescendantPids $RootPid   # дерево процессов запрашиваем только при новых окнах
    $null = & $vd "/GetDesktopFromWindowHandle:$HostHwnd" 2>$null
    $hostDesk = $LASTEXITCODE
    foreach ($f in $fresh) {
      $move = $desc.Contains($f[1])
      if (-not $move) {
        # Не потомок: двигаем, только если (а) сессия недавно выполняла команду
        # И (б) пользователь ничего не нажимал ~2.5с — иначе это его ручной запуск
        # (клик/Enter за мгновение до появления окна), такие окна не трогаем.
        $act = Get-Item $activityFile -ErrorAction SilentlyContinue
        if ($act -and ((Get-Date) - $act.LastWriteTime).TotalSeconds -lt $activityWindowSec -and
            [WinWatch]::IdleMs() -gt 2500) {
          $pname = ""
          try { $pname = (Get-Process -Id $f[1] -ErrorAction Stop).ProcessName.ToLower() } catch {}
          # Родитель explorer = запуск ярлыком/Пуском/панелью задач — это всегда
          # ручной запуск пользователя, даже если окно появилось спустя секунды
          # (холодный старт браузера). Такое не трогаем.
          $manualLaunch = $false
          $chainPid = [int]$f[1]
          for ($lvl = 0; $lvl -lt 2 -and -not $manualLaunch; $lvl++) {
            try {
              $chainPid = [int](Get-CimInstance Win32_Process -Filter "ProcessId=$chainPid" -ErrorAction Stop).ParentProcessId
              if ((Get-Process -Id $chainPid -ErrorAction Stop).ProcessName.ToLower() -eq "explorer") { $manualLaunch = $true }
            } catch { break }
          }
          if ($pname -and ($blacklist -notcontains $pname) -and -not $manualLaunch) { $move = $true }
        }
      }
      if ($move) {
        $null = & $vd "/GetDesktopFromWindowHandle:$($f[0])" 2>$null
        if ($LASTEXITCODE -ne $hostDesk) {
          $null = & $vd "/GetDesktop:$hostDesk" "/MoveWindowHandle:$($f[0])" 2>$null
        }
      }
    }
  }
  Start-Sleep -Milliseconds $PollMs
}
