/* ================= داده و ذخیره‌سازی ================= */
const LS_KEY = 'foodStatApp_v1';
const uid = () => Math.random().toString(36).slice(2, 10);

const DEFAULT_SETUP = {
  paper: 'T58', customW: 80, customH: 0,
  mt: 3, mb: 3, mr: 2, ml: 2,
  font: 'Vazirmatn, Tahoma, sans-serif', fontSize: 9, lineH: 1.3, bold: true,
  layout: 'units',
  heads: { rowNo:'ر', name:'نام و نام خانوادگی', code:'کد پرسنلی', unit:'واحد', sign:'امضا' },
  colW: { rowNo:8, code:16, unit:20, sign:15 },
  rowH: 0, cellPad: 1,
  alignHeader: 'center', alignPage: 'center',
  /* چیدمان هر ستون: بدنه (align) و سرستون (halign) جداگانه */
  colAlign:  { rowNo:'center', name:'right',  code:'center', unit:'center', sign:'center' },
  colHAlign: { rowNo:'center', name:'center', code:'center', unit:'center', sign:'center' },
  headRowH: 0, headBold: true, extraRowH: 0,
  /* --- برگرفته از پروژه Page Setup Pro --- */
  orient: 'portrait',                 // جهت کاغذ
  italic: false, underline: false,    // سبک قلم
  fontColor: '#000000',
  borderStyle: 'solid', borderColor: '#000000', borderWidth: 0.5,
  headBg: '', zebra: false,           // پس‌زمینه عنوان و ردیف‌های یک‌درمیان
  indent: 0,                          // تورفتگی متن نام (mm)
  sortKey: 'code', sortDir: 1,        // مرتب‌سازی پیش‌فرض: کد پرسنلی از کم به زیاد
  unitTitleAlign: 'center',           // چیدمان نوار «واحد: …»
  unitTitleSize: 1,                   // بزرگی نوار واحد (برابر قلم)
  /* --- سلول منوی غذا در چاپ --- */
  foodSize: 1.3,                      // بزرگی قلم نام غذا (برابر قلم سند)
  foodH: 0,                           // ارتفاع سلول (mm) — ۰ یعنی خودکار
  foodP: 1,                           // فاصله داخلی (mm)
  foodAlign: 'center',                // چیدمان متن
  foodBold: true, foodItalic: false, foodUnderline: false,
  foodBorder: true,                   // نمایش کادر دور سلول
  foodBg: '', foodColor: '',          // رنگ پس‌زمینه و رنگ متن
  foodPrefix: '**', foodSuffix: '**', // متن دو طرف نام غذا
  foodLabel: '',                      // برچسب پیش از نام غذا مثل «منوی امروز:»
  foodPerUnit: true,                  // منوی غذا برای هر واحد جداگانه چاپ شود
  datePerUnit: true,                  // تاریخ زیر عنوان هر واحد چاپ شود
  /* اندازه مستقل هر ستون: ارتفاع سطر و فاصله داخلی (mm) */
  cellH: { rowNo:0, name:0, code:0, unit:0, sign:0 },
  cellP: { rowNo:0, name:0, code:0, unit:0, sign:0 },
  cellFS: { rowNo:0, name:0, code:0, unit:0, sign:0 },
  /* --- ویرایش قالب فرم اکسل --- */
  xls: {
    dateLabel: '', unitLabel: '',      // پیشوند خانه تاریخ و واحد
    foodPrefix: '**', foodSuffix: '**',
    dateW: 45, foodScale: 1.7,         // عرض خانه تاریخ ٪ و بزرگی نام غذا
    noW: 11, codeW: 16,                // عرض ستون شماره و کد ٪
    twoBlocks: true,                   // دو ستونه بودن اسامی
    showExtras: true, extraLabelW: 60,
  },
  /* اقلام زیر جدول: خوراک / حاضری / 50% / تخم مرغ */
  extraAlignLabel: 'center', extraAlignQty: 'center',
  extraWidth: 100, extraQtyW: 40, extraAlignPage: 'center', extraBold: true,
  cols: 1, showCode: true, showRowNo: true, showSign: false,
  showAbsent: true, showSummary: true, noFill: false, unitNewPage: false,
  /* --- جداکننده بین واحدها در چاپ --- */
  unitSep: true,                      // نمایش خط جداکننده بین دو واحد
  unitSepStyle: 'dashed',             // dashed | dotted | solid | double
  unitSepWidth: 0.4,                  // ضخامت (mm)
  unitSepColor: '#000000',
  unitSepGap: 4,                      // فاصله بالا و پایین خط (mm)
  rollCut: true,                      // پرینتر حرارتی: هر واحد جدا (برش بین واحدها)
  rollCutH: 200,                      // طول هر برش روی رول (mm) — کاغذ رول ارتفاع ثابت ندارد
  headerOn: true, headerTitle: 'آمار غذای پرسنل', headerSub: '',
  headerDate: true, headerMeal: true,
  footerOn: true, footerText: '', footerSign: true, footerTime: false,
};

function seedData() {
  const uCNC = uid(), uAB = uid();
  const cnc = [["احمدرضا صمدی",1325],["جواد اسفندپور",1421],["مسعود طاهری",1313],["محمد رضا امیری",1570],["محسن قمشه ای",1256],["محسن آغاسیان",1294],["محسن کاظمی",1431],["پرویز بابایی",1005],["محمد کیانی",1535],["مقصود برهمن",1450],["علیرضا محرابی",1332],["امیر محمد ترکان",1564],["محمود محمدی",1568],["حامد جعفری",1424],["احسان مهرابی",1139],["غلامحسین خاشعی",1428],["محمدعلی نامدار",1381],["نوید خرم",5012],["محمد نبی",1377],["حسین خطیبی",1478],["رسول نبی",1376],["احسان خواجه",1433],["ایمان نخکوب",1513],["حامد رضائی",1092],["حسین نوروزی",1460],["محمد سعادت نیا",1369],["ابراهیم یزدانی",1045],["سهیل شفیعی",1622],["محمد صابری",1409],["مسعود صالحی",1555]];
  const ab = [["مجید قدیرزاده",1372],["علی حق شناس",1288]];
  const foods = ["ماکارونی","کشک و بادمجان","چلو مرغ","خوراک کوکو سبزی","الویه","پلو عدس","خوراک لوبیا","خورشت سبزی","پلو شوید تن ماهی","ساندویچ مرغ","پلو ماش با خرما","حلیم بادمجان","خورشت قیمه","پلو هویج","جوجه کباب","پلو لوبیا چشم بلبلی","بندری","کوبیده مرغ","استامبولی","پلو مرغ مخلوط"];
  return {
    units: [{id:uCNC,name:'CNC و تراش'},{id:uAB,name:'آبکاری'}],
    people: [
      ...cnc.map(([n,c])=>({id:uid(),name:n,code:String(c),unitId:uCNC})),
      ...ab.map(([n,c])=>({id:uid(),name:n,code:String(c),unitId:uAB})),
    ],
    meals: [{id:uid(),name:'ناهار'},{id:uid(),name:'عصرانه'},{id:uid(),name:'شام'}],
    foods: foods.map(f=>({id:uid(),name:f})),
    sheet: { date: todayJalali(), mealId:'', foodId:'', note:'', unitIds:[uCNC,uAB], absent:{} },
    setup: {...DEFAULT_SETUP},
  };
}

function todayJalali() {
  try {
    const f = new Intl.DateTimeFormat('fa-IR-u-nu-latn', {year:'numeric',month:'2-digit',day:'2-digit'});
    const p = f.formatToParts(new Date());
    const g = t => p.find(x=>x.type===t).value;
    return `${g('year')}/${g('month')}/${g('day')}`;
  } catch(e) { return new Date().toLocaleDateString('fa-IR'); }
}

let S; // state
function load() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) {
      S = JSON.parse(raw);
      S.setup = {...DEFAULT_SETUP, ...S.setup};
      // سازگاری با نسخه‌های قدیمی‌تر: نبود هر یک از لیست‌ها برنامه را خراب نکند
      const seed = seedData();
      ['units','people','meals','foods'].forEach(k=>{ if (!Array.isArray(S[k])) S[k] = seed[k]; });
      if (!S.sheet) S.sheet = seed.sheet;
      if (!S.foods.length) S.foods = seed.foods;
      migrateExtras();
      migrateDefaults();
      migrateAlign();
      migrateRollFit();
      migrateSortCode();
      return;
    }
  } catch(e){}
  S = seedData();
  S.__extrasV2 = true;
  S.__defaultsV3 = true;   // پیش‌فرض‌ها از قبل اعمال‌اند؛ مهاجرت نباید بعداً تنظیمات کاربر را بازنویسی کند
  S.__rollFitV1 = true;
  S.__sortCodeV1 = true;
  save();
}
/* یک‌بار: انتقال چیدمان‌های تکی قدیمی به مدل جدید colAlign */
function migrateAlign() {
  const st = S.setup; if (!st) return;
  if (!st.colAlign)  st.colAlign  = { rowNo:'center', name:'right',  code:'center', unit:'center', sign:'center' };
  if (!st.colHAlign) st.colHAlign = { rowNo:'center', name:'center', code:'center', unit:'center', sign:'center' };
  if (st.alignName)  { st.colAlign.name  = st.alignName;  delete st.alignName; }
  if (st.alignRowNo) { st.colAlign.rowNo = st.alignRowNo; delete st.alignRowNo; }
  if (st.alignCode)  { st.colAlign.code  = st.alignCode;  delete st.alignCode; }
  if (st.extraAlignLabel == null) st.extraAlignLabel = 'center';
  if (st.extraAlignQty   == null) st.extraAlignQty   = 'center';
  if (st.extraWidth      == null) st.extraWidth      = 100;
  if (st.extraQtyW       == null) st.extraQtyW       = 40;
  if (st.extraAlignPage  == null) st.extraAlignPage  = 'center';
  if (st.extraBold       == null) st.extraBold       = true;
  if (st.orient      == null) st.orient      = 'portrait';
  if (st.italic      == null) st.italic      = false;
  if (st.underline   == null) st.underline   = false;
  if (st.fontColor   == null) st.fontColor   = '#000000';
  if (st.borderStyle == null) st.borderStyle = 'solid';
  if (st.borderColor == null) st.borderColor = '#000000';
  if (st.borderWidth == null) st.borderWidth = 0.5;
  if (st.headBg      == null) st.headBg      = '';
  if (st.zebra       == null) st.zebra       = false;
  if (st.indent         == null) st.indent         = 0;
  if (st.sortKey        == null) st.sortKey        = 'code';
  if (st.sortDir        == null) st.sortDir        = 1;
  if (st.unitTitleAlign == null) st.unitTitleAlign = 'center';
  if (st.unitTitleSize  == null) st.unitTitleSize  = 1;
  /* سلول منوی غذا */
  if (st.foodSize      == null) st.foodSize      = 1.3;
  if (st.foodH         == null) st.foodH         = 0;
  if (st.foodP         == null) st.foodP         = 1;
  if (st.foodAlign     == null) st.foodAlign     = 'center';
  if (st.foodBold      == null) st.foodBold      = true;
  if (st.foodItalic    == null) st.foodItalic    = false;
  if (st.foodUnderline == null) st.foodUnderline = false;
  if (st.foodBorder    == null) st.foodBorder    = true;
  if (st.foodBg        == null) st.foodBg        = '';
  if (st.foodColor     == null) st.foodColor     = '';
  if (st.foodPrefix    == null) st.foodPrefix    = '**';
  if (st.foodSuffix    == null) st.foodSuffix    = '**';
  if (st.foodLabel     == null) st.foodLabel     = '';
  if (st.foodPerUnit   == null) st.foodPerUnit   = true;
  if (st.datePerUnit   == null) st.datePerUnit   = true;
  /* جداکننده واحدها و برش رول */
  if (st.unitSep       == null) st.unitSep       = true;
  if (st.unitSepStyle  == null) st.unitSepStyle  = 'dashed';
  if (st.unitSepWidth  == null) st.unitSepWidth  = 0.4;
  if (st.unitSepColor  == null) st.unitSepColor  = '#000000';
  if (st.unitSepGap    == null) st.unitSepGap    = 4;
  if (st.rollCut       == null) st.rollCut       = true;
  if (st.rollCutH      == null) st.rollCutH      = 200;
  const zc = { rowNo:0, name:0, code:0, unit:0, sign:0 };
  if (!st.cellH)  st.cellH  = { ...zc };
  if (!st.cellP)  st.cellP  = { ...zc };
  if (!st.cellFS) st.cellFS = { ...zc };
  if (!st.xls) st.xls = {};
  const dx = { dateLabel:'', unitLabel:'', foodPrefix:'**', foodSuffix:'**',
               dateW:45, foodScale:1.7, noW:11, codeW:16, twoBlocks:true,
               showExtras:true, extraLabelW:60 };
  Object.keys(dx).forEach(k => { if (st.xls[k] == null) st.xls[k] = dx[k]; });
  if (st.headRowH == null)  st.headRowH = 0;
  if (st.extraRowH == null) st.extraRowH = 0;
  if (st.headBold == null)  st.headBold = true;
}

/* یک‌بار: پیش‌فرض‌های جدید (پرینتر حرارتی ۵۸، جدول جدا برای هر واحد، ۲ ستون) */
function migrateDefaults() {
  if (S.__defaultsV3) return;
  S.setup = S.setup || {};
  if (S.setup.paper  == null) S.setup.paper  = 'T58';
  if (S.setup.layout == null) S.setup.layout = 'units';
  if (S.setup.cols   == null) S.setup.cols   = 1;
  S.__defaultsV3 = true;
  save();
}

/* یک‌بار: اصلاح حاشیه/ستون ناسازگار با کاغذ رول باریک
   (حاشیه ۸ میلی‌متری A4 روی رول ۵۸ حدود ۳۰٪ عرض را می‌خورد و اسامی محو می‌شوند) */
function migrateRollFit() {
  if (S.__rollFitV1) return;
  const st = S.setup;
  if (st && (st.paper === 'T58' || st.paper === 'T80')) {
    if ((+st.mr || 0) > 4) st.mr = 2;
    if ((+st.ml || 0) > 4) st.ml = 2;
    if ((+st.mt || 0) > 6) st.mt = 3;
    if ((+st.mb || 0) > 6) st.mb = 3;
    const usable = (st.paper === 'T58' ? 58 : 80) - (+st.mr || 0) - (+st.ml || 0);
    if (usable < 70 && (+st.cols || 0) > 1) st.cols = 1;
  }
  S.__rollFitV1 = true;
  save();
}

/* یک‌بار: مرتب‌سازی پیش‌فرض جدول پرسنل روی «کد پرسنلی، از کم به زیاد».
   فقط نصب‌هایی که هنوز روی مرتب‌سازی پیش‌فرض قدیمی (نام) مانده‌اند تغییر
   می‌کنند؛ اگر کاربر خودش ستون دیگری را انتخاب کرده باشد دست‌نخورده می‌ماند. */
function migrateSortCode() {
  if (S.__sortCodeV1) return;
  const st = S.setup;
  if (st && st.sortKey === 'name' && (st.sortDir === 1 || st.sortDir == null)) {
    st.sortKey = 'code';
    st.sortDir = 1;
  }
  S.__sortCodeV1 = true;
  save();
}

/* اقلام زیر جدول: ردیف «50%» جدا شود و مقدار «تخم مرغ» خالی بماند */
function migrateExtras() {
  if (S.__extrasV2) return;
  const ex = S.sheet && S.sheet.extras;
  if (ex) {
    Object.keys(ex).forEach(uId => {
      const list = ex[uId];
      if (!Array.isArray(list)) return;
      const egg = list.find(x => String(x.label).trim() === 'تخم مرغ');
      if (egg && String(egg.qty).trim() === '50%') egg.qty = '';
      if (!list.some(x => String(x.label).trim() === '50%')) {
        const i = list.indexOf(egg);
        const row = { id: uid(), label: '50%', qty: '' };
        if (i >= 0) list.splice(i, 0, row); else list.push(row);
      }
    });
  }
  S.__extrasV2 = true;
}

function save() {
  localStorage.setItem(LS_KEY, JSON.stringify(S));
  const el = document.getElementById('saveStatus');
  if (el) {
    const t = new Date().toLocaleTimeString('fa-IR', {hour:'2-digit',minute:'2-digit',second:'2-digit'});
    el.textContent = `✅ ذخیره شد — ${t} (${S.people.length} پرسنل، ${S.units.length} واحد، ${S.foods.length} غذا)`;
  }
}

function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.style.display = 'block';
  clearTimeout(t._tm); t._tm = setTimeout(()=>t.style.display='none', 2200);
}

/* ذخیره صریح با تأیید — دکمه «ذخیره تغییرات» */
function saveNow() {
  /* ۱) خانه‌ای که همین حالا در حال ویرایش است را نهایی کن.
        سلول‌های contenteditable فقط با blur ذخیره می‌شوند، پس اگر کاربر
        وسط تایپ دکمه ذخیره را بزند بدون این مرحله تغییرش از دست می‌رفت. */
  try {
    const a = document.activeElement;
    if (a && a !== document.body) {
      const tag = (a.tagName || '').toLowerCase();
      if (a.isContentEditable || tag === 'input' || tag === 'select' || tag === 'textarea') {
        a.blur();   // رویدادهای change/blur شلیک و مقدار ثبت می‌شود
      }
    }
  } catch (e) {}

  /* ۲) مقادیر همه فرم‌های باز را بخوان — حتی تب‌هایی که الان دیده نمی‌شوند */
  try { if (typeof saveSetup === 'function' && document.getElementById('psPaper')) saveSetup(); } catch(e){}
  try { if (typeof saveSheet === 'function' && document.getElementById('sheetDate')) saveSheet(); } catch(e){}
  try { if (typeof saveHeads === 'function') saveHeads(); } catch(e){}
  try { if (typeof saveColW  === 'function') saveColW();  } catch(e){}

  /* ۳) ذخیره و راستی‌آزمایی */
  let ok = false, err = '';
  try {
    const json = JSON.stringify(S);
    localStorage.setItem(LS_KEY, json);
    ok = localStorage.getItem(LS_KEY) === json;   // دوباره بخوان و مقایسه کن
  } catch (e) {
    err = (e && e.name === 'QuotaExceededError') ? 'فضای ذخیره‌سازی مرورگر پر است' : 'خطای مرورگر';
  }

  if (ok) {
    const n = (S.people || []).length, u = (S.units || []).length;
    toast(`💾 همه تغییرات ذخیره شد ✅ — ${n} نفر، ${u} واحد، تنظیمات چاپ، منو و آمار روز`);
  } else {
    toast('⚠️ ذخیره نشد! ' + (err || 'فضای مرورگر را بررسی کنید') +
          ' — از دکمه «پشتیبان‌گیری» فایل JSON بگیرید.');
  }

  /* ۴) صفحه را با مقادیر ذخیره‌شده تازه کن تا کاربر نتیجه را ببیند */
  try { if (typeof renderPreview === 'function') renderPreview(); } catch(e){}
  return ok;
}
