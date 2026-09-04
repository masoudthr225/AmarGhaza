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

echo [1/5] Checking program files extracted correctly...
if exist "app.py" (
    echo   [OK] Program files found
) else (
    echo   [FAIL] Files NOT extracted! Right-click the ZIP -^> Extract All,
    echo          then run اجرای برنامه.vbs from the extracted folder.
    set FAIL=1
)

echo [2/5] Checking Python...
where pythonw >nul 2>&1
if %errorlevel% equ 0 (
    echo   [OK] Python found (pythonw)
) else (
    where pyw >nul 2>&1
    if %errorlevel% equ 0 (
        echo   [OK] Python found (py launcher)
    ) else (
        where python >nul 2>&1
        if %errorlevel% equ 0 (
            echo   [OK] Python found (console version)
        ) else (
            echo   [FAIL] Python NOT found! Install Python 3 from python.org
            echo          and check "Add python.exe to PATH" during install.
            set FAIL=1
        )
    )
)

echo [3/5] Checking database file...
if exist "db\custom.db" (
    echo   [OK] db\custom.db found
) else (
    echo   [WARN] db\custom.db not found - a new empty database will be created
)

echo [4/5] Checking port 3000...
powershell -NoProfile -Command "if (Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue) { exit 0 } else { exit 1 }" >nul 2>&1
if %errorlevel% equ 0 (
    echo   [OK] Program is already running at http://127.0.0.1:3000
) else (
    echo   [INFO] Program is not running now - that is fine
)

echo [5/5] No installation needed!
echo   This version needs NO npm install and NO internet. It starts instantly.

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
