@echo off
setlocal
cd /d "%~dp0"
echo.
echo ========================================
echo        ROBLOX FORGE WINDOWS BUILD
echo ========================================
echo.
where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Node.js 20+ is required.
  pause
  exit /b 1
)
if not exist node_modules (
  echo [1/2] Installing build dependencies...
  call npm install
  if errorlevel 1 goto :fail
) else (
  echo [1/2] Build dependencies already installed.
)
echo [2/2] Building Windows installer and portable EXE...
call npm run build:win
if errorlevel 1 goto :fail
echo.
echo [OK] Build finished. Files are in:
echo      %~dp0dist
echo.
explorer "%~dp0dist"
exit /b 0
:fail
echo.
echo [ERROR] Build failed. Check the output above.
pause
exit /b 1
