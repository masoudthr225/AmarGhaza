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
