/* ================= Page Setup ================= */
const PAPERS = {
  A4P:{w:210,h:297,label:'A4 عمودی'}, A4L:{w:297,h:210,label:'A4 افقی'},
  A5P:{w:148,h:210,label:'A5 عمودی'}, A5L:{w:210,h:148,label:'A5 افقی'},
  LETTER:{w:216,h:279,label:'Letter'},
  T80:{w:80,h:0,label:'رول حرارتی ۸۰mm'}, T58:{w:58,h:0,label:'رول حرارتی ۵۸mm'},
};
function paperDims() {
  const st = S.setup;
  if (st.paper==='CUSTOM') return {w: +st.customW||80, h: +st.customH||0, label:'دلخواه'};
  return PAPERS[st.paper] || PAPERS.A4P;
}
function isRoll() { const d = paperDims(); return !d.h; }

function renderSetupControls() {
  const st = S.setup;
  document.getElementById('psPaper').value = st.paper;
  document.getElementById('customSizeRow').style.display = st.paper==='CUSTOM' ? 'flex' : 'none';
  document.getElementById('psCustomW').value = st.customW;
  document.getElementById('psCustomH').value = st.customH;
  ['mt','mb','mr','ml'].forEach(k=>document.getElementById('ps'+k.toUpperCase().replace('M','M')).value = st[k]);
  document.getElementById('psMT').value = st.mt; document.getElementById('psMB').value = st.mb;
  document.getElementById('psMR').value = st.mr; document.getElementById('psML').value = st.ml;
  document.getElementById('psFont').value = st.font;
  document.getElementById('psFontSize').value = st.fontSize;
  document.getElementById('psLineH').value = st.lineH;
  const _rh = document.getElementById('psRowH');
  if (_rh) _rh.value = (st.rowH != null ? st.rowH : 0);
  const _cp = document.getElementById('psCellPad');
  if (_cp) _cp.value = (st.cellPad != null ? st.cellPad : 1);
  const _dCA = { rowNo:'center', name:'right',  code:'center', unit:'center', sign:'center' };
  const _dHA = { rowNo:'center', name:'center', code:'center', unit:'center', sign:'center' };
  const _ca = { ..._dCA, ...(st.colAlign  || {}) };
  const _ha = { ..._dHA, ...(st.colHAlign || {}) };
  [['RowNo','rowNo'],['Name','name'],['Code','code'],['Unit','unit'],['Sign','sign']].forEach(([sfx,k]) => {
    const a = document.getElementById('psCA'+sfx); if (a) a.value = _ca[k];
    const b = document.getElementById('psHA'+sfx); if (b) b.value = _ha[k];
  });
  const _hrh = document.getElementById('psHeadRowH');  if (_hrh) _hrh.value = st.headRowH || 0;
  const _erh = document.getElementById('psExtraRowH'); if (_erh) _erh.value = st.extraRowH || 0;
  const _hb  = document.getElementById('psHeadBold');  if (_hb)  _hb.checked = st.headBold !== false;
  const _ah = document.getElementById('psAlignHeader');
  if (_ah) _ah.value = st.alignHeader || 'center';
  const _ap = document.getElementById('psAlignPage');
  if (_ap) _ap.value = st.alignPage || 'center';
  document.getElementById('psBold').checked = st.bold;
  document.getElementById('psCols').value = String(st.cols);
  document.getElementById('psShowCode').checked = st.showCode;
  document.getElementById('psShowRowNo').checked = st.showRowNo;
  document.getElementById('psShowSign').checked = st.showSign;
  document.getElementById('psLayout').value = st.layout || 'units';
  const _h = { rowNo:'ر', name:'نام و نام خانوادگی', code:'کد پرسنلی', unit:'واحد', sign:'امضا', ...(st.heads||{}) };
  document.getElementById('psHeadName').value = _h.name;
  document.getElementById('psHeadCode').value = _h.code;
  document.getElementById('psHeadUnit').value = _h.unit;
  document.getElementById('psHeadRowNo').value = _h.rowNo;
  document.getElementById('psHeadSign').value = _h.sign;
  const _w = { rowNo:8, code:16, unit:20, sign:15, ...(st.colW||{}) };
  document.getElementById('psWRowNo').value = _w.rowNo;
  document.getElementById('psWCode').value = _w.code;
  document.getElementById('psWUnit').value = _w.unit;
  document.getElementById('psWSign').value = _w.sign;
  document.getElementById('psShowAbsent').checked = st.showAbsent;
  document.getElementById('psShowSummary').checked = st.showSummary;
  document.getElementById('psNoFill').checked = st.noFill;
  document.getElementById('psUnitNewPage').checked = st.unitNewPage;
  document.getElementById('psHeaderOn').checked = st.headerOn;
  document.getElementById('psHeaderTitle').value = st.headerTitle;
  document.getElementById('psHeaderSub').value = st.headerSub;
  document.getElementById('psHeaderDate').checked = st.headerDate;
  document.getElementById('psHeaderMeal').checked = st.headerMeal;
  document.getElementById('psFooterOn').checked = st.footerOn;
  document.getElementById('psFooterText').value = st.footerText;
  document.getElementById('psFooterSign').checked = st.footerSign;
  document.getElementById('psFooterTime').checked = st.footerTime;
}
function onPaperChange() {
  const v = document.getElementById('psPaper').value;
  S.setup.paper = v;
  document.getElementById('customSizeRow').style.display = v==='CUSTOM' ? 'flex' : 'none';
  // پیشنهاد خودکار برای حرارتی
  if (v==='T80' || v==='T58') {
    Object.assign(S.setup, {mt:2, mb:2, mr:2, ml:2, fontSize: v==='T58'?8.5:9.5, bold:true, cols:1, showSign:false, noFill:true});
  }
  save(); renderSetupControls(); renderPreview();
}
function saveSetup() {
  const st = S.setup;
  st.paper = document.getElementById('psPaper').value;
  st.customW = +document.getElementById('psCustomW').value || 80;
  st.customH = +document.getElementById('psCustomH').value || 0;
  st.mt = +document.getElementById('psMT').value || 0;
  st.mb = +document.getElementById('psMB').value || 0;
  st.mr = +document.getElementById('psMR').value || 0;
  st.ml = +document.getElementById('psML').value || 0;
  st.font = document.getElementById('psFont').value;
  st.fontSize = +document.getElementById('psFontSize').value || 11;
  st.lineH = +document.getElementById('psLineH').value || 1.5;
  const _rh = document.getElementById('psRowH');
  if (_rh) st.rowH = Math.max(0, Math.min(20, parseFloat(_rh.value) || 0));
  const _cp = document.getElementById('psCellPad');
  if (_cp) { const v = parseFloat(_cp.value); st.cellPad = isNaN(v) ? 1 : Math.max(0, Math.min(10, v)); }
  if (!st.colAlign)  st.colAlign  = {};
  if (!st.colHAlign) st.colHAlign = {};
  [['RowNo','rowNo'],['Name','name'],['Code','code'],['Unit','unit'],['Sign','sign']].forEach(([sfx,k]) => {
    const a = document.getElementById('psCA'+sfx); if (a) st.colAlign[k]  = a.value;
    const b = document.getElementById('psHA'+sfx); if (b) st.colHAlign[k] = b.value;
  });
  const _hrh = document.getElementById('psHeadRowH');
  if (_hrh) st.headRowH = Math.max(0, Math.min(30, parseFloat(_hrh.value) || 0));
  const _erh = document.getElementById('psExtraRowH');
  if (_erh) st.extraRowH = Math.max(0, Math.min(30, parseFloat(_erh.value) || 0));
  const _hb = document.getElementById('psHeadBold');
  if (_hb) st.headBold = _hb.checked;
  const _ah = document.getElementById('psAlignHeader');
  if (_ah) st.alignHeader = _ah.value || 'center';
  const _ap = document.getElementById('psAlignPage');
  if (_ap) st.alignPage = _ap.value || 'center';
  st.bold = document.getElementById('psBold').checked;
  st.cols = +document.getElementById('psCols').value;
  st.showCode = document.getElementById('psShowCode').checked;
  st.showRowNo = document.getElementById('psShowRowNo').checked;
  st.showSign = document.getElementById('psShowSign').checked;
  st.layout = document.getElementById('psLayout').value;
  st.showAbsent = document.getElementById('psShowAbsent').checked;
  st.showSummary = document.getElementById('psShowSummary').checked;
  st.noFill = document.getElementById('psNoFill').checked;
  st.unitNewPage = document.getElementById('psUnitNewPage').checked;
  st.headerOn = document.getElementById('psHeaderOn').checked;
  st.headerTitle = document.getElementById('psHeaderTitle').value;
  st.headerSub = document.getElementById('psHeaderSub').value;
  st.headerDate = document.getElementById('psHeaderDate').checked;
  st.headerMeal = document.getElementById('psHeaderMeal').checked;
  st.footerOn = document.getElementById('psFooterOn').checked;
  st.footerText = document.getElementById('psFooterText').value;
  st.footerSign = document.getElementById('psFooterSign').checked;
  st.footerTime = document.getElementById('psFooterTime').checked;

  /* عنوان‌ها و عرض ستون‌ها هم از همین‌جا ذخیره شوند */
  const dh = { rowNo:'ر', name:'نام و نام خانوادگی', code:'کد پرسنلی', unit:'واحد', sign:'امضا' };
  if (!st.heads) st.heads = {};
  [['psHeadRowNo','rowNo'],['psHeadName','name'],['psHeadCode','code'],
   ['psHeadUnit','unit'],['psHeadSign','sign']].forEach(([id,k]) => {
    const e = document.getElementById(id);
    if (e) st.heads[k] = (e.value || '').trim() || dh[k];
  });

  const dw = { rowNo:8, code:16, unit:20, sign:15 };
  const clampW = v => Math.max(2, Math.min(60, parseFloat(v) || 0));
  if (!st.colW) st.colW = {};
  [['psWRowNo','rowNo'],['psWCode','code'],['psWUnit','unit'],['psWSign','sign']].forEach(([id,k]) => {
    const e = document.getElementById(id);
    if (e) st.colW[k] = clampW(e.value) || dw[k];
  });

  save(); renderPreview();
}
function saveHeads() {
  if (!S.setup.heads) S.setup.heads = {};
  const def = { rowNo:'ر', name:'نام و نام خانوادگی', code:'کد پرسنلی', unit:'واحد', sign:'امضا' };
  S.setup.heads.name  = document.getElementById('psHeadName').value.trim()  || def.name;
  S.setup.heads.code  = document.getElementById('psHeadCode').value.trim()  || def.code;
  S.setup.heads.unit  = document.getElementById('psHeadUnit').value.trim()  || def.unit;
  S.setup.heads.rowNo = document.getElementById('psHeadRowNo').value.trim() || def.rowNo;
  S.setup.heads.sign  = document.getElementById('psHeadSign').value.trim()  || def.sign;
  save();
  if (typeof renderHeads==='function') renderHeads();
  renderPreview();
}

function saveColW() {
  if (!S.setup.colW) S.setup.colW = {};
  const clamp = v => Math.max(3, Math.min(60, +v||0));
  S.setup.colW.rowNo = clamp(document.getElementById('psWRowNo').value) || 8;
  S.setup.colW.code  = clamp(document.getElementById('psWCode').value)  || 16;
  S.setup.colW.unit  = clamp(document.getElementById('psWUnit').value)  || 20;
  S.setup.colW.sign  = clamp(document.getElementById('psWSign').value)  || 15;
  save(); renderPreview();
}

function resetSetup() {
  if (!confirm('تنظیمات صفحه به حالت پیش‌فرض برگردد؟')) return;
  S.setup = {...DEFAULT_SETUP};
  save(); renderSetupControls(); renderPreview();
}

/* ============ تنظیم سریع داخل پیش‌نمایش (مارجین / عرض ستون / اندازه رکورد) ============ */
function qsEl(id){ return document.getElementById(id); }
function renderQuickSetup() {
  const st = S.setup;
  if (!qsEl('qsMT')) return;   // نوار منوی قدیمی حذف شده است
  const _w = { rowNo:8, code:16, unit:20, sign:15, ...(st.colW||{}) };
  qsEl('qsMT').value = st.mt; qsEl('qsMB').value = st.mb;
  qsEl('qsMR').value = st.mr; qsEl('qsML').value = st.ml;
  qsEl('qsWRowNo').value = _w.rowNo; qsEl('qsWCode').value = _w.code;
  qsEl('qsWUnit').value  = _w.unit;  qsEl('qsWSign').value = _w.sign;
  qsEl('qsFontSize').value = st.fontSize;
  qsEl('qsLineH').value = st.lineH;
  qsEl('qsRowH').value = st.rowH != null ? st.rowH : 0;
  qsEl('qsCellPad').value = st.cellPad != null ? st.cellPad : 1;
  qsEl('qsCols').value = String(st.cols);
}
function saveQuick() {
  if (!qsEl('qsMT')) return;
  const st = S.setup;
  const num = (id, def) => { const v = parseFloat(qsEl(id).value); return isNaN(v) ? def : v; };
  const clampW = v => Math.max(3, Math.min(60, v));
  st.mt = Math.max(0, num('qsMT', st.mt));
  st.mb = Math.max(0, num('qsMB', st.mb));
  st.mr = Math.max(0, num('qsMR', st.mr));
  st.ml = Math.max(0, num('qsML', st.ml));
  if (!st.colW) st.colW = {};
  st.colW.rowNo = clampW(num('qsWRowNo', 8));
  st.colW.code  = clampW(num('qsWCode', 16));
  st.colW.unit  = clampW(num('qsWUnit', 20));
  st.colW.sign  = clampW(num('qsWSign', 15));
  st.fontSize = Math.max(6, Math.min(30, num('qsFontSize', st.fontSize)));
  st.lineH    = Math.max(1, Math.min(3,  num('qsLineH', st.lineH)));
  st.rowH     = Math.max(0, Math.min(20, num('qsRowH', 0)));
  st.cellPad  = Math.max(0, Math.min(10, num('qsCellPad', 1)));
  st.cols     = +qsEl('qsCols').value || 0;
  save();
  if (qsEl('psMT')) renderSetupControls();
  renderPreview();
}
function quickMarginAll() {
  if (!qsEl('qsMT')) return;
  const v = parseFloat(qsEl('qsMT').value) || 0;
  ['qsMB','qsMR','qsML'].forEach(id=>qsEl(id).value = v);
  saveQuick();
}
function resetQuick() {
  const st = S.setup;
  ['mt','mb','mr','ml','fontSize','lineH','cols'].forEach(k=> st[k] = DEFAULT_SETUP[k]);
  st.colW = {...DEFAULT_SETUP.colW};
  st.rowH = DEFAULT_SETUP.rowH; st.cellPad = DEFAULT_SETUP.cellPad;
  save();
  renderQuickSetup();
  renderSetupControls();
  renderPreview();
}

/* ============ نوار منوی چاپ (کشویی) ============ */
function toggleMenu(btn, id) {
  const drop = document.getElementById(id);
  if (!drop) return;
  const wasOpen = drop.classList.contains('open');
  closeAllMenus();
  if (!wasOpen) {
    drop.classList.add('open');
    btn.classList.add('active');
  }
}
function closeAllMenus() {
  document.querySelectorAll('.menu-drop.open').forEach(d=>d.classList.remove('open'));
  document.querySelectorAll('.menu-btn.active').forEach(b=>b.classList.remove('active'));
}
/* بستن منو با کلیک بیرون یا Escape */
document.addEventListener('click', e=>{
  if (!e.target.closest || !e.target.closest('.menu-item')) closeAllMenus();
});
document.addEventListener('keydown', e=>{ if (e.key === 'Escape') closeAllMenus(); });


/* ============ ناوبری بخش‌های تنظیمات صفحه ============ */
function psGo(secId, btn) {
  document.querySelectorAll('#tab-pagesetup .ps-sec').forEach(x => x.classList.toggle('show', x.id === secId));
  document.querySelectorAll('#tab-pagesetup .ps-nav-btn').forEach(b => b.classList.toggle('active', b === btn));
}

/* ============ یکسان کردن حاشیه‌ها ============ */
function marginAll() {
  const v = parseFloat(document.getElementById('psMT').value) || 0;
  ['psMT','psMB','psMR','psML'].forEach(id => { const e = document.getElementById(id); if (e) e.value = v; });
  saveSetup();
}
