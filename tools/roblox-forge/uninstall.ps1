$ErrorActionPreference = 'Stop'

$pluginTarget = Join-Path $env:LOCALAPPDATA 'Roblox\Plugins\RobloxForge.lua'

if (Test-Path $pluginTarget) {
    Remove-Item -Force $pluginTarget
    Write-Host '[OK] Roblox Forge Studio plugin removed.' -ForegroundColor Green
} else {
    Write-Host '[INFO] Roblox Forge Studio plugin was not installed.'
}
