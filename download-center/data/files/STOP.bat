@echo off
title Stop Gold Sampling System
cd /d "%~dp0"

echo Stopping Gold Sampling System...
echo.

:: 1) Create stop flag so the watchdog exits cleanly (no auto-restart)
echo stop > stop.flag

:: 2) Kill the web server listening on port 3000
powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }"

:: 3) Kill the app (python) processes
powershell -NoProfile -Command "Get-CimInstance Win32_Process -ErrorAction SilentlyContinue | Where-Object { ($_.Name -eq 'pythonw.exe' -or $_.Name -eq 'python.exe') -and $_.CommandLine -like '*app.py*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }"

timeout /t 2 /nobreak >nul
del stop.flag >nul 2>&1
del .run.lock >nul 2>&1

echo.
echo Done. The program is fully stopped.
echo.
pause
