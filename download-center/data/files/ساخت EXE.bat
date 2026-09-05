@echo off
title Build EXE - Gold Sampling System
cd /d "%~dp0"

echo ==================================================
echo   Building GoldReyGiri.exe  -  PyInstaller
echo   Folder: %CD%
echo ==================================================
echo.

:: 1) Python available?
where python >nul 2>&1
if %errorlevel% neq 0 (
    echo [FAIL] Python not found in PATH.
    echo Install Python 3 from https://www.python.org with Add python.exe to PATH.
    pause
    exit /b 1
)
python --version
echo.

:: 2) Install PyInstaller for the SAME python
echo Installing PyInstaller...
python -m pip install --upgrade pyinstaller
if %errorlevel% neq 0 (
    echo [FAIL] Could not install PyInstaller. Check internet or antivirus.
    pause
    exit /b 1
)
echo.

:: 3) Clean old build outputs
if exist build rmdir /s /q build
if exist dist rmdir /s /q dist
if exist GoldReyGiri.spec del /q GoldReyGiri.spec

:: 4) Build the EXE
echo Building EXE... this takes 1-3 minutes
python -m PyInstaller --onefile --noconsole --clean --name GoldReyGiri --add-data "ui.html;." --add-data "assets;assets" app.py
if %errorlevel% neq 0 (
    echo.
    echo [FAIL] Build failed. Read the error messages above.
    echo TIP 1: If this folder path contains Persian characters, copy the whole
    echo        folder to a short English path like  C:\GoldApp  and run again.
    echo TIP 2: If antivirus blocked it, temporarily disable realtime protection.
    pause
    exit /b 1
)

:: 5) Put the EXE beside app.py and clean up
if exist dist\GoldReyGiri.exe move /y dist\GoldReyGiri.exe GoldReyGiri.exe >nul
if exist GoldReyGiri.spec del /q GoldReyGiri.spec
if exist build rmdir /s /q build
if exist dist rmdir /s /q dist

echo.
echo ==================================================
echo   [OK] GoldReyGiri.exe is ready in this folder!
echo   Double-click it to run - no Python needed.
echo   The db folder, backups and output folder are
echo   created BESIDE the EXE. Copy your old db folder
echo   next to the EXE to keep your records.
echo   Custom icon: add  --icon myicon.ico  to the build command.
echo ==================================================
pause
