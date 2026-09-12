/* =================================================================
   نگهداری پایدار داده‌ها
   ---------------------------------------------------------------
   داده‌ها در چند لایه همزمان نگهداری می‌شوند تا با خاموش شدن سیستم
   یا پاک کردن History مرورگر از بین نروند:

     ۱) localStorage  — سریع، ولی با پاک کردن History پاک می‌شود
     ۲) IndexedDB     — مقاوم‌تر و با ظرفیت بسیار بیشتر
     ۳) فایل روی دیسک — کاملاً بیرون از مرورگر، هیچ‌وقت پاک نمی‌شود

   هنگام باز شدن برنامه، هر سه لایه خوانده و «تازه‌ترین» نسخه انتخاب
   می‌شود؛ پس حتی اگر یکی پاک شود، داده از لایه دیگر برمی‌گردد.
================================================================= */

const DB_NAME = 'AmarGhazaDB';
const DB_STORE = 'kv';
const DB_KEY = 'appState';
const FH_KEY = 'fileHandle';

/* ---------- لایه ۲: IndexedDB ---------- */
let _db = null;
function idbOpen() {
  if (_db) return Promise.resolve(_db);
  return new Promise((res, rej) => {
    if (!window.indexedDB) return rej(new Error('no-idb'));
    const rq = indexedDB.open(DB_NAME, 1);
    rq.onupgradeneeded = () => {
      if (!rq.result.objectStoreNames.contains(DB_STORE)) rq.result.createObjectStore(DB_STORE);
    };
    rq.onsuccess = () => { _db = rq.result; res(_db); };
    rq.onerror = () => rej(rq.error);
  });
}
function idbSet(key, val) {
  return idbOpen().then(db => new Promise((res, rej) => {
    const tx = db.transaction(DB_STORE, 'readwrite');
    tx.objectStore(DB_STORE).put(val, key);
    tx.oncomplete = res; tx.onerror = () => rej(tx.error);
  }));
}
function idbGet(key) {
  return idbOpen().then(db => new Promise((res, rej) => {
    const tx = db.transaction(DB_STORE, 'readonly');
    const rq = tx.objectStore(DB_STORE).get(key);
    rq.onsuccess = () => res(rq.result);
    rq.onerror = () => rej(rq.error);
  }));
}

/* ---------- لایه ۳: فایل واقعی روی دیسک ---------- */
/* با File System Access API یک فایل پشتیبان انتخاب می‌شود و از آن پس
   هر ذخیره‌سازی مستقیم روی همان فایل هم نوشته می‌شود. این فایل با پاک
   کردن History یا نصب دوباره ویندوز هم از بین نمی‌رود. */
let _fileHandle = null;

function fsSupported() {
  return typeof window !== 'undefined' && typeof window.showSaveFilePicker === 'function';
}

async function fsVerifyPermission(handle, write) {
  if (!handle || !handle.queryPermission) return false;
  const opts = { mode: write ? 'readwrite' : 'read' };
  if ((await handle.queryPermission(opts)) === 'granted') return true;
  if ((await handle.requestPermission(opts)) === 'granted') return true;
  return false;
}

/* کاربر یک‌بار محل فایل پشتیبان را انتخاب می‌کند */
async function chooseBackupFile() {
  if (!fsSupported()) {
    toast('⚠️ این مرورگر از ذخیره روی فایل پشتیبانی نمی‌کند — از دکمه «پشتیبان» استفاده کنید');
    return false;
  }
  try {
    const handle = await window.showSaveFilePicker({
      suggestedName: 'AmarGhaza-Data.json',
      types: [{ description: 'داده برنامه آمار غذا', accept: { 'application/json': ['.json'] } }],
    });
    _fileHandle = handle;
    try { await idbSet(FH_KEY, handle); } catch (e) {}
    await fsWrite(JSON.stringify(S));
    renderStorageInfo();
    toast('🔒 فایل پشتیبان خودکار فعال شد — از این پس تغییرات روی دیسک هم ذخیره می‌شود');
    return true;
  } catch (e) {
    return false;   // کاربر پنجره را بست
  }
}

async function fsWrite(text) {
  if (!_fileHandle) return false;
  try {
    if (!(await fsVerifyPermission(_fileHandle, true))) return false;
    const w = await _fileHandle.createWritable();
    await w.write(text);
    await w.close();
    return true;
  } catch (e) { return false; }
}

async function fsRead() {
  if (!_fileHandle) return null;
  try {
    if (!(await fsVerifyPermission(_fileHandle, false))) return null;
    const f = await _fileHandle.getFile();
    const t = await f.text();
    return t ? JSON.parse(t) : null;
  } catch (e) { return null; }
}

/* قطع کردن ذخیره خودکار روی فایل */
async function forgetBackupFile() {
  _fileHandle = null;
  try { await idbSet(FH_KEY, null); } catch (e) {}
  renderStorageInfo();
  toast('فایل پشتیبان خودکار غیرفعال شد');
}

/* ---------- نوشتن همزمان در همه لایه‌ها ---------- */
/* مهر زمانی می‌گذاریم تا هنگام بارگذاری بتوانیم تازه‌ترین نسخه را بشناسیم */
function stampState() {
  try { S.__savedAt = Date.now(); } catch (e) {}
}

function persistAll(json) {
  // لایه ۲
  try { idbSet(DB_KEY, json).catch(() => {}); } catch (e) {}
  // لایه ۳
  try { fsWrite(json); } catch (e) {}
}

/* ---------- خواندن: تازه‌ترین نسخه از میان لایه‌ها ---------- */
function _parse(raw) {
  if (!raw) return null;
  try { return typeof raw === 'string' ? JSON.parse(raw) : raw; } catch (e) { return null; }
}
function _stamp(o) { return (o && +o.__savedAt) || 0; }

/* داده‌ها را از همه لایه‌ها می‌خواند و اگر لایه‌ای تازه‌تر از localStorage
   بود، آن را برمی‌گرداند تا برنامه با داده کامل بالا بیاید. */
async function loadNewest() {
  const local = _parse(localStorage.getItem(LS_KEY));
  let best = local, from = 'local';

  try {
    const fromIdb = _parse(await idbGet(DB_KEY));
    if (_stamp(fromIdb) > _stamp(best)) { best = fromIdb; from = 'idb'; }
  } catch (e) {}

  try {
    if (!_fileHandle) {
      const h = await idbGet(FH_KEY);
      if (h) _fileHandle = h;
    }
    const fromFile = await fsRead();
    if (_stamp(fromFile) > _stamp(best)) { best = fromFile; from = 'file'; }
  } catch (e) {}

  return { data: best, from, hadLocal: !!local };
}

/* ---------- درخواست حافظه پایدار از مرورگر ---------- */
/* با این اجازه، مرورگر داده برنامه را هنگام کمبود فضا یا پاکسازی
   خودکار حذف نمی‌کند. */
async function requestPersistentStorage() {
  try {
    if (navigator.storage && navigator.storage.persist) {
      if (await navigator.storage.persisted()) return true;
      return await navigator.storage.persist();
    }
  } catch (e) {}
  return false;
}

/* ---------- نمایش وضعیت در تنظیمات ---------- */
async function storageStatus() {
  let persisted = false;
  try { persisted = navigator.storage && navigator.storage.persisted ? await navigator.storage.persisted() : false; } catch (e) {}
  return {
    local: !!localStorage.getItem(LS_KEY),
    idb: !!window.indexedDB,
    file: !!_fileHandle,
    fileName: _fileHandle ? (_fileHandle.name || 'فایل انتخاب‌شده') : '',
    fsSupported: fsSupported(),
    persisted,
  };
}

async function renderStorageInfo() {
  const box = document.getElementById('storageInfo');
  if (!box) return;
  const s = await storageStatus();
  const row = (ok, txt) => `<div class="st-row ${ok ? 'ok' : 'no'}">${ok ? '✅' : '⚪'} ${txt}</div>`;
  box.innerHTML =
    row(true, 'حافظه مرورگر (سریع) — با پاک کردن History پاک می‌شود') +
    row(s.idb, 'پایگاه داده مرورگر — مقاوم‌تر و با ظرفیت بالا') +
    row(s.persisted, s.persisted
      ? 'حافظه پایدار: مرورگر اجازه داده داده‌ها خودکار پاک نشوند'
      : 'حافظه پایدار هنوز فعال نیست') +
    row(s.file, s.file
      ? `ذخیره خودکار روی فایل: ${s.fileName}`
      : 'ذخیره خودکار روی فایل غیرفعال است ← امن‌ترین گزینه');

  const b = document.getElementById('btnChooseFile');
  if (b) {
    b.textContent = s.file ? '📁 تغییر فایل پشتیبان' : '🔒 فعال کردن ذخیره روی فایل';
    b.disabled = !s.fsSupported;
    b.title = s.fsSupported ? '' : 'این مرورگر پشتیبانی نمی‌کند — برنامه را با Edge یا Chrome باز کنید';
  }
  const f = document.getElementById('btnForgetFile');
  if (f) f.style.display = s.file ? '' : 'none';
}
