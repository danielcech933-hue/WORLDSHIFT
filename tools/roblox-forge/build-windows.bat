@echo off
setlocal EnableExtensions
cd /d "%~dp0"

echo.
echo ========================================
echo       ROBLOX FORGE 1.0 WINDOWS BUILD
echo ========================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Node.js is required.
  pause
  exit /b 1
)

node --version
if errorlevel 1 goto :fail

echo.
echo [1/3] Installing / refreshing dependencies...
call npm install
if errorlevel 1 goto :fail

echo.
echo [2/3] Cleaning previous release output...
if exist dist rmdir /s /q dist
if errorlevel 1 goto :fail

echo.
echo [3/3] Building Windows installer and portable EXE...
call npm run build:win
if errorlevel 1 goto :fail

echo.
echo ========================================
echo       ROBLOX FORGE BUILD COMPLETE
echo ========================================
echo.
echo Release files:
echo   %~dp0dist
echo.
explorer "%~dp0dist"
exit /b 0

:fail
echo.
echo [ERROR] Build failed. Check the output above.
pause
exit /b 1
