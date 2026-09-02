#!/usr/bin/env bash
# ============================================================
# ساخت نسخه ویندوز (exe) از برنامه آمار غذا
#   ./tools/build-windows.sh          → ساخت نصب‌کننده + پرتابل
# پیش‌نیاز: Node.js 18+
# خروجی: desktop/dist-win/*.exe
# ============================================================
set -e
cd "$(dirname "$0")/.."

echo "== همگام‌سازی فایل‌های وب با پوشه دسکتاپ =="
rm -rf desktop/app
mkdir -p desktop/app
cp index.html desktop/app/
cp -r css js assets desktop/app/

echo "== نصب وابستگی‌ها =="
cd desktop
npm install

echo "== ساخت exe ویندوز =="
npm run dist

echo ""
echo "✅ آماده شد! فایل‌های خروجی:"
ls -la dist-win/*.exe 2>/dev/null || true
