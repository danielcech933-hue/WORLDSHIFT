@echo off
setlocal
cd /d "%~dp0..\.."
set "FORGE_PROJECT_ROOT=%CD%"
title ROBLOX FORGE - ONLINE MODE
node "%CD%\tools\roblox-forge\online-mode.mjs"
pause
