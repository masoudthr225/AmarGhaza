/* ================= روزهای تعطیل و آمار روزهای کاری ================= */

function holidays() {
  if (!Array.isArray(S.holidays)) S.holidays = [];
  return S.holidays;
}

/* مرتب‌سازی بر اساس تاریخ */
function sortHolidays() {
  holidays().sort((a,b)=> String(a.date).localeCompare(String(b.date)));
}

function addHoliday() {
  const inp = document.getElementById('hdDate');
  const ttl = document.getElementById('hdTitle');
  const p = parseJDate(inp.value);
  if (!p) { toast('تاریخ را به شکل 1405/01/01 وارد کنید ❌'); return; }
  const d = fmtJ(p[0], p[1], p[2]);
  if (holidays().some(h=>h.date===d)) { toast('این تاریخ قبلاً ثبت شده است'); return; }
  holidays().push({ id: uid(), date: d, title: (ttl.value||'').trim() || 'تعطیل' });
  sortHolidays(); save();
  inp.value=''; ttl.value='';
  renderHolidays(); toast('روز تعطیل اضافه شد ✅');
}

function delHoliday(id) {
  S.holidays = holidays().filter(h=>h.id!==id);
  save(); renderHolidays();
}

function updHoliday(id, field, val) {
  const h = holidays().find(x=>x.id===id);
  if (!h) return;
  if (field==='date') {
    const p = parseJDate(val);
    if (!p) { toast('تاریخ نامعتبر ❌'); renderHolidays(); return; }
    h.date = fmtJ(p[0],p[1],p[2]);
  } else h.title = String(val||'').trim() || 'تعطیل';
  sortHolidays(); save(); renderHolidays();
}

function clearHolidays() {
  if (!holidays().length) return;
  if (!confirm('همه روزهای تعطیل حذف شوند؟')) return;
  S.holidays = []; save(); renderHolidays(); toast('لیست تعطیلات پاک شد');
}

/* افزودن خودکار همه جمعه‌های یک ماه */
function addFridays() {
  const y = +document.getElementById('hdStatYear').value;
  const m = +document.getElementById('hdStatMonth').value;
  if (!y || !m) { toast('سال و ماه را انتخاب کنید'); return; }
  let n = 0;
  for (let d=1; d<=jMonthLen(y,m); d++) {
    if (jDow(y,m,d) === 6) {
      const s = fmtJ(y,m,d);
      if (!holidays().some(h=>h.date===s)) { holidays().push({id:uid(), date:s, title:'جمعه'}); n++; }
    }
  }
  sortHolidays(); save(); renderHolidays();
  toast(n ? `${n} جمعه اضافه شد ✅` : 'جمعه‌ای برای افزودن نبود');
}

function isHoliday(dateStr) {
  const p = parseJDate(dateStr);
  if (!p) return null;
  const s = fmtJ(p[0],p[1],p[2]);
  return holidays().find(h=>h.date===s) || null;
}

const J_DOWS_FULL = ['شنبه','یکشنبه','دوشنبه','سه‌شنبه','چهارشنبه','پنجشنبه','جمعه'];

function renderHolidays() {
  const box = document.getElementById('holidayList');
  if (!box) return;

  // پرکردن سال/ماه در اولین اجرا (برای دکمه «افزودن جمعه‌های ماه»)
  const ySel = document.getElementById('hdStatYear');
  const mSel = document.getElementById('hdStatMonth');
  if (ySel && !ySel.options.length) {
    const [ty] = todayJ();
    let opts = '';
    for (let y = ty-2; y <= ty+2; y++) opts += `<option value="${y}" ${y===ty?'selected':''}>${y}</option>`;
    ySel.innerHTML = opts;
    mSel.innerHTML = J_MONTHS.map((n,i)=>`<option value="${i+1}">${n}</option>`).join('');
    mSel.value = String(todayJ()[1]);
  }

  sortHolidays();
  box.innerHTML = holidays().length ? holidays().map((h,i)=>{
    const p = parseJDate(h.date);
    const dow = p ? J_DOWS_FULL[jDow(p[0],p[1],p[2])] : '';
    return `<div class="mini-item">
      <span class="badge">${i+1}</span>
      <input type="text" class="has-jdp" value="${esc(h.date)}" style="max-width:130px"
             onchange="updHoliday('${h.id}','date',this.value)">
      <span class="chip" style="min-width:70px">${dow}</span>
      <input type="text" value="${esc(h.title)}" placeholder="مناسبت" style="flex:1"
             onchange="updHoliday('${h.id}','title',this.value)">
      <button class="icon-btn" title="حذف" onclick="delHoliday('${h.id}')">🗑️</button>
    </div>`;
  }).join('') : '<div class="att-note">هنوز روز تعطیلی ثبت نشده است.</div>';

  renderHolidayPeople();
}

/* ================= لیست نفرات روزهای تعطیل ================= */
function holidayStaff() {
  if (!S.holidayStaff || typeof S.holidayStaff !== 'object') S.holidayStaff = {};
  return S.holidayStaff;
}
function toggleHolidayStaff(pid, on) {
  if (on) holidayStaff()[pid] = true; else delete holidayStaff()[pid];
  save(); renderHolidayPeople();
}
function hdSelectAll(on) {
  hdFilteredPeople().forEach(p=>{ if (on) holidayStaff()[p.id] = true; else delete holidayStaff()[p.id]; });
  save(); renderHolidayPeople();
}
function hdFilteredPeople() {
  const uf = (document.getElementById('hdUnitFilter')||{}).value || '';
  const q  = ((document.getElementById('hdSearch')||{}).value || '').trim().toLowerCase();
  return S.people
    .filter(p => !uf || p.unitId === uf)
    .filter(p => !q || String(p.name).toLowerCase().includes(q) || String(p.code||'').includes(q))
    .sort((a,b)=>faCompare(a.name,b.name));
}
function renderHolidayPeople() {
  const tb = document.getElementById('hdPeopleTable');
  if (!tb) return;

  // پرکردن فیلتر واحدها
  const uf = document.getElementById('hdUnitFilter');
  const cur = uf.value;
  uf.innerHTML = '<option value="">همه واحدها</option>' +
    S.units.map(u=>`<option value="${u.id}">${esc(u.name)}</option>`).join('');
  uf.value = S.units.some(u=>u.id===cur) ? cur : '';

  const list = hdFilteredPeople();
  const sel = list.filter(p=>holidayStaff()[p.id]).length;
  const cnt = document.getElementById('hdPeopleCount');
  if (cnt) cnt.textContent = `${sel} نفر از ${list.length} نفر انتخاب شده`;

  const unitName = id => (S.units.find(u=>u.id===id)||{}).name || '—';
  tb.innerHTML = list.length
    ? `<thead><tr><th style="width:36px">#</th><th style="width:52px">شیفت تعطیل</th>
        <th>نام و نام خانوادگی</th><th style="width:90px">کد پرسنلی</th><th style="width:140px">واحد</th></tr></thead><tbody>` +
      list.map((p,i)=>{
        const on = !!holidayStaff()[p.id];
        return `<tr class="${on?'hd-on':''}">
          <td class="c">${i+1}</td>
          <td class="c"><input type="checkbox" ${on?'checked':''} onchange="toggleHolidayStaff('${p.id}', this.checked)"></td>
          <td>${esc(p.name)}</td>
          <td class="c">${esc(p.code||'')}</td>
          <td>${esc(unitName(p.unitId))}</td>
        </tr>`;
      }).join('') + '</tbody>'
    : '<tbody><tr><td>نفری یافت نشد.</td></tr></tbody>';
}

/* نشان دادن وضعیت تعطیل بودن تاریخ آمار روز */
function renderHolidayBadge() {
  const el = document.getElementById('sheetHolidayBadge');
  if (!el) return;
  const h = isHoliday(S.sheet && S.sheet.date);
  if (h) {
    el.style.display = '';
    el.className = 'chip red';
    el.textContent = `🔴 این روز تعطیل است — ${h.title}`;
  } else {
    el.style.display = 'none';
  }
}

function markSheetDateHoliday() {
  const d = S.sheet && S.sheet.date;
  const p = parseJDate(d);
  if (!p) { toast('ابتدا تاریخ آمار را وارد کنید'); return; }
  const s = fmtJ(p[0],p[1],p[2]);
  const ex = holidays().find(h=>h.date===s);
  if (ex) { S.holidays = holidays().filter(h=>h.date!==s); toast('از لیست تعطیلات حذف شد'); }
  else { holidays().push({id:uid(), date:s, title:'تعطیل'}); toast('به روزهای تعطیل اضافه شد ✅'); }
  sortHolidays(); save(); renderHolidays(); renderHolidayBadge();
}
