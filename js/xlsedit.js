/* ================= ویرایشگر فایل اکسل =================
   باز کردن یک فایل .xlsx واقعی، ویرایش خانه‌ها در جدول،
   و ذخیره دوباره به‌صورت فایل اکسل.
   از کتابخانه SheetJS (js/xlsx.full.min.js) استفاده می‌کند.
   ======================================================= */

let XE = {
  wb: null,        // workbook باز شده
  sheet: '',       // نام شیت جاری
  rows: [],        // داده شیت جاری به‌صورت آرایه دو بعدی
  name: '',        // نام فایل
  dirty: false,    // آیا تغییر ذخیره‌نشده دارد
};

const XE_MIN_ROWS = 12;
const XE_MIN_COLS = 6;

/* ---------- باز کردن فایل ---------- */
function xeOpenPicker() {
  const inp = document.getElementById('xeFile');
  if (inp) { inp.value = ''; inp.click(); }
}

function xeLoadFile(inp) {
  const f = inp.files && inp.files[0];
  if (!f) return;
  const rd = new FileReader();
  rd.onload = ev => {
    try {
      const wb = XLSX.read(ev.target.result, { type: 'array' });
      if (!wb.SheetNames.length) throw new Error('no-sheet');
      XE.wb = wb;
      XE.name = f.name;
      XE.dirty = false;
      xeSelectSheet(wb.SheetNames[0]);
      toast('فایل باز شد: ' + f.name);
    } catch (e) {
      toast('فایل اکسل خوانده نشد');
    }
  };
  rd.readAsArrayBuffer(f);
}

/* ---------- ساخت فایل خالی ---------- */
function xeNewFile() {
  if (XE.dirty && !confirm('تغییرات ذخیره‌نشده از بین می‌رود. ادامه؟')) return;
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([['']]);
  XLSX.utils.book_append_sheet(wb, ws, 'برگه۱');
  XE.wb = wb;
  XE.name = 'فایل-جدید.xlsx';
  XE.dirty = false;
  xeSelectSheet('برگه۱');
}

/* ---------- انتخاب شیت ---------- */
function xeSelectSheet(nm) {
  if (!XE.wb || !XE.wb.Sheets[nm]) return;
  // ویرایش‌های برگه فعلی پیش از جابه‌جایی در workbook نوشته شود
  if (XE.sheet && XE.sheet !== nm && XE.rows.length) xeCommit();
  XE.sheet = nm;
  const raw = XLSX.utils.sheet_to_json(XE.wb.Sheets[nm], { header: 1, defval: '', blankrows: true });
  // جدول را تا حداقل اندازه پر می‌کنیم تا جای نوشتن باشد
  const cols = Math.max(XE_MIN_COLS, ...raw.map(r => r.length), 1);
  const rows = [];
  for (let i = 0; i < Math.max(XE_MIN_ROWS, raw.length); i++) {
    const src = raw[i] || [];
    const row = [];
    for (let j = 0; j < cols; j++) row.push(src[j] == null ? '' : String(src[j]));
    rows.push(row);
  }
  XE.rows = rows;
  xeRender();
}

/* ---------- رندر جدول ---------- */
function xeColName(i) {
  let s = '';
  i++;
  while (i > 0) { const m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); }
  return s;
}

function xeRender() {
  const box = document.getElementById('xeGrid');
  const bar = document.getElementById('xeSheets');
  const info = document.getElementById('xeInfo');
  if (!box) return;

  if (!XE.wb) {
    box.innerHTML = '<div class="xe-empty">فایلی باز نشده است.<br>یک فایل اکسل باز کنید یا فایل جدید بسازید.</div>';
    if (bar) bar.innerHTML = '';
    if (info) info.textContent = '';
    return;
  }

  if (bar) {
    bar.innerHTML = XE.wb.SheetNames.map(n =>
      `<button class="xe-sheet ${n === XE.sheet ? 'on' : ''}" onclick="xeSelectSheet('${n.replace(/'/g, "\\'")}')">${esc(n)}</button>`
    ).join('') + `<button class="xe-sheet add" onclick="xeAddSheet()" title="برگه جدید">+</button>`;
  }

  const cols = XE.rows[0] ? XE.rows[0].length : XE_MIN_COLS;
  let h = '<table class="xe-tab"><thead><tr><th class="xe-corner"></th>';
  for (let j = 0; j < cols; j++) h += `<th>${xeColName(j)}</th>`;
  h += '</tr></thead><tbody>';
  XE.rows.forEach((row, i) => {
    h += `<tr><th class="xe-rn">${i + 1}</th>`;
    row.forEach((v, j) => {
      h += `<td><input value="${esc(v)}" data-r="${i}" data-c="${j}" onchange="xeEdit(this)"></td>`;
    });
    h += '</tr>';
  });
  h += '</tbody></table>';
  box.innerHTML = h;

  if (info) {
    info.textContent = `${XE.name} — برگه «${XE.sheet}» — ${XE.rows.length} سطر × ${cols} ستون` +
      (XE.dirty ? ' • ذخیره نشده' : '');
  }
}

/* ---------- ویرایش یک خانه ---------- */
function xeEdit(el) {
  const r = +el.dataset.r, c = +el.dataset.c;
  if (!XE.rows[r]) return;
  XE.rows[r][c] = el.value;
  XE.dirty = true;
  const info = document.getElementById('xeInfo');
  if (info && !/ذخیره نشده/.test(info.textContent)) info.textContent += ' • ذخیره نشده';
}

/* ---------- افزودن سطر / ستون / برگه ---------- */
function xeAddRow() {
  if (!XE.wb) return toast('اول یک فایل باز کنید');
  const cols = XE.rows[0] ? XE.rows[0].length : XE_MIN_COLS;
  XE.rows.push(new Array(cols).fill(''));
  XE.dirty = true;
  xeRender();
}
function xeAddCol() {
  if (!XE.wb) return toast('اول یک فایل باز کنید');
  XE.rows.forEach(r => r.push(''));
  XE.dirty = true;
  xeRender();
}
function xeAddSheet() {
  if (!XE.wb) return;
  let n = 1, nm;
  do { nm = 'برگه' + (++n); } while (XE.wb.SheetNames.includes(nm));
  xeCommit();
  XLSX.utils.book_append_sheet(XE.wb, XLSX.utils.aoa_to_sheet([['']]), nm);
  XE.dirty = true;
  xeSelectSheet(nm);
}

/* ---------- نوشتن جدول جاری در workbook ---------- */
function xeCommit() {
  if (!XE.wb || !XE.sheet) return;
  // سطرها و ستون‌های کاملاً خالی انتهایی حذف شوند
  const rows = XE.rows.map(r => r.slice());
  while (rows.length && rows[rows.length - 1].every(v => String(v).trim() === '')) rows.pop();
  let maxC = 0;
  rows.forEach(r => { for (let j = 0; j < r.length; j++) if (String(r[j]).trim() !== '') maxC = Math.max(maxC, j + 1); });
  const trimmed = rows.map(r => r.slice(0, Math.max(1, maxC)));
  const ws = XLSX.utils.aoa_to_sheet(trimmed.length ? trimmed : [['']]);
  // عرض ستون‌ها را تا حدی حفظ کنیم
  const old = XE.wb.Sheets[XE.sheet];
  if (old && old['!cols']) ws['!cols'] = old['!cols'];
  if (old && old['!merges']) ws['!merges'] = old['!merges'];
  XE.wb.Sheets[XE.sheet] = ws;
}

/* ---------- ذخیره ---------- */
function xeSave() {
  if (!XE.wb) return toast('فایلی باز نشده است');
  xeCommit();
  const nm = (XE.name || 'file.xlsx').replace(/\.xlsx?$/i, '') + '.xlsx';
  XLSX.writeFile(XE.wb, nm);
  XE.dirty = false;
  xeRender();
  toast('ذخیره شد: ' + nm);
}

function xeSaveAs() {
  if (!XE.wb) return toast('فایلی باز نشده است');
  const nm = prompt('نام فایل برای ذخیره:', (XE.name || 'file').replace(/\.xlsx?$/i, ''));
  if (nm === null) return;
  XE.name = (nm.trim() || 'file') + '.xlsx';
  xeSave();
}

/* ---------- وارد کردن اسامی از برگه جاری به برنامه ---------- */
function xeImportPeople() {
  if (!XE.wb) return toast('فایلی باز نشده است');
  xeCommit();
  const rows = XE.rows.filter(r => r.some(v => String(v).trim() !== ''));
  if (!rows.length) return toast('برگه خالی است');

  const head = rows[0].map(c => (typeof normFa === 'function' ? normFa(c) : String(c)));
  const iName = head.findIndex(c => /نام/.test(c) && !/واحد/.test(c));
  const iCode = head.findIndex(c => /کد|شماره/.test(c));
  const iUnit = head.findIndex(c => /واحد|قسمت|بخش/.test(c));
  const start = iName >= 0 ? 1 : 0;
  const ci = iName >= 0 ? { name: iName, code: iCode, unit: iUnit } : { name: 0, code: 1, unit: 2 };

  let added = 0;
  for (let i = start; i < rows.length; i++) {
    const r = rows[i];
    const nm = String(r[ci.name] || '').trim();
    if (!nm) continue;
    const code = ci.code >= 0 ? String(r[ci.code] || '').trim() : '';
    const uname = ci.unit >= 0 ? String(r[ci.unit] || '').trim() : '';
    let unit = uname ? S.units.find(u => u.name.trim() === uname) : S.units[0];
    if (uname && !unit) { unit = { id: uid(), name: uname }; S.units.push(unit); }
    if (!unit) continue;
    if (S.people.some(p => p.name.trim() === nm && String(p.code || '') === code)) continue;
    S.people.push({ id: uid(), name: nm, code, unitId: unit.id });
    added++;
  }
  save();
  if (typeof renderAll === 'function') renderAll();
  toast(added ? `${added} نفر افزوده شد` : 'نفر جدیدی یافت نشد');
}
