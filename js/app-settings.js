/* تنظیمات ظاهر همراه داده‌های برنامه ذخیره و در بازیابی پشتیبان اعمال می‌شود. */
const APP_THEMES = ['green', 'blue', 'purple', 'amber'];
function currentAppearance() {
  const value = (S.setup && S.setup.appearance) || {};
  return { theme: APP_THEMES.includes(value.theme) ? value.theme : 'green', glass: value.glass === true };
}
function applyAppAppearance() {
  const appearance = currentAppearance();
  document.documentElement.dataset.appTheme = appearance.theme;
  document.body.classList.toggle('glass-buttons', appearance.glass);
}
function openAppSettings() {
  const appearance = currentAppearance();
  document.querySelectorAll('input[name="appTheme"]').forEach(r => { r.checked = r.value === appearance.theme; });
  document.getElementById('glassButtons').checked = appearance.glass;
  const panel = document.getElementById('appSettings');
  panel.hidden = false;
  panel.querySelector('input:checked').focus();
}
function closeAppSettings() {
  const panel = document.getElementById('appSettings');
  if (panel) panel.hidden = true;
}
function saveAppSettings() {
  const selected = document.querySelector('input[name="appTheme"]:checked');
  const theme = selected && APP_THEMES.includes(selected.value) ? selected.value : 'green';
  const previous = S.setup.appearance;
  S.setup.appearance = { theme, glass: document.getElementById('glassButtons').checked };
  try {
    save();
  } catch (e) {
    if (previous === undefined) delete S.setup.appearance; else S.setup.appearance = previous;
    toast('❌ ذخیره تنظیمات انجام نشد؛ فضای ذخیره‌سازی را بررسی کنید');
    return;
  }
  applyAppAppearance();
  closeAppSettings();
  toast('✅ تنظیمات ظاهر ذخیره و اعمال شد');
}
