#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ساخت manifest.js — اثرانگشت (هش) همه فایل‌های برنامه را تولید می‌کند.
بعد از هر تغییر در فایل‌ها این اسکریپت را اجرا کنید:
    python3 tools/build-manifest.py [--bump]
--bump : شماره نسخه برنامه را یک واحد افزایش می‌دهد (مثلاً 1.2.0 -> 1.3.0)

نتیجه: فقط فایل‌هایی که هش‌شان تغییر کرده باشد توسط مرورگر دوباره
دانلود می‌شوند؛ بقیه فایل‌ها از کش مرورگر خوانده می‌شوند.
"""
import hashlib, json, os, re, sys, datetime

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MANIFEST = os.path.join(ROOT, 'js', 'manifest.js')

# فایل‌هایی که نسخه‌بندی می‌شوند (index.html جدا بررسی می‌شود)
TRACKED = [
    'css/app.css',
    'js/store.js', 'js/jalali.js', 'js/sheet.js', 'js/manage.js',
    'js/pagesetup.js', 'js/hwork.js', 'js/print.js', 'js/excel.js', 'js/updater.js',
    'js/main.js', 'js/xlsx.full.min.js',
    'index.html',
]

def md5(path):
    h = hashlib.md5()
    with open(path, 'rb') as f:
        for chunk in iter(lambda: f.read(65536), b''):
            h.update(chunk)
    return h.hexdigest()[:10]

def read_current():
    if not os.path.exists(MANIFEST):
        return {'version': '1.0.0', 'files': {}}
    txt = open(MANIFEST, encoding='utf-8').read()
    m = re.search(r'window\.APP_MANIFEST\s*=\s*(\{.*\});', txt, re.S)
    return json.loads(m.group(1)) if m else {'version': '1.0.0', 'files': {}}

def bump(ver):
    parts = ver.split('.')
    parts[1] = str(int(parts[1]) + 1); parts[2] = '0'
    return '.'.join(parts)

def main():
    cur = read_current()
    files, changed = {}, []
    for rel in TRACKED:
        p = os.path.join(ROOT, rel)
        if not os.path.exists(p):
            print(f'⚠️  یافت نشد: {rel}'); continue
        h = md5(p)
        files[rel] = h
        if cur['files'].get(rel) != h:
            changed.append(rel)

    version = cur.get('version', '1.0.0')
    if '--bump' in sys.argv:
        version = bump(version)

    data = {
        'version': version,
        'date': datetime.date.today().isoformat(),
        'files': files,
    }
    body = 'window.APP_MANIFEST = ' + json.dumps(data, ensure_ascii=False, indent=1) + ';\n'
    open(MANIFEST, 'w', encoding='utf-8').write(body)

    print(f'✅ manifest.js ساخته شد — نسخه {version}')
    if changed:
        print('فایل‌های تغییرکرده (فقط این‌ها دوباره دانلود می‌شوند):')
        for c in changed:
            print(f'   • {c}')
    else:
        print('هیچ فایلی تغییر نکرده است.')

if __name__ == '__main__':
    main()
