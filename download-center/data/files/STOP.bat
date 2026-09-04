@echo off
title Stop Gold Sampling System
cd /d "%~dp0"

echo Stopping Gold Sampling System...
echo.

:: 1) Create stop flag so the launcher exits cleanly (no auto-restart)
echo stop > stop.flag

:: 2) Kill the web server listening on port 3000
powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }"

:: 3) Kill any launcher (watchdog) node processes
powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \"Name='node.exe'\" | Where-Object { $_.CommandLine -like '*launcher.mjs*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }"

timeout /t 2 /nobreak >nul
del stop.flag >nul 2>&1
del .run.lock >nul 2>&1

echo.
echo Done. The program is fully stopped.
echo.
pause
