@echo off
chcp 65001 >nul
REM ============================================================
REM  ساخت نسخه ویندوز (exe) — این فایل را روی ویندوز اجرا کنید
REM  پیش‌نیاز: Node.js  (از nodejs.org نصب کنید)
REM  خروجی: desktop\dist-win\*.exe
REM ============================================================
cd /d "%~dp0.."

echo == همگام‌سازی فایل‌های وب ==
if exist desktop\app rmdir /s /q desktop\app
mkdir desktop\app
copy index.html desktop\app\ >nul
xcopy /e /i /q css desktop\app\css >nul
xcopy /e /i /q js desktop\app\js >nul
xcopy /e /i /q assets desktop\app\assets >nul

echo == نصب وابستگی‌ها ==
cd desktop
call npm install
if errorlevel 1 goto :err

echo == ساخت exe ==
call npm run dist
if errorlevel 1 goto :err

echo.
echo ✅ آماده شد! فایل‌ها در پوشه desktop\dist-win :
dir /b dist-win\*.exe
pause
exit /b

:err
echo ❌ خطا! مطمئن شوید Node.js نصب است (nodejs.org)
pause
