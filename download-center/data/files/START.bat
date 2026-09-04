@echo off
title Gold Sampling System - Console Mode
cd /d "%~dp0"
echo.
echo   ================================================
echo     GOLD SAMPLING SYSTEM - Console (troubleshooting)
echo   ================================================
echo.

echo [1/4] Checking Node.js...
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo   [FAIL] Node.js NOT installed!
    echo   Install the LTS version from https://nodejs.org then run this again.
    pause
    exit /b 1
)
echo   [OK] Node.js found:
node --version

echo [2/4] Installing dependencies ^(first time only^)...
if not exist "node_modules" (
    call npm install --no-audit --no-fund
    if %errorlevel% neq 0 (
        echo   [FAIL] npm install failed. Check your internet connection.
        pause
        exit /b 1
    )
) else (
    echo   [OK] Already installed.
)

echo [3/4] Generating database client...
call npm run db:generate
if %errorlevel% neq 0 (
    echo   [FAIL] prisma generate failed.
    pause
    exit /b 1
)

echo [4/4] Building the app if needed...
if not exist ".next\BUILD_ID" (
    echo   Building... this can take a few minutes the first time.
    call npm run build
    if %errorlevel% neq 0 (
        echo   [FAIL] build failed.
        pause
        exit /b 1
    )
) else (
    echo   [OK] Build exists.
)

echo.
echo   Starting server at http://127.0.0.1:3000
echo   Keep this window OPEN while using the program.
echo   To stop: close this window or press Ctrl+C.
echo.
start "" http://127.0.0.1:3000
call npm run start
pause
