@echo off
setlocal

REM ============================================================
REM  Amar Ghaza - portable launcher for Windows 10/11
REM  Opens the app in a standalone window (no browser toolbar).
REM  NOTE: keep this file ASCII-only + CRLF, otherwise CMD breaks.
REM ============================================================

set "APPDIR=%~dp0"
set "URL=file:///%APPDIR:\=/%index.html"

set "EDGE1=%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe"
set "EDGE2=%ProgramFiles%\Microsoft\Edge\Application\msedge.exe"
set "CHR1=%ProgramFiles%\Google\Chrome\Application\chrome.exe"
set "CHR2=%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"

set "BROWSER="
if exist "%EDGE1%" set "BROWSER=%EDGE1%"
if not defined BROWSER if exist "%EDGE2%" set "BROWSER=%EDGE2%"
if not defined BROWSER if exist "%CHR1%" set "BROWSER=%CHR1%"
if not defined BROWSER if exist "%CHR2%" set "BROWSER=%CHR2%"

if defined BROWSER (
  start "" "%BROWSER%" --app="%URL%" --user-data-dir="%APPDIR%AppData" --no-first-run --allow-file-access-from-files
  exit /b 0
)

echo Edge/Chrome not found - opening with the default browser...
start "" "%URL%"
exit /b 0
