# Dev-проверка PowerShell-скриптов плагина через PSScriptAnalyzer.
# Warning печатаем, Error валит проверку (exit 1).
$results = Invoke-ScriptAnalyzer -Path (Join-Path $PSScriptRoot "..\hooks\scripts\desktop") -Recurse -Severity Warning, Error
if ($results) { $results | Format-Table -AutoSize | Out-String | Write-Host }
if ($results | Where-Object Severity -eq "Error") { exit 1 }
Write-Host "PSScriptAnalyzer: OK ($($results.Count) warnings)"
exit 0
