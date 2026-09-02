#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
دانلود سنتر — سرور کوچک برای تبادل فایل فشرده بین کاربر و دستیار.

سه قابلیت اصلی:
  1) آپلود فایل فشرده (zip) توسط کاربر  -> در پوشه _uploads ذخیره و باز می‌شود
  2) ساخت فایل فشرده از آخرین وضعیت پروژه -> در پوشه _downloads
  3) دانلود آخرین فایل فشرده ساخته‌شده

اجرا:  python3 tools/download-center/server.py [PORT]
"""
import http.server
import io
import json
import os
import re
import shutil
import socketserver
import subprocess
import sys
import zipfile
from datetime import datetime, timezone, timedelta
from urllib.parse import urlparse, parse_qs, unquote

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DL_DIR = os.path.join(ROOT, '_downloads')
UP_DIR = os.path.join(ROOT, '_uploads')
HTML_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'index.html')

# مواردی که داخل فایل فشرده پروژه نمی‌آیند
EXCLUDE_DIRS = {'.git', '_downloads', '_uploads', 'node_modules', '__pycache__',
                '.arena', '.cache', 'dist', 'build', 'out'}

TEHRAN = timezone(timedelta(hours=3, minutes=30))


def now_stamp():
    return datetime.now(TEHRAN).strftime('%Y-%m-%d_%H-%M-%S')


def human(n):
    for u in ['B', 'KB', 'MB', 'GB']:
        if n < 1024:
            return f'{n:.0f} {u}' if u == 'B' else f'{n:.1f} {u}'
        n /= 1024
    return f'{n:.1f} TB'


def ensure_dirs():
    os.makedirs(DL_DIR, exist_ok=True)
    os.makedirs(UP_DIR, exist_ok=True)


def git(*args):
    try:
        return subprocess.run(['git'] + list(args), cwd=ROOT, capture_output=True,
                              text=True, timeout=20).stdout.strip()
    except Exception:
        return ''


def list_zips(folder):
    ensure_dirs()
    items = []
    for name in os.listdir(folder):
        p = os.path.join(folder, name)
        if os.path.isfile(p) and name.lower().endswith('.zip'):
            stt = os.stat(p)
            items.append({
                'name': name,
                'size': stt.st_size,
                'sizeText': human(stt.st_size),
                'mtime': stt.st_mtime,
                'time': datetime.fromtimestamp(stt.st_mtime, TEHRAN).strftime('%Y-%m-%d %H:%M:%S'),
            })
    items.sort(key=lambda x: x['mtime'], reverse=True)
    return items


def build_project_zip(note=''):
    """ساخت فایل فشرده از آخرین وضعیت پروژه."""
    ensure_dirs()
    stamp = now_stamp()
    fname = f'AmarGhaza_{stamp}.zip'
    fpath = os.path.join(DL_DIR, fname)

    branch = git('rev-parse', '--abbrev-ref', 'HEAD')
    last = git('log', '-1', '--pretty=%h — %s (%cd)', '--date=format:%Y-%m-%d %H:%M')
    changed = git('status', '--porcelain')

    count = 0
    with zipfile.ZipFile(fpath, 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as z:
        for base, dirs, files in os.walk(ROOT):
            dirs[:] = [d for d in dirs if d not in EXCLUDE_DIRS]
            for f in files:
                full = os.path.join(base, f)
                rel = os.path.relpath(full, ROOT)
                if rel.split(os.sep)[0] in EXCLUDE_DIRS:
                    continue
                z.write(full, os.path.join('AmarGhaza', rel))
                count += 1
        info = (
            'AmarGhaza — بسته آخرین تغییرات\n'
            f'تاریخ ساخت: {datetime.now(TEHRAN).strftime("%Y-%m-%d %H:%M:%S")} (تهران)\n'
            f'برنچ: {branch}\n'
            f'آخرین کامیت: {last}\n'
            f'تعداد فایل: {count}\n'
            + (f'یادداشت: {note}\n' if note else '')
            + ('\nتغییرات ذخیره‌نشده در گیت:\n' + changed + '\n' if changed else '\nهمه تغییرات کامیت شده است.\n')
        )
        z.writestr('AmarGhaza/BUILD-INFO.txt', info)

    stt = os.stat(fpath)
    return {
        'name': fname, 'files': count, 'size': stt.st_size, 'sizeText': human(stt.st_size),
        'branch': branch, 'commit': last,
        'time': datetime.fromtimestamp(stt.st_mtime, TEHRAN).strftime('%Y-%m-%d %H:%M:%S'),
    }


def safe_name(name):
    name = os.path.basename(unquote(name or 'upload.zip')).strip()
    name = re.sub(r'[\\/:*?"<>|]+', '_', name)
    return name or 'upload.zip'


class Handler(http.server.BaseHTTPRequestHandler):
    protocol_version = 'HTTP/1.1'
    server_version = 'AmarGhazaDownloadCenter/1.0'

    def log_message(self, fmt, *args):
        sys.stderr.write('%s - %s\n' % (self.address_string(), fmt % args))

    # ---------- helpers ----------
    def _send(self, code, body=b'', ctype='text/plain; charset=utf-8', extra=None):
        if isinstance(body, str):
            body = body.encode('utf-8')
        self.send_response(code)
        self.send_header('Content-Type', ctype)
        self.send_header('Content-Length', str(len(body)))
        self.send_header('Cache-Control', 'no-store')
        self.send_header('Access-Control-Allow-Origin', '*')
        for k, v in (extra or {}).items():
            self.send_header(k, v)
        self.end_headers()
        if self.command != 'HEAD':
            self.wfile.write(body)

    def _json(self, obj, code=200):
        self._send(code, json.dumps(obj, ensure_ascii=False), 'application/json; charset=utf-8')

    # ---------- GET ----------
    def do_GET(self):
        u = urlparse(self.path)
        path, q = u.path, parse_qs(u.query)

        if path in ('/', '/index.html'):
            try:
                with open(HTML_FILE, 'rb') as f:
                    return self._send(200, f.read(), 'text/html; charset=utf-8')
            except FileNotFoundError:
                return self._send(500, 'index.html یافت نشد')

        if path == '/api/status':
            ensure_dirs()
            builds = list_zips(DL_DIR)
            ups = list_zips(UP_DIR)
            return self._json({
                'ok': True,
                'branch': git('rev-parse', '--abbrev-ref', 'HEAD'),
                'commit': git('log', '-1', '--pretty=%h — %s'),
                'dirty': bool(git('status', '--porcelain')),
                'latest': builds[0] if builds else None,
                'builds': builds[:20],
                'uploads': ups[:20],
            })

        if path == '/api/download-latest' or path == '/api/download':
            ensure_dirs()
            if 'name' in q:
                name = safe_name(q['name'][0])
            else:
                builds = list_zips(DL_DIR)
                if not builds:
                    return self._send(404, 'هنوز فایل فشرده‌ای ساخته نشده است.')
                name = builds[0]['name']
            fpath = os.path.join(DL_DIR, name)
            if not os.path.isfile(fpath):
                return self._send(404, 'فایل یافت نشد.')
            with open(fpath, 'rb') as f:
                data = f.read()
            return self._send(200, data, 'application/zip',
                              {'Content-Disposition': f'attachment; filename="{name}"'})

        return self._send(404, 'یافت نشد')

    # ---------- POST ----------
    def do_POST(self):
        u = urlparse(self.path)
        path = u.path

        if path == '/api/build':
            try:
                length = int(self.headers.get('Content-Length') or 0)
                body = self.rfile.read(length) if length else b'{}'
                note = (json.loads(body or b'{}') or {}).get('note', '')
            except Exception:
                note = ''
            try:
                info = build_project_zip(note)
                return self._json({'ok': True, 'build': info,
                                   'message': f'فایل فشرده ساخته شد: {info["name"]}'})
            except Exception as e:
                return self._json({'ok': False, 'message': f'خطا در ساخت فایل: {e}'}, 500)

        if path == '/api/upload':
            ensure_dirs()
            length = int(self.headers.get('Content-Length') or 0)
            if length <= 0:
                return self._json({'ok': False, 'message': 'فایلی ارسال نشد'}, 400)
            if length > 400 * 1024 * 1024:
                return self._json({'ok': False, 'message': 'حجم فایل بیش از ۴۰۰ مگابایت است'}, 413)

            name = safe_name(self.headers.get('X-File-Name') or 'upload.zip')
            if not name.lower().endswith(('.zip', '.rar', '.7z', '.tar', '.gz', '.tgz')):
                name += '.zip'
            stamp = now_stamp()
            base, ext = os.path.splitext(name)
            fname = f'{base}__{stamp}{ext}'
            fpath = os.path.join(UP_DIR, fname)

            remaining = length
            with open(fpath, 'wb') as out:
                while remaining > 0:
                    chunk = self.rfile.read(min(1024 * 256, remaining))
                    if not chunk:
                        break
                    out.write(chunk)
                    remaining -= len(chunk)

            extracted, files = None, 0
            if zipfile.is_zipfile(fpath):
                try:
                    dest = os.path.join(UP_DIR, base + '__' + stamp)
                    with zipfile.ZipFile(fpath) as z:
                        members = [m for m in z.namelist() if not m.startswith(('/', '..'))]
                        z.extractall(dest, members=members)
                        files = len(members)
                    extracted = os.path.relpath(dest, ROOT)
                except Exception as e:
                    extracted = f'خطا در باز کردن: {e}'

            stt = os.stat(fpath)
            return self._json({
                'ok': True,
                'name': fname,
                'sizeText': human(stt.st_size),
                'extracted': extracted,
                'files': files,
                'message': f'فایل «{fname}» دریافت شد ({human(stt.st_size)})'
                           + (f' و در {extracted} باز شد ({files} فایل)' if files else ''),
            })

        return self._send(404, 'یافت نشد')

    def do_OPTIONS(self):
        self._send(204, b'', 'text/plain', {
            'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
            'Access-Control-Allow-Headers': '*',
        })


class Server(socketserver.ThreadingTCPServer):
    allow_reuse_address = True
    daemon_threads = True


if __name__ == '__main__':
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8090
    ensure_dirs()
    print(f'📦 دانلود سنتر روی پورت {port} اجرا شد — ریشه پروژه: {ROOT}')
    with Server(('0.0.0.0', port), Handler) as httpd:
        httpd.serve_forever()
