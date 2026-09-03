#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
📦 مرکز دانلود — AmarGhaza Download Center
سرور سبک آپلود/آرشیو/دانلود فایل‌های فشرده — فقط پایتون استاندارد (بدون وابستگی)

دکمه ۱: POST /api/upload?filename=...   → آپلود و استخراج فایل فشرده کاربر
دکمه ۲: POST /api/archive?only_changed= → ساخت ZIP از آخرین وضعیت/تغییرات فایل‌ها + گزارش CHANGES.txt
دکمه ۳: GET  /api/latest                → دانلود آخرین آرشیو ساخته‌شده
وضعیت:  GET  /api/status
"""

from __future__ import annotations

import bz2
import gzip
import json
import lzma
import os
import re
import shutil
import subprocess
import sys
import tarfile
import tempfile
import threading
import time
import zipfile
from datetime import datetime
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

# ---------------------------------------------------------------------------
# تنظیمات
# ---------------------------------------------------------------------------
BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = Path(os.environ.get("DC_DATA_DIR") or (BASE_DIR / "data")).resolve()
FILES_DIR = DATA_DIR / "files"        # فایل‌های استخراج‌شدهٔ کاربر (محل ویرایش توسط ایجنت)
ARCHIVES_DIR = DATA_DIR / "archives"  # آرشیوهای ساخته‌شده
UPLOADS_DIR = DATA_DIR / "uploads"    # فایل‌های آپلودی خام
BASELINE_PATH = DATA_DIR / "baseline.json"
LATEST_PATH = DATA_DIR / "latest.json"

HOST = os.environ.get("DC_HOST", "0.0.0.0")
PORT = int(os.environ.get("DC_PORT", os.environ.get("PORT", "8000")))
MAX_UPLOAD = int(os.environ.get("DC_MAX_UPLOAD", str(1024 ** 3)))  # 1 GiB
KEEP_ARCHIVES = 10
KEEP_UPLOADS = 5
CHUNK = 1 << 20

LOCK = threading.RLock()

ARCHIVE_SUFFIXES = (".zip", ".tar", ".gz", ".tgz", ".bz2", ".tbz2", ".xz", ".txz", ".rar", ".7z")
# این‌ها از نظر باینری ZIP هستند ولی آرشیو محسوب نمی‌شوند → تک‌فایل ذخیره می‌شوند
OFFICE_ZIPS = {
    ".docx", ".docm", ".xlsx", ".xlsm", ".pptx", ".pptm",
    ".odt", ".ods", ".odp", ".epub", ".jar", ".apk", ".ipa", ".whl", ".crx",
}
SUPPORTED_BASE = "zip ، tar.gz ، tgz ، gz ، bz2 ، xz"


class UnsupportedFormat(Exception):
    pass


class NoChanges(Exception):
    pass


def _py7zr_available() -> bool:
    try:
        import py7zr  # noqa: F401
        return True
    except Exception:
        return False


def supported_text() -> str:
    txt = SUPPORTED_BASE
    if _py7zr_available() or shutil.which("7z"):
        txt += " ، 7z"
    if shutil.which("7z") or shutil.which("unrar"):
        txt += " ، rar"
    return txt


class UnsupportedFormat(Exception):
    pass


class NoChanges(Exception):
    pass


# ---------------------------------------------------------------------------
# ابزارهای عمومی
# ---------------------------------------------------------------------------
def now_iso() -> str:
    return datetime.now().astimezone().isoformat(timespec="seconds")


def stamp() -> str:
    return time.strftime("%Y%m%d-%H%M%S")


def jdump(path: Path, obj) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(json.dumps(obj, ensure_ascii=False, indent=1), encoding="utf-8")
    tmp.replace(path)


def jload(path: Path, default=None):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return default


def sanitize_filename(name: str) -> str:
    name = (name or "").replace("\\", "/")
    name = name.rsplit("/", 1)[-1].strip()
    name = re.sub(r"[\x00-\x1f<>:\"|?*]", "_", name)
    return name[:200] or "upload.bin"


def iter_files(root: Path):
    if not root.exists():
        return
    for p in sorted(root.rglob("*")):
        if p.is_file():
            yield p


def files_stat(root: Path):
    count = 0
    total = 0
    for p in iter_files(root):
        count += 1
        try:
            total += p.stat().st_size
        except OSError:
            pass
    return count, total


def build_manifest(root: Path) -> dict:
    """نقشهٔ فایل‌ها بر اساس اندازه و زمان تغییر (برای تشخیص تغییرات)"""
    m = {}
    for p in iter_files(root):
        try:
            st = p.stat()
        except OSError:
            continue
        m[p.relative_to(root).as_posix()] = {"size": st.st_size, "mtime": st.st_mtime}
    return m


def diff_manifests(baseline: dict, current: dict):
    changed = sorted(
        k for k in current
        if k in baseline
        and (current[k]["size"] != baseline[k]["size"] or current[k]["mtime"] != baseline[k]["mtime"])
    )
    added = sorted(k for k in current if k not in baseline)
    removed = sorted(k for k in baseline if k not in current)
    return changed, added, removed


# ---------------------------------------------------------------------------
# تشخیص فرمت و استخراج امن
# ---------------------------------------------------------------------------
def sniff_kind(path: Path) -> str:
    try:
        with open(path, "rb") as f:
            head = f.read(8)
            f.seek(257)
            ustar = f.read(5)
    except OSError:
        return "unknown"
    if head.startswith(b"PK\x03\x04") or head.startswith(b"PK\x05\x06"):
        return "zip"
    if head.startswith(b"\x1f\x8b"):
        return "gzip"
    if head.startswith(b"BZh"):
        return "bzip2"
    if head.startswith(b"\xfd7zXZ\x00"):
        return "xz"
    if head.startswith(b"7z\xbc\xaf\x27\x1c"):
        return "7z"
    if head.startswith(b"Rar!\x1a\x07"):
        return "rar"
    if ustar == b"ustar":
        return "tar"
    return "unknown"


def classify_upload(filename: str, path: Path) -> str:
    """«archive» یا «single»"""
    n = filename.lower()
    if any(n.endswith(s) for s in ARCHIVE_SUFFIXES):
        return "archive"
    ext = Path(n).suffix
    if ext in OFFICE_ZIPS:
        return "single"
    if sniff_kind(path) in ("zip", "gzip", "bzip2", "xz", "7z", "rar", "tar"):
        return "archive"
    return "single"


def _safe_target(root: Path, name: str) -> Path:
    """جلوگیری از حملهٔ Zip-Slip (مسیر خارج از پوشهٔ مقصد)"""
    name = (name or "").replace("\\", "/")
    raw = name.split("/")
    if any(c == ".." for c in raw):
        raise ValueError("مسیر ناامن در آرشیو: " + name)
    parts = [p for p in raw if p not in ("", ".") and not re.match(r"^[A-Za-z]:$", p)]
    if not parts:
        raise ValueError("نام فایل نامعتبر در آرشیو")
    target = root.joinpath(*parts)
    tr, rr = target.resolve(), root.resolve()
    if tr != rr and rr not in tr.parents:
        raise ValueError("مسیر ناامن در آرشیو: " + name)
    return target


def extract_zip(src: Path, dest: Path) -> None:
    with zipfile.ZipFile(src) as z:
        for zi in z.infolist():
            target = _safe_target(dest, zi.filename)
            if zi.is_dir() or zi.filename.endswith("/"):
                target.mkdir(parents=True, exist_ok=True)
                continue
            target.parent.mkdir(parents=True, exist_ok=True)
            with z.open(zi) as fin, open(target, "wb") as fout:
                shutil.copyfileobj(fin, fout, CHUNK)


def extract_tar(src: Path, dest: Path) -> None:
    with tarfile.open(src) as t:  # نوع فشرده‌سازی خودکار تشخیص داده می‌شود
        try:
            t.extractall(dest, filter="data")
        except TypeError:  # پایتون‌های قدیمی‌تر از 3.12
            for m in t.getmembers():
                _safe_target(dest, m.name)
                if m.issym() or m.islnk():
                    raise ValueError("فایل‌های لینک‌شده در tar پذیرفته نمی‌شوند")
            t.extractall(dest)


DECOMPRESSORS = {"gzip": gzip.open, "bzip2": bz2.open, "xz": lzma.open}


def extract_single_compressed(src: Path, dest: Path, kind: str, original_name: str) -> None:
    base = re.sub(r"\.(gz|bz2|xz)$", "", original_name, flags=re.I) or "decompressed"
    out = _safe_target(dest, base)
    with DECOMPRESSORS[kind](src, "rb") as fin, open(out, "wb") as fout:
        shutil.copyfileobj(fin, fout, CHUNK)


def extract_external(src: Path, dest: Path, kind: str) -> None:
    """استخراج 7z / rar با ابزار خارجی یا py7zr (در صورت وجود)"""
    exe = shutil.which("7z") or shutil.which("7za") or shutil.which("7zr")
    if exe:
        cmd = [exe, "x", "-y", "-o" + str(dest), str(src)]
        r = subprocess.run(cmd, capture_output=True, text=True)
        if r.returncode != 0:
            raise ValueError("خطا در استخراج آرشیو: " + (r.stderr or r.stdout or "").strip()[:300])
        return
    if kind == "rar" and shutil.which("unrar"):
        cmd = [shutil.which("unrar"), "x", "-y", str(src), str(dest) + os.sep]
        r = subprocess.run(cmd, capture_output=True, text=True)
        if r.returncode != 0:
            raise ValueError("خطا در استخراج آرشیو: " + (r.stderr or r.stdout or "").strip()[:300])
        return
    if kind == "7z" and _py7zr_available():
        import py7zr
        try:
            with py7zr.SevenZipFile(src) as z:
                z.extractall(dest)
        except Exception as e:
            raise ValueError(f"خطا در استخراج آرشیو 7z: {e}")
        return
    raise UnsupportedFormat(
        f"فرمت {kind} روی این سرور قابل استخراج نیست. "
        f"فرمت‌های پشتیبانی‌شده: {supported_text()}"
    )


def extract_archive(src: Path, dest: Path, original_name: str) -> str:
    n = original_name.lower()
    if n.endswith((".tar", ".tar.gz", ".tgz", ".tar.bz2", ".tbz2", ".tar.xz", ".txz")):
        extract_tar(src, dest)
        return "tar"
    if n.endswith(".zip"):
        extract_zip(src, dest)
        return "zip"
    if n.endswith(".gz"):
        extract_single_compressed(src, dest, "gzip", original_name)
        return "gzip"
    if n.endswith(".bz2"):
        extract_single_compressed(src, dest, "bzip2", original_name)
        return "bzip2"
    if n.endswith(".xz"):
        extract_single_compressed(src, dest, "xz", original_name)
        return "xz"
    if n.endswith(".7z"):
        extract_external(src, dest, "7z")
        return "7z"
    if n.endswith(".rar"):
        extract_external(src, dest, "rar")
        return "rar"
    # پسوند ناشناخته → تشخیص با امضای باینری
    k = sniff_kind(src)
    if k == "zip":
        extract_zip(src, dest)
        return "zip"
    if k == "tar":
        extract_tar(src, dest)
        return "tar"
    if k in DECOMPRESSORS:
        extract_single_compressed(src, dest, k, original_name)
        return k
    if k in ("7z", "rar"):
        extract_external(src, dest, k)
        return k
    raise UnsupportedFormat("این فایل یک آرشیو شناخته‌شده نیست. فرمت‌های پشتیبانی‌شده: " + supported_text())


# ---------------------------------------------------------------------------
# ساخت آرشیو از تغییرات
# ---------------------------------------------------------------------------
def _report_section(lines: list, title: str, items: list) -> None:
    if not items:
        return
    lines.append("")
    lines.append(title)
    lines.extend("  • " + x for x in items[:200])
    if len(items) > 200:
        lines.append(f"  … و {len(items) - 200} مورد دیگر")


def make_report(mode: str, changed: list, added: list, removed: list,
                include_count: int, upload_name) -> str:
    lines = [
        "گزارش تغییرات — مرکز دانلود AmarGhaza",
        "=" * 42,
        f"زمان ساخت آرشیو: {now_iso()}",
        f"نام فایل آپلودی شما: {upload_name or '—'}",
        "حالت آرشیو: " + ("فقط فایل‌های تغییرکرده" if mode == "only_changed" else "کل فایل‌ها (نسخهٔ کامل)"),
        "",
        "خلاصهٔ تغییرات نسبت به نسخهٔ آپلودی:",
        f"  • فایل‌های تغییرکرده: {len(changed)}",
        f"  • فایل‌های افزوده‌شده: {len(added)}",
        f"  • فایل‌های حذف‌شده: {len(removed)}",
        f"  • تعداد فایل‌های داخل این آرشیو: {include_count}",
    ]
    _report_section(lines, "فایل‌های تغییرکرده:", changed)
    _report_section(lines, "فایل‌های افزوده‌شده:", added)
    _report_section(lines, "فایل‌های حذف‌شده:", removed)
    return "\n".join(lines) + "\n"


def prune_dir(directory: Path, keep: int) -> None:
    try:
        items = sorted((p for p in directory.iterdir() if p.is_file()),
                       key=lambda p: p.name, reverse=True)
        for p in items[keep:]:
            p.unlink(missing_ok=True)
    except FileNotFoundError:
        pass


def create_archive(only_changed: bool) -> dict:
    current = build_manifest(FILES_DIR)
    baseline = (jload(BASELINE_PATH) or {}).get("files", {})
    changed, added, removed = diff_manifests(baseline, current)
    if only_changed and not (changed or added or removed):
        raise NoChanges()

    include = set(changed) | set(added) if only_changed else set(current)
    upload_name = (jload(BASELINE_PATH) or {}).get("meta", {}).get("original_name")

    ARCHIVES_DIR.mkdir(parents=True, exist_ok=True)
    name = f"changes-{stamp()}.zip"
    seq = 0
    while (ARCHIVES_DIR / name).exists():
        seq += 1
        name = f"changes-{stamp()}-{seq}.zip"
    path = ARCHIVES_DIR / name
    report = make_report("only_changed" if only_changed else "full",
                         changed, added, removed, len(include), upload_name)
    with zipfile.ZipFile(path, "w", zipfile.ZIP_DEFLATED, compresslevel=6) as z:
        z.writestr("CHANGES.txt", "\ufeff" + report)  # BOM برای نمایش درست در ویندوز
        for rel in sorted(include):
            z.write(FILES_DIR / rel, rel)

    info = {
        "name": name,
        "size": path.stat().st_size,
        "created_at": now_iso(),
        "mode": "only_changed" if only_changed else "full",
        "files_in_archive": len(include),
        "changed": len(changed),
        "added": len(added),
        "removed": len(removed),
        "changed_list": changed[:200],
        "added_list": added[:200],
        "removed_list": removed[:200],
    }
    jdump(LATEST_PATH, info)
    prune_dir(ARCHIVES_DIR, KEEP_ARCHIVES)
    return info


# ---------------------------------------------------------------------------
# رابط کاربری (HTML درون‌خطی)
# ---------------------------------------------------------------------------
INDEX_HTML = r"""<!doctype html>
<html lang="fa" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>مرکز دانلود | AmarGhaza</title>
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Ctext y='.9em' font-size='90'%3E📦%3C/text%3E%3C/svg%3E">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/rastikerdar/vazirmatn@v33.003/Vazirmatn-font-face.css">
<style>
:root{
  --bg:#0b1020; --card:rgba(255,255,255,.055); --border:rgba(255,255,255,.13);
  --text:#e6ebf5; --muted:#93a0b8; --accent1:#6366f1; --accent2:#8b5cf6;
  --ok:#34d399; --err:#f87171;
}
*{box-sizing:border-box;margin:0;padding:0}
html,body{min-height:100%}
body{
  font-family:Vazirmatn,Vazir,'Segoe UI',Tahoma,sans-serif;
  background:
    radial-gradient(1100px 520px at 85% -10%, rgba(99,102,241,.30), transparent 60%),
    radial-gradient(900px 480px at -10% 110%, rgba(139,92,246,.22), transparent 55%),
    var(--bg);
  color:var(--text); padding:28px 18px 70px; line-height:1.75;
}
.wrap{max-width:1080px;margin:0 auto}
header{text-align:center;margin-bottom:24px}
header h1{font-size:1.9rem;font-weight:800}
header h1 span{background:linear-gradient(90deg,var(--accent1),var(--accent2));-webkit-background-clip:text;background-clip:text;color:transparent}
header p{color:var(--muted);margin-top:6px;font-size:.95rem}
.stats{display:flex;flex-wrap:wrap;gap:10px;justify-content:center;margin-bottom:26px}
.chip{background:var(--card);border:1px solid var(--border);border-radius:999px;padding:6px 16px;font-size:.84rem;color:var(--muted);backdrop-filter:blur(8px)}
.chip b{color:var(--text);font-weight:700}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(290px,1fr));gap:18px;align-items:stretch}
.card{background:var(--card);border:1px solid var(--border);border-radius:20px;padding:22px;display:flex;flex-direction:column;gap:14px;backdrop-filter:blur(10px);box-shadow:0 10px 40px rgba(0,0,0,.28);transition:transform .15s ease}
.card:hover{transform:translateY(-3px)}
.card-head{display:flex;gap:12px;align-items:flex-start}
.num{flex:0 0 auto;width:38px;height:38px;border-radius:12px;display:grid;place-items:center;font-weight:800;font-size:1.05rem;background:linear-gradient(135deg,var(--accent1),var(--accent2));color:#fff;box-shadow:0 6px 18px rgba(99,102,241,.4)}
.card-head h2{font-size:1.06rem;font-weight:800}
.card-head p{color:var(--muted);font-size:.82rem;margin-top:2px}
.btn{border:0;cursor:pointer;font-family:inherit;font-size:.98rem;font-weight:700;border-radius:14px;padding:12px 18px;transition:filter .15s, transform .1s, opacity .15s;color:#fff}
.btn:active{transform:scale(.98)}
.btn.primary{background:linear-gradient(135deg,var(--accent1),var(--accent2));box-shadow:0 8px 24px rgba(99,102,241,.35)}
.btn.primary:hover{filter:brightness(1.13)}
.btn.big{padding:14px 18px;font-size:1.03rem}
.btn:disabled{opacity:.4;cursor:not-allowed;filter:grayscale(.4)}
.drop{border:1.5px dashed rgba(255,255,255,.28);border-radius:16px;padding:22px 14px;text-align:center;color:var(--muted);font-size:.88rem;transition:.15s;cursor:pointer}
.drop:hover,.drop.over{border-color:var(--accent2);background:rgba(139,92,246,.09)}
.drop svg{width:34px;height:34px;opacity:.85;margin-bottom:4px}
.progress{height:8px;background:rgba(255,255,255,.08);border-radius:99px;overflow:hidden}
.progress .bar{height:100%;width:0%;background:linear-gradient(90deg,var(--accent1),var(--accent2));transition:width .15s;border-radius:99px}
.meta{background:rgba(0,0,0,.26);border:1px solid var(--border);border-radius:14px;padding:12px 14px;font-size:.86rem;color:var(--muted)}
.meta b{color:var(--text)}
.kv{display:grid;grid-template-columns:auto 1fr;gap:4px 12px;font-size:.85rem}
.kv span:nth-child(odd){color:var(--muted)}
.kv span:nth-child(even){color:var(--text);font-weight:600;word-break:break-all}
.toggle{display:flex;gap:9px;align-items:center;font-size:.87rem;color:var(--muted);cursor:pointer;user-select:none}
.toggle input{accent-color:var(--accent2);width:17px;height:17px;cursor:pointer}
.hint{font-size:.76rem;color:var(--muted);opacity:.9}
.result{background:rgba(52,211,153,.08);border:1px solid rgba(52,211,153,.35);border-radius:14px;padding:12px 14px;font-size:.86rem}
#toast{position:fixed;bottom:22px;left:50%;transform:translateX(-50%) translateY(90px);background:#111827;border:1px solid var(--border);color:var(--text);padding:11px 22px;border-radius:14px;font-size:.9rem;opacity:0;transition:.3s;z-index:50;max-width:90vw;box-shadow:0 10px 30px rgba(0,0,0,.5)}
#toast.show{opacity:1;transform:translateX(-50%) translateY(0)}
#toast.ok{border-color:rgba(52,211,153,.5)}
#toast.err{border-color:rgba(248,113,113,.5)}
footer{text-align:center;color:var(--muted);font-size:.78rem;margin-top:30px;opacity:.85}
</style>
</head>
<body>
<div class="wrap">
  <header>
    <h1>📦 <span>مرکز دانلود</span> AmarGhaza</h1>
    <p>آپلود فایل فشرده، ساخت آرشیو از آخرین تغییرات و دانلود نتیجه</p>
  </header>

  <div class="stats" id="stats"><span class="chip">⏳ در حال دریافت وضعیت…</span></div>

  <main class="grid">

    <!-- دکمه ۱: آپلود -->
    <section class="card">
      <div class="card-head">
        <span class="num">۱</span>
        <div>
          <h2>آپلود فایل فشرده</h2>
          <p>فایلت را بفرست تا روی سرور استخراج شود</p>
        </div>
      </div>
      <div class="drop" id="drop" title="کلیک کن یا فایل را رها کن">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">
          <path d="M12 16V4m0 0l-4 4m4-4l4 4" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2" stroke-linecap="round"/>
        </svg>
        <div>فایل فشرده را اینجا رها کن یا کلیک کن</div>
        <input type="file" id="file-input" hidden
               accept=".zip,.rar,.7z,.tar,.gz,.tgz,.bz2,.xz">
      </div>
      <div class="meta" id="file-meta" hidden></div>
      <button class="btn primary big" id="btn-upload" disabled>⬆&nbsp; ارسال فایل</button>
      <div class="progress" id="prog" hidden><div class="bar" id="bar"></div></div>
      <p class="hint">فرمت‌ها: zip ، tar.gz ، tgz ، gz ، bz2 ، xz (و rar/7z در صورت پشتیبانی سرور) — هر آپلود جدید، فایل‌های قبلی را جایگزین می‌کند.</p>
    </section>

    <!-- دکمه ۲: ساخت آرشیو از تغییرات -->
    <section class="card">
      <div class="card-head">
        <span class="num">۲</span>
        <div>
          <h2>ساخت فایل فشرده از تغییرات</h2>
          <p>آرشیو ZIP از آخرین وضعیت فایل‌هایت + گزارش تغییرات</p>
        </div>
      </div>
      <label class="toggle"><input type="checkbox" id="only-changed"> فقط فایل‌های تغییرکرده و افزوده‌شده</label>
      <div class="meta" id="changes-meta">—</div>
      <button class="btn primary big" id="btn-archive">🗄&nbsp; ساخت فایل فشرده</button>
      <div class="result" id="archive-result" hidden></div>
    </section>

    <!-- دکمه ۳: دانلود -->
    <section class="card">
      <div class="card-head">
        <span class="num">۳</span>
        <div>
          <h2>دانلود آخرین فایل فشرده</h2>
          <p>آخرین آرشیویی که برایت ساخته‌ام</p>
        </div>
      </div>
      <div class="meta" id="latest-meta">هنوز آرشیوی ساخته نشده است.</div>
      <button class="btn primary big" id="btn-download" disabled>⬇&nbsp; دانلود فایل فشرده</button>
      <p class="hint">داخل هر آرشیو، فایل <b>CHANGES.txt</b> گزارش کامل تغییرات (تغییرکرده/افزوده/حذف‌شده) قرار دارد.</p>
    </section>

  </main>

  <footer>سرور مرکز دانلود AmarGhaza — پایتون استاندارد، بدون وابستگی</footer>
</div>
<div id="toast"></div>
<script>
const $ = id => document.getElementById(id);
const drop = $('drop'), fileInput = $('file-input'), btnUpload = $('btn-upload');
let currentFile = null;

function toast(msg, type){
  const t = $('toast');
  t.textContent = msg;
  t.className = 'show ' + (type || '');
  clearTimeout(t._h);
  t._h = setTimeout(() => t.className = '', 4500);
}
function fmtSize(n){
  if (n == null || isNaN(n)) return '—';
  const u = ['بایت', 'کیلوبایت', 'مگابایت', 'گیگابایت'];
  let i = 0;
  while (n >= 1024 && i < 3) { n /= 1024; i++; }
  return (i ? n.toFixed(1) : n) + ' ' + u[i];
}
function fmtDate(s){
  if (!s) return '—';
  try { return new Intl.DateTimeFormat('fa-IR', {dateStyle:'medium', timeStyle:'short'}).format(new Date(s)); }
  catch(e) { return s; }
}
function esc(s){ return String(s ?? '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }

/* ---- دکمه ۱: انتخاب و آپلود فایل ---- */
drop.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', () => selectFile(fileInput.files[0]));
['dragover','dragenter'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.add('over'); }));
['dragleave','drop'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.remove('over'); }));
drop.addEventListener('drop', e => {
  const f = e.dataTransfer.files && e.dataTransfer.files[0];
  if (f) selectFile(f);
});

function selectFile(f){
  if (!f) return;
  currentFile = f;
  $('file-meta').hidden = false;
  $('file-meta').innerHTML = '<b>' + esc(f.name) + '</b> — ' + fmtSize(f.size);
  btnUpload.disabled = false;
}

btnUpload.addEventListener('click', () => {
  if (!currentFile) return;
  btnUpload.disabled = true;
  btnUpload.textContent = '⏳ در حال ارسال…';
  $('prog').hidden = false;
  $('bar').style.width = '0%';
  const xhr = new XMLHttpRequest();
  xhr.open('POST', '/api/upload?filename=' + encodeURIComponent(currentFile.name));
  xhr.upload.onprogress = e => {
    if (e.lengthComputable) $('bar').style.width = (e.loaded / e.total * 100).toFixed(1) + '%';
  };
  xhr.onload = () => {
    $('prog').hidden = true;
    let r = {};
    try { r = JSON.parse(xhr.responseText); } catch(e) {}
    if (xhr.status === 200 && r.ok) {
      let msg = '✅ «' + r.original_name + '» دریافت شد — ' + r.files + ' فایل آماده شد';
      if (r.kind === 'single') msg += ' (آرشیو نبود؛ تک‌فایل ذخیره شد)';
      toast(msg, 'ok');
    } else {
      toast('❌ ' + (r.error || ('خطا در آپلود (' + xhr.status + ')')), 'err');
    }
    resetUploadUI();
    refresh();
  };
  xhr.onerror = () => {
    $('prog').hidden = true;
    toast('❌ ارتباط با سرور برقرار نشد', 'err');
    resetUploadUI();
  };
  xhr.send(currentFile);
});

function resetUploadUI(){
  btnUpload.textContent = '⬆ ارسال فایل';
  btnUpload.disabled = true;
  fileInput.value = '';
  currentFile = null;
  $('file-meta').hidden = true;
}

/* ---- دکمه ۲: ساخت آرشیو ---- */
$('btn-archive').addEventListener('click', async () => {
  const btn = $('btn-archive');
  btn.disabled = true;
  btn.textContent = '⏳ در حال ساخت…';
  try {
    const only = $('only-changed').checked ? '1' : '0';
    const res = await fetch('/api/archive?only_changed=' + only, {method: 'POST'});
    const r = await res.json();
    if (res.ok && r.ok) {
      $('archive-result').hidden = false;
      $('archive-result').innerHTML =
        '<div class="kv">' +
        '<span>نام فایل:</span><span>' + esc(r.name) + '</span>' +
        '<span>حجم:</span><span>' + fmtSize(r.size) + '</span>' +
        '<span>فایل‌های داخل آرشیو:</span><span>' + r.files_in_archive + '</span>' +
        '<span>تغییرکرده / افزوده / حذف:</span><span>' + r.changed + ' / ' + r.added + ' / ' + r.removed + '</span>' +
        '</div>';
      toast('✅ فایل فشرده ساخته شد؛ از دکمهٔ ۳ دانلودش کن', 'ok');
    } else {
      toast('❌ ' + (r.error || 'ساخت آرشیو ناموفق بود'), 'err');
    }
  } catch (e) {
    toast('❌ خطای شبکه', 'err');
  }
  btn.disabled = false;
  btn.textContent = '🗄 ساخت فایل فشرده';
  refresh();
});

/* ---- دکمه ۳: دانلود آخرین آرشیو ---- */
$('btn-download').addEventListener('click', () => {
  if (!$('btn-download').dataset.ready) {
    toast('اول از دکمهٔ ۲ فایل فشرده بساز', 'err');
    return;
  }
  window.location.href = '/api/latest';
});

/* ---- وضعیت ---- */
async function refresh(){
  try {
    const res = await fetch('/api/status');
    const s = await res.json();
    const chips = [];
    if (s.upload) chips.push('📤 آخرین آپلود: <b>' + esc(s.upload.original_name) + '</b> (' + fmtDate(s.upload.uploaded_at) + ')');
    else chips.push('📤 هنوز فایلی آپلود نشده');
    if (s.files && s.files.count) chips.push('🗂 فایل‌ها: <b>' + s.files.count + '</b> (' + fmtSize(s.files.bytes) + ')');
    if (s.upload) chips.push('✏️ تغییرات از زمان آپلود: <b>' + (s.changes.changed + s.changes.added + s.changes.removed) + '</b>');
    if (s.latest) chips.push('📦 آخرین آرشیو: <b>' + esc(s.latest.name) + '</b>');
    $('stats').innerHTML = chips.map(x => '<span class="chip">' + x + '</span>').join('');

    if (s.upload) {
      const c = s.changes;
      $('changes-meta').innerHTML = 'مقایسه با نسخهٔ آپلودی: <b>' + c.changed + '</b> تغییرکرده، <b>' + c.added + '</b> افزوده، <b>' + c.removed + '</b> حذف‌شده';
    } else {
      $('changes-meta').textContent = 'برای ساخت آرشیو، اول فایلت را آپلود کن (دکمهٔ ۱).';
    }

    const dbtn = $('btn-download');
    if (s.latest) {
      dbtn.disabled = false;
      dbtn.dataset.ready = '1';
      $('latest-meta').innerHTML =
        '<div class="kv">' +
        '<span>نام:</span><span>' + esc(s.latest.name) + '</span>' +
        '<span>حجم:</span><span>' + fmtSize(s.latest.size) + '</span>' +
        '<span>زمان ساخت:</span><span>' + fmtDate(s.latest.created_at) + '</span>' +
        '</div>';
    } else {
      dbtn.disabled = true;
      delete dbtn.dataset.ready;
      $('latest-meta').textContent = 'هنوز آرشیوی ساخته نشده است.';
    }
  } catch (e) { /* بی‌خیال */ }
}
refresh();
</script>
</body>
</html>
"""


# ---------------------------------------------------------------------------
# HTTP Handler
# ---------------------------------------------------------------------------
class Handler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"
    server_version = "AmarGhazaDC/1.0"

    def log_message(self, fmt, *args):
        sys.stdout.write("[%s] %s\n" % (self.log_date_time_string(), fmt % args))
        sys.stdout.flush()

    # ----- پاسخ‌دهی -----
    def send_json(self, code: int, obj: dict):
        body = json.dumps(obj, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        try:
            self.wfile.write(body)
        except (BrokenPipeError, ConnectionResetError):
            pass

    def send_html(self, text: str):
        body = text.encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        try:
            self.wfile.write(body)
        except (BrokenPipeError, ConnectionResetError):
            pass

    def drain_body(self):
        try:
            length = int(self.headers.get("Content-Length") or 0)
        except ValueError:
            length = 0
        while length > 0:
            chunk = self.rfile.read(min(CHUNK, length))
            if not chunk:
                break
            length -= len(chunk)

    # ----- GET -----
    def do_GET(self):
        url = urlparse(self.path)
        try:
            if url.path in ("/", "/index.html"):
                self.send_html(INDEX_HTML)
            elif url.path == "/api/status":
                self.handle_status()
            elif url.path == "/api/latest":
                self.handle_latest()
            elif url.path == "/favicon.ico":
                self.send_response(204)
                self.send_header("Content-Length", "0")
                self.end_headers()
            else:
                self.send_json(404, {"ok": False, "error": "مسیر یافت نشد"})
        except (BrokenPipeError, ConnectionResetError):
            pass
        except Exception as e:
            self.safe_error(e)

    # ----- POST -----
    def do_POST(self):
        url = urlparse(self.path)
        qs = parse_qs(url.query)
        try:
            if url.path == "/api/upload":
                self.handle_upload(qs)
            elif url.path == "/api/archive":
                self.handle_archive(qs)
            else:
                self.drain_body()
                self.send_json(404, {"ok": False, "error": "مسیر یافت نشد"})
        except (BrokenPipeError, ConnectionResetError):
            pass
        except Exception as e:
            self.safe_error(e)

    def safe_error(self, e):
        try:
            self.send_json(500, {"ok": False, "error": f"خطای داخلی سرور: {e}"})
        except Exception:
            pass

    # ----- دکمه ۱: آپلود -----
    def handle_upload(self, qs):
        raw_name = (qs.get("filename") or [""])[0]
        original = sanitize_filename(raw_name)
        try:
            length = int(self.headers.get("Content-Length") or 0)
        except ValueError:
            length = 0
        if length <= 0:
            return self.send_json(400, {"ok": False, "error": "بدنهٔ درخواست خالی است"})
        if length > MAX_UPLOAD:
            self.close_connection = True
            return self.send_json(
                413,
                {"ok": False,
                 "error": f"حجم فایل بیشتر از سقف مجاز است ({MAX_UPLOAD // (1024 ** 2)} مگابایت)"},
            )

        UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
        safe = re.sub(r"[^\w.\-\u0600-\u06FF ]", "_", original)
        upload_path = UPLOADS_DIR / (stamp() + "_" + safe)

        received = 0
        try:
            with open(upload_path, "wb") as f:
                remaining = length
                while remaining > 0:
                    chunk = self.rfile.read(min(CHUNK, remaining))
                    if not chunk:
                        break
                    f.write(chunk)
                    received += len(chunk)
                    remaining -= len(chunk)
        except Exception:
            upload_path.unlink(missing_ok=True)
            raise
        if received != length:
            upload_path.unlink(missing_ok=True)
            return self.send_json(400, {"ok": False, "error": "آپلود ناقص بود؛ دوباره تلاش کن"})

        with LOCK:
            DATA_DIR.mkdir(parents=True, exist_ok=True)
            category = classify_upload(original, upload_path)
            tmp = Path(tempfile.mkdtemp(dir=DATA_DIR))
            try:
                if category == "single":
                    shutil.copy2(upload_path, tmp / original)
                    kind = "single"
                else:
                    kind = extract_archive(upload_path, tmp, original)
                    if not any(tmp.rglob("*")):
                        raise ValueError("آرشیو خالی است")
            except Exception as e:
                shutil.rmtree(tmp, ignore_errors=True)
                prune_dir(UPLOADS_DIR, KEEP_UPLOADS)
                msg = str(e) if isinstance(e, UnsupportedFormat) else f"استخراج ناموفق بود: {e}"
                return self.send_json(415, {
                    "ok": False,
                    "error": msg,
                    "saved_as_upload": upload_path.name,
                    "supported": supported_text(),
                })

            # جایگزینی موفق فایل‌های قبلی
            if FILES_DIR.exists():
                shutil.rmtree(FILES_DIR)
            os.rename(tmp, FILES_DIR)

            count, total = files_stat(FILES_DIR)
            meta = {
                "original_name": original,
                "uploaded_at": now_iso(),
                "kind": kind,
                "upload_file": upload_path.name,
                "files": count,
                "bytes": total,
            }
            jdump(BASELINE_PATH, {"meta": meta, "files": build_manifest(FILES_DIR)})

        prune_dir(UPLOADS_DIR, KEEP_UPLOADS)
        self.send_json(200, {
            "ok": True,
            "original_name": original,
            "kind": kind,
            "files": count,
            "bytes": total,
            "uploaded_at": meta["uploaded_at"],
        })

    # ----- دکمه ۲: ساخت آرشیو -----
    def handle_archive(self, qs):
        only_changed = (qs.get("only_changed") or ["0"])[0].lower() in ("1", "true", "yes")
        with LOCK:
            count, _ = files_stat(FILES_DIR)
            if count == 0:
                return self.send_json(422, {
                    "ok": False,
                    "error": "هنوز فایلی آپلود نشده است. اول از دکمهٔ ۱ فایل فشردهٔ خودت را آپلود کن.",
                })
            try:
                info = create_archive(only_changed)
            except NoChanges:
                return self.send_json(422, {
                    "ok": False,
                    "error": "از زمان آپلود، هیچ تغییری در فایل‌ها ثبت نشده است. (گزینهٔ «کل فایل‌ها» را امتحان کن)",
                })
            except Exception as e:
                return self.send_json(500, {"ok": False, "error": f"ساخت آرشیو ناموفق بود: {e}"})
        self.send_json(200, {"ok": True, **info})

    # ----- دکمه ۳: دانلود آخرین آرشیو -----
    def handle_latest(self):
        info = jload(LATEST_PATH) or {}
        name = os.path.basename(info.get("name") or "")
        path = ARCHIVES_DIR / name if name else None
        if not name or not path.exists():
            return self.send_json(404, {
                "ok": False,
                "error": "هنوز آرشیوی ساخته نشده است. از دکمهٔ ۲ فایل فشرده بساز.",
            })
        size = path.stat().st_size
        self.send_response(200)
        self.send_header("Content-Type", "application/zip")
        self.send_header("Content-Disposition", f'attachment; filename="{name}"')
        self.send_header("Content-Length", str(size))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        try:
            with open(path, "rb") as f:
                shutil.copyfileobj(f, self.wfile, CHUNK)
        except (BrokenPipeError, ConnectionResetError):
            pass

    # ----- وضعیت -----
    def handle_status(self):
        with LOCK:
            base = jload(BASELINE_PATH) or {}
            meta = base.get("meta") or None
            count, total = files_stat(FILES_DIR)
            current = build_manifest(FILES_DIR) if count else {}
            changed, added, removed = diff_manifests(base.get("files") or {}, current)
            latest = jload(LATEST_PATH) or None
            if latest:
                lname = os.path.basename(latest.get("name") or "")
                if not lname or not (ARCHIVES_DIR / lname).exists():
                    latest = None
        self.send_json(200, {
            "ok": True,
            "upload": meta,
            "files": {"count": count, "bytes": total},
            "changes": {"changed": len(changed), "added": len(added), "removed": len(removed)},
            "latest": latest,
            "max_upload": MAX_UPLOAD,
            "supported": supported_text(),
        })


# ---------------------------------------------------------------------------
# اجرا
# ---------------------------------------------------------------------------
def main():
    for d in (DATA_DIR, FILES_DIR, ARCHIVES_DIR, UPLOADS_DIR):
        d.mkdir(parents=True, exist_ok=True)
    server = ThreadingHTTPServer((HOST, PORT), Handler)
    server.daemon_threads = True
    print(f"✓ مرکز دانلود AmarGhaza راه‌اندازی شد → http://{HOST}:{PORT}", flush=True)
    print(f"  پوشهٔ داده‌ها: {DATA_DIR}", flush=True)
    print(f"  فرمت‌های پشتیبانی‌شده: {supported_text()}", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n✗ سرور متوقف شد", flush=True)


if __name__ == "__main__":
    main()
