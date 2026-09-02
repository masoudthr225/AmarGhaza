/* ================= شروع ================= */
function renderAll() {
  renderSheetControls(); renderUnitChecks(); renderAttendance();
  renderUnits(); renderPeople(); renderMeals(); renderFoods();
  if (typeof renderHeads==='function') renderHeads();
  renderSetupControls(); renderPreview();
}
load();
renderAll();
window.addEventListener('keydown', e=>{
  if ((e.ctrlKey||e.metaKey) && e.key==='p') { e.preventDefault(); openPrintDialog(); }
  if ((e.ctrlKey||e.metaKey) && e.key==='s') { e.preventDefault(); saveNow(); }
  if (e.key==='Escape') closePersonModal();
});
