/* ================= ساخت سند چاپی ================= */
function esc(s) { return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

/* عنوان‌های سرستون (قابل ویرایش توسط کاربر) */
function hd() {
  const def = { rowNo:'ر', name:'نام و نام خانوادگی', code:'کد پرسنلی', unit:'واحد', sign:'امضا' };
  return { ...def, ...(S.setup.heads||{}) };
}
/* عرض ستون‌ها به درصد (قابل ویرایش توسط کاربر) — ستون نام باقیمانده را می‌گیرد */
/* جدول اقلام زیر جدول: عرض و جای‌گیری در صفحه */
function extraTableStyle() {
  const st = S.setup;
  const w = Math.max(20, Math.min(100, +st.extraWidth || 100));
  const a = st.extraAlignPage || 'center';
  let css = `width:${w}%;`;
  if (a === 'center')     css += 'margin-inline:auto;';
  else if (a === 'left')  css += 'margin-inline:0 auto;';
  else                    css += 'margin-inline:auto 0;';
  return css;
}
function extraLabelStyle() {
  const st = S.setup;
  return `text-align:${st.extraAlignLabel || 'center'};` +
         (st.extraBold === false ? 'font-weight:400;' : 'font-weight:800;');
}
function extraQtyStyle() {
  const st = S.setup;
  const w = Math.max(10, Math.min(80, +st.extraQtyW || 40));
  return `width:${w}%;text-align:${st.extraAlignQty || 'center'};` +
         (st.extraBold === false ? 'font-weight:400;' : 'font-weight:800;');
}

/* چیدمان بدنه و سرستون برای هر ستون، جداگانه */
function ca(k) {
  const d = { rowNo:'center', name:'right', code:'center', unit:'center', sign:'center' };
  const m = { ...d, ...((S.setup && S.setup.colAlign) || {}) };
  return `text-align:${m[k] || d[k]};`;
}
function cha(k) {
  const d = { rowNo:'center', name:'center', code:'center', unit:'center', sign:'center' };
  const m = { ...d, ...((S.setup && S.setup.colHAlign) || {}) };
  return `text-align:${m[k] || d[k]};`;
}
/* استایل سلول سرستون (ارتفاع مستقل + ضخامت) */
function headStyle() {
  const st = S.setup;
  const pad = (st.cellPad == null ? 1 : +st.cellPad);
  let css = `padding:${pad}mm ${(pad + 1).toFixed(2)}mm;`;
  const h = +st.headRowH || 0;
  if (h > 0) css += `height:${h}mm;`;
  css += st.headBold === false ? 'font-weight:400;' : 'font-weight:800;';
  return css;
}
function cw() {
  const def = { rowNo:8, code:16, unit:20, sign:15 };
  const w = { ...def, ...(S.setup.colW||{}) };
  ['rowNo','code','unit','sign'].forEach(k=>{ w[k] = Math.max(3, Math.min(60, +w[k]||def[k])); });
  return w;
}

function autoCols() {
  const st = S.setup;
  const d = paperDims();
  const usable = d.w - (+st.mr || 0) - (+st.ml || 0);   // عرض واقعی قابل استفاده
  // حداکثر ستونی که با عرض مفید جا می‌شود (هر ستون دست‌کم ۳۵ میلی‌متر)
  const maxFit = Math.max(1, Math.floor(usable / 35));
  if (st.cols > 0) return Math.min(st.cols, maxFit);
  if (usable <= 160) return Math.min(1, maxFit);
  if (usable <= 230) return Math.min(2, maxFit);
  return Math.min(3, maxFit);
}

function buildDoc() {
  const st = S.setup;
  const units = selectedUnits();
  const meal = S.meals.find(m=>m.id===S.sheet.mealId);
  const food = S.foods.find(f=>f.id===S.sheet.foodId);
  const cols = autoCols();
  const rowH = +st.rowH || 0;
  const cellPad = (st.cellPad==null?1:+st.cellPad);
  const CS = cellStyle(rowH, cellPad);   // استایل مستقیم سلول‌ها (ارتفاع سطر و فاصله داخلی)
  const HS = headStyle();                                   // استایل سرستون‌ها
  const XS = cellStyle(+st.extraRowH || rowH, cellPad);     // اقلام زیر جدول
  const ETS = extraTableStyle(), ELS = extraLabelStyle(), EQS = extraQtyStyle();
  const AH = st.alignHeader || 'center';                    // چیدمان سربرگ
  const AP = st.alignPage || 'center';                      // چیدمان جدول در صفحه
  if (st.layout === 'excel') return buildExcelDoc();

  let html = `<div class="doc ${st.noFill?'no-fill':''}" style="font-family:${st.font};font-size:${st.fontSize}pt;line-height:${st.lineH};${st.bold?'font-weight:700;':''}--row-h:${rowH?rowH+'mm':'auto'};--cell-pad:${cellPad}mm;--align-page:${AP};" dir="rtl">`;

  if (st.headerOn) {
    html += `<div class="doc-header" style="text-align:${AH}">`;
    if (st.headerTitle) html += `<div class="htitle" style="font-size:${st.fontSize*1.35}pt">${esc(st.headerTitle)}</div>`;
    if (st.headerSub) html += `<div class="hsub" style="font-size:${st.fontSize*0.95}pt">${esc(st.headerSub)}</div>`;
    html += `</div>`;
    const metas = [];
    if (st.headerDate && S.sheet.date) metas.push(`تاریخ: ${esc(S.sheet.date)}`);
    if (st.headerMeal && meal) metas.push(`وعده: ${esc(meal.name)}`);
    if (metas.length) html += `<div class="meta-line" style="justify-content:${AH==='center'?'center':(AH==='left'?'flex-start':'flex-end')}">${metas.map(m=>`<span>${m}</span>`).join('')}</div>`;
    if (st.headerMeal && food) html += `<div class="food-line" style="text-align:${AH}">** ${esc(food.name)} **</div>`;
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
      if (st.showRowNo) html += `<th style="width:${cw().rowNo}%;${HS}${cha('rowNo')}">${esc(hd().rowNo)}</th>`;
      html += `<th style="${HS}${cha('name')}">${esc(hd().name)}</th>`;
      if (st.showCode) html += `<th style="width:${cw().code}%;${HS}${cha('code')}">${esc(hd().code)}</th>`;
      html += `<th style="width:${cw().unit}%;${HS}${cha('unit')}">${esc(hd().unit)}</th>`;
      if (st.showSign) html += `<th style="width:${cw().sign}%;${HS}${cha('sign')}">${esc(hd().sign)}</th>`;
      html += `</tr></thead><tbody>`;
      chunk.forEach((r, i)=>{
        const isAb = !!S.sheet.absent[r.p.id];
        html += `<tr class="${isAb?'ab':''}">`;
        if (st.showRowNo) html += `<td style="${CS}${ca('rowNo')}">${ci*per+i+1}</td>`;
        html += `<td style="${CS}${ca('name')}"><span class="nm">${esc(r.p.name)}</span>${isAb?' <span class="ab-tag">(غایب)</span>':''}</td>`;
        if (st.showCode) html += `<td style="${CS}${ca('code')}">${esc(r.p.code||'')}</td>`;
        html += `<td style="${CS}${ca('unit')}">${esc(r.u.name)}</td>`;
        if (st.showSign) html += `<td style="${CS}${ca('sign')}"></td>`;
        html += `</tr>`;
      });
      html += `</tbody></table>`;
    }
    html += `</div>`;

    // اقلام زیر جدول — تجمیع همه واحدها
    units.forEach(u=>{
      const exs = (typeof unitExtras==='function' ? unitExtras(u.id) : []).filter(x=>x.label);
      if (exs.length) {
        html += `<table class="ptab extras-ptab" style="${ETS}"><tbody>`;
        exs.forEach(x=>{
          html += `<tr><td style="width:28%;${XS}${ELS}">${units.length>1?esc(u.name):''}</td><td style="${XS}${ELS}">${esc(x.label)}</td><td style="${XS}${EQS}">${esc(x.qty||'')}</td></tr>`;
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
      if (st.showRowNo) html += `<th style="width:${cw().rowNo}%;${HS}${cha('rowNo')}">${esc(hd().rowNo)}</th>`;
      html += `<th style="${HS}${cha('name')}">${esc(hd().name)}</th>`;
      if (st.showCode) html += `<th style="width:${cw().code}%;${HS}${cha('code')}">${esc(hd().code)}</th>`;
      if (st.showSign) html += `<th style="width:${cw().sign}%;${HS}${cha('sign')}">${esc(hd().sign)}</th>`;
      html += `</tr></thead><tbody>`;
      chunk.forEach((p, i)=>{
        const isAb = !!S.sheet.absent[p.id];
        html += `<tr class="${isAb?'ab':''}">`;
        if (st.showRowNo) html += `<td style="${CS}${ca('rowNo')}">${ci*per+i+1}</td>`;
        html += `<td style="${CS}${ca('name')}"><span class="nm">${esc(p.name)}</span>${isAb?' <span class="ab-tag">(غایب)</span>':''}</td>`;
        if (st.showCode) html += `<td style="${CS}${ca('code')}">${esc(p.code||'')}</td>`;
        if (st.showSign) html += `<td style="${CS}${ca('sign')}"></td>`;
        html += `</tr>`;
      });
      html += `</tbody></table>`;
    });
    html += `</div>`;

    // اقلام زیر جدول (خوراک، حاضری، تخم مرغ و …)
    const exs = (typeof unitExtras==='function' ? unitExtras(u.id) : []).filter(x=>x.label);
    if (exs.length) {
      html += `<table class="ptab extras-ptab" style="${ETS}"><tbody>`;
      exs.forEach(x=>{
        html += `<tr><td style="${XS}${ELS}">${esc(x.label)}</td><td style="${XS}${EQS}">${esc(x.qty||'')}</td></tr>`;
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
  ['paperInfo','paperInfo2'].forEach(id=>{ const el=document.getElementById(id); if(el) el.textContent = '📄 ' + label; });

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
  // جلوگیری از چاپ برگه بدون هیچ اسمی
  const total = selectedUnits().reduce((n, u) => n + printablePeople(u.id)
    .filter(p => S.setup.showAbsent || !S.sheet.absent[p.id]).length, 0);
  if (!total) {
    toast('هیچ نفری برای چاپ وجود ندارد — تیک «نمایش غایبان» یا انتخاب نفرات را بررسی کنید');
    showTabById('tab-sheet');
    return;
  }
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


/* ================= قالب برگه اکسل (مطابق فایل «آمار غذا.xlsx») =================
   ساختار هر واحد:
     ردیف ۱ : تاریخ  |  نام واحد
     ردیف ۲ : ** نام غذا **  (تمام عرض، درشت)
     جدول   : دو ستون کنار هم — هر ستون = نام | کد | شماره ردیف
     پایین  : اقلام (خوراک / نون پنیر / تخم مرغ ...) با مقدار
================================================================= */
function buildExcelDoc() {
  const st = S.setup;
  const units = selectedUnits();
  const food = S.foods.find(f => f.id === S.sheet.foodId);
  const rowH = +st.rowH || 0;
  const cellPad = (st.cellPad == null ? 1 : +st.cellPad);
  const CS = cellStyle(rowH, cellPad);
  const XS = cellStyle(+st.extraRowH || rowH, cellPad);
  const ETS = extraTableStyle(), ELS = extraLabelStyle(), EQS = extraQtyStyle();
  const AH = st.alignHeader || 'center';
  const AP = st.alignPage || 'center';
  const dateTxt = S.sheet.date || '';

  let html = `<div class="doc xls ${st.noFill ? 'no-fill' : ''}" dir="rtl" style="font-family:${st.font};font-size:${st.fontSize}pt;line-height:${st.lineH};${st.bold ? 'font-weight:700;' : ''}--row-h:${rowH ? rowH + 'mm' : 'auto'};--cell-pad:${cellPad}mm;--align-page:${AP};">`;

  let grandTot = 0, grandAbs = 0;

  units.forEach((u, ui) => {
    const all = (typeof printablePeople === 'function' ? printablePeople(u.id) : unitPeople(u.id));
    const allAbs = all.filter(p => S.sheet.absent[p.id]).length;
    grandTot += all.length; grandAbs += allAbs;

    let ppl = all;
    if (!st.showAbsent) ppl = ppl.filter(p => !S.sheet.absent[p.id]);

    html += `<div class="xls-block" ${st.unitNewPage && ui > 0 ? 'style="page-break-before:always"' : ''}>`;

    /* --- سربرگ: تاریخ + نام واحد --- */
    html += `<table class="xls-head"><tr>
      <td class="xls-date" style="${CS}">${esc(dateTxt)}</td>
      <td class="xls-unit" style="${CS}">${esc(u.name)}</td>
    </tr></table>`;

    /* --- نام غذا در یک کادر تمام‌عرض --- */
    if (food) html += `<div class="xls-food" style="font-size:${st.fontSize * 1.7}pt;text-align:${AH}">** ${esc(food.name)} **</div>`;

    /* --- جدول اسامی در دو ستون کنار هم --- */
    const half = Math.ceil(ppl.length / 2) || 1;
    const right = ppl.slice(0, half);          // ستون راست: نفر ۱ تا نیمه
    const left  = ppl.slice(half);             // ستون چپ: بقیه
    const lines = Math.max(right.length, left.length);

    html += `<table class="xls-tab"><tbody>`;
    for (let i = 0; i < lines; i++) {
      const a = right[i], b = left[i];
      html += `<tr>`;
      html += cellTrio(a, i + 1, CS);
      html += cellTrio(b, half + i + 1, CS, true);
      html += `</tr>`;
    }
    html += `</tbody></table>`;

    /* --- اقلام زیر جدول (خوراک، نون پنیر، تخم مرغ …) --- */
    const exs = (typeof unitExtras === 'function' ? unitExtras(u.id) : []).filter(x => x.label);
    if (exs.length) {
      html += `<table class="xls-extras" style="${ETS}"><tbody>`;
      exs.forEach(x => {
        html += `<tr><td class="xls-ex-label" style="${XS}${ELS}">${esc(x.label)}</td><td class="xls-ex-qty" style="${XS}${EQS}">${esc(x.qty || '')}</td></tr>`;
      });
      html += `</tbody></table>`;
    }

    html += `</div>`;
  });

  if (S.sheet.note) html += `<div class="note-line">${esc(S.sheet.note)}</div>`;
  if (st.showSummary) {
    html += `<div class="sum-line"><span>کل: ${grandTot}</span><span>حاضر: ${grandTot - grandAbs} پرس</span><span>غایب: ${grandAbs}</span></div>`;
  }
  if (st.footerOn) {
    html += `<div class="doc-footer" style="font-size:${st.fontSize * 0.9}pt">`;
    if (st.footerText) html += `<div>${esc(st.footerText)}</div>`;
    if (st.footerTime) html += `<div>ساعت چاپ: ${new Date().toLocaleTimeString('fa-IR', {hour:'2-digit',minute:'2-digit'})}</div>`;
    if (st.footerSign) html += `<div class="sig-row"><span>مسئول واحد: <span class="dots">..............</span></span><span>آشپزخانه: <span class="dots">..............</span></span></div>`;
    html += `</div>`;
  }

  html += `</div>`;
  return html;
}

/* یک گروه سه‌سلولی — مطابق فایل اکسل: شماره ردیف | کد | نام */
function cellTrio(p, no, CS, isLeft) {
  const sep = isLeft ? ' xls-sep' : '';
  const AN = ca('name'), AR = ca('rowNo'), AC = ca('code');
  const W = cw();                                   // عرض ستون‌ها از تنظیمات کاربر
  const WR = `width:${(W.rowNo / 2).toFixed(2)}%;`;  // دو بلوک کنار هم → نصف عرض
  const WC = `width:${(W.code / 2).toFixed(2)}%;`;
  if (!p) return `<td class="xls-no${sep}" style="${CS}${AR}${WR}"></td><td class="xls-code" style="${CS}${AC}${WC}"></td><td class="xls-name" style="${CS}${AN}"></td>`;
  const ab = !!S.sheet.absent[p.id];
  return `<td class="xls-no${sep}" style="${CS}${AR}${WR}">${no}</td>` +
         `<td class="xls-code ${ab ? 'ab' : ''}" style="${CS}${AC}${WC}">${esc(p.code || '')}</td>` +
         `<td class="xls-name ${ab ? 'ab' : ''}" style="${CS}${ca('name')}"><span class="nm">${esc(p.name)}</span></td>`;
}

/* استایل مستقیم سلول: ارتفاع سطر و فاصله داخلی — روی همه مرورگرها و در چاپ قابل اتکاست */
function cellStyle(rowH, cellPad) {
  const pad = (cellPad == null ? 1 : +cellPad);
  let css = `padding:${pad}mm ${(pad + 1).toFixed(2)}mm;`;
  if (rowH > 0) css += `height:${rowH}mm;`;
  return css;
}
