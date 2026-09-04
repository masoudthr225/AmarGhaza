@echo off
chcp 65001 >nul 2>nul
title System Check - Gold Sampling
cd /d "%~dp0"
echo.
echo   ================================================
echo      SYSTEM CHECK - Gold Sampling System
echo   ================================================
echo.
set FAIL=0

echo [1/6] Checking Node.js...
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo   [FAIL] Node.js NOT installed!
    echo   Install the LTS version from: https://nodejs.org
    set FAIL=1
) else (
    for /f "delims=" %%v in ('node --version') do echo   [OK] Node.js %%v
)

echo [2/6] Checking npm...
where npm >nul 2>&1
if %errorlevel% neq 0 (
    echo   [FAIL] npm not found - reinstall Node.js
    set FAIL=1
) else (
    echo   [OK] npm found
)

echo [3/6] Checking dependencies (node_modules)...
if exist "node_modules" (
    echo   [OK] Installed
) else (
    echo   [WAIT] Not installed yet - will install automatically on first run
)

echo [4/6] Checking database client (Prisma)...
if exist "node_modules\.prisma\client" (
    echo   [OK] Database client ready
) else (
    echo   [WAIT] Will be generated automatically on first run
)

echo [5/6] Checking database file...
if exist "db\custom.db" (
    echo   [OK] db\custom.db found
) else (
    echo   [WARN] db\custom.db not found - a new empty database will be created
)

echo [6/6] Checking port 3000...
powershell -NoProfile -Command "if (Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue) { exit 0 } else { exit 1 }" >nul 2>&1
if %errorlevel% equ 0 (
    echo   [OK] Program is already running at http://127.0.0.1:3000
) else (
    echo   [INFO] Program is not running now - that is fine
)

echo.
echo   ================================================
if %FAIL% equ 1 (
    echo   RESULT: Fix the FAIL items above first.
) else (
    echo   RESULT: Everything looks good!
    echo.
    echo   قدم بعدی: روی فایل «اجرای برنامه.vbs» دابل‌کلیک کنید
    echo   Next step: double-click  اجرای برنامه.vbs
)
echo   ================================================
echo.
pause
