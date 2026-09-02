@echo off
chcp 65001 >nul
REM ============================================================
REM  اجرای «برنامه آمار غذا» روی ویندوز 11 (نسخه پرتابل)
REM  برنامه در پنجره مستقل (بدون نوار مرورگر) با Edge باز می‌شود
REM ============================================================
setlocal
set "APPDIR=%~dp0"
set "URL=file:///%APPDIR:\=/%index.html"

REM پیدا کردن Edge (در ویندوز 11 همیشه نصب است)
set "EDGE=%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe"
if not exist "%EDGE%" set "EDGE=%ProgramFiles%\Microsoft\Edge\Application\msedge.exe"

if exist "%EDGE%" (
  start "" "%EDGE%" --app="%URL%" --user-data-dir="%APPDIR%AppData" --no-first-run
  exit /b
)

REM اگر Edge نبود، Chrome را امتحان کن
set "CHROME=%ProgramFiles%\Google\Chrome\Application\chrome.exe"
if not exist "%CHROME%" set "CHROME=%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"
if exist "%CHROME%" (
  start "" "%CHROME%" --app="%URL%" --user-data-dir="%APPDIR%AppData" --no-first-run
  exit /b
)

REM در نهایت با مرورگر پیش‌فرض
start "" "%URL%"
