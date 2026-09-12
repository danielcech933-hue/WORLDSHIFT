@echo off
setlocal
cd /d "%~dp0..\.."
set "FORGE_PROJECT_ROOT=%CD%"
start "ROBLOX FORGE Git Sync" /b node "%CD%\tools\roblox-forge\git-sync.mjs"
node "%CD%\tools\roblox-forge\approval-bridge.mjs"
pause
