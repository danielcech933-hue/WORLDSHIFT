$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$launcher = Join-Path $root 'tools\roblox-forge\online-mode-launcher.vbs'
$taskName = 'ROBLOX FORGE Online Mode'
$action = New-ScheduledTaskAction -Execute 'wscript.exe' -Argument ('"' + $launcher + '"')
$trigger = New-ScheduledTaskTrigger -AtLogOn
$principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel Limited
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1)
Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Force | Out-Null
Start-ScheduledTask -TaskName $taskName
Write-Host "[ROBLOX FORGE] Online Mode installed and started."
Write-Host "Task: $taskName"
