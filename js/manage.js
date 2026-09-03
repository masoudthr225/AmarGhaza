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
  let list = S.people.slice().sort((a,b)=>faCompare(a.name,b.name));
  if (fu) list = list.filter(p=>p.unitId===fu);
  if (q) list = list.filter(p=>p.name.includes(q) || (p.code||'').includes(q));
  tb.innerHTML = list.map((p,i)=>{
    const u = S.units.find(x=>x.id===p.unitId);
    return `<tr><td>${i+1}</td>
      <td class="edit-cell" contenteditable="true" title="برای ویرایش کلیک کنید"
          onkeydown="if(event.key==='Enter'){event.preventDefault();nextEditCell(this);}"
          onblur="updPersonInline('${p.id}','name',this)">${esc(p.name)}</td>
      <td class="edit-cell" contenteditable="true" title="برای ویرایش کلیک کنید"
          onkeydown="if(event.key==='Enter'){event.preventDefault();nextEditCell(this);}"
          onblur="updPersonInline('${p.id}','code',this)">${esc(p.code||'')}</td>
      <td>${esc(u?u.name:'—')}</td>
      <td><button class="icon-btn" title="حذف نام کوچک (تبدیل به نام خانوادگی)" onclick="dropFirstName('${p.id}')">✂️</button>
      <button class="icon-btn" onclick="openPersonModal('${p.id}')">✏️</button>
      <button class="icon-btn" onclick="delPerson('${p.id}')">🗑️</button></td></tr>`;
  }).join('') || '<tr><td colspan="5" style="text-align:center;color:var(--muted)">موردی یافت نشد</td></tr>';
}

/* ویرایش سرستون‌ها — در جدول برنامه و چاپ اعمال می‌شود */
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

/* ویرایش داخل جدول (سلول نام / کد) */
function updPersonInline(id, field, el) {
  const p = S.people.find(x=>x.id===id);
  if (!p) return;
  const val = el.textContent.replace(/\s+/g,' ').trim();
  if (field==='name' && !val) { el.textContent = p.name; return toast('نام نمی‌تواند خالی باشد'); }
  if (p[field] === val) { el.textContent = val; return; }
  p[field] = val;
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
    document.getElementById('pmCode').value = p.code || '';
    document.getElementById('pmUnit').value = p.unitId;
  } else {
    document.getElementById('pmName').value = '';
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
  const code = document.getElementById('pmCode').value.trim();
  const unitId = document.getElementById('pmUnit').value;
  if (!name) return toast('نام را وارد کنید');
  if (id) {
    const p = S.people.find(x=>x.id===id);
    Object.assign(p, {name, code, unitId});
  } else {
    S.people.push({id:uid(), name, code, unitId});
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
