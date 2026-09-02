/* ================= داده و ذخیره‌سازی ================= */
const LS_KEY = 'foodStatApp_v1';
const uid = () => Math.random().toString(36).slice(2, 10);

const DEFAULT_SETUP = {
  paper: 'A4P', customW: 80, customH: 0,
  mt: 10, mb: 10, mr: 8, ml: 8,
  font: 'Vazirmatn, Tahoma, sans-serif', fontSize: 11, lineH: 1.5, bold: false,
  layout: 'units',
  heads: { rowNo:'ر', name:'نام و نام خانوادگی', code:'کد پرسنلی', unit:'واحد', sign:'امضا' },
  colW: { rowNo:8, code:16, unit:20, sign:15 },
  rowH: 0, cellPad: 1,
  cols: 0, showCode: true, showRowNo: true, showSign: false,
  showAbsent: true, showSummary: true, noFill: false, unitNewPage: false,
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
      return;
    }
  } catch(e){}
  S = seedData();
  save();
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
  // اول مقادیر فرم‌های باز را بخوان (تنظیمات صفحه و آمار روز)
  try { if (typeof saveSetup === 'function' && document.getElementById('psPaper')) saveSetup(); } catch(e){}
  try { if (typeof saveSheet === 'function' && document.getElementById('sheetDate')) saveSheet(); } catch(e){}
  localStorage.setItem(LS_KEY, JSON.stringify(S));
  // راستی‌آزمایی: دوباره بخوان و مقایسه کن
  let ok = false;
  try { ok = localStorage.getItem(LS_KEY) === JSON.stringify(S); } catch(e){}
  if (ok) {
    toast('💾 همه تغییرات ذخیره شد ✅ (تنظیمات چاپ، پرسنل، منو و آمار)');
  } else {
    toast('⚠️ خطا در ذخیره‌سازی! فضای مرورگر را بررسی کنید');
  }
  save();
}
