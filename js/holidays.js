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

/* ---------- آمار ---------- */
function holidayStats(y, m) {
  const total = jMonthLen(y, m);
  const pref = `${y}/${String(m).padStart(2,'0')}/`;
  const list = holidays().filter(h=>String(h.date).startsWith(pref));
  const off = list.length;
  return { total, off, work: total - off, list };
}

function renderHolidays() {
  const box = document.getElementById('holidayList');
  if (!box) return;

  // پرکردن سال/ماه در اولین اجرا
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

  renderHolidayStats();
}

const J_DOWS_FULL = ['شنبه','یکشنبه','دوشنبه','سه‌شنبه','چهارشنبه','پنجشنبه','جمعه'];

function renderHolidayStats() {
  const el = document.getElementById('holidayStats');
  if (!el) return;
  const y = +document.getElementById('hdStatYear').value || todayJ()[0];
  const m = +document.getElementById('hdStatMonth').value || todayJ()[1];
  const st = holidayStats(y, m);

  // آمار سالانه
  let yTotal = 0, yOff = 0;
  for (let mm=1; mm<=12; mm++) { const s = holidayStats(y, mm); yTotal += s.total; yOff += s.off; }

  // تعداد نفرات حاضر فعلی برای برآورد پرس
  let people = 0;
  try { selectedUnits().forEach(u=>{ unitPeople(u.id).forEach(p=>{ if(!S.sheet.absent[p.id]) people++; }); }); } catch(e){}

  el.innerHTML = `
    <div class="stat"><b>${st.total}</b><span>کل روزهای ${J_MONTHS[m-1]}</span></div>
    <div class="stat red"><b>${st.off}</b><span>روز تعطیل</span></div>
    <div class="stat"><b>${st.work}</b><span>روز کاری</span></div>
    <div class="stat"><b>${st.work * people}</b><span>برآورد کل پرس ماه (${people} نفر)</span></div>
    <div class="stat"><b>${yOff}</b><span>تعطیلات سال ${y}</span></div>
    <div class="stat"><b>${yTotal - yOff}</b><span>روزهای کاری سال ${y}</span></div>`;

  // جدول ماه‌های سال
  const tb = document.getElementById('holidayYearTable');
  if (tb) {
    tb.innerHTML = `<thead><tr><th>ماه</th><th>کل روزها</th><th>تعطیل</th><th>روز کاری</th></tr></thead><tbody>` +
      J_MONTHS.map((n,i)=>{
        const s = holidayStats(y, i+1);
        return `<tr class="${(i+1)===m?'hl':''}"><td>${n}</td><td class="c">${s.total}</td><td class="c">${s.off}</td><td class="c">${s.work}</td></tr>`;
      }).join('') +
      `<tr class="tot"><td>جمع سال</td><td class="c">${yTotal}</td><td class="c">${yOff}</td><td class="c">${yTotal-yOff}</td></tr></tbody>`;
  }
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
