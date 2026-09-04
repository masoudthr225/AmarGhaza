#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
🥇 سیستم ثبت ری‌گیری طلا — نسخهٔ پایتون
=========================================
کل برنامه در یک فایل، فقط با کتابخانهٔ استاندارد پایتون (بدون هیچ نصب اضافه).

اجرا:
  • اجرای برنامه.vbs  →  pythonw app.py (نگهبان + اجرای بی‌صدا + باز کردن مرورگر)
  • python app.py --serve  →  فقط سرور (حالت کنسول/عیب‌یابی)

امکانات:
  • ثبت / ویرایش / جستجو / فیلتر / مرتب‌سازی / صفحه‌بندی
  • سطل بازیافت (حذف نرم + بازیابی)
  • خروجی Excel (xlsx) و آپلود Excel/CSV (بدون پاک شدن داده‌ها — رد تکراری‌ها)
  • بکاپ‌گیری، دانلود بکاپ، بازیابی از فهرست یا فایل آپلودی
  • پشتیبان‌گیری خودکار در هر اجرا (۲۰ نسخهٔ آخر)
  • نگهبان: اگر برنامه بسته شود دوباره بالا می‌آورد
  • همان دیتابیس قبلی (db/custom.db) — داده‌ها دست‌نخورده
"""

import csv
import io
import json
import os
import re
import shutil
import sqlite3
import subprocess
import sys
import time
import webbrowser
import zipfile
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse, parse_qs, unquote

# ─────────────────────────── مسیرها و تنظیمات ───────────────────────────
APP_PATH = os.path.abspath(__file__)
BASE_DIR = os.path.dirname(APP_PATH)
DB_PATH = os.path.join(BASE_DIR, 'db', 'custom.db')
BACKUP_DIR = os.path.join(BASE_DIR, 'db', 'backups')
LOG_DIR = os.path.join(BASE_DIR, 'logs')
LOG_FILE = os.path.join(LOG_DIR, 'launcher.log')
LOCK_FILE = os.path.join(BASE_DIR, '.run.lock')
STOP_FLAG = os.path.join(BASE_DIR, 'stop.flag')
UI_FILE = os.path.join(BASE_DIR, 'ui.html')
ASSETS_DIR = os.path.join(BASE_DIR, 'assets')

PORT = int(os.environ.get('PORT', '3000'))
# به‌صورت پیش‌فرض فقط همین کامپیوتر (امن)؛ برای پیش‌نمایش وب می‌توان با HOST=0.0.0.0 تغییر داد
HOST = os.environ.get('HOST', '127.0.0.1')
DISPLAY_HOST = '127.0.0.1' if HOST in ('0.0.0.0', '::') else HOST
BASE_URL = 'http://%s:%d' % (DISPLAY_HOST, PORT)
MAX_BACKUPS = 20

# برچسب‌های استاندارد وضعیت عیار — هماهنگ با نسخه‌های قبلی
KARAT_STANDARD = 'استاندارد (750)'
KARAT_HIGH = 'بالا (>750)'
KARAT_LOW = 'پایین (<750)'

MSG_TRASH = 'رکورد به سطل بازیافت منتقل شد'
MSG_RESTORE = 'رکورد با موفقیت بازیابی شد'

REY_GIRI_DDL = """
CREATE TABLE IF NOT EXISTS "ReyGiri" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "rowNumber" INTEGER NOT NULL,
    "packetNumber" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "workType" TEXT NOT NULL,
    "modelCode" TEXT NOT NULL,
    "modelFull" TEXT NOT NULL,
    "reyWeight" TEXT NOT NULL,
    "numericWeight" REAL NOT NULL,
    "meltNumber" TEXT,
    "description" TEXT,
    "karatReceived" REAL,
    "numericKarat" REAL,
    "karatStatus" TEXT,
    "createdAt" DATETIME NOT NULL,
    "updatedAt" DATETIME NOT NULL,
    "deletedAt" DATETIME
)
"""


# ─────────────────────────── ابزارهای عمومی ───────────────────────────
def log(msg):
    """ثبت در لاگ (+ کنسول اگر موجود باشد)"""
    try:
        os.makedirs(LOG_DIR, exist_ok=True)
        with open(LOG_FILE, 'a', encoding='utf-8') as f:
            stamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
            f.write('[%s] %s\n' % (stamp, msg))
    except Exception:
        pass
    try:
        print(msg)
    except Exception:
        pass


def to_fa(n):
    """تبدیل ارقام انگلیسی به فارسی"""
    fa = '۰۱۲۳۴۵۶۷۸۹'
    return ''.join(fa[int(c)] if c.isdigit() else c for c in str(n))


def now_ms():
    return int(time.time() * 1000)


def make_id():
    """شناسهٔ یکتا (مشابه cuid نسخهٔ قبلی — سازگار با دیتابیس موجود)"""
    import random
    abc = '0123456789abcdefghijklmnopqrstuvwxyz'
    t = base36(now_ms())
    rand = ''.join(random.choice(abc) for _ in range(16))
    return 'c%s%s' % (t, rand)


def base36(n):
    abc = '0123456789abcdefghijklmnopqrstuvwxyz'
    s = ''
    while n:
        s = abc[n % 36] + s
        n //= 36
    return s or '0'


def normalize_digits(s):
    """تبدیل ارقام فارسی/عربی به انگلیسی + اصلاح ممیز"""
    fa = '۰۱۲۳۴۵۶۷۸۹'
    ar = '٠١٢٣٤٥٦٧٨٩'
    out = []
    for ch in str(s):
        if ch in fa:
            out.append(str(fa.index(ch)))
        elif ch in ar:
            out.append(str(ar.index(ch)))
        elif ch == '٫':  # ممیز فارسی
            out.append('.')
        else:
            out.append(ch)
    return ''.join(out)


def to_float(v):
    """رشتهٔ عددی (با ارقام فارسی/کاما/ممیز) → float یا None"""
    if v is None:
        return None
    s = normalize_digits(v).strip()
    if s in ('', '-', '.', 'None'):
        return None
    # فقط یک ممیز معتبر نگه دار
    if s.count('.') > 1:
        return None
    s = s.replace(',', '')
    try:
        f = float(s)
        return f if f == f else None  # NaN → None
    except ValueError:
        return None


def calc_karat_status(numeric_karat):
    """وضعیت عیار با برچسب استاندارد — None اگر عیار نامعتبر باشد"""
    try:
        k = float(numeric_karat)
    except (TypeError, ValueError):
        return None
    if k <= 0:
        return None
    if k > 750:
        return KARAT_HIGH
    if k < 750:
        return KARAT_LOW
    return KARAT_STANDARD


def ms_to_iso(ms):
    """تبدیل میلی‌ثانیه (فرمت Prisma) به رشتهٔ ISO — برای JSON"""
    if ms is None:
        return None
    try:
        dt = datetime.fromtimestamp(int(ms) / 1000, tz=timezone.utc)
        return dt.strftime('%Y-%m-%dT%H:%M:%S.%f')[:-3] + 'Z'
    except Exception:
        return None


def msgbox(title, text):
    """پیام‌گرافیکی خطا (ویندوز: PowerShell MessageBox)"""
    try:
        if sys.platform == 'win32':
            safe_t = title.replace("'", "''")
            safe_x = text.replace("'", "''")
            subprocess.Popen(
                ['powershell.exe', '-NoProfile', '-Command',
                 "Add-Type -AssemblyName PresentationFramework; "
                 "[System.Windows.MessageBox]::Show('%s', '%s')" % (safe_x, safe_t)],
                creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0),
                stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
            )
        else:
            log('⛔ %s: %s' % (title, text))
    except Exception:
        pass


# ─────────────────────────── لایهٔ دیتابیس ───────────────────────────
def db():
    """اتصال تازه برای هر درخواست — از قفل‌شدن فایل جلوگیری می‌کند"""
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    conn = sqlite3.connect(DB_PATH, timeout=10)
    conn.row_factory = sqlite3.Row
    conn.execute('PRAGMA busy_timeout = 5000')
    return conn


def init_db():
    """اگر دیتابیس نبود، با همان ساختار نسخهٔ قبلی ساخته می‌شود"""
    conn = db()
    try:
        conn.execute(REY_GIRI_DDL)
        conn.commit()
    finally:
        conn.close()


def row_to_dict(r):
    """ردیف دیتابیس → دیکشنری JSON (تاریخ‌ها به ISO)"""
    return {
        'id': r['id'],
        'rowNumber': r['rowNumber'],
        'packetNumber': r['packetNumber'],
        'date': r['date'],
        'workType': r['workType'],
        'modelCode': r['modelCode'],
        'modelFull': r['modelFull'],
        'reyWeight': r['reyWeight'],
        'numericWeight': r['numericWeight'],
        'meltNumber': r['meltNumber'],
        'description': r['description'],
        'karatReceived': r['karatReceived'],
        'numericKarat': r['numericKarat'],
        'karatStatus': r['karatStatus'],
        'createdAt': ms_to_iso(r['createdAt']),
        'updatedAt': ms_to_iso(r['updatedAt']),
        'deletedAt': ms_to_iso(r['deletedAt']),
    }


SORTABLE = {
    'rowNumber': 'rowNumber', 'packetNumber': 'packetNumber', 'date': 'date',
    'numericWeight': 'numericWeight', 'numericKarat': 'numericKarat',
    'createdAt': 'createdAt',
}


def list_records(params):
    search = (params.get('search') or [''])[0].strip()
    work_type = (params.get('workType') or [''])[0].strip()
    karat_status = (params.get('karatStatus') or [''])[0].strip()
    sort_by = (params.get('sortBy') or ['rowNumber'])[0]
    sort_order = (params.get('sortOrder') or ['desc'])[0].lower()
    page = int((params.get('page') or ['1'])[0] or 1)
    limit = min(int((params.get('limit') or ['50'])[0] or 50), 200)
    trash = (params.get('trash') or [''])[0] == '1'

    where = ['deletedAt IS NOT NULL' if trash else 'deletedAt IS NULL']
    args = []
    if search:
        where.append("(packetNumber LIKE ? OR modelCode LIKE ? OR modelFull LIKE ? "
                     "OR date LIKE ? OR meltNumber LIKE ?)")
        like = '%' + search + '%'
        args += [like, like, like, like, like]
    if work_type:
        where.append('workType = ?')
        args.append(work_type)
    if karat_status:
        where.append('karatStatus LIKE ?')
        args.append('%' + karat_status + '%')

    order = 'ORDER BY %s %s' % (
        SORTABLE.get(sort_by, 'createdAt'),
        'ASC' if sort_order == 'asc' else 'DESC',
    )
    wsql = ' AND '.join(where)

    conn = db()
    try:
        total = conn.execute('SELECT COUNT(*) FROM ReyGiri WHERE ' + wsql, args).fetchone()[0]
        rows = conn.execute(
            'SELECT * FROM ReyGiri WHERE %s %s LIMIT ? OFFSET ?' % (wsql, order),
            args + [limit, (page - 1) * limit],
        ).fetchall()
    finally:
        conn.close()
    return [row_to_dict(r) for r in rows], total, page, limit


def get_record(rid):
    conn = db()
    try:
        r = conn.execute('SELECT * FROM ReyGiri WHERE id = ?', (rid,)).fetchone()
    finally:
        conn.close()
    return row_to_dict(r) if r else None


def next_row_number(conn):
    row = conn.execute('SELECT MAX(rowNumber) FROM ReyGiri').fetchone()
    return (row[0] or 0) + 1


def create_record(body):
    packet = str(body.get('packetNumber') or '').strip()
    date = str(body.get('date') or '').strip()
    if not packet or not date:
        return None, 'شماره پاکت و تاریخ لازم است'
    numeric_weight = to_float(body.get('numericWeight'))
    if numeric_weight is None:
        numeric_weight = 0.0
    numeric_karat = to_float(body.get('numericKarat'))

    karat_status = body.get('karatStatus') or calc_karat_status(numeric_karat)
    ts = now_ms()
    rid = make_id()

    conn = db()
    try:
        row_number = int(body.get('rowNumber') or next_row_number(conn))
        conn.execute(
            'INSERT INTO ReyGiri (id, rowNumber, packetNumber, date, workType, modelCode, modelFull,'
            ' reyWeight, numericWeight, meltNumber, description, karatReceived, numericKarat,'
            ' karatStatus, createdAt, updatedAt, deletedAt)'
            ' VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,NULL)',
            (rid, row_number, packet, date,
             str(body.get('workType') or '').strip(),
             str(body.get('modelCode') or '').strip(),
             str(body.get('modelFull') or body.get('modelCode') or '').strip(),
             str(body.get('reyWeight') if body.get('reyWeight') is not None else numeric_weight),
             numeric_weight,
             (str(body.get('meltNumber')).strip() or None) if body.get('meltNumber') else None,
             (str(body.get('description')).strip() or None) if body.get('description') else None,
             numeric_karat, numeric_karat, karat_status, ts, ts),
        )
        conn.commit()
    finally:
        conn.close()
    return get_record(rid), None


UPDATE_FIELDS = ['packetNumber', 'date', 'workType', 'modelCode', 'modelFull',
                 'reyWeight', 'meltNumber', 'description']


def update_record(rid, body):
    rec = get_record(rid)
    if not rec:
        return None, 'رکورد یافت نشد', 404

    sets, args = [], []
    for f in UPDATE_FIELDS:
        if f in body:
            v = body[f]
            if v is None or str(v).strip() == '':
                sets.append('%s = ?' % f)
                args.append(None if f in ('meltNumber', 'description') else str(v))
            else:
                sets.append('%s = ?' % f)
                args.append(str(v).strip())
    if 'numericWeight' in body:
        w = to_float(body['numericWeight'])
        if w is None:
            w = 0.0
        sets.append('numericWeight = ?')
        args.append(w)
        if 'reyWeight' not in body:
            sets.append('reyWeight = ?')
            args.append(str(w))
    if 'numericKarat' in body:
        k = to_float(body['numericKarat'])
        sets.append('numericKarat = ?')
        args.append(k)
        sets.append('karatReceived = ?')
        args.append(k)
        if not body.get('karatStatus'):
            sets.append('karatStatus = ?')
            args.append(calc_karat_status(k))
    if body.get('karatStatus'):
        sets.append('karatStatus = ?')
        args.append(body['karatStatus'])

    if not sets:
        return rec, None, 200
    sets.append('updatedAt = ?')
    args.append(now_ms())
    args.append(rid)

    conn = db()
    try:
        conn.execute('UPDATE ReyGiri SET %s WHERE id = ?' % ', '.join(sets), args)
        conn.commit()
    finally:
        conn.close()
    return get_record(rid), None, 200


def soft_delete(rid):
    conn = db()
    try:
        cur = conn.execute('UPDATE ReyGiri SET deletedAt = ?, updatedAt = ? WHERE id = ?',
                           (now_ms(), now_ms(), rid))
        conn.commit()
        return cur.rowcount > 0
    finally:
        conn.close()


def restore_record(rid):
    rec = get_record(rid)
    if not rec:
        return False, 'رکورد یافت نشد', 404
    if not rec['deletedAt']:
        return False, 'این رکورد در سطل بازیافت نیست', 400
    conn = db()
    try:
        conn.execute('UPDATE ReyGiri SET deletedAt = NULL, updatedAt = ? WHERE id = ?',
                     (now_ms(), rid))
        conn.commit()
    finally:
        conn.close()
    return True, MSG_RESTORE, 200


def get_stats():
    conn = db()
    try:
        active = 'deletedAt IS NULL'
        total = conn.execute('SELECT COUNT(*) FROM ReyGiri WHERE ' + active).fetchone()[0]
        tw = conn.execute('SELECT COALESCE(SUM(numericWeight),0) FROM ReyGiri WHERE ' + active).fetchone()[0]
        ak = conn.execute('SELECT AVG(numericKarat) FROM ReyGiri WHERE ' + active
                          + ' AND numericKarat IS NOT NULL').fetchone()[0]
        def cnt(sql, *a):
            return conn.execute(sql, a).fetchone()[0]
        standard = cnt('SELECT COUNT(*) FROM ReyGiri WHERE ' + active + " AND karatStatus LIKE '%استاندارد%'")
        high = cnt('SELECT COUNT(*) FROM ReyGiri WHERE ' + active + " AND karatStatus LIKE '%بالا%'")
        low = cnt('SELECT COUNT(*) FROM ReyGiri WHERE ' + active + " AND karatStatus LIKE '%پایین%'")
        elango = cnt('SELECT COUNT(*) FROM ReyGiri WHERE ' + active + " AND workType = 'النگو'")
        rikhtehi = cnt('SELECT COUNT(*) FROM ReyGiri WHERE ' + active + " AND workType = 'ریخته ای'")
        trash = conn.execute('SELECT COUNT(*) FROM ReyGiri WHERE deletedAt IS NOT NULL').fetchone()[0]
        wt_stats = [
            {'workType': r[0], '_sum': {'numericWeight': r[1]}, '_count': r[2]}
            for r in conn.execute(
                'SELECT workType, SUM(numericWeight), COUNT(*) FROM ReyGiri WHERE '
                + active + ' GROUP BY workType')
        ]
    finally:
        conn.close()
    return {
        'totalRecords': total,
        'totalWeight': round(tw or 0, 2),
        'avgKarat': round(ak or 0, 2),
        'distribution': {'standard': standard, 'high': high, 'low': low},
        'byWorkType': {'elango': elango, 'rikhtehi': rikhtehi},
        'workTypeStats': wt_stats,
        'trashCount': trash,
    }


# ─────────────────────────── Excel (xlsx) — تولید ───────────────────────────
def xml_escape(s):
    return (str(s).replace('&', '&amp;').replace('<', '&lt;')
            .replace('>', '&gt;').replace('"', '&quot;'))


def col_letter(i):
    s = ''
    while i >= 0:
        s = chr(65 + i % 26) + s
        i = i // 26 - 1
    return s


EXPORT_HEADERS = ['ردیف', 'شماره پاکت', 'تاریخ', 'نوع کار', 'کد مدل', 'مدل کامل', 'وزن ری',
                  'مقدار عددی وزن', 'شماره ذوب', 'توضیحات', 'عیار دریافتی', 'مقدار عددی عیار',
                  'وضعیت عیار']
EXPORT_WIDTHS = [6, 12, 12, 10, 8, 10, 8, 14, 10, 16, 12, 14, 16]


def xlsx_export(records):
    """ساخت فایل xlsx با کتابخانهٔ استاندارد (بدون وابستگی)"""
    ns_cols = ''.join(
        '<col min="%d" max="%d" width="%d" customWidth="1"/>' % (i + 1, i + 1, w)
        for i, w in enumerate(EXPORT_WIDTHS))

    rows_xml = []
    # سربرگ (بولد)
    head_cells = []
    for i, h in enumerate(EXPORT_HEADERS):
        head_cells.append('<c r="%s1" s="1" t="inlineStr"><is><t xml:space="preserve">%s</t></is></c>'
                          % (col_letter(i), xml_escape(h)))
    rows_xml.append('<row r="1">%s</row>' % ''.join(head_cells))

    for ridx, r in enumerate(records, start=2):
        values = [
            ('n', r['rowNumber']),
            ('s', r['packetNumber']),
            ('s', r['date']),
            ('s', r['workType']),
            ('s', r['modelCode']),
            ('s', r['modelFull']),
            ('s', r['reyWeight']),
            ('n', r['numericWeight']),
            ('s', r['meltNumber'] or ''),
            ('s', r['description'] or ''),
            ('n', r['karatReceived']),
            ('n', r['numericKarat']),
            ('s', r['karatStatus'] or ''),
        ]
        cells = []
        for i, (kind, v) in enumerate(values):
            ref = '%s%d' % (col_letter(i), ridx)
            if v is None or v == '':
                continue
            if kind == 'n':
                cells.append('<c r="%s"><v>%s</v></c>' % (ref, xml_escape(v)))
            else:
                cells.append('<c r="%s" t="inlineStr"><is><t xml:space="preserve">%s</t></is></c>'
                             % (ref, xml_escape(v)))
        rows_xml.append('<row r="%d">%s</row>' % (ridx, ''.join(cells)))

    sheet1 = ('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
              '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
              '<sheetViews><sheetView rightToLeft="1" workbookViewId="0"/></sheetViews>'
              '<cols>%s</cols><sheetData>%s</sheetData></worksheet>'
              % (ns_cols, ''.join(rows_xml)))

    content_types = ('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
                     '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
                     '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
                     '<Default Extension="xml" ContentType="application/xml"/>'
                     '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
                     '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'
                     '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'
                     '</Types>')

    rels = ('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
            '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>'
            '</Relationships>')

    workbook = ('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
                '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" '
                'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
                '<sheets><sheet name="ری‌گیری طلا" sheetId="1" r:id="rId1"/></sheets></workbook>')

    wb_rels = ('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
               '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
               '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>'
               '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>'
               '</Relationships>')

    styles = ('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
              '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
              '<fonts count="2"><font><sz val="11"/><name val="Vazirmatn"/></font>'
              '<font><b/><sz val="11"/><name val="Vazirmatn"/></font></fonts>'
              '<fills count="2"><fill><patternFill patternType="none"/></fill>'
              '<fill><patternFill patternType="gray125"/></fill></fills>'
              '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>'
              '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>'
              '<cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>'
              '<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs>'
              '</styleSheet>')

    buf = io.BytesIO()
    with zipfile.ZipFile(buf, 'w', zipfile.ZIP_DEFLATED) as z:
        z.writestr('[Content_Types].xml', content_types)
        z.writestr('_rels/.rels', rels)
        z.writestr('xl/workbook.xml', workbook)
        z.writestr('xl/_rels/workbook.xml.rels', wb_rels)
        z.writestr('xl/styles.xml', styles)
        z.writestr('xl/worksheets/sheet1.xml', sheet1)
    return buf.getvalue()


# ─────────────────────────── Excel/CSV — خواندن ───────────────────────────
NS = '{http://schemas.openxmlformats.org/spreadsheetml/2006/main}'


def xlsx_read(data):
    """خواندن فایل xlsx (خروجی Excel یا همین برنامه) → فهرست دیکشنری با کلید سربرگ"""
    with zipfile.ZipFile(io.BytesIO(data)) as z:
        shared = []
        if 'xl/sharedStrings.xml' in z.namelist():
            root = ET.fromstring(z.read('xl/sharedStrings.xml'))
            for si in root.findall(NS + 'si'):
                shared.append(''.join(t.text or '' for t in si.iter(NS + 't')))
        # اولین شیت
        sheet_name = next((n for n in z.namelist()
                           if re.match(r'xl/worksheets/sheet1?\.xml$', n)), None)
        if not sheet_name:
            raise ValueError('شیت پیدا نشد')
        root = ET.fromstring(z.read(sheet_name))

    table = []
    for row in root.iter(NS + 'row'):
        cells = {}
        for c in row.findall(NS + 'c'):
            ref = c.get('r') or ''
            m = re.match(r'([A-Z]+)', ref)
            col = 0
            if m:
                for ch in m.group(1):
                    col = col * 26 + (ord(ch) - 64)
                col -= 1
            t = c.get('t')
            if t == 'inlineStr':
                is_el = c.find(NS + 'is')
                val = ''.join(x.text or '' for x in is_el.iter(NS + 't')) if is_el is not None else ''
            else:
                v = c.find(NS + 'v')
                val = v.text if v is not None else ''
                if t == 's' and val != '':
                    val = shared[int(val)]
            cells[col] = val
        if cells:
            maxc = max(cells)
            table.append([cells.get(i, '') for i in range(maxc + 1)])

    if not table:
        return []
    headers = [str(h or '').strip() for h in table[0]]
    out = []
    for values in table[1:]:
        row = {}
        empty = True
        for i, h in enumerate(headers):
            if not h:
                continue
            v = values[i] if i < len(values) else ''
            row[h] = v
            if str(v).strip():
                empty = False
        if not empty:
            out.append(row)
    return out


def csv_read(data):
    """خواندن CSV (utf-8 با/بدون BOM) → فهرست دیکشنری"""
    text = data.decode('utf-8-sig', errors='replace')
    return [dict(r) for r in csv.DictReader(io.StringIO(text))]


def transform_rows(rows):
    """تبدیل ردیف‌های فایل به رکورد برنامه (همان منطق نسخهٔ قبلی)"""
    out = []
    for i, row in enumerate(rows):
        def cell(*keys):
            for k in keys:
                if k in row and row[k] is not None and str(row[k]).strip() != '':
                    return row[k]
            return None

        packet = str(cell('شماره پاکت', 'packetNumber') or '').strip()
        date = str(cell('تاریخ', 'date') or '').strip()
        if not packet or not date:
            continue

        numeric_weight = to_float(cell('مقدار عددی وزن', 'وزن ری', 'numericWeight', 'reyWeight'))
        if numeric_weight is None:
            numeric_weight = 0.0
        numeric_karat = to_float(cell('مقدار عددی عیار', 'عیار دریافتی', 'karatReceived', 'numericKarat'))

        out.append({
            'packetNumber': packet,
            'date': date,
            'workType': str(cell('نوع کار', 'workType') or '').strip(),
            'modelCode': str(cell('کد مدل', 'modelCode') or '').strip(),
            'modelFull': str(cell('مدل کامل', 'modelFull') or '').strip(),
            'reyWeight': str(cell('وزن ری') if cell('وزن ری') is not None else numeric_weight),
            'numericWeight': numeric_weight,
            'meltNumber': (str(cell('شماره ذوب', 'meltNumber')).strip() or None)
                          if cell('شماره ذوب', 'meltNumber') else None,
            'description': (str(cell('توضیحات', 'description')).strip() or None)
                           if cell('توضیحات', 'description') else None,
            'karatReceived': numeric_karat,
            'numericKarat': numeric_karat,
            'karatStatus': calc_karat_status(numeric_karat),
        })
    return out


def import_rows(valid_rows):
    """درج رکوردهای جدید — بدون پاک شدن هیچ داده‌ای؛ تکراری‌ها (شماره پاکت) رد می‌شوند"""
    conn = db()
    try:
        existing = set(r[0].strip() for r in conn.execute('SELECT packetNumber FROM ReyGiri'))
        row_number = next_row_number(conn)
        seen = set()
        to_insert = []
        duplicates = 0
        for rec in valid_rows:
            key = rec['packetNumber'].strip()
            if key in existing or key in seen:
                duplicates += 1
                continue
            seen.add(key)
            ts = now_ms()
            to_insert.append((make_id(), row_number, rec['packetNumber'], rec['date'],
                              rec['workType'], rec['modelCode'],
                              rec['modelFull'] or rec['modelCode'],
                              str(rec['reyWeight']), rec['numericWeight'],
                              rec['meltNumber'], rec['description'],
                              rec['karatReceived'], rec['numericKarat'], rec['karatStatus'],
                              ts, ts))
            row_number += 1
        if to_insert:
            conn.executemany(
                'INSERT INTO ReyGiri (id, rowNumber, packetNumber, date, workType, modelCode,'
                ' modelFull, reyWeight, numericWeight, meltNumber, description, karatReceived,'
                ' numericKarat, karatStatus, createdAt, updatedAt, deletedAt)'
                ' VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,NULL)', to_insert)
            conn.commit()
        return len(to_insert), duplicates
    finally:
        conn.close()


# ─────────────────────────── بکاپ و بازیابی ───────────────────────────
def backup_file_path(stamp):
    return os.path.join(BACKUP_DIR, 'gold-backup-%s.db' % stamp)


def manual_file_path(stamp):
    return os.path.join(BACKUP_DIR, 'gold-manual-%s.db' % stamp)


def stamp_now():
    return datetime.now().strftime('%Y-%m-%d-%H-%M-%S')


def create_backup():
    """گرفتن نسخهٔ پشتیبان دستی (در db/backups)"""
    if not os.path.exists(DB_PATH):
        return None, 'فایل دیتابیس پیدا نشد', 404
    os.makedirs(BACKUP_DIR, exist_ok=True)
    name = 'gold-manual-%s.db' % stamp_now()
    shutil.copy2(DB_PATH, os.path.join(BACKUP_DIR, name))
    conn = db()
    try:
        count = conn.execute('SELECT COUNT(*) FROM ReyGiri WHERE deletedAt IS NULL').fetchone()[0]
    finally:
        conn.close()
    return {
        'success': True,
        'message': 'نسخهٔ پشتیبان با موفقیت ساخته شد (%s رکورد)' % to_fa(count),
        'name': name,
        'count': count,
        'size': os.path.getsize(os.path.join(BACKUP_DIR, name)),
    }, None, 200


def list_backups():
    if not os.path.isdir(BACKUP_DIR):
        return []
    out = []
    for f in sorted(os.listdir(BACKUP_DIR)):
        if not f.endswith('.db') or f.startswith('.'):
            continue
        st = os.stat(os.path.join(BACKUP_DIR, f))
        out.append({
            'name': f,
            'size': st.st_size,
            'createdAt': datetime.fromtimestamp(st.st_mtime).isoformat(),
            'manual': f.startswith('gold-manual-'),
        })
    out.sort(key=lambda x: x['createdAt'], reverse=True)
    return out


def validate_db_file(path):
    """بررسی سلامت فایل بکاپ: هدر SQLite + جدول ReyGiri"""
    with open(path, 'rb') as f:
        header = f.read(16)
    if header[:15] != b'SQLite format 3':
        raise ValueError('این فایل یک دیتابیس SQLite معتبر نیست')
    conn = sqlite3.connect(path)
    try:
        count = conn.execute('SELECT COUNT(*) FROM ReyGiri WHERE deletedAt IS NULL').fetchone()[0]
    finally:
        conn.close()
    return count


def restore_backup(source_path, display_name):
    """جایگزینی دیتابیس فعلی با فایل بکاپ — قبل از آن نسخهٔ امن گرفته می‌شود"""
    try:
        count = validate_db_file(source_path)
    except Exception as e:
        return {'success': False,
                'error': 'این فایل یک بکاپ معتبر برنامه نیست (%s)' % e}, 400

    os.makedirs(BACKUP_DIR, exist_ok=True)
    if os.path.exists(DB_PATH):
        shutil.copy2(DB_PATH, os.path.join(BACKUP_DIR, 'gold-backup-before-restore-%s.db' % stamp_now()))

    shutil.copy2(source_path, DB_PATH)
    return {
        'success': True,
        'message': 'بکاپ «%s» با موفقیت بازیابی شد — %s رکورد' % (display_name, to_fa(count)),
        'count': count,
    }, 200


# ─────────────────────────── تجزیهٔ multipart ───────────────────────────
def parse_multipart(content_type, body):
    """استخراج فایل‌های فرم multipart/form-data → [(filename, bytes)]"""
    m = re.search(r'boundary="?([^";]+)"?', content_type or '')
    if not m:
        return []
    boundary = m.group(1).encode()
    files = []
    for part in body.split(b'--' + boundary):
        part = part.lstrip(b'\r\n')
        if not part or part == b'--':
            continue
        header_blob, sep, content = part.partition(b'\r\n\r\n')
        if not sep:
            continue
        if content.endswith(b'\r\n'):
            content = content[:-2]
        headers = header_blob.decode('utf-8', 'replace')
        fn = re.search(r'filename="([^"]*)"', headers)
        if fn and fn.group(1):
            files.append((unquote(fn.group(1)), content))
    return files


# ─────────────────────────── سرور HTTP ───────────────────────────
class Handler(BaseHTTPRequestHandler):
    protocol_version = 'HTTP/1.1'
    server_version = 'GoldApp/1.0'

    # ── ابزارهای پاسخ ──
    def log_message(self, fmt, *args):
        try:
            log('%s - %s' % (self.address_string(), fmt % args))
        except Exception:
            pass

    def send_json(self, obj, status=200):
        data = json.dumps(obj, ensure_ascii=False).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(data)))
        self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.end_headers()
        self.wfile.write(data)

    def send_bytes(self, data, ctype, filename=None):
        self.send_response(200)
        self.send_header('Content-Type', ctype)
        self.send_header('Content-Length', str(len(data)))
        self.send_header('Cache-Control', 'no-cache')
        if filename:
            self.send_header('Content-Disposition', 'attachment; filename="%s"' % filename)
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.end_headers()
        self.wfile.write(data)

    def read_body(self):
        try:
            length = int(self.headers.get('Content-Length') or 0)
        except ValueError:
            length = 0
        return self.rfile.read(length) if length > 0 else b''

    def read_json(self):
        try:
            return json.loads(self.read_body().decode('utf-8') or '{}')
        except Exception:
            return {}

    def send_ui(self):
        try:
            with open(UI_FILE, 'rb') as f:
                html = f.read()
        except Exception:
            html = ('<!doctype html><html lang="fa" dir="rtl"><meta charset="utf-8">'
                    '<body><h3>فایل ui.html کنار app.py پیدا نشد</h3></body></html>').encode('utf-8')
        self.send_response(200)
        self.send_header('Content-Type', 'text/html; charset=utf-8')
        self.send_header('Content-Length', str(len(html)))
        self.send_header('Cache-Control', 'no-cache')
        self.end_headers()
        self.wfile.write(html)

    # ── مسیریابی ──
    def do_GET(self):
        try:
            u = urlparse(self.path)
            path, params = u.path, parse_qs(u.query)

            if path == '/':
                return self.send_ui()
            if path == '/favicon.ico':
                self.send_response(204)
                self.send_header('Content-Length', '0')
                self.end_headers()
                return

            m = re.match(r'^/assets/([A-Za-z0-9_.\-]+)$', path)
            if m:
                name = m.group(1)
                full = os.path.join(ASSETS_DIR, name)
                if os.path.isfile(full) and (name.endswith('.woff2') or name.endswith('.jpg')):
                    ctype = ('font/woff2' if name.endswith('.woff2') else 'image/jpeg')
                    with open(full, 'rb') as f:
                        data = f.read()
                    self.send_response(200)
                    self.send_header('Content-Type', ctype)
                    self.send_header('Content-Length', str(len(data)))
                    self.send_header('Cache-Control', 'max-age=86400')
                    self.end_headers()
                    return self.wfile.write(data)
                return self.send_json({'success': False, 'error': 'پیدا نشد'}, 404)

            if path == '/api/rey-giri/stats':
                return self.send_json({'success': True, 'data': get_stats()})

            if path == '/api/rey-giri/export':
                conn = db()
                try:
                    rows = conn.execute(
                        'SELECT * FROM ReyGiri WHERE deletedAt IS NULL ORDER BY rowNumber ASC'
                    ).fetchall()
                finally:
                    conn.close()
                if not rows:
                    return self.send_json({'success': False, 'error': 'داده‌ای برای خروجی وجود ندارد'}, 404)
                data = xlsx_export([row_to_dict(r) for r in rows])
                fname = 'rey-giri-export-%s.xlsx' % datetime.now().strftime('%Y-%m-%d')
                return self.send_bytes(data,
                                       'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                                       fname)

            if path == '/api/rey-giri/backup':
                if not os.path.exists(DB_PATH):
                    return self.send_json({'success': False, 'error': 'فایل دیتابیس پیدا نشد'}, 404)
                with open(DB_PATH, 'rb') as f:
                    data = f.read()
                return self.send_bytes(data, 'application/octet-stream',
                                       'gold-backup-%s.db' % stamp_now())

            if path == '/api/rey-giri/backup/list':
                return self.send_json({'success': True, 'data': list_backups()})

            m = re.match(r'^/api/rey-giri/([A-Za-z0-9]+)$', path)
            if m:
                rec = get_record(m.group(1))
                if not rec:
                    return self.send_json({'success': False, 'error': 'رکورد یافت نشد'}, 404)
                return self.send_json({'success': True, 'data': rec})

            if path == '/api/rey-giri':
                records, total, page, limit = list_records(params)
                return self.send_json({
                    'success': True,
                    'data': records,
                    'pagination': {'page': page, 'limit': limit, 'total': total,
                                   'pages': max(1, -(-total // limit))},
                })

            return self.send_json({'success': False, 'error': 'مسیر پیدا نشد'}, 404)
        except BrokenPipeError:
            pass
        except Exception as e:
            log('❌ خطای GET %s: %s' % (self.path, e))
            try:
                self.send_json({'success': False, 'error': 'خطای داخلی سرور'}, 500)
            except Exception:
                pass

    def do_POST(self):
        try:
            u = urlparse(self.path)
            path = u.path

            if path == '/api/rey-giri':
                body = self.read_json()
                rec, err = create_record(body)
                if err:
                    return self.send_json({'success': False, 'error': err}, 400)
                return self.send_json({'success': True, 'data': rec,
                                       'message': 'رکورد با موفقیت ثبت شد'})

            # مسیرهای خاص — باید قبل از الگوی /{id} بررسی شوند
            if path == '/api/rey-giri/upload':
                files = parse_multipart(self.headers.get('Content-Type'), self.read_body())
                if not files:
                    return self.send_json({'success': False, 'error': 'فایلی انتخاب نشده است'}, 400)
                fname, data = files[0]
                low = fname.lower()
                try:
                    if low.endswith('.csv'):
                        rows = csv_read(data)
                    elif low.endswith('.xlsx') or low.endswith('.xls'):
                        rows = xlsx_read(data)
                    else:
                        return self.send_json({'success': False,
                                               'error': 'فرمت فایل پشتیبانی نمی‌شود. لطفاً فایل .xlsx یا .csv انتخاب کنید'}, 400)
                except Exception:
                    return self.send_json({'success': False,
                                           'error': 'خطا در خواندن فایل. مطمئن شوید فایل سالم است.'}, 400)
                valid = transform_rows(rows)
                if not valid:
                    return self.send_json({'success': False,
                                           'error': 'رکورد معتبری در فایل یافت نشد. مطمئن شوید ستون‌ها شامل: شماره پاکت، تاریخ، نوع کار، کد مدل و...'}, 400)
                inserted, duplicates = import_rows(valid)
                if inserted > 0 and duplicates > 0:
                    message = ('%s رکورد با موفقیت از فایل وارد شد — %s رکورد تکراری رد شد'
                               % (to_fa(inserted), to_fa(duplicates)))
                elif inserted > 0:
                    message = '%s رکورد با موفقیت از فایل وارد شد' % to_fa(inserted)
                else:
                    message = ('همهٔ رکوردهای این فایل قبلاً ثبت شده‌اند (%s رکورد تکراری رد شد)'
                               % to_fa(duplicates))
                return self.send_json({'success': True, 'message': message,
                                       'count': inserted, 'duplicates': duplicates,
                                       'fileName': fname})

            if path == '/api/rey-giri/backup':
                result, err, status = create_backup()
                if err:
                    return self.send_json({'success': False, 'error': err}, status)
                return self.send_json(result)

            if path == '/api/rey-giri/backup/restore':
                ctype = self.headers.get('Content-Type') or ''
                if 'multipart/form-data' in ctype:
                    files = parse_multipart(ctype, self.read_body())
                    if not files:
                        return self.send_json({'success': False, 'error': 'فایلی انتخاب نشده است'}, 400)
                    fname, data = files[0]
                    if not fname.lower().endswith('.db'):
                        return self.send_json({'success': False,
                                               'error': 'فایل بکاپ باید با پسوند .db باشد'}, 400)
                    if len(data) < 100:
                        return self.send_json({'success': False,
                                               'error': 'فایل بکاپ خیلی کوچک است — معتبر نیست'}, 400)
                    os.makedirs(BACKUP_DIR, exist_ok=True)
                    tmp = os.path.join(BACKUP_DIR, '.restore-tmp-%d.db' % now_ms())
                    with open(tmp, 'wb') as f:
                        f.write(data)
                    try:
                        result, status = restore_backup(tmp, fname)
                    finally:
                        try:
                            os.remove(tmp)
                        except OSError:
                            pass
                    return self.send_json(result, status)

                body = self.read_json()
                name = str(body.get('name') or '')
                if not re.match(r'^gold-(backup|manual)-[\w\-]+\.db$', name):
                    return self.send_json({'success': False, 'error': 'نام فایل بکاپ معتبر نیست'}, 400)
                full = os.path.join(BACKUP_DIR, name)
                if not os.path.exists(full):
                    return self.send_json({'success': False, 'error': 'این نسخهٔ پشتیبان پیدا نشد'}, 404)
                result, status = restore_backup(full, name)
                return self.send_json(result, status)

            m = re.match(r'^/api/rey-giri/([A-Za-z0-9]+)/restore$', path)
            if m:
                ok, msg, status = restore_record(m.group(1))
                return self.send_json({'success': ok, 'message': msg} if ok
                                      else {'success': False, 'error': msg}, status)

            m = re.match(r'^/api/rey-giri/([A-Za-z0-9]+)$', path)
            if m:
                rec, err, status = update_record(m.group(1), self.read_json())
                if err:
                    return self.send_json({'success': False, 'error': err}, status)
                return self.send_json({'success': True, 'data': rec,
                                       'message': 'رکورد با موفقیت بروزرسانی شد'})

            return self.send_json({'success': False, 'error': 'مسیر پیدا نشد'}, 404)
        except BrokenPipeError:
            pass
        except Exception as e:
            log('❌ خطای POST %s: %s' % (self.path, e))
            try:
                self.send_json({'success': False, 'error': 'خطای داخلی سرور'}, 500)
            except Exception:
                pass

    def do_PUT(self):
        try:
            m = re.match(r'^/api/rey-giri/([A-Za-z0-9]+)$', urlparse(self.path).path)
            if m:
                rec, err, status = update_record(m.group(1), self.read_json())
                if err:
                    return self.send_json({'success': False, 'error': err}, status)
                return self.send_json({'success': True, 'data': rec,
                                       'message': 'رکورد با موفقیت بروزرسانی شد'})
            return self.send_json({'success': False, 'error': 'مسیر پیدا نشد'}, 404)
        except Exception as e:
            log('❌ خطای PUT %s: %s' % (self.path, e))
            try:
                self.send_json({'success': False, 'error': 'خطای داخلی سرور'}, 500)
            except Exception:
                pass

    def do_DELETE(self):
        try:
            m = re.match(r'^/api/rey-giri/([A-Za-z0-9]+)$', urlparse(self.path).path)
            if m:
                if soft_delete(m.group(1)):
                    return self.send_json({'success': True, 'message': MSG_TRASH})
                return self.send_json({'success': False, 'error': 'رکورد یافت نشد'}, 404)
            return self.send_json({'success': False, 'error': 'مسیر پیدا نشد'}, 404)
        except Exception as e:
            log('❌ خطای DELETE %s: %s' % (self.path, e))
            try:
                self.send_json({'success': False, 'error': 'خطای داخلی سرور'}, 500)
            except Exception:
                pass


def serve_main():
    init_db()
    try:
        server = ThreadingHTTPServer((HOST, PORT), Handler)
    except OSError as e:
        log('⛔ پورت %d باز نشد — احتمالاً برنامهٔ دیگری آن را اشغال کرده: %s' % (PORT, e))
        sys.exit(1)
    server.daemon_threads = True
    log('🚀 سرور راه‌اندازی شد → %s' % BASE_URL)
    while True:
        try:
            server.serve_forever(poll_interval=0.5)
        except KeyboardInterrupt:
            log('سرور متوقف شد')
            break
        except Exception as e:
            log('⚠️ خطای سرور: %s — ادامه می‌دهیم' % e)
            time.sleep(1)
    server.server_close()


# ─────────────────────────── نگهبان (حالت اصلی) ───────────────────────────
def is_alive(pid):
    try:
        os.kill(pid, 0)
        return True
    except OSError:
        return False


def wait_ready(proc, timeout_s=60):
    import urllib.request
    deadline = time.time() + timeout_s
    while time.time() < deadline:
        if os.path.exists(STOP_FLAG):
            return False
        if proc.poll() is not None:
            return False  # فرزند مرد — دیگر منتظر نمی‌مانیم
        try:
            urllib.request.urlopen(BASE_URL + '/', timeout=3)
            return True
        except Exception:
            time.sleep(1.2)
    return False


def auto_backup():
    """پشتیبان خودکار قبل از هر اجرا — نگهداری ۲۰ نسخهٔ آخر (بکاپ‌های دستی پاک نمی‌شوند)"""
    try:
        if not os.path.exists(DB_PATH):
            return
        os.makedirs(BACKUP_DIR, exist_ok=True)
        shutil.copy2(DB_PATH, backup_file_path(stamp_now()))
        backups = sorted(f for f in os.listdir(BACKUP_DIR) if f.startswith('gold-backup-'))
        while len(backups) > MAX_BACKUPS:
            try:
                os.remove(os.path.join(BACKUP_DIR, backups.pop(0)))
            except OSError:
                break
        log('💾 پشتیبان خودکار دیتابیس گرفته شد')
    except Exception as e:
        log('⚠️ پشتیبان‌گیری ناموفق: %s' % e)


def watchdog_main():
    log('━━━ شروع برنامه (نگهبان) ━━━')

    # تک‌نمونه — اگر در حال اجراست فقط مرورگر باز شود
    try:
        if os.path.exists(LOCK_FILE):
            with open(LOCK_FILE) as f:
                pid = int(f.read().strip() or 0)
            if pid and pid != os.getpid() and is_alive(pid):
                log('نمونهٔ دیگری از برنامه در حال اجراست — فقط مرورگر باز می‌شود')
                try:
                    webbrowser.open(BASE_URL)
                except Exception:
                    pass
                return
    except Exception:
        pass
    try:
        with open(LOCK_FILE, 'w') as f:
            f.write(str(os.getpid()))
    except Exception:
        pass

    auto_backup()

    crashes = []
    first = True
    errf = None
    try:
        while True:
            creation = getattr(subprocess, 'CREATE_NO_WINDOW', 0)
            # خطاهای فرزند هم در launcher.log ثبت می‌شوند
            try:
                errf = open(LOG_FILE, 'a', encoding='utf-8', buffering=1)
            except Exception:
                errf = None
            proc = subprocess.Popen(
                [sys.executable, APP_PATH, '--serve'],
                stdout=errf or subprocess.DEVNULL,
                stderr=errf or subprocess.DEVNULL,
                creationflags=creation,
            )
            if errf:
                try:
                    errf.close()  # فرزند نسخهٔ خودش را دارد
                except Exception:
                    pass
                errf = None

            if first:
                if wait_ready(proc):
                    log('✅ برنامه آماده است: %s' % BASE_URL)
                    try:
                        webbrowser.open(BASE_URL)
                    except Exception:
                        pass
                else:
                    log('⚠️ سرور آماده نشد (احتمالاً پورت %d اشغال است)' % PORT)
                first = False

            # زیر نظر داشتن سرور
            while proc.poll() is None:
                if os.path.exists(STOP_FLAG):
                    break
                time.sleep(1.5)

            if os.path.exists(STOP_FLAG):
                try:
                    proc.terminate()
                    proc.wait(timeout=5)
                except Exception:
                    pass
                log('سرور به درخواست کاربر متوقف شد.')
                return

            code = proc.returncode
            log('⚠️ سرور بسته شد (کد %s) — راه‌اندازی مجدد...' % code)

            now = time.time()
            crashes = [t for t in crashes if now - t < 60]
            crashes.append(now)
            if len(crashes) >= 3:
                log('⛔ سرور ۳ بار در ۶۰ ثانیه متوقف شد — اجرا متوقف می‌شود')
                msgbox('سیستم ری‌گیری طلا — خطا',
                       'برنامه پس از ۳ بار تلاش متوقف شد.\n\nبرای بررسی، فایل logs\\launcher.log '
                       'را ببینید یا START.bat را اجرا کنید.')
                return
            time.sleep(2.5)
    finally:
        try:
            os.remove(LOCK_FILE)
        except OSError:
            pass
        try:
            os.remove(STOP_FLAG)
        except OSError:
            pass


def main():
    if '--serve' in sys.argv:
        serve_main()
    else:
        watchdog_main()


if __name__ == '__main__':
    main()
