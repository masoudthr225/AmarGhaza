@echo off
title Gold Sampling System - Console Mode
cd /d "%~dp0"
echo.
echo   ================================================
echo     GOLD SAMPLING SYSTEM - Console (troubleshooting)
echo   ================================================
echo.
echo Checking Python...
where python >nul 2>&1
if %errorlevel% neq 0 (
    echo   [FAIL] Python NOT found in PATH!
    echo   Install Python 3 from https://python.org
    echo   and check "Add python.exe to PATH" during install.
    pause
    exit /b 1
)
python --version
echo.
echo Starting server at http://127.0.0.1:3000
echo Keep this window OPEN while using the program.
echo To stop: close this window or press Ctrl+C.
echo.
start "" http://127.0.0.1:3000
python app.py --serve
pause
