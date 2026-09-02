/* ================= ساخت سند چاپی ================= */
function esc(s) { return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

/* عنوان‌های سرستون (قابل ویرایش توسط کاربر) */
function hd() {
  const def = { rowNo:'ر', name:'نام و نام خانوادگی', code:'کد پرسنلی', unit:'واحد', sign:'امضا' };
  return { ...def, ...(S.setup.heads||{}) };
}
/* عرض ستون‌ها به درصد (قابل ویرایش توسط کاربر) — ستون نام باقیمانده را می‌گیرد */
function cw() {
  const def = { rowNo:8, code:16, unit:20, sign:15 };
  const w = { ...def, ...(S.setup.colW||{}) };
  ['rowNo','code','unit','sign'].forEach(k=>{ w[k] = Math.max(3, Math.min(60, +w[k]||def[k])); });
  return w;
}

function autoCols() {
  const st = S.setup;
  if (st.cols > 0) return st.cols;
  const w = paperDims().w;
  if (w <= 100) return 1;
  if (w <= 160) return 1;
  if (w <= 230) return 2;
  return 3;
}

function buildDoc() {
  const st = S.setup;
  const units = selectedUnits();
  const meal = S.meals.find(m=>m.id===S.sheet.mealId);
  const food = S.foods.find(f=>f.id===S.sheet.foodId);
  const cols = autoCols();
  const rowH = +st.rowH || 0;
  const cellPad = (st.cellPad==null?1:+st.cellPad);
  let html = `<div class="doc ${st.noFill?'no-fill':''}" style="font-family:${st.font};font-size:${st.fontSize}pt;line-height:${st.lineH};${st.bold?'font-weight:700;':''}--row-h:${rowH?rowH+'mm':'auto'};--cell-pad:${cellPad}mm;" dir="rtl">`;

  if (st.headerOn) {
    html += `<div class="doc-header">`;
    if (st.headerTitle) html += `<div class="htitle" style="font-size:${st.fontSize*1.35}pt">${esc(st.headerTitle)}</div>`;
    if (st.headerSub) html += `<div class="hsub" style="font-size:${st.fontSize*0.95}pt">${esc(st.headerSub)}</div>`;
    html += `</div>`;
    const metas = [];
    if (st.headerDate && S.sheet.date) metas.push(`تاریخ: ${esc(S.sheet.date)}`);
    if (st.headerMeal && meal) metas.push(`وعده: ${esc(meal.name)}`);
    if (metas.length) html += `<div class="meta-line">${metas.map(m=>`<span>${m}</span>`).join('')}</div>`;
    if (st.headerMeal && food) html += `<div class="food-line">** ${esc(food.name)} **</div>`;
  }

  let grandTot=0, grandAbs=0;

  if (st.layout === 'flat') {
    /* ---- قالب اکسل: جدول یکپارچه با ستون «واحد» ---- */
    // ردیف‌ها: همه نفرات واحدهای انتخابی، به ترتیب واحد و بر اساس نام
    let rows = [];
    units.forEach(u=>{
      let ppl = (typeof printablePeople==='function' ? printablePeople(u.id) : unitPeople(u.id));
      const allAbs = ppl.filter(p=>S.sheet.absent[p.id]).length;
      grandTot += ppl.length; grandAbs += allAbs;
      if (!st.showAbsent) ppl = ppl.filter(p=>!S.sheet.absent[p.id]);
      ppl.forEach(p=>rows.push({p, u}));
    });

    const per = Math.ceil(rows.length / cols) || 1;
    html += `<div class="cols" style="grid-template-columns:repeat(${cols},1fr)">`;
    for (let ci=0; ci<cols; ci++) {
      const chunk = rows.slice(ci*per,(ci+1)*per);
      html += `<table class="ptab"><thead><tr>`;
      if (st.showRowNo) html += `<th style="width:${cw().rowNo}%">${esc(hd().rowNo)}</th>`;
      html += `<th>${esc(hd().name)}</th>`;
      if (st.showCode) html += `<th style="width:${cw().code}%">${esc(hd().code)}</th>`;
      html += `<th style="width:${cw().unit}%">${esc(hd().unit)}</th>`;
      if (st.showSign) html += `<th style="width:${cw().sign}%">${esc(hd().sign)}</th>`;
      html += `</tr></thead><tbody>`;
      chunk.forEach((r, i)=>{
        const isAb = !!S.sheet.absent[r.p.id];
        html += `<tr class="${isAb?'ab':''}">`;
        if (st.showRowNo) html += `<td class="c">${ci*per+i+1}</td>`;
        html += `<td><span class="nm">${esc(r.p.name)}</span>${isAb?' <span class="ab-tag">(غایب)</span>':''}</td>`;
        if (st.showCode) html += `<td class="c">${esc(r.p.code||'')}</td>`;
        html += `<td class="c">${esc(r.u.name)}</td>`;
        if (st.showSign) html += `<td></td>`;
        html += `</tr>`;
      });
      html += `</tbody></table>`;
    }
    html += `</div>`;

    // اقلام زیر جدول — تجمیع همه واحدها
    units.forEach(u=>{
      const exs = (typeof unitExtras==='function' ? unitExtras(u.id) : []).filter(x=>x.label);
      if (exs.length) {
        html += `<table class="ptab extras-ptab"><tbody>`;
        exs.forEach(x=>{
          html += `<tr><td style="width:28%">${units.length>1?esc(u.name):''}</td><td>${esc(x.label)}</td><td class="c" style="width:22%">${esc(x.qty||'')}</td></tr>`;
        });
        html += `</tbody></table>`;
      }
    });
  } else {
  units.forEach((u, ui)=>{
    const base = (typeof printablePeople==='function' ? printablePeople(u.id) : unitPeople(u.id));
    let ppl = base;
    if (!st.showAbsent) ppl = ppl.filter(p=>!S.sheet.absent[p.id]);
    const abs = ppl.filter(p=>S.sheet.absent[p.id]).length;
    const allAbs = base.filter(p=>S.sheet.absent[p.id]).length;
    grandTot += base.length; grandAbs += allAbs;

    html += `<div class="unit-block" ${st.unitNewPage && ui>0 ? 'style="page-break-before:always"' : ''}>`;
    html += `<div class="unit-title"><span>واحد: ${esc(u.name)}</span></div>`;

    // تقسیم به ستون‌ها
    const per = Math.ceil(ppl.length / cols) || 1;
    const chunks = [];
    for (let i=0;i<cols;i++) chunks.push(ppl.slice(i*per,(i+1)*per));
    html += `<div class="cols" style="grid-template-columns:repeat(${cols},1fr)">`;
    chunks.forEach((chunk, ci)=>{
      html += `<table class="ptab"><thead><tr>`;
      if (st.showRowNo) html += `<th style="width:${cw().rowNo}%">${esc(hd().rowNo)}</th>`;
      html += `<th>${esc(hd().name)}</th>`;
      if (st.showCode) html += `<th style="width:${cw().code}%">${esc(hd().code)}</th>`;
      if (st.showSign) html += `<th style="width:${cw().sign}%">${esc(hd().sign)}</th>`;
      html += `</tr></thead><tbody>`;
      chunk.forEach((p, i)=>{
        const isAb = !!S.sheet.absent[p.id];
        html += `<tr class="${isAb?'ab':''}">`;
        if (st.showRowNo) html += `<td class="c">${ci*per+i+1}</td>`;
        html += `<td><span class="nm">${esc(p.name)}</span>${isAb?' <span class="ab-tag">(غایب)</span>':''}</td>`;
        if (st.showCode) html += `<td class="c">${esc(p.code||'')}</td>`;
        if (st.showSign) html += `<td></td>`;
        html += `</tr>`;
      });
      html += `</tbody></table>`;
    });
    html += `</div>`;

    // اقلام زیر جدول (خوراک، حاضری، تخم مرغ و …)
    const exs = (typeof unitExtras==='function' ? unitExtras(u.id) : []).filter(x=>x.label);
    if (exs.length) {
      html += `<table class="ptab extras-ptab"><tbody>`;
      exs.forEach(x=>{
        html += `<tr><td>${esc(x.label)}</td><td class="c" style="width:30%">${esc(x.qty||'')}</td></tr>`;
      });
      html += `</tbody></table>`;
    }
    html += `</div>`;
  });
  } // پایان قالب واحد به واحد

  if (S.sheet.note) html += `<div class="note-line">${esc(S.sheet.note)}</div>`;

  if (st.showSummary) {
    html += `<div class="sum-line"><span>کل: ${grandTot}</span><span>حاضر: ${grandTot-grandAbs} پرس</span><span>غایب: ${grandAbs}</span></div>`;
  }

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

/* ================= پیش‌نمایش ================= */
function renderPreview() {
  const d = paperDims();
  const st = S.setup;
  const html = buildDoc();
  const label = `${d.label} — ${d.w}×${d.h||'∞'} mm`;
  ['paperInfo','paperInfo2','paperInfo3'].forEach(id=>{ const el=document.getElementById(id); if(el) el.textContent = '📄 ' + label; });

  const scale = Math.min(1, 700 / (d.w * 3.7795));
  ['previewPage','previewPage2'].forEach(id=>{
    const el = document.getElementById(id);
    if (!el) return;
    const wpx = d.w * 3.7795;
    const hpx = d.h ? d.h * 3.7795 : 0;
    el.style.width = (wpx*scale) + 'px';
    if (hpx) el.style.minHeight = (hpx*scale)+'px'; else el.style.minHeight = 'auto';
    el.innerHTML = `<div style="transform:scale(${scale});transform-origin:top right;width:${wpx}px;${hpx?`min-height:${hpx}px;`:''}
      padding:${st.mt*3.7795*1}px ${st.mr*3.7795}px ${st.mb*3.7795}px ${st.ml*3.7795}px;">${html}</div>`;
    if (hpx) el.style.height = (hpx*scale)+'px';
    else { el.style.height = 'auto'; }
  });
}

/* ================= چاپ ================= */
function openPrintDialog() {
  if (!selectedUnits().length) { toast('حداقل یک واحد را انتخاب کنید'); showTabById('tab-sheet'); return; }
  const d = paperDims();
  const st = S.setup;
  const sizeRule = d.h ? `size: ${d.w}mm ${d.h}mm;` : `size: ${d.w}mm auto;`;
  document.getElementById('printPageStyle').textContent = `
    @page { ${sizeRule} margin: ${st.mt}mm ${st.mr}mm ${st.mb}mm ${st.ml}mm; }
    @media print {
      html, body { width: ${d.w - st.mr - st.ml}mm; }
      #printArea .ptab { page-break-inside: auto; }
      #printArea tr { page-break-inside: avoid; }
      #printArea .unit-title { page-break-after: avoid; }
      #printArea .doc .unit-title { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }`;
  document.getElementById('printArea').innerHTML = buildDoc();
  setTimeout(()=>window.print(), 60);
}

/* ================= پشتیبان‌گیری ================= */
function exportData() {
  const blob = new Blob([JSON.stringify(S, null, 1)], {type:'application/json'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'amar-ghaza-backup.json';
  a.click();
  toast('فایل پشتیبان دانلود شد 💾');
}
function importData(inp) {
  const f = inp.files[0]; if (!f) return;
  const r = new FileReader();
  r.onload = () => {
    try {
      const data = JSON.parse(r.result);
      if (!data.units || !data.people) throw 0;
      S = data; S.setup = {...DEFAULT_SETUP, ...S.setup};
      save(); renderAll(); toast('بازیابی انجام شد ✅');
    } catch(e) { toast('فایل نامعتبر است ❌'); }
    inp.value = '';
  };
  r.readAsText(f);
}
