/* ================= پرسنل و واحدها ================= */
function renderUnits() {
  const box = document.getElementById('unitList');
  box.innerHTML = S.units.map(u=>{
    const cnt = S.people.filter(p=>p.unitId===u.id).length;
    return `<div class="mini-item">
      <span class="grow"><b>${esc(u.name)}</b> <span class="badge">${cnt} نفر</span></span>
      <button class="icon-btn" title="آپلود اکسل پرسنل به این واحد" onclick="importToUnit('${u.id}')">📤</button>
      <button class="icon-btn" title="ویرایش" onclick="editUnit('${u.id}')">✏️</button>
      <button class="icon-btn" title="حذف" onclick="delUnit('${u.id}')">🗑️</button>
    </div>`;
  }).join('') || '<div class="att-note">واحدی ثبت نشده.</div>';
  // فیلتر و مودال
  const fu = document.getElementById('filterUnit');
  const cur = fu.value;
  fu.innerHTML = '<option value="">همه واحدها</option>' + S.units.map(u=>`<option value="${u.id}">${esc(u.name)}</option>`).join('');
  fu.value = cur;
  document.getElementById('pmUnit').innerHTML = S.units.map(u=>`<option value="${u.id}">${esc(u.name)}</option>`).join('');
}
function addUnit() {
  const inp = document.getElementById('newUnitName');
  const name = inp.value.trim();
  if (!name) return toast('نام واحد را وارد کنید');
  S.units.push({id:uid(), name});
  inp.value=''; save(); renderAll(); toast('واحد اضافه شد ✅');
}
function editUnit(id) {
  const u = S.units.find(x=>x.id===id);
  const name = prompt('نام جدید واحد:', u.name);
  if (name && name.trim()) { u.name = name.trim(); save(); renderAll(); }
}
function delUnit(id) {
  const cnt = S.people.filter(p=>p.unitId===id).length;
  if (!confirm(`این واحد ${cnt?`و ${cnt} پرسنل آن `:''}حذف شود؟`)) return;
  S.units = S.units.filter(u=>u.id!==id);
  S.people = S.people.filter(p=>p.unitId!==id);
  S.sheet.unitIds = S.sheet.unitIds.filter(x=>x!==id);
  save(); renderAll(); toast('واحد حذف شد');
}

function renderPeople() {
  const q = document.getElementById('searchPerson').value.trim();
  const fu = document.getElementById('filterUnit').value;
  const tb = document.querySelector('#peopleTable tbody');
  let list = sortPeople(S.people);
  if (fu) list = list.filter(p=>p.unitId===fu);
  if (q) list = list.filter(p=>p.name.includes(q) || (p.code||'').includes(q) || familyLabel(p).includes(q));
  tb.innerHTML = list.map((p,i)=>{
    const u = S.units.find(x=>x.id===p.unitId);
    const fam = String(p.family||'').trim();
    const shownFam = fam || familyLabel(p.name);
    return `<tr><td>${i+1}</td>
      <td class="edit-cell" contenteditable="true" title="برای ویرایش کلیک کنید"
          onkeydown="if(event.key==='Enter'){event.preventDefault();nextEditCell(this);}"
          onblur="updPersonInline('${p.id}','name',this)">${esc(p.name)}</td>
      <td class="edit-cell family-cell ${fam?'':'auto'}" contenteditable="true"
          title="${fam?'نام خانوادگی ثبتشده':'بهطور خودکار از نام کامل استخراج شده — برای تغییر کلیک کنید'}"
          onkeydown="if(event.key==='Enter'){event.preventDefault();nextEditCell(this);}"
          onblur="updPersonInline('${p.id}','family',this)">${esc(shownFam)}</td>
      <td class="edit-cell" contenteditable="true" title="برای ویرایش کلیک کنید"
          onkeydown="if(event.key==='Enter'){event.preventDefault();nextEditCell(this);}"
          onblur="updPersonInline('${p.id}','code',this)">${esc(p.code||'')}</td>
      <td>${esc(u?u.name:'—')}</td>
      <td><button class="icon-btn" title="حذف نام کوچک (تبدیل به نام خانوادگی)" onclick="dropFirstName('${p.id}')">✂️</button>
      <button class="icon-btn" onclick="openPersonModal('${p.id}')">✏️</button>
      <button class="icon-btn" onclick="delPerson('${p.id}')">🗑️</button></td></tr>`;
  }).join('') || '<tr><td colspan="6" style="text-align:center;color:var(--muted)">موردی یافت نشد</td></tr>';
}

/* ---------- مرتبسازی سرستونها (روی نمایش، حضور/غیاب و چاپ) ---------- */
const SORT_NAMES = { name:'نام کامل', family:'نام خانوادگی', code:'کد پرسنلی', unit:'واحد' };
function setSort(key) {
  const st = S.setup;
  if (st.sortKey === key) st.sortDir = (st.sortDir === -1 ? 1 : -1);
  else { st.sortKey = key; st.sortDir = 1; }
  save();
  renderPeople();
  renderSortArrows();
  if (typeof renderAttendance === 'function') renderAttendance();
  if (typeof renderPreview === 'function') renderPreview();
  toast(`مرتبسازی بر اساس ${SORT_NAMES[key] || key} — ${st.sortDir === 1 ? 'صعودی' : 'نزولی'}`);
}
function toggleSortDir() { setSort(S.setup.sortKey || 'code'); }
/* یک کلیک: حتماً روی نام خانوادگی و صعودی قرار بگیرد */
function sortByFamily() {
  const st = S.setup;
  if (st.sortKey === 'family' && st.sortDir === 1) {
    toast('در حال حاضر بر اساس نام خانوادگی صعودی مرتب است ✅');
    return;
  }
  st.sortKey = 'family'; st.sortDir = 1;
  save(); renderPeople(); renderSortArrows();
  if (typeof renderAttendance === 'function') renderAttendance();
  if (typeof renderPreview === 'function') renderPreview();
  toast('🔤 مرتبسازی بر اساس نام خانوادگی — صعودی');
}

/* نشان دادن جهت مرتبسازی روی دکمهها و هماهنگ کردن نوار ابزار */
function renderSortArrows() {
  const st = S.setup;
  document.querySelectorAll('#peopleTable .sort-btn').forEach(b => {
    const on = b.dataset.key === st.sortKey;
    b.classList.toggle('on', on);
    b.textContent = on ? (st.sortDir === 1 ? '▲' : '▼') : '⇅';
    b.title = on
      ? `مرتبسازی ${st.sortDir === 1 ? 'صعودی' : 'نزولی'} — برای برعکس کردن کلیک کنید`
      : 'مرتبسازی بر اساس این ستون';
  });
  const sel = document.getElementById('sortKey');
  if (sel) sel.value = st.sortKey || 'code';
  const dirBtn = document.getElementById('sortDir');
  if (dirBtn) {
    const asc = st.sortDir !== -1;
    dirBtn.textContent = asc ? '⬆ صعودی' : '⬇ نزولی';
    dirBtn.title = asc ? 'برای نزولی کردن کلیک کنید' : 'برای صعودی کردن کلیک کنید';
  }
  const hint = document.getElementById('sortHint');
  if (hint) hint.textContent = `اکنون: ${SORT_NAMES[st.sortKey] || st.sortKey} — ${st.sortDir === -1 ? 'نزولی' : 'صعودی'}`;
}

/* ---------- قالب نام خانوادگی ---------- */
function autoFillFamilies(silent) {
  const fu = document.getElementById('filterUnit').value;
  let list = fu ? S.people.filter(p=>p.unitId===fu) : S.people;
  const targets = list.filter(p => !String(p.family||'').trim());
  if (!targets.length) { if (!silent) toast('همه نامهای خانوادگی از قبل پر هستند ✅'); return 0; }
  if (!silent) {
    const scope = fu ? 'این واحد' : 'همه واحدها';
    if (!confirm(`نام خانوادگی ${targets.length} نفر (${scope}) از روی نام کامل استخراج و ذخیره شود؟\nموارد خاص را بعداً در ستون «نام خانوادگی» ویرایش کنید.`)) return 0;
  }
  targets.forEach(p => { p.family = familyLabel(p.name); });
  save();
  if (!silent) {
    renderPeople(); renderAttendance(); renderPreview();
    toast(`🧩 ${targets.length} نام خانوادگی استخراج شد`);
  }
  return targets.length;
}
function applyFamilyTemplate() {
  const st = S.setup;
  st.sortKey = 'family'; st.sortDir = 1;
  save();
  if (typeof renderAll === 'function') renderAll();
  toast('✅ مرتب‌سازی صعودی بر اساس نام خانوادگی فعال شد');
}
function autoFamilyFromName() {
  const name = document.getElementById('pmName').value.trim();
  const el = document.getElementById('pmFamily');
  if (!el) return;
  el.value = familyLabel(name);
  if (!el.value) toast('ابتدا نام کامل را وارد کنید');
  else el.focus();
}

function updHead(key, el) {
  if (!S.setup.heads) S.setup.heads = {};
  const def = { rowNo:'ر', name:'نام و نام خانوادگی', code:'کد پرسنلی', unit:'واحد', sign:'امضا' };
  const val = el.textContent.replace(/\s+/g,' ').trim();
  if (!val) { el.textContent = S.setup.heads[key] || def[key]; return toast('عنوان سرستون نمی‌تواند خالی باشد'); }
  if ((S.setup.heads[key]||def[key]) === val) { el.textContent = val; return; }
  S.setup.heads[key] = val;
  save(); renderHeads(); renderPreview();
  toast('✅ سرستون ذخیره شد: ' + val);
}
function renderHeads() {
  const def = { name:'نام و نام خانوادگی', code:'کد پرسنلی', unit:'واحد' };
  const h = { ...def, ...(S.setup.heads||{}) };
  const elN = document.getElementById('thName'); if (elN) elN.textContent = h.name;
  const elC = document.getElementById('thCode'); if (elC) elC.textContent = h.code;
  const elU = document.getElementById('thUnit'); if (elU) elU.textContent = h.unit;
}

/* ویرایش داخل جدول (سلول نام / نام خانوادگی / کد) */
function updPersonInline(id, field, el) {
  const p = S.people.find(x=>x.id===id);
  if (!p) return;
  const val = el.textContent.replace(/\s+/g,' ').trim();
  if (field==='name' && !val) { el.textContent = p.name; return toast('نام نمی‌تواند خالی باشد'); }

  if (field === 'family') {
    const auto = familyLabel(p.name);
    if (val === (p.family || auto)) return;
    if (val) p.family = val;
    else delete p.family; // پاک کردن → برگشت به حدس خودکار
    save(); renderPeople(); renderAttendance(); renderPreview();
    toast('✅ نام خانوادگی ذخیره شد: ' + (p.family || auto));
    return;
  }

  if (p[field] === val) { el.textContent = val; return; }
  p[field] = val;
  /* با عوض شدن نام کامل، فقط وقتی نام خانوادگی صریح ثبت نشده باشد
     همان حدس خودکار هم بهروز میشود (بقیه منطق در familyLabel است). */
  save(); renderPeople(); renderAttendance(); renderPreview();
  toast('✅ ذخیره شد: ' + (field==='name' ? val : p.name));
}

/* تبدیل گروهی: حذف نام کوچک همه نفرات لیست فیلترشده */
function dropFirstNameAll() {
  const fu = document.getElementById('filterUnit').value;
  let list = S.people;
  if (fu) list = list.filter(p=>p.unitId===fu);
  const targets = list.filter(p=>p.name.replace(/\s+/g,' ').trim().split(' ').length >= 2);
  if (!targets.length) return toast('نامی برای تبدیل نیست');
  const scope = fu ? 'این واحد' : 'همه واحدها';
  if (!confirm(`نام کوچک ${targets.length} نفر (${scope}) حذف شود و فقط نام خانوادگی بماند؟\nمثال: «محسن قمشه ای» → «قمشه ای»\n\n⚠️ پیشنهاد: قبل از این کار یک پشتیبان بگیرید.`)) return;
  targets.forEach(p=>{ p.name = p.name.replace(/\s+/g,' ').trim().split(' ').slice(1).join(' '); });
  save(); renderPeople(); renderAttendance(); renderPreview();
  toast(`✂️ ${targets.length} نام تبدیل شد`);
}

/* حذف اولین کلمه نام — «محسن قمشه ای» → «قمشه ای» (برای نام دوکلمه‌ای دوباره بزنید) */
function dropFirstName(id) {
  const p = S.people.find(x=>x.id===id);
  if (!p) return;
  const words = p.name.replace(/\s+/g,' ').trim().split(' ');
  if (words.length < 2) return toast('نام فقط یک کلمه است');
  p.name = words.slice(1).join(' ');
  save(); renderPeople(); renderAttendance(); renderPreview();
  toast('✂️ شد: ' + p.name);
}
function openPersonModal(id) {
  if (!S.units.length) return toast('ابتدا یک واحد بسازید');
  renderUnits();
  document.getElementById('pmId').value = id || '';
  document.getElementById('personModalTitle').textContent = id ? 'ویرایش پرسنل' : 'افزودن پرسنل';
  if (id) {
    const p = S.people.find(x=>x.id===id);
    document.getElementById('pmName').value = p.name;
    document.getElementById('pmFamily').value = p.family || '';
    document.getElementById('pmFamily').placeholder = familyLabel(p.name);
    document.getElementById('pmCode').value = p.code || '';
    document.getElementById('pmUnit').value = p.unitId;
  } else {
    document.getElementById('pmName').value = '';
    document.getElementById('pmFamily').value = '';
    document.getElementById('pmFamily').placeholder = 'مثال: قمشه ای';
    document.getElementById('pmCode').value = '';
    const fu = document.getElementById('filterUnit').value;
    if (fu) document.getElementById('pmUnit').value = fu;
  }
  document.getElementById('personModal').classList.add('open');
  setTimeout(()=>document.getElementById('pmName').focus(), 50);
}
function closePersonModal() { document.getElementById('personModal').classList.remove('open'); }
function savePerson() {
  const id = document.getElementById('pmId').value;
  const name = document.getElementById('pmName').value.trim();
  const familyEl = document.getElementById('pmFamily');
  const family = familyEl ? familyEl.value.replace(/\s+/g,' ').trim() : '';
  const code = document.getElementById('pmCode').value.trim();
  const unitId = document.getElementById('pmUnit').value;
  if (!name) return toast('نام را وارد کنید');
  const fam = family;
  if (id) {
    const p = S.people.find(x=>x.id===id);
    Object.assign(p, {name, code, unitId});
    if (fam) p.family = fam; else delete p.family;
  } else {
    const p = {id:uid(), name, code, unitId};
    if (fam) p.family = fam;
    S.people.push(p);
  }
  save(); closePersonModal(); renderAll(); toast('ذخیره شد ✅');
}
function delPerson(id) {
  const p = S.people.find(x=>x.id===id);
  if (!confirm(`«${p.name}» حذف شود؟`)) return;
  S.people = S.people.filter(x=>x.id!==id);
  delete S.sheet.absent[id];
  save(); renderAll(); toast('حذف شد');
}

/* ================= وعده‌ها و منو ================= */
function renderMeals() {
  document.getElementById('mealList').innerHTML = S.meals.map(m=>`
    <div class="mini-item"><span class="grow"><b>${esc(m.name)}</b></span>
      <button class="icon-btn" onclick="editMeal('${m.id}')">✏️</button>
      <button class="icon-btn" onclick="delMeal('${m.id}')">🗑️</button></div>`).join('')
    || '<div class="att-note">وعده‌ای ثبت نشده.</div>';
}
function addMeal() {
  const inp = document.getElementById('newMealName');
  if (!inp.value.trim()) return toast('نام وعده را وارد کنید');
  S.meals.push({id:uid(), name: inp.value.trim()});
  inp.value=''; save(); renderAll(); toast('وعده اضافه شد ✅');
}
function editMeal(id) {
  const m = S.meals.find(x=>x.id===id);
  const name = prompt('نام جدید وعده:', m.name);
  if (name && name.trim()) { m.name = name.trim(); save(); renderAll(); }
}
function delMeal(id) {
  if (!confirm('این وعده حذف شود؟')) return;
  S.meals = S.meals.filter(m=>m.id!==id);
  if (S.sheet.mealId===id) S.sheet.mealId = S.meals[0] ? S.meals[0].id : '';
  save(); renderAll();
}

function renderFoods() {
  document.getElementById('foodList').innerHTML = S.foods.map(f=>`
    <div class="mini-item"><span class="grow">${esc(f.name)}</span>
      <button class="icon-btn" onclick="editFood('${f.id}')">✏️</button>
      <button class="icon-btn" onclick="delFood('${f.id}')">🗑️</button></div>`).join('')
    || '<div class="att-note">غذایی ثبت نشده.</div>';
}
function addFood() {
  const inp = document.getElementById('newFoodName');
  if (!inp.value.trim()) return toast('نام غذا را وارد کنید');
  S.foods.push({id:uid(), name: inp.value.trim()});
  inp.value=''; save(); renderAll(); toast('غذا اضافه شد ✅');
}
function editFood(id) {
  const f = S.foods.find(x=>x.id===id);
  const name = prompt('نام جدید غذا:', f.name);
  if (name && name.trim()) { f.name = name.trim(); save(); renderAll(); }
}
function delFood(id) {
  if (!confirm('این غذا از منو حذف شود؟')) return;
  S.foods = S.foods.filter(f=>f.id!==id);
  if (S.sheet.foodId===id) S.sheet.foodId='';
  save(); renderAll();
}


/* Enter در سلول‌های ویرایش‌شونده: ذخیره و رفتن به سلول بعدی */
function nextEditCell(cell) {
  const cells = Array.from(document.querySelectorAll('.edit-cell[contenteditable="true"]'))
    .filter(c => c.offsetParent !== null);
  const i = cells.indexOf(cell);
  cell.blur();                       // ذخیره از طریق onblur
  if (i > -1 && i + 1 < cells.length) {
    const nxt = cells[i + 1];
    nxt.focus();
    const r = document.createRange(); r.selectNodeContents(nxt);
    const sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(r);
  }
}
