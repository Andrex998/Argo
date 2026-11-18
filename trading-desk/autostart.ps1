# ARGO DESK launcher for the scheduled task created by install-autostart.ps1.
#
# Keeps the desk running in paper trading: it starts `desk run`, and starts it again
# 30 seconds after it stops for any reason. The window is minimized and titled
# "ARGO DESK - NON CHIUDERE"; to stop the desk on purpose use FERMA ARGO DESK.
# The environment is cleaned of the variables a Claude Code shell would pass on.

$Host.UI.RawUI.WindowTitle = 'ARGO DESK - NON CHIUDERE'
Set-Location -LiteralPath $PSScriptRoot
$inherited = @(Get-ChildItem Env: | Where-Object { $_.Name -match '^(ANTHROPIC_|CLAUDE)' } | ForEach-Object { $_.Name })
foreach ($name in $inherited) { [Environment]::SetEnvironmentVariable($name, $null, 'Process') }
$env:PYTHONUTF8 = '1'
$uv = (Get-Command uv.exe -ErrorAction SilentlyContinue).Source
if (-not $uv) { $uv = Join-Path $env:USERPROFILE '.local\bin\uv.exe' }
$log = Join-Path $PSScriptRoot 'data\autostart.log'
function Write-Log([string]$text) {
    $line = '{0} {1}' -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $text
    Write-Host $line
    try { Add-Content -LiteralPath $log -Value $line -Encoding UTF8 } catch { }
}
Write-Log "avvio automatico (PID $PID)"
Write-Host 'Questa finestra tiene acceso ARGO DESK. Per fermarlo usa FERMA ARGO DESK sul desktop.'
while ($true) {
    Write-Log 'avvio del desk in paper trading'
    & $uv run desk run --rules-if-no-key --dashboard
    Write-Log "il desk si e' fermato (codice $LASTEXITCODE): riparte tra 30 secondi"
    Start-Sleep -Seconds 30
}
