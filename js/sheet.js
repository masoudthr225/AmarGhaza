/* ================= تب‌ها ================= */
function showTab(btn) {
  document.querySelectorAll('nav.tabs button').forEach(b=>b.classList.toggle('active', b===btn));
  document.querySelectorAll('.tabpane').forEach(p=>p.classList.toggle('active', p.id===btn.dataset.tab));
  if (btn.dataset.tab==='tab-sheet' || btn.dataset.tab==='tab-pagesetup') renderPreview();
}
function showTabById(id) {
  const btn = document.querySelector(`nav.tabs button[data-tab="${id}"]`);
  if (btn) showTab(btn);
}

/* ================= آمار روز ================= */
function renderSheetControls() {
  document.getElementById('sheetDate').value = S.sheet.date || '';
  const mealSel = document.getElementById('sheetMeal');
  mealSel.innerHTML = S.meals.map(m=>`<option value="${m.id}" ${m.id===S.sheet.mealId?'selected':''}>${esc(m.name)}</option>`).join('');
  if (!S.meals.find(m=>m.id===S.sheet.mealId) && S.meals[0]) S.sheet.mealId = S.meals[0].id;
  mealSel.value = S.sheet.mealId;

  const foodSel = document.getElementById('sheetFood');
  foodSel.innerHTML = '<option value="">— بدون انتخاب —</option>' +
    S.foods.map(f=>`<option value="${f.id}" ${f.id===S.sheet.foodId?'selected':''}>${esc(f.name)}</option>`).join('');
  document.getElementById('sheetNote').value = S.sheet.note || '';
}

function saveSheet() {
  S.sheet.date = document.getElementById('sheetDate').value.trim();
  S.sheet.mealId = document.getElementById('sheetMeal').value;
  S.sheet.foodId = document.getElementById('sheetFood').value;
  S.sheet.note = document.getElementById('sheetNote').value.trim();
  save();
  renderPreview();
}

function renderUnitChecks() {
  const box = document.getElementById('unitChecks');
  box.innerHTML = S.units.map(u=>{
    const on = S.sheet.unitIds.includes(u.id);
    const cnt = S.people.filter(p=>p.unitId===u.id).length;
    return `<label class="${on?'on':''}"><input type="checkbox" ${on?'checked':''} onchange="toggleUnit('${u.id}')"> ${esc(u.name)} <span class="badge">${cnt} نفر</span></label>`;
  }).join('') || '<span class="att-note">هنوز واحدی تعریف نشده — از تب «پرسنل و واحدها» اضافه کنید.</span>';
}
function toggleUnit(id) {
  const i = S.sheet.unitIds.indexOf(id);
  if (i>=0) S.sheet.unitIds.splice(i,1); else S.sheet.unitIds.push(id);
  save(); renderUnitChecks(); renderAttendance(); renderPreview();
  if (typeof renderPickInfo==='function') renderPickInfo();
}
function selectAllUnits(on) {
  S.sheet.unitIds = on ? S.units.map(u=>u.id) : [];
  save(); renderUnitChecks(); renderAttendance(); renderPreview();
  if (typeof renderPickInfo==='function') renderPickInfo();
}

function selectedUnits() {
  return S.units.filter(u=>S.sheet.unitIds.includes(u.id));
}
/* مرتب‌سازی بر اساس حروف الفبای فارسی (با نرمال‌سازی ی/ي و ک/ك) */
function faSortNorm(s){ return String(s||'').replace(/[يى]/g,'ی').replace(/ك/g,'ک').replace(/\u200c/g,' ').replace(/\s+/g,' ').trim(); }
function faCompare(a,b){ return faSortNorm(a).localeCompare(faSortNorm(b),'fa'); }
function unitPeople(uId) {
  return S.people.filter(p=>p.unitId===uId).sort((a,b)=>faCompare(a.name,b.name));
}

/* ---- اقلام زیر جدول (خوراک، حاضری، تخم مرغ و ...) ---- */
function unitExtras(uId) {
  if (!S.sheet.extras) S.sheet.extras = {};
  if (!S.sheet.extras[uId]) S.sheet.extras[uId] = [
    {id:uid(), label:'خوراک',   qty:''},
    {id:uid(), label:'حاضری',   qty:''},
    {id:uid(), label:'50%',     qty:''},
    {id:uid(), label:'تخم مرغ', qty:''},
  ];
  return S.sheet.extras[uId];
}
function addExtra(uId) {
  unitExtras(uId).push({id:uid(), label:'', qty:''});
  save(); renderAttendance(); renderPreview();
}
function delExtra(uId, exId) {
  S.sheet.extras[uId] = unitExtras(uId).filter(x=>x.id!==exId);
  save(); renderAttendance(); renderPreview();
}
function updExtra(uId, exId, field, val) {
  const x = unitExtras(uId).find(x=>x.id===exId);
  if (x) { x[field] = val.trim(); save(); renderPreview(); }
}

function renderAttendance() {
  const box = document.getElementById('attendance');
  const units = selectedUnits();
  if (!units.length) { box.innerHTML = '<div class="att-note">واحدی انتخاب نشده است.</div>'; renderStats(); return; }
  box.innerHTML = units.map(u=>{
    const ppl = unitPeople(u.id);
    const abs = ppl.filter(p=>S.sheet.absent[p.id]).length;
    const exs = unitExtras(u.id);
    return `<div class="att-unit">
      <h3><span>${esc(u.name)}</span><small>حاضر: ${ppl.length-abs} — غایب: ${abs}${
        pickModeOn() ? ` — 🖨️ چاپ: ${ppl.filter(p=>picked()[p.id]).length}` : ''}</small>
        ${pickModeOn() ? `<span class="pick-tools">
          <button class="btn sm ghost" onclick="pickUnit('${u.id}',true)">✅ همه این واحد</button>
          <button class="btn sm ghost" onclick="pickUnit('${u.id}',false)">⬜ هیچکدام</button></span>` : ''}
      </h3>
      <div class="att-grid">${
        ppl.map((p,i)=>{
          const pm = pickModeOn(), on = !!picked()[p.id];
          return `<div class="person ${S.sheet.absent[p.id]?'absent':''} ${pm?(on?'picked':'notprint'):''}" onclick="toggleAbsent('${p.id}')">
          ${pm?`<input type="checkbox" class="pchk" ${on?'checked':''} title="در لیست چاپ باشد"
                 onclick="event.stopPropagation()" onchange="togglePick('${p.id}', this.checked)">`:''}
          <span class="num">${i+1}</span><span class="pname">${esc(p.name)}</span><span class="code">${esc(p.code||'')}</span>
        </div>`;}).join('') || '<span class="att-note">این واحد پرسنلی ندارد.</span>'
      }</div>
      <div class="extras-box">
        <div class="extras-head">
          <span>🍳 اقلام زیر جدول <small>(خوراک، حاضری، تخم مرغ و … — در چاپ زیر جدول همین واحد می‌آید)</small></span>
          <button class="btn sm ghost" onclick="addExtra('${u.id}')">➕ افزودن ردیف</button>
        </div>
        ${exs.map(x=>`<div class="extra-row">
          <input type="text" value="${esc(x.label)}" placeholder="نام قلم (مثال: تخم مرغ)" onchange="updExtra('${u.id}','${x.id}','label',this.value)">
          <input type="text" value="${esc(x.qty)}" placeholder="مقدار (مثال: 50% یا 3)" onchange="updExtra('${u.id}','${x.id}','qty',this.value)">
          <button class="icon-btn" title="حذف این قلم" onclick="delExtra('${u.id}','${x.id}')">🗑️</button>
        </div>`).join('') || '<div class="att-note">قلمی ثبت نشده — با «افزودن ردیف» اضافه کنید.</div>'}
      </div>
    </div>`;
  }).join('');
  renderStats();
}
function toggleAbsent(pid) {
  if (S.sheet.absent[pid]) delete S.sheet.absent[pid]; else S.sheet.absent[pid] = true;
  save(); renderAttendance(); renderPreview();
}
function clearAbsents() {
  S.sheet.absent = {}; save(); renderAttendance(); renderPreview();
}
function renderStats() {
  const units = selectedUnits();
  let tot=0, abs=0;
  units.forEach(u=>unitPeople(u.id).forEach(p=>{ tot++; if (S.sheet.absent[p.id]) abs++; }));
  document.getElementById('sheetStats').innerHTML = `
    <div class="stat"><b>${tot}</b><span>کل نفرات</span></div>
    <div class="stat"><b>${tot-abs}</b><span>حاضر (پرس غذا)</span></div>
    <div class="stat red"><b>${abs}</b><span>غایب</span></div>
    <div class="stat"><b>${units.length}</b><span>واحد انتخابی</span></div>`;
}

/* ================= انتخاب نفرات دلخواه برای چاپ ================= */
function picked() {
  if (!S.sheet.picked || typeof S.sheet.picked !== 'object') S.sheet.picked = {};
  return S.sheet.picked;
}
/* آیا حالت «فقط نفرات انتخاب‌شده» فعال است؟ */
function pickModeOn() { return !!S.sheet.pickMode; }

/* نفرات قابل چاپ یک واحد — با اعمال فیلتر انتخاب دستی */
function printablePeople(uId) {
  const ppl = unitPeople(uId);
  if (!pickModeOn()) return ppl;
  return ppl.filter(p => picked()[p.id]);
}

function togglePickMode(on) {
  S.sheet.pickMode = !!on;
  if (on && !Object.keys(picked()).length) {
    toast('هنوز کسی انتخاب نشده — از دکمه «انتخاب نفرات دلخواه» استفاده کنید');
  }
  save(); renderPickInfo(); renderAttendance(); renderPreview();
}
function clearPicked() {
  S.sheet.picked = {}; S.sheet.pickMode = false;
  const chk = document.getElementById('pickModeChk'); if (chk) chk.checked = false;
  save(); renderPickInfo(); renderPickList(); renderAttendance(); renderPreview();
  toast('انتخاب نفرات پاک شد');
}
function renderPickInfo() {
  const chk = document.getElementById('pickModeChk');
  if (chk) chk.checked = pickModeOn();
  const el = document.getElementById('pickInfo');
  if (!el) return;
  const n = selectedUnits().reduce((a,u)=>a + unitPeople(u.id).filter(p=>picked()[p.id]).length, 0);
  el.textContent = pickModeOn()
    ? `🖨️ فقط ${n} نفر انتخاب‌شده چاپ می‌شود`
    : `${n} نفر انتخاب شده (غیرفعال — همه چاپ می‌شوند)`;
  el.className = 'chip' + (pickModeOn() ? ' red' : '');
}

/* ---- مودال ---- */
function openPickModal() {
  if (!selectedUnits().length) { toast('ابتدا حداقل یک واحد را انتخاب کنید'); return; }
  document.getElementById('pickModal').classList.add('open');
  renderPickList();
}
function closePickModal() {
  document.getElementById('pickModal').classList.remove('open');
}
function pickPool() {
  const uf = (document.getElementById('pickUnitFilter')||{}).value || '';
  const q  = ((document.getElementById('pickSearch')||{}).value || '').trim().toLowerCase();
  let list = [];
  selectedUnits().forEach(u=>{ if (!uf || u.id===uf) list = list.concat(unitPeople(u.id)); });
  return list.filter(p => !q || String(p.name).toLowerCase().includes(q) || String(p.code||'').includes(q));
}
function togglePick(pid, on) {
  if (on) picked()[pid] = true; else delete picked()[pid];
  save(); renderPickList(); renderPickInfo(); renderAttendance(); renderPreview();
}
/* انتخاب/لغو همه نفرات یک واحد */
function pickUnit(uId, on) {
  unitPeople(uId).forEach(p=>{ if (on) picked()[p.id] = true; else delete picked()[p.id]; });
  save(); renderPickList(); renderPickInfo(); renderAttendance(); renderPreview();
}
function pickAll(on) {
  pickPool().forEach(p=>{ if (on) picked()[p.id] = true; else delete picked()[p.id]; });
  save(); renderPickList(); renderPickInfo(); renderAttendance(); renderPreview();
}
function applyPick() {
  const n = Object.keys(picked()).length;
  if (!n) { toast('حداقل یک نفر را انتخاب کنید'); return; }
  S.sheet.pickMode = true;
  save(); closePickModal(); renderPickInfo(); renderAttendance(); renderPreview();
  toast(`فقط ${n} نفر انتخاب‌شده در چاپ می‌آیند ✅`);
}
function renderPickList() {
  const tb = document.getElementById('pickTable');
  if (!tb) return;
  const uf = document.getElementById('pickUnitFilter');
  const cur = uf.value;
  uf.innerHTML = '<option value="">همه واحدهای انتخابی</option>' +
    selectedUnits().map(u=>`<option value="${u.id}">${esc(u.name)}</option>`).join('');
  uf.value = selectedUnits().some(u=>u.id===cur) ? cur : '';

  const list = pickPool();
  const unitName = id => (S.units.find(u=>u.id===id)||{}).name || '—';
  tb.innerHTML = list.length
    ? `<thead><tr><th style="width:36px">#</th><th style="width:56px">چاپ</th>
        <th>نام و نام خانوادگی</th><th style="width:100px">کد پرسنلی</th><th style="width:150px">واحد</th></tr></thead><tbody>` +
      list.map((p,i)=>{
        const on = !!picked()[p.id];
        return `<tr class="${on?'pick-on':''}">
          <td class="c">${i+1}</td>
          <td class="c"><input type="checkbox" ${on?'checked':''} onchange="togglePick('${p.id}', this.checked)"></td>
          <td>${esc(p.name)}</td>
          <td class="c">${esc(p.code||'')}</td>
          <td>${esc(unitName(p.unitId))}</td>
        </tr>`;
      }).join('') + '</tbody>'
    : '<tbody><tr><td>نفری یافت نشد.</td></tr></tbody>';

  const cnt = document.getElementById('pickModalCount');
  if (cnt) cnt.textContent = `${list.filter(p=>picked()[p.id]).length} از ${list.length} نفر انتخاب شده`;
}
