@echo off
setlocal

REM ============================================================
REM  Build the Windows desktop app (.exe) - run this on Windows.
REM  Requires Node.js (install from nodejs.org).
REM  Output: desktop\dist-win\*.exe
REM  NOTE: keep this file ASCII-only + CRLF, otherwise CMD breaks.
REM ============================================================

cd /d "%~dp0.."

echo == Syncing web files ==
if exist desktop\app rmdir /s /q desktop\app
mkdir desktop\app
copy index.html desktop\app\ >nul
xcopy /e /i /q css desktop\app\css >nul
xcopy /e /i /q js desktop\app\js >nul
if exist assets xcopy /e /i /q assets desktop\app\assets >nul

echo == Installing dependencies ==
cd desktop
call npm install
if errorlevel 1 goto err

echo == Building exe ==
call npm run dist
if errorlevel 1 goto err

echo.
echo [OK] Done. Files are in desktop\dist-win :
dir /b dist-win\*.exe
pause
exit /b 0

:err
echo.
echo [ERROR] Build failed. Make sure Node.js is installed (nodejs.org).
pause
exit /b 1
