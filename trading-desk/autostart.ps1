# ARGO DESK launcher for the scheduled task created by install-autostart.ps1.
#
#   autostart.ps1 [-Market spot|perps]
#
# Keeps one desk running in paper trading: it starts `desk run --market <market>`, and
# starts it again 30 seconds after it stops for any reason. The window is minimized and
# titled "<name> - NON CHIUDERE"; to stop the desk on purpose use the FERMA icon.
# The environment is cleaned of the variables a Claude Code shell would pass on.

param([ValidateSet('spot', 'perps')][string]$Market = 'spot')

$Name = @{ spot = 'ARGO DESK'; perps = 'ARGO DESK PERPETUI' }[$Market]
$Host.UI.RawUI.WindowTitle = "$Name - NON CHIUDERE"
Set-Location -LiteralPath $PSScriptRoot
$inherited = @(Get-ChildItem Env: | Where-Object { $_.Name -match '^(ANTHROPIC_|CLAUDE)' } | ForEach-Object { $_.Name })
foreach ($name in $inherited) { [Environment]::SetEnvironmentVariable($name, $null, 'Process') }
[Environment]::SetEnvironmentVariable('DESK_MARKET', $null, 'Process')  # --market decides
$env:PYTHONUTF8 = '1'
$uv = (Get-Command uv.exe -ErrorAction SilentlyContinue).Source
if (-not $uv) { $uv = Join-Path $env:USERPROFILE '.local\bin\uv.exe' }
$logName = @{ spot = 'autostart.log'; perps = 'autostart-perps.log' }[$Market]
$log = Join-Path $PSScriptRoot "data\$logName"
function Write-Log([string]$text) {
    $line = '{0} {1}' -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $text
    Write-Host $line
    try { Add-Content -LiteralPath $log -Value $line -Encoding UTF8 } catch { }
}
Write-Log "avvio automatico di $Name (PID $PID)"
Write-Host "Questa finestra tiene acceso $Name. Per fermarlo usa FERMA $Name sul desktop."
while ($true) {
    Write-Log "avvio di $Name in paper trading"
    & $uv run desk run --market $Market --rules-if-no-key --dashboard
    Write-Log "$Name si e' fermato (codice $LASTEXITCODE): riparte tra 30 secondi"
    Start-Sleep -Seconds 30
}
