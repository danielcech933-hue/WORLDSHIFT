$ErrorActionPreference = 'Stop'

$forgeRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = Resolve-Path (Join-Path $forgeRoot '..\..')
$pluginSource = Join-Path $forgeRoot 'studio\ForgePlugin.server.lua'

$localPlugins = Join-Path $env:LOCALAPPDATA 'Roblox\Plugins'
$pluginTarget = Join-Path $localPlugins 'RobloxForge.lua'

Write-Host ''
Write-Host '========================================' -ForegroundColor Cyan
Write-Host '         ROBLOX FORGE INSTALLER' -ForegroundColor Cyan
Write-Host '========================================' -ForegroundColor Cyan
Write-Host ''

if (-not (Test-Path $pluginSource)) {
    throw "Forge Studio plugin was not found: $pluginSource"
}

New-Item -ItemType Directory -Force -Path $localPlugins | Out-Null
Copy-Item -Force $pluginSource $pluginTarget

Write-Host "[OK] Studio plugin installed:" -ForegroundColor Green
Write-Host "     $pluginTarget"

$node = Get-Command node -ErrorAction SilentlyContinue
if (-not $node) {
    Write-Host ''
    Write-Host '[WARN] Node.js was not found in PATH.' -ForegroundColor Yellow
    Write-Host '       Install Node.js 20+ and run this installer again.'
    exit 0
}

$nodeVersion = (& node --version).Trim()
Write-Host "[OK] Node.js: $nodeVersion" -ForegroundColor Green

Write-Host ''
Write-Host 'Forge is installed.' -ForegroundColor Green
Write-Host ''
Write-Host 'Start Forge with:' -ForegroundColor White
Write-Host "  cd `"$repoRoot`"" -ForegroundColor DarkGray
Write-Host '  node tools\roblox-forge\forge-server.mjs' -ForegroundColor DarkGray
Write-Host ''
Write-Host 'Then restart Roblox Studio so the local plugin loads cleanly.' -ForegroundColor Yellow
Write-Host ''
