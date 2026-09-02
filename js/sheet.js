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
  save(); renderPreview();
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
}
function selectAllUnits(on) {
  S.sheet.unitIds = on ? S.units.map(u=>u.id) : [];
  save(); renderUnitChecks(); renderAttendance(); renderPreview();
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
    {id:uid(), label:'تخم مرغ', qty:'50%'},
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
      <h3><span>${esc(u.name)}</span><small>حاضر: ${ppl.length-abs} — غایب: ${abs}</small></h3>
      <div class="att-grid">${
        ppl.map((p,i)=>`<div class="person ${S.sheet.absent[p.id]?'absent':''}" onclick="toggleAbsent('${p.id}')">
          <span class="num">${i+1}</span><span class="pname">${esc(p.name)}</span><span class="code">${esc(p.code||'')}</span>
        </div>`).join('') || '<span class="att-note">این واحد پرسنلی ندارد.</span>'
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
