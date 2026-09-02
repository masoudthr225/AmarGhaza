/* ================= شروع ================= */
function renderAll() {
  renderSheetControls(); renderUnitChecks(); renderAttendance();
  renderUnits(); renderPeople(); renderMeals(); renderFoods();
  if (typeof renderHeads==='function') renderHeads();
  renderSetupControls();
  if (typeof renderQuickSetup==='function') renderQuickSetup();
  if (typeof renderHolidays==='function') renderHolidays();
  if (typeof renderHolidayBadge==='function') renderHolidayBadge();
  renderPreview();
}
load();
renderAll();
window.addEventListener('keydown', e=>{
  if ((e.ctrlKey||e.metaKey) && e.key==='p') { e.preventDefault(); openPrintDialog(); }
  if ((e.ctrlKey||e.metaKey) && e.key==='s') { e.preventDefault(); saveNow(); }
  if (e.key==='Escape') closePersonModal();
});
