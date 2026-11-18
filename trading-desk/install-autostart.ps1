# ARGO DESK - automatic start at logon, with restart if it stops. One task per desk.
#
#   install-autostart.ps1 [-Market spot|perps]             create (or update) the task
#                                                           and its two desktop icons,
#                                                           then start it
#   install-autostart.ps1 [-Market spot|perps] -Start      enable and start the task
#   install-autostart.ps1 [-Market spot|perps] -Stop       disable the task, stop that desk
#   install-autostart.ps1 [-Market spot|perps] -Uninstall  stop it, remove task and icons
#
# spot (the default) is the task "ARGO DESK", perps is "ARGO DESK PERPETUI". Each one
# starts and stops only its own desk, in the background, with no window. The task runs
# only while the user is logged on, without administrator rights. It starts
# autostart.ps1 at logon and checks every minute that it is still running: a crash
# brings the desk back within about a minute.

param(
    [ValidateSet('spot', 'perps')][string]$Market = 'spot',
    [switch]$Start, [switch]$Stop, [switch]$Uninstall
)
$Market = $Market.ToLowerInvariant()  # ValidateSet ignores case, the desk's --market does not

$TaskName = @{ spot = 'ARGO DESK'; perps = 'ARGO DESK PERPETUI' }[$Market]
$Here = $PSScriptRoot
$HereRx = [regex]::Escape($Here)  # this folder, whatever it is called on this PC
$Launcher = Join-Path $Here 'autostart.ps1'
$Self = Join-Path $Here 'install-autostart.ps1'
$Desktop = [Environment]::GetFolderPath('Desktop')
$StopIcon = Join-Path $Desktop "FERMA $TaskName.bat"
$StartIcon = Join-Path $Desktop "AVVIA $TaskName.bat"
$User = [Security.Principal.WindowsIdentity]::GetCurrent().Name
# The only programs a desk is made of. Nothing else is ever stopped, and the search for
# what a launcher started never passes through anything else (a browser, Explorer...).
$DeskImages = @('powershell.exe', 'cmd.exe', 'conhost.exe', 'uv.exe', 'desk.exe', 'python.exe')

function Test-Market([string]$CommandLine) {
    # Which desk a command line belongs to. Older launchers and start.bat name no market:
    # they are the spot desk.
    $perps = ($CommandLine -match '-Market\s+perps') -or ($CommandLine -match '--market[\s=]+perps') -or
        ($CommandLine -match 'start-perps\.bat')
    if ($Market -eq 'perps') { return $perps }
    return -not $perps
}

function Stop-Desk {
    # This desk's launcher (autostart.ps1) or manual start, with the desk programs they
    # started (nothing else: see $DeskImages); then any of its desk processes left over.
    Stop-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
    $all = @(Get-CimInstance Win32_Process)
    $byId = @{}
    foreach ($p in $all) { $byId[[int]$p.ProcessId] = $p }
    $ids = @($all | Where-Object {
            (($_.Name -eq 'powershell.exe' -and $_.CommandLine -match ($HereRx + '\\autostart\.ps1')) -or
            ($_.Name -eq 'cmd.exe' -and $_.CommandLine -match ($HereRx + '\\start(-perps)?\.bat'))) -and
            (Test-Market $_.CommandLine)
        } | ForEach-Object { [int]$_.ProcessId })
    do {
        $added = $false
        foreach ($p in $all) {
            $child = [int]$p.ProcessId
            $parent = [int]$p.ParentProcessId
            # Windows reuses the number of a process that has ended: a real child is never
            # older than its parent, so an older process only looks like one.
            if (($ids -contains $parent) -and -not ($ids -contains $child) -and ($DeskImages -contains $p.Name) -and
                $byId.ContainsKey($parent) -and ($p.CreationDate -ge $byId[$parent].CreationDate)) {
                $ids += $child
                $added = $true
            }
        }
    } while ($added)
    $victims = @($all | Where-Object {
            (($ids -contains [int]$_.ProcessId) -and ($DeskImages -contains $_.Name)) -or
            ($_.Name -in @('python.exe', 'desk.exe') -and $_.CommandLine -match ($HereRx + '\\\.venv') -and
            ($_.CommandLine -match '\brun\b') -and (Test-Market $_.CommandLine))
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
        Write-Host "$TaskName fermato ($count processi chiusi). Avvio automatico e icone rimossi."
    }
    else {
        Write-Host "$TaskName fermato ($count processi chiusi)."
        Write-Host "Non ripartira' da solo finche' non usi AVVIA $TaskName sul desktop."
    }
    return
}

if ($Start) {
    Enable-ScheduledTask -TaskName $TaskName | Out-Null
    Start-ScheduledTask -TaskName $TaskName
    Write-Host "$TaskName riparte in background, senza finestre."
    Write-Host "Dashboard: spot su http://127.0.0.1:9787, perpetui su http://127.0.0.1:9788 (di solito)."
    return
}

# --- install or update -------------------------------------------------------------
# The launcher runs hidden, in a classic console (conhost), never in Windows Terminal.
# The PC is shared at the office and a visible window gets closed; and Terminal hosts
# every console of the session in one window, so closing it took both desks and the
# user's other console windows with it. A hidden conhost console stands alone.
$conhost = Join-Path $env:WINDIR 'System32\conhost.exe'
$action = New-ScheduledTaskAction -Execute $conhost -WorkingDirectory $Here `
    -Argument "powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$Launcher`" -Market $Market"
$atLogon = New-ScheduledTaskTrigger -AtLogOn -User $User
$atLogon.Delay = 'PT30S'  # let the network come up first
$everyMinute = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1) -RepetitionInterval (New-TimeSpan -Minutes 1)
$everyMinute.Repetition.Duration = ''  # repeat for ever
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable `
    -MultipleInstances IgnoreNew -ExecutionTimeLimit ([TimeSpan]::Zero) -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1)
$principal = New-ScheduledTaskPrincipal -UserId $User -LogonType Interactive -RunLevel Limited
Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $atLogon, $everyMinute -Settings $settings -Principal $principal `
    -Description "$TaskName in paper trading: parte all accesso e riparte entro un minuto se si ferma. Per fermarlo: FERMA $TaskName sul desktop." `
    -Force | Out-Null

Set-Content -LiteralPath $StopIcon -Encoding ASCII -Value @(
    '@echo off', "title FERMA $TaskName",
    "powershell -NoProfile -ExecutionPolicy Bypass -File `"$Self`" -Market $Market -Stop",
    'echo.', 'pause')
Set-Content -LiteralPath $StartIcon -Encoding ASCII -Value @(
    '@echo off', "title AVVIA $TaskName",
    "powershell -NoProfile -ExecutionPolicy Bypass -File `"$Self`" -Market $Market -Start",
    'echo.', 'pause')

Start-ScheduledTask -TaskName $TaskName
Write-Host "Attivita' '$TaskName' creata e avviata. Icone sul desktop: FERMA $TaskName e AVVIA $TaskName."
