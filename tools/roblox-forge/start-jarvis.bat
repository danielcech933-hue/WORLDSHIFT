@echo off
setlocal
cd /d "%~dp0..\.."
set "FORGE_PROJECT_ROOT=%CD%"
set "JARVIS_PORT=43119"
set "JARVIS_POLICY=supervised"
set "JARVIS_MODEL=qwen2.5-coder:7b"
echo.
echo ========================================
echo        ROBLOX FORGE - JARVIS
echo ========================================
echo.
echo Project: %FORGE_PROJECT_ROOT%
echo URL:     http://127.0.0.1:%JARVIS_PORT%
echo.
node "%CD%\tools\roblox-forge\jarvis-backend.mjs"
pause
