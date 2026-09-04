/* ================= ساخت سند چاپی ================= */
function esc(s) { return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

/* عنوان‌های سرستون (قابل ویرایش توسط کاربر) */
function hd() {
  const def = { rowNo:'ر', name:'نام و نام خانوادگی', code:'کد پرسنلی', unit:'واحد', sign:'امضا' };
  return { ...def, ...(S.setup.heads||{}) };
}
/* عرض ستون‌ها به درصد (قابل ویرایش توسط کاربر) — ستون نام باقیمانده را می‌گیرد */
/* تنظیمات قالب فرم اکسل (با مقادیر پیش‌فرض امن) */
function xlsCfg() {
  const d = { dateLabel:'', unitLabel:'', foodPrefix:'**', foodSuffix:'**',
              dateW:45, foodScale:1.7, noW:11, codeW:16, twoBlocks:true,
              showExtras:true, extraLabelW:60 };
  return { ...d, ...((S.setup && S.setup.xls) || {}) };
}

/* کادر سلول‌ها — معادل کلاس Border در پروژه Page Setup Pro */
function cellBorder() {
  const st = S.setup;
  const sty = st.borderStyle || 'solid';
  if (sty === 'none') return 'border:none;';
  const wdt = Math.max(0.1, +st.borderWidth || 0.5);
  const col = st.borderColor || '#000000';
  return `border:${wdt}mm ${sty} ${col};`.replace(`${wdt}mm`, `${(wdt).toFixed(2)}mm`);
}
/* سبک قلم سند — ایتالیک / زیرخط / رنگ */
function fontStyleCss() {
  const st = S.setup;
  let css = '';
  if (st.italic) css += 'font-style:italic;';
  if (st.underline) css += 'text-decoration:underline;';
  if (st.fontColor && st.fontColor !== '#000000') css += `color:${st.fontColor};`;
  return css;
}

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
  let css = `text-align:${m[k] || d[k]};`;
  const ind = +((S.setup && S.setup.indent) || 0);
  if (k === 'name' && ind > 0) css += `padding-inline-start:${ind}mm;`;
  return css;
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
  let css = cellBorder() + `padding:${pad}mm ${(pad + 1).toFixed(2)}mm;`;
  if (st.headBg) css += `background:${st.headBg};-webkit-print-color-adjust:exact;print-color-adjust:exact;`;
  const h = +st.headRowH || 0;
  if (h > 0) css += `height:${h}mm;`;
  css += st.headBold === false ? 'font-weight:400;' : 'font-weight:800;';
  return css;
}
function cw() {
  const def = { rowNo:8, code:16, unit:20, sign:15 };
  const w = { ...def, ...(S.setup.colW||{}) };
  ['rowNo','code','unit','sign'].forEach(k=>{ w[k] = Math.max(3, Math.min(60, +w[k]||def[k])); });

  /* روی کاغذ باریک، درصدها به میلی‌متر خیلی کوچکی ترجمه می‌شوند و متن جا نمی‌شود.
     حداقلِ عرض بر حسب میلی‌متر تضمین می‌شود تا شماره و کد خوانا بمانند. */
  const st = S.setup;
  const pw = (typeof paperDims === 'function') ? paperDims().w : 210;
  const usable = pw - (+st.mr || 0) - (+st.ml || 0);
  if (usable > 0 && usable < 100) {
    const minPct = (mm) => (mm / usable) * 100;
    w.rowNo = Math.max(w.rowNo, minPct(6));    // دست‌کم ۶ میلی‌متر برای شماره ردیف
    w.code  = Math.max(w.code,  minPct(13));   // دست‌کم ۱۳ میلی‌متر برای کد پرسنلی
    w.unit  = Math.max(w.unit,  minPct(13));
    w.sign  = Math.max(w.sign,  minPct(12));
    // مجموع ستون‌های ثابت نباید فضایی برای «نام» باقی نگذارد
    let fixed = (st.showRowNo ? w.rowNo : 0) + (st.showCode ? w.code : 0) + (st.showSign ? w.sign : 0);
    if (fixed > 60) {
      const k = 60 / fixed;
      if (st.showRowNo) w.rowNo *= k;
      if (st.showCode)  w.code  *= k;
      if (st.showSign)  w.sign  *= k;
    }
  }
  ['rowNo','code','unit','sign'].forEach(k=>{ w[k] = Math.round(w[k] * 100) / 100; });
  return w;
}

function autoCols() {
  const st = S.setup;
  const d = (typeof orientedDims === 'function') ? orientedDims() : paperDims();
  const usable = d.w - (+st.mr || 0) - (+st.ml || 0);   // عرض واقعی قابل استفاده

  /* حداقل عرض هر ستون بر حسب اندازه قلم تخمین زده می‌شود، نه یک عدد ثابت.
     با قلم کوچک (چاپ حرارتی) ستون باریک‌تری هم خوانا است. */
  const fs = +st.fontSize || 11;
  const minCol = Math.max(18, fs * 1.9);   // مثلا قلم ۹pt → ~۱۸mm، قلم ۱۱pt → ~۲۱mm
  const maxFit = Math.max(1, Math.floor(usable / minCol));

  if (st.cols > 0) return Math.min(st.cols, maxFit);   // انتخاب کاربر، تا حد جا شدن
  if (usable <= 90)  return Math.min(1, maxFit);
  if (usable <= 160) return Math.min(2, maxFit);
  if (usable <= 230) return Math.min(3, maxFit);
  return Math.min(4, maxFit);
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
  const X = xlsCfg();
  const AH = st.alignHeader || 'center';                    // چیدمان سربرگ
  const AP = st.alignPage || 'center';                      // چیدمان جدول در صفحه
  if (st.layout === 'excel') return buildExcelDoc();

  let html = `<div class="doc ${st.noFill?'no-fill':''} ${st.zebra?'zebra':''}" style="font-family:${st.font};font-size:${st.fontSize}pt;line-height:${st.lineH};${st.bold?'font-weight:700;':''}${fontStyleCss()}--row-h:${rowH?rowH+'mm':'auto'};--cell-pad:${cellPad}mm;--align-page:${AP};" dir="rtl">`;

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
/* ================= پیش‌نمایش =================
   کاغذ با واحد میلی‌متر واقعی رندر می‌شود (نه پیکسل، نه transform/zoom).
   مرورگر خودش mm را به پیکسل تبدیل می‌کند، بنابراین محتوا هرگز از
   لبه کاغذ بیرون نمی‌زند و ارتفاع هم به‌درستی در چیدمان لحاظ می‌شود. */
let PGS_ZOOM = 0;   // 0 = خودکار (متناسب با عرض میز کار)

function pgsFitScale(paperMM) {
  const stage = document.getElementById('pgsStage');
  if (!stage) return 1;
  const avail = stage.clientWidth - 52;               // منهای padding میز کار
  const pxPerMM = 96 / 25.4;
  const need = paperMM * pxPerMM;
  if (need <= 0 || avail <= 0) return 1;
  return Math.min(1.6, Math.max(0.25, avail / need));
}

function renderPreview() {
  const d = orientedDims();
  const st = S.setup;
  const html = buildDoc();

  const label = `${d.label} — ${d.w}×${d.h || '∞'} mm`;
  ['paperInfo', 'paperInfo2'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = '📄 ' + label;
  });

  let scale = PGS_ZOOM > 0 ? PGS_ZOOM : pgsFitScale(d.w);
  scale = Math.round(scale * 1000) / 1000;   // جلوگیری از اعداد اعشاری طولانی
  const zv = document.getElementById('pgsZoomVal');
  if (zv) zv.textContent = Math.round(scale * 100) + '٪';

  ['previewPage', 'previewPage2'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    // عرض/ارتفاع کاغذ بر حسب میلی‌متر، مقیاس‌شده با font-size ریشه‌ای
    const mm = v => (Math.round(v * 100) / 100) + 'mm';
    el.style.width  = mm(d.w * scale);
    el.style.height = d.h ? mm(d.h * scale) : 'auto';
    el.innerHTML =
      `<div class="pgs-inner" style="` +
        `box-sizing:border-box;width:${mm(d.w * scale)};` +
        (d.h ? `min-height:${mm(d.h * scale)};` : '') +
        `padding:${mm(st.mt * scale)} ${mm(st.mr * scale)} ${mm(st.mb * scale)} ${mm(st.ml * scale)};` +
        `font-size:${(Math.round((+st.fontSize || 11) * scale * 100) / 100)}pt;` +
      `">${html}</div>`;
  });

  updatePgsHints();
}

/* جهت کاغذ (عمودی/افقی) — معادل orientation در Page Setup Pro */
function orientedDims() {
  const d = paperDims();
  const st = S.setup;
  if (st.orient === 'landscape' && d.h) return { w: d.h, h: d.w, label: d.label + ' (افقی)' };
  return d;
}

/* راهنمای زنده: عرض مفید و هشدار تنگی ستون‌ها */
function updatePgsHints() {
  const d = orientedDims(), st = S.setup;
  const usable = d.w - (+st.mr || 0) - (+st.ml || 0);
  const u = document.getElementById('pgsUsable');
  if (u) {
    u.className = 'pgs-hint' + (usable < 30 ? ' warn' : '');
    u.textContent = `عرض مفید: ${usable.toFixed(1)} میلی‌متر` +
      (usable < 30 ? ' — حاشیه‌ها را کم کنید، جا برای جدول نمی‌ماند.' : '');
  }
  const c = document.getElementById('pgsColHint');
  if (c && usable > 0) {
    const w = cw();
    const fixed = (st.showRowNo ? w.rowNo : 0) + (st.showCode ? w.code : 0) + (st.showSign ? w.sign : 0);
    const nameMM = usable * (100 - fixed) / 100;
    c.className = 'pgs-hint' + (nameMM < 15 ? ' warn' : '');
    c.textContent = `ستون نام: ${nameMM.toFixed(1)} میلی‌متر` +
      (nameMM < 15 ? ' — برای نام کوتاه است؛ عرض بقیه ستون‌ها را کم کنید.' : ' (کافی)');
  }
}

/* بزرگ‌نمایی: 1 = زیاد، -1 = کم، 0 = اندازه مناسب */
function pgsZoom(dir) {
  const d = orientedDims();
  const cur = PGS_ZOOM > 0 ? PGS_ZOOM : pgsFitScale(d.w);
  if (dir === 0) PGS_ZOOM = 0;
  else PGS_ZOOM = Math.min(1.6, Math.max(0.25, cur + dir * 0.1));
  renderPreview();
}

/* دکمه ضخیم روی نوار ابزار */
function pgsToggleBold() {
  const cb = document.getElementById('psBold');
  if (!cb) return;
  cb.checked = !cb.checked;
  saveSetup();
  const btn = document.getElementById('psBoldBtn');
  if (btn) btn.classList.toggle('on', cb.checked);
}

/* دکمه‌های مورب/زیرخط روی نوار ابزار */
function pgsToggleStyle(cbId, btnId) {
  const cb = document.getElementById(cbId);
  if (!cb) return;
  cb.checked = !cb.checked;
  saveSetup();
  const b = document.getElementById(btnId);
  if (b) b.classList.toggle('on', cb.checked);
}
/* حذف پس‌زمینه عنوان */
function pgsClearHeadBg() {
  saveSetup();
  renderSetupControls();
  renderPreview();
}

/* فعال کردن قالب اکسل از داخل تب فرم اکسل */
function pgsUseExcel() {
  const sel = document.getElementById('psLayout');
  if (sel) sel.value = 'excel';
  S.setup.layout = 'excel';
  saveSetup();
  renderSetupControls();
  renderPreview();
}
/* بازگرداندن تنظیمات فرم اکسل به پیش‌فرض */
function resetXls() {
  if (!confirm('تنظیمات فرم اکسل به حالت پیش‌فرض برگردد؟')) return;
  S.setup.xls = { dateLabel:'', unitLabel:'', foodPrefix:'**', foodSuffix:'**',
                  dateW:45, foodScale:1.7, noW:11, codeW:16, twoBlocks:true,
                  showExtras:true, extraLabelW:60 };
  save();
  renderSetupControls();
  renderPreview();
}

/* ذخیره دستی یک بخش + بازخورد دیداری */
function pgsSaveSection(btn) {
  saveSetup();
  renderPreview();
  const bar = btn && btn.closest('.pgs-savebar');
  const tag = bar && bar.querySelector('.pgs-saved');
  if (tag) {
    tag.classList.add('show');
    clearTimeout(tag._t);
    tag._t = setTimeout(() => tag.classList.remove('show'), 1800);
  }
}

/* جابه‌جایی بین بخش‌های پنل تنظیمات */
function pgsGo(secId, btn) {
  document.querySelectorAll('#tab-pagesetup .pgs-sec').forEach(x => x.classList.toggle('show', x.id === secId));
  document.querySelectorAll('#tab-pagesetup .pgs-tab').forEach(b => b.classList.toggle('active', b === btn));
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
  const d = orientedDims();
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
  const X = xlsCfg();
  const AH = st.alignHeader || 'center';
  const AP = st.alignPage || 'center';
  const dateTxt = S.sheet.date || '';

  let html = `<div class="doc xls ${st.noFill ? 'no-fill' : ''} ${st.zebra?'zebra':''}" dir="rtl" style="font-family:${st.font};font-size:${st.fontSize}pt;line-height:${st.lineH};${st.bold ? 'font-weight:700;' : ''}${fontStyleCss()}--row-h:${rowH ? rowH + 'mm' : 'auto'};--cell-pad:${cellPad}mm;--align-page:${AP};">`;

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
      <td class="xls-date" style="${CS}width:${X.dateW}%;">${esc(X.dateLabel)}${esc(dateTxt)}</td>
      <td class="xls-unit" style="${CS}width:${100 - X.dateW}%;">${esc(X.unitLabel)}${esc(u.name)}</td>
    </tr></table>`;

    /* --- نام غذا در یک کادر تمام‌عرض --- */
    if (food) html += `<div class="xls-food" style="font-size:${(st.fontSize * X.foodScale).toFixed(1)}pt;text-align:${AH}">${esc(X.foodPrefix)} ${esc(food.name)} ${esc(X.foodSuffix)}</div>`;

    /* --- جدول اسامی: یک یا دو بلوک کنار هم --- */
    const nb = X.twoBlocks ? 2 : 1;
    const half = Math.ceil(ppl.length / nb) || 1;
    const right = ppl.slice(0, half);
    const left  = nb === 2 ? ppl.slice(half) : [];
    const lines = Math.max(right.length, left.length);

    html += `<table class="xls-tab"><tbody>`;
    for (let i = 0; i < lines; i++) {
      html += `<tr>`;
      html += cellTrio(right[i], i + 1, CS);
      if (nb === 2) html += cellTrio(left[i], half + i + 1, CS, true);
      html += `</tr>`;
    }
    html += `</tbody></table>`;

    /* --- اقلام زیر جدول (خوراک، نون پنیر، تخم مرغ …) --- */
    const exs = X.showExtras
      ? (typeof unitExtras === 'function' ? unitExtras(u.id) : []).filter(x => x.label)
      : [];
    if (exs.length) {
      html += `<table class="xls-extras" style="${ETS}"><tbody>`;
      exs.forEach(x => {
        html += `<tr><td class="xls-ex-label" style="${XS}${ELS}width:${X.extraLabelW}%;">${esc(x.label)}</td><td class="xls-ex-qty" style="${XS}${EQS}">${esc(x.qty || '')}</td></tr>`;
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
  const X = xlsCfg();
  const nb = X.twoBlocks ? 2 : 1;
  const WR = `width:${(X.noW / nb).toFixed(2)}%;`;
  const WC = `width:${(X.codeW / nb).toFixed(2)}%;`;
  if (!p) return `<td class="xls-no${sep}" style="${CS}${AR}${WR}"></td><td class="xls-code" style="${CS}${AC}${WC}"></td><td class="xls-name" style="${CS}${AN}"></td>`;
  const ab = !!S.sheet.absent[p.id];
  return `<td class="xls-no${sep}" style="${CS}${AR}${WR}">${no}</td>` +
         `<td class="xls-code ${ab ? 'ab' : ''}" style="${CS}${AC}${WC}">${esc(p.code || '')}</td>` +
         `<td class="xls-name ${ab ? 'ab' : ''}" style="${CS}${ca('name')}"><span class="nm">${esc(p.name)}</span></td>`;
}

/* استایل مستقیم سلول: ارتفاع سطر و فاصله داخلی — روی همه مرورگرها و در چاپ قابل اتکاست */
function cellStyle(rowH, cellPad) {
  const pad = (cellPad == null ? 1 : +cellPad);
  const bd = cellBorder();
  /* پدینگ افقی نباید روی کاغذ باریک (رول حرارتی) کل عرض ستون را ببلعد.
     روی رول ۵۸ ستون «ردیف» فقط ~۴mm عرض دارد؛ ۲mm پدینگ در هر طرف
     یعنی صفر فضا برای متن و محتوا محو می‌شود. */
  const w = (typeof paperDims === 'function') ? paperDims().w : 210;
  const maxH = w <= 60 ? 0.6 : (w <= 90 ? 1 : pad + 1);
  const padH = Math.min(pad + 1, maxH);
  let css = bd + `padding:${pad}mm ${padH.toFixed(2)}mm;`;
  if (rowH > 0) css += `height:${rowH}mm;`;
  return css;
}
