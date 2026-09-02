/* ================= تب «تعطیل کاری» ================= */
/* لیست نفرات + لیست واحدها + لیست غذا + تاریخ + چاپ برگه */

function HW() {
  if (!S.hwork || typeof S.hwork !== 'object') {
    S.hwork = { date: (typeof todayJalali==='function'?todayJalali():''), mealId:'', foodId:'',
                title:'لیست غذای تعطیل کاری', note:'', unitIds:[], people:{} };
  }
  const h = S.hwork;
  if (!Array.isArray(h.unitIds)) h.unitIds = [];
  if (!h.people || typeof h.people !== 'object') h.people = {};
  if (h.title == null) h.title = 'لیست غذای تعطیل کاری';
  return h;
}

/* ---------- ذخیره فرم ---------- */
function saveHW() {
  const h = HW();
  const g = id => document.getElementById(id);
  if (g('hwDate'))  h.date  = g('hwDate').value.trim();
  if (g('hwMeal'))  h.mealId = g('hwMeal').value;
  if (g('hwFood'))  h.foodId = g('hwFood').value;
  if (g('hwTitle')) h.title = g('hwTitle').value.trim() || 'لیست غذای تعطیل کاری';
  if (g('hwNote'))  h.note  = g('hwNote').value.trim();
  save();
  renderHWFoods(); renderHWPreview();
}

/* ---------- واحدها ---------- */
function hwToggleUnit(id) {
  const h = HW();
  const i = h.unitIds.indexOf(id);
  if (i >= 0) h.unitIds.splice(i,1); else h.unitIds.push(id);
  save(); renderHWUnits(); renderHWPeople(); renderHWPreview();
}
function hwAllUnits(on) {
  HW().unitIds = on ? S.units.map(u=>u.id) : [];
  save(); renderHWUnits(); renderHWPeople(); renderHWPreview();
}
function hwUnits() {
  return S.units.filter(u=>HW().unitIds.includes(u.id));
}
function renderHWUnits() {
  const box = document.getElementById('hwUnitChecks');
  if (!box) return;
  const h = HW();
  box.innerHTML = S.units.map(u=>{
    const on = h.unitIds.includes(u.id);
    const total = S.people.filter(p=>p.unitId===u.id).length;
    const sel = S.people.filter(p=>p.unitId===u.id && h.people[p.id]).length;
    return `<label class="${on?'on':''}"><input type="checkbox" ${on?'checked':''} onchange="hwToggleUnit('${u.id}')">
      ${esc(u.name)} <span class="badge">${sel}/${total}</span></label>`;
  }).join('') || '<span class="att-note">هنوز واحدی تعریف نشده — از تب «پرسنل و واحدها» اضافه کنید.</span>';
}

/* ---------- غذا ---------- */
function hwPickFood(id) {
  HW().foodId = (HW().foodId === id) ? '' : id;
  save();
  const sel = document.getElementById('hwFood');
  if (sel) sel.value = HW().foodId;
  renderHWFoods(); renderHWPreview();
}
function renderHWFoods() {
  const box = document.getElementById('hwFoodList');
  if (!box) return;
  const q = ((document.getElementById('hwFoodSearch')||{}).value||'').trim().toLowerCase();
  const list = S.foods.filter(f=>!q || String(f.name).toLowerCase().includes(q));
  const cur = HW().foodId;
  box.innerHTML = list.length
    ? list.map(f=>`<button class="food-pick ${f.id===cur?'on':''}" onclick="hwPickFood('${f.id}')">${esc(f.name)}</button>`).join('')
    : '<span class="att-note">غذایی یافت نشد.</span>';
}

/* ---------- نفرات ---------- */
function hwTogglePerson(pid, on) {
  const h = HW();
  if (on) h.people[pid] = true; else delete h.people[pid];
  save(); renderHWUnits(); renderHWPeople(); renderHWPreview();
}
function hwFilteredPeople() {
  const h = HW();
  const uf = (document.getElementById('hwUnitFilter')||{}).value || '';
  const q  = ((document.getElementById('hwSearch')||{}).value || '').trim().toLowerCase();
  const pool = h.unitIds.length ? S.people.filter(p=>h.unitIds.includes(p.unitId)) : S.people;
  return pool
    .filter(p => !uf || p.unitId === uf)
    .filter(p => !q || String(p.name).toLowerCase().includes(q) || String(p.code||'').includes(q))
    .sort((a,b)=>faCompare(a.name,b.name));
}
function hwAllPeople(on) {
  const h = HW();
  hwFilteredPeople().forEach(p=>{ if (on) h.people[p.id] = true; else delete h.people[p.id]; });
  save(); renderHWUnits(); renderHWPeople(); renderHWPreview();
}
/* نفرات انتخاب‌شده برای چاپ — گروه‌بندی بر اساس واحد */
function hwSelected() {
  const h = HW();
  const pool = h.unitIds.length ? S.people.filter(p=>h.unitIds.includes(p.unitId)) : S.people;
  return pool.filter(p=>h.people[p.id]).sort((a,b)=>faCompare(a.name,b.name));
}

function renderHWPeople() {
  const tb = document.getElementById('hwPeopleTable');
  if (!tb) return;
  const h = HW();

  // فیلتر واحد — فقط واحدهای انتخاب‌شده
  const uf = document.getElementById('hwUnitFilter');
  const cur = uf.value;
  const opts = (h.unitIds.length ? hwUnits() : S.units);
  uf.innerHTML = '<option value="">همه واحدهای انتخابی</option>' +
    opts.map(u=>`<option value="${u.id}">${esc(u.name)}</option>`).join('');
  uf.value = opts.some(u=>u.id===cur) ? cur : '';

  const list = hwFilteredPeople();
  const unitName = id => (S.units.find(u=>u.id===id)||{}).name || '—';
  tb.innerHTML = list.length
    ? `<thead><tr><th style="width:36px">#</th><th style="width:60px">تعطیل کار</th>
        <th>نام و نام خانوادگی</th><th style="width:100px">کد پرسنلی</th><th style="width:150px">واحد</th></tr></thead><tbody>` +
      list.map((p,i)=>{
        const on = !!h.people[p.id];
        return `<tr class="${on?'hw-on':''}">
          <td class="c">${i+1}</td>
          <td class="c"><input type="checkbox" ${on?'checked':''} onchange="hwTogglePerson('${p.id}', this.checked)"></td>
          <td>${esc(p.name)}</td>
          <td class="c">${esc(p.code||'')}</td>
          <td>${esc(unitName(p.unitId))}</td>
        </tr>`;
      }).join('') + '</tbody>'
    : '<tbody><tr><td>نفری یافت نشد — ابتدا واحد را انتخاب کنید.</td></tr></tbody>';

  const sel = hwSelected().length;
  const st = document.getElementById('hwStats');
  if (st) st.innerHTML = `
    <div class="stat"><b>${sel}</b><span>تعطیل کار (پرس غذا)</span></div>
    <div class="stat"><b>${list.length}</b><span>نفرات قابل انتخاب</span></div>
    <div class="stat"><b>${hwUnits().length}</b><span>واحد انتخابی</span></div>`;
}

/* ---------- ساخت سند چاپی ---------- */
function buildHWDoc() {
  const st = S.setup;
  const h = HW();
  const meal = S.meals.find(m=>m.id===h.mealId);
  const food = S.foods.find(f=>f.id===h.foodId);
  const rows = hwSelected();
  const rowH = +st.rowH || 0;
  const cellPad = (st.cellPad==null?1:+st.cellPad);
  const multi = hwUnits().length > 1 || !h.unitIds.length;
  const _h = { rowNo:'ر', name:'نام و نام خانوادگی', code:'کد پرسنلی', unit:'واحد', sign:'امضا', ...(st.heads||{}) };
  const _w = { rowNo:8, code:16, unit:20, sign:15, ...(st.colW||{}) };
  const unitName = id => (S.units.find(u=>u.id===id)||{}).name || '';

  let html = `<div class="doc ${st.noFill?'no-fill':''}" dir="rtl" style="font-family:${st.font};font-size:${st.fontSize}pt;line-height:${st.lineH};${st.bold?'font-weight:700;':''}--row-h:${rowH?rowH+'mm':'auto'};--cell-pad:${cellPad}mm;">`;

  html += `<div class="doc-header"><div class="htitle" style="font-size:${st.fontSize*1.35}pt">${esc(h.title||'لیست غذای تعطیل کاری')}</div>`;
  if (st.headerSub) html += `<div class="hsub" style="font-size:${st.fontSize*0.95}pt">${esc(st.headerSub)}</div>`;
  html += `</div>`;

  const metas = [];
  if (h.date) metas.push(`تاریخ: ${esc(h.date)}`);
  if (meal) metas.push(`وعده: ${esc(meal.name)}`);
  metas.push(`تعداد: ${rows.length} نفر`);
  html += `<div class="meta-line">${metas.map(m=>`<span>${m}</span>`).join('')}</div>`;
  if (food) html += `<div class="food-line">** ${esc(food.name)} **</div>`;

  html += `<table class="ptab"><thead><tr>`;
  if (st.showRowNo) html += `<th style="width:${_w.rowNo}%">${esc(_h.rowNo)}</th>`;
  html += `<th>${esc(_h.name)}</th>`;
  if (st.showCode) html += `<th style="width:${_w.code}%">${esc(_h.code)}</th>`;
  if (multi) html += `<th style="width:${_w.unit}%">${esc(_h.unit)}</th>`;
  if (st.showSign) html += `<th style="width:${_w.sign}%">${esc(_h.sign)}</th>`;
  html += `</tr></thead><tbody>`;
  if (rows.length) {
    rows.forEach((p,i)=>{
      html += `<tr>`;
      if (st.showRowNo) html += `<td class="c">${i+1}</td>`;
      html += `<td><span class="nm">${esc(p.name)}</span></td>`;
      if (st.showCode) html += `<td class="c">${esc(p.code||'')}</td>`;
      if (multi) html += `<td class="c">${esc(unitName(p.unitId))}</td>`;
      if (st.showSign) html += `<td></td>`;
      html += `</tr>`;
    });
  } else {
    html += `<tr><td colspan="6" class="c">نفری انتخاب نشده است.</td></tr>`;
  }
  html += `</tbody></table>`;

  if (h.note) html += `<div class="note-line">${esc(h.note)}</div>`;
  html += `<div class="sum-line"><span>جمع تعطیل کار: ${rows.length} نفر</span><span>${rows.length} پرس</span></div>`;

  if (st.footerOn) {
    html += `<div class="doc-footer" style="font-size:${st.fontSize*0.9}pt">`;
    if (st.footerText) html += `<div>${esc(st.footerText)}</div>`;
    if (st.footerTime) html += `<div>ساعت چاپ: ${new Date().toLocaleTimeString('fa-IR',{hour:'2-digit',minute:'2-digit'})}</div>`;
    if (st.footerSign) html += `<div class="sig-row"><span>مسئول واحد: <span class="dots">..............</span></span><span>آشپزخانه: <span class="dots">..............</span></span></div>`;
    html += `</div>`;
  }
  html += `</div>`;
  return html;
}

function renderHWPreview() {
  const el = document.getElementById('hwPreview');
  if (!el || typeof paperDims !== 'function') return;
  const d = paperDims();
  const st = S.setup;
  const info = document.getElementById('hwPaperInfo');
  if (info) info.textContent = `📄 ${d.label} — ${d.w}×${d.h||'∞'} mm`;

  const scale = Math.min(1, 700 / (d.w * 3.7795));
  const wpx = d.w * 3.7795;
  const hpx = d.h ? d.h * 3.7795 : 0;
  el.style.width = (wpx*scale) + 'px';
  el.style.minHeight = hpx ? (hpx*scale)+'px' : 'auto';
  el.style.height = hpx ? (hpx*scale)+'px' : 'auto';
  el.innerHTML = `<div style="transform:scale(${scale});transform-origin:top right;width:${wpx}px;${hpx?`min-height:${hpx}px;`:''}
    padding:${st.mt*3.7795}px ${st.mr*3.7795}px ${st.mb*3.7795}px ${st.ml*3.7795}px;">${buildHWDoc()}</div>`;
}

function printHW() {
  if (!hwSelected().length) { toast('حداقل یک نفر را انتخاب کنید'); return; }
  const d = paperDims();
  const st = S.setup;
  const sizeRule = d.h ? `size: ${d.w}mm ${d.h}mm;` : `size: ${d.w}mm auto;`;
  document.getElementById('printPageStyle').textContent = `
    @page { ${sizeRule} margin: ${st.mt}mm ${st.mr}mm ${st.mb}mm ${st.ml}mm; }
    @media print {
      html, body { width: ${d.w - st.mr - st.ml}mm; }
      #printArea .ptab { page-break-inside: auto; }
      #printArea tr { page-break-inside: avoid; }
    }`;
  document.getElementById('printArea').innerHTML = buildHWDoc();
  setTimeout(()=>window.print(), 60);
}

/* ---------- رندر کامل تب ---------- */
function renderHWork() {
  const h = HW();
  const g = id => document.getElementById(id);
  if (!g('hwDate')) return;
  g('hwDate').value = h.date || '';
  g('hwTitle').value = h.title || '';
  g('hwNote').value = h.note || '';

  g('hwMeal').innerHTML = '<option value="">— بدون انتخاب —</option>' +
    S.meals.map(m=>`<option value="${m.id}" ${m.id===h.mealId?'selected':''}>${esc(m.name)}</option>`).join('');
  g('hwMeal').value = h.mealId || '';

  g('hwFood').innerHTML = '<option value="">— بدون انتخاب —</option>' +
    S.foods.map(f=>`<option value="${f.id}" ${f.id===h.foodId?'selected':''}>${esc(f.name)}</option>`).join('');
  g('hwFood').value = h.foodId || '';

  renderHWUnits(); renderHWFoods(); renderHWPeople(); renderHWPreview();
}
