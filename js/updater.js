/* ================= به‌روزرسانی برنامه =================
   manifest.js شامل نسخه برنامه و اثرانگشت (هش) هر فایل است.
   - هر فایل با ?v=هش بارگیری می‌شود؛ اگر فایلی عوض شود هشش عوض می‌شود
     و مرورگر فقط همان فایل را دوباره دانلود می‌کند. بقیه از کش می‌آیند.
   - دکمه «بررسی به‌روزرسانی» manifest تازه را از سرور می‌گیرد و اگر
     نسخه یا فایل‌ها فرق داشته باشند، با یک کلیک فقط فایل‌های جدید
     جایگزین می‌شوند (اطلاعات شما دست‌نخورده می‌ماند).           */

function appVersion() {
  return (window.APP_MANIFEST && window.APP_MANIFEST.version) || '?';
}

function renderVersionBadge() {
  var el = document.getElementById('appVersion');
  if (el) el.textContent = 'نسخه ' + appVersion();
}

function checkForUpdate(silent) {
  // manifest تازه را بدون کش بگیر
  fetch('js/manifest.js?nocache=' + Date.now(), { cache: 'no-store' })
    .then(function (r) { if (!r.ok) throw 0; return r.text(); })
    .then(function (txt) {
      var m = txt.match(/window\.APP_MANIFEST\s*=\s*(\{[\s\S]*\});/);
      if (!m) throw 0;
      var fresh = JSON.parse(m[1]);
      var cur = window.APP_MANIFEST || { version: '?', files: {} };

      // کدام فایل‌ها عوض شده‌اند؟
      var changed = [];
      Object.keys(fresh.files || {}).forEach(function (f) {
        if (cur.files[f] !== fresh.files[f]) changed.push(f);
      });

      if (!changed.length && fresh.version === cur.version) {
        if (!silent) toast('✅ برنامه به‌روز است (نسخه ' + cur.version + ')');
        return;
      }

      // به‌روزرسانی موجود است
      var msg = 'نسخه جدید ' + fresh.version + ' موجود است.\n' +
                'فایل‌های تغییرکرده (' + changed.length + '):\n' +
                changed.map(function (f) { return ' • ' + f; }).join('\n') +
                '\n\nفقط همین فایل‌ها جایگزین می‌شوند و اطلاعات شما (پرسنل، منو، تنظیمات) دست‌نخورده می‌ماند.\nبه‌روزرسانی انجام شود؟';
      if (!confirm(msg)) return;

      // فایل‌های تغییرکرده را با هش جدید pre-fetch کن تا در کش بنشینند
      Promise.all(changed.map(function (f) {
        return fetch(f + '?v=' + fresh.files[f], { cache: 'reload' });
      })).then(function () {
        toast('⬇️ فایل‌های جدید دریافت شد — بارگذاری مجدد...');
        setTimeout(function () { location.reload(); }, 800);
      }).catch(function () {
        toast('خطا در دریافت فایل‌های جدید ❌');
      });
    })
    .catch(function () {
      if (!silent) toast('بررسی به‌روزرسانی ممکن نیست (آفلاین؟) ❌');
    });
}

// بررسی بی‌صدا هنگام شروع (اگر آنلاین باشد)
window.addEventListener('load', function () {
  renderVersionBadge();
  if (location.protocol !== 'file:') {
    setTimeout(function () { checkForUpdate(true); }, 2500);
  }
});
