# ARGO DESK - automatic start at logon, with restart if it stops.
#
#   install-autostart.ps1             create (or update) the scheduled task "ARGO DESK"
#                                     and the two desktop icons, then start the task
#   install-autostart.ps1 -Start      enable and start the task   (icon AVVIA ARGO DESK)
#   install-autostart.ps1 -Stop       disable the task, stop the desk (icon FERMA ARGO DESK)
#   install-autostart.ps1 -Uninstall  stop the desk, remove the task and the icons
#
# The task runs only while the user is logged on, without administrator rights. It
# starts autostart.ps1 at logon and checks every minute that it is still running:
# a closed window or a crash brings the desk back within about a minute.

param([switch]$Start, [switch]$Stop, [switch]$Uninstall)

$TaskName = 'ARGO DESK'
$Here = $PSScriptRoot
$HereRx = [regex]::Escape($Here)  # this folder, whatever it is called on this PC
$Launcher = Join-Path $Here 'autostart.ps1'
$Self = Join-Path $Here 'install-autostart.ps1'
$Desktop = [Environment]::GetFolderPath('Desktop')
$StopIcon = Join-Path $Desktop 'FERMA ARGO DESK.bat'
$StartIcon = Join-Path $Desktop 'AVVIA ARGO DESK.bat'
$User = [Security.Principal.WindowsIdentity]::GetCurrent().Name
$Browsers = @('chrome.exe', 'msedge.exe', 'firefox.exe', 'brave.exe', 'opera.exe')

function Stop-Desk {
    # The launcher (autostart.ps1) or a manual start.bat, with everything they started,
    # except a browser opened by the dashboard; then any desk process left over.
    Stop-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
    $all = @(Get-CimInstance Win32_Process)
    $ids = @($all | Where-Object {
            ($_.Name -eq 'powershell.exe' -and $_.CommandLine -match '\\autostart\.ps1') -or
            ($_.Name -eq 'cmd.exe' -and $_.CommandLine -match ($HereRx + '\\start\.bat'))
        } | ForEach-Object { $_.ProcessId })
    do {
        $added = $false
        foreach ($p in $all) {
            if (($ids -contains $p.ParentProcessId) -and -not ($ids -contains $p.ProcessId)) { $ids += $p.ProcessId; $added = $true }
        }
    } while ($added)
    $victims = @($all | Where-Object {
            (($ids -contains $_.ProcessId) -and ($Browsers -notcontains $_.Name)) -or
            ($_.Name -in @('python.exe', 'desk.exe') -and $_.CommandLine -match ($HereRx + '\\\.venv'))
        })
    foreach ($v in $victims) { Stop-Process -Id $v.ProcessId -Force -ErrorAction SilentlyContinue }
    return $victims.Count
}

if ($Stop -or $Uninstall) {
    Disable-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue | Out-Null
    $count = Stop-Desk
    if ($Uninstall) {
        Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction SilentlyContinue
        Remove-Item -LiteralPath $StopIcon, $StartIcon -ErrorAction SilentlyContinue
        Write-Host "ARGO DESK fermato ($count processi chiusi). Avvio automatico e icone rimossi."
    }
    else {
        Write-Host "ARGO DESK fermato ($count processi chiusi)."
        Write-Host "Non ripartira' da solo finche' non usi AVVIA ARGO DESK sul desktop."
    }
    return
}

if ($Start) {
    Enable-ScheduledTask -TaskName $TaskName | Out-Null
    Start-ScheduledTask -TaskName $TaskName
    Write-Host "ARGO DESK riparte in una finestra ridotta a icona: ARGO DESK - NON CHIUDERE."
    Write-Host "Dashboard: http://127.0.0.1:9787 (se occupata, la porta e' scritta in quella finestra)."
    return
}

# --- install or update -------------------------------------------------------------
$action = New-ScheduledTaskAction -Execute 'powershell.exe' -WorkingDirectory $Here `
    -Argument "-NoProfile -ExecutionPolicy Bypass -WindowStyle Minimized -File `"$Launcher`""
$atLogon = New-ScheduledTaskTrigger -AtLogOn -User $User
$atLogon.Delay = 'PT30S'  # let the network come up first
$everyMinute = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1) -RepetitionInterval (New-TimeSpan -Minutes 1)
$everyMinute.Repetition.Duration = ''  # repeat for ever
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable `
    -MultipleInstances IgnoreNew -ExecutionTimeLimit ([TimeSpan]::Zero) -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1)
$principal = New-ScheduledTaskPrincipal -UserId $User -LogonType Interactive -RunLevel Limited
Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $atLogon, $everyMinute -Settings $settings -Principal $principal `
    -Description 'ARGO DESK in paper trading: parte all accesso e riparte entro un minuto se si ferma. Per fermarlo: FERMA ARGO DESK sul desktop.' `
    -Force | Out-Null

Set-Content -LiteralPath $StopIcon -Encoding ASCII -Value @(
    '@echo off', 'title FERMA ARGO DESK',
    "powershell -NoProfile -ExecutionPolicy Bypass -File `"$Self`" -Stop",
    'echo.', 'pause')
Set-Content -LiteralPath $StartIcon -Encoding ASCII -Value @(
    '@echo off', 'title AVVIA ARGO DESK',
    "powershell -NoProfile -ExecutionPolicy Bypass -File `"$Self`" -Start",
    'echo.', 'pause')

Start-ScheduledTask -TaskName $TaskName
Write-Host "Attivita' '$TaskName' creata e avviata. Icone sul desktop: FERMA ARGO DESK e AVVIA ARGO DESK."
