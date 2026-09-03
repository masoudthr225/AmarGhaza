/* ================= شروع ================= */
function renderAll() {
  renderSheetControls(); renderUnitChecks(); renderAttendance();
  renderUnits(); renderPeople(); renderMeals(); renderFoods();
  if (typeof renderHeads==='function') renderHeads();
  renderSetupControls();
  if (typeof renderQuickSetup==='function') renderQuickSetup();
  if (typeof renderPickInfo==='function') renderPickInfo();
  renderPreview();
}
load();
renderAll();
window.addEventListener('keydown', e=>{
  if ((e.ctrlKey||e.metaKey) && e.key==='p') { e.preventDefault(); openPrintDialog(); }
  if ((e.ctrlKey||e.metaKey) && e.key==='s') { e.preventDefault(); saveNow(); }
  if (e.key==='Escape') closePersonModal();
});

/* ---------- کلید Enter مانند Tab عمل کند (رفتن به فیلد بعدی) ---------- */
window.addEventListener('keydown', e => {
  if (e.key !== 'Enter' || e.shiftKey || e.ctrlKey || e.metaKey || e.altKey) return;
  const el = e.target;
  if (!el || !el.tagName) return;
  const tag = el.tagName.toLowerCase();

  // در متن چندخطی و دکمه‌ها، Enter باید کار همیشگی خودش را بکند
  if (tag === 'textarea' || tag === 'button' || tag === 'a') return;
  if (el.isContentEditable) return;   // سلول‌های ویرایش‌شونده هندلر خودشان را دارند

  const isField = (tag === 'input' || tag === 'select');
  if (!isField) return;
  if (el.type === 'checkbox' || el.type === 'radio' || el.type === 'submit') return;

  e.preventDefault();
  el.blur();          // ابتدا تغییر ذخیره شود (رویداد change)

  // فهرست فیلدهای قابل تمرکز، به ترتیب ظاهر در صفحه
  const all = Array.from(document.querySelectorAll(
    'input, select, textarea, [contenteditable="true"], button'
  )).filter(x => !x.disabled && x.type !== 'hidden' && x.offsetParent !== null);

  const i = all.indexOf(el);
  if (i > -1 && i + 1 < all.length) {
    const nxt = all[i + 1];
    nxt.focus();
    if (nxt.select) { try { nxt.select(); } catch (_) {} }
  }
});
