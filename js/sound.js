/* =================================================================
   آوای تأیید برنامه
   صداها با WebAudio ساخته می‌شوند — هیچ فایل صوتی لازم نیست،
   پس برنامه کاملاً آفلاین و پرتابل باقی می‌ماند.
================================================================= */

const SND_KEY = 'foodStatApp_sound';

/* تنظیمات صدا جدا از داده‌های برنامه ذخیره می‌شود تا بازیابی
   پشتیبان یا پاک شدن آمار، سلیقه صوتی کاربر را عوض نکند. */
let SND = { on: true, vol: 0.5 };
try {
  const raw = localStorage.getItem(SND_KEY);
  if (raw) SND = { ...SND, ...JSON.parse(raw) };
} catch (e) {}

function saveSnd() {
  try { localStorage.setItem(SND_KEY, JSON.stringify(SND)); } catch (e) {}
}

let _actx = null;
function audioCtx() {
  if (_actx) return _actx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  try { _actx = new AC(); } catch (e) { return null; }
  return _actx;
}

/* یک نت ساده با محو شدن نرم (بدون تق‌وتوق) */
function playTone(freq, startAt, dur, peak, type) {
  const ctx = audioCtx(); if (!ctx) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type || 'sine';
  osc.frequency.setValueAtTime(freq, startAt);

  const v = Math.max(0.0001, peak * (SND.vol == null ? 0.5 : SND.vol));
  gain.gain.setValueAtTime(0.0001, startAt);
  gain.gain.exponentialRampToValueAtTime(v, startAt + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + dur);

  osc.connect(gain); gain.connect(ctx.destination);
  osc.start(startAt); osc.stop(startAt + dur + 0.02);
}

/* نواختن یک آوا: آرایه‌ای از [بسامد، زمان شروع، طول، بلندی] */
function playSeq(notes, type) {
  if (!SND.on) return;
  const ctx = audioCtx(); if (!ctx) return;
  // مرورگرها تا اولین کلیک کاربر صدا را قفل می‌کنند
  if (ctx.state === 'suspended') { try { ctx.resume(); } catch (e) {} }
  const t0 = ctx.currentTime + 0.01;
  notes.forEach(n => playTone(n[0], t0 + n[1], n[2], n[3], type));
}

/* ---------- آواهای برنامه ---------- */

/* تأیید: دو نت بالارونده (دو → سل) */
function sndOk() {
  playSeq([[660, 0, 0.10, 0.28], [880, 0.09, 0.16, 0.24]]);
}
/* ذخیره موفق: سه نت کوتاه و شاد */
function sndSave() {
  playSeq([[587, 0, 0.08, 0.24], [784, 0.075, 0.08, 0.24], [1047, 0.15, 0.20, 0.22]]);
}
/* چاپ: یک نت گرم و کوتاه */
function sndPrint() {
  playSeq([[520, 0, 0.09, 0.22], [700, 0.08, 0.18, 0.20]]);
}
/* هشدار یا خطا: دو نت پایین‌رونده */
function sndErr() {
  playSeq([[400, 0, 0.13, 0.26], [300, 0.12, 0.24, 0.24], ], 'triangle');
}
/* کلیک ریز برای غایب زدن */
function sndTick() {
  playSeq([[900, 0, 0.045, 0.16]]);
}

/* تشخیص خودکار نوع آوا از روی متن پیام */
function sndForMessage(msg) {
  const m = String(msg || '');
  if (/⚠️|❌|خطا|نشد|نامعتبر|پر است/.test(m)) return sndErr;
  if (/💾|ذخیره/.test(m)) return sndSave;
  if (/🖨️|چاپ/.test(m)) return sndPrint;
  return sndOk;
}

/* ---------- کنترل از نوار بالا ---------- */
function toggleSound() {
  SND.on = !SND.on;
  saveSnd();
  renderSoundBtn();
  if (SND.on) sndOk();               // نمونه صدا هنگام روشن کردن
  if (typeof toast === 'function') {
    toast(SND.on ? '🔊 آوای تأیید روشن شد' : '🔇 آوای تأیید خاموش شد');
  }
}

function setSoundVol(v) {
  SND.vol = Math.max(0, Math.min(1, parseFloat(v) || 0));
  saveSnd();
  renderSoundBtn();
  sndOk();                            // تا کاربر بلندی جدید را بشنود
}

function renderSoundBtn() {
  const b = document.getElementById('soundBtn');
  if (b) {
    b.textContent = SND.on ? '🔊' : '🔇';
    b.title = SND.on
      ? 'آوای تأیید روشن است — برای خاموش کردن کلیک کنید'
      : 'آوای تأیید خاموش است — برای روشن کردن کلیک کنید';
    b.classList.toggle('off', !SND.on);
  }
  const s = document.getElementById('soundVol');
  if (s) s.value = SND.vol == null ? 0.5 : SND.vol;
}
