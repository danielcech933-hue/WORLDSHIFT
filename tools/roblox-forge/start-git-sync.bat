@echo off
setlocal
cd /d "%~dp0..\.."
set "FORGE_PROJECT_ROOT=%CD%"
node "%CD%\tools\roblox-forge\git-sync.mjs"
pause
