/* ================= اکسل: دانلود و آپلود ================= */
function exportExcel() {
  try {
    const wb = XLSX.utils.book_new();

    // شیت ۱: پرسنل
    const pplRows = [['نام','نام خانوادگی','کد پرسنلی','واحد']];
    sortPeople(S.people).forEach(p=>{
      const u = S.units.find(x=>x.id===p.unitId);
      pplRows.push([p.name, familyLabel(p), p.code||'', u?u.name:'']);
    });
    const wsP = XLSX.utils.aoa_to_sheet(pplRows);
    wsP['!cols'] = [{wch:26},{wch:20},{wch:12},{wch:18}];
    XLSX.utils.book_append_sheet(wb, wsP, 'پرسنل');

    // شیت ۲: آمار امروز (با وضعیت حضور)
    const meal = S.meals.find(m=>m.id===S.sheet.mealId);
    const food = S.foods.find(f=>f.id===S.sheet.foodId);
    const stRows = [
      ['تاریخ', S.sheet.date||'', 'وعده', meal?meal.name:'', 'غذا', food?food.name:''],
      [],
      ['ردیف','نام','نام خانوادگی','کد پرسنلی','واحد','وضعیت'],
    ];
    let i=0, tot=0, abs=0;
    selectedUnits().forEach(u=>{
      unitPeople(u.id).forEach(p=>{
        const a = !!S.sheet.absent[p.id];
        tot++; if(a) abs++;
        stRows.push([++i, p.name, familyLabel(p), p.code||'', u.name, a?'مرخصی':'حاضر']);
      });
    });
    stRows.push([]);
    stRows.push(['کل', tot, 'حاضر (پرس)', tot-abs, 'مرخصی', abs]);
    if (S.sheet.note) stRows.push(['توضیحات', S.sheet.note]);
    const wsS = XLSX.utils.aoa_to_sheet(stRows);
    wsS['!cols'] = [{wch:6},{wch:26},{wch:20},{wch:12},{wch:18},{wch:10}];
    XLSX.utils.book_append_sheet(wb, wsS, 'آمار امروز');

    // شیت ۳: منو
    const menuRows = [['وعده‌ها','','منوی غذا']];
    const n = Math.max(S.meals.length, S.foods.length);
    for(let k=0;k<n;k++) menuRows.push([S.meals[k]?S.meals[k].name:'', '', S.foods[k]?S.foods[k].name:'']);
    const wsM = XLSX.utils.aoa_to_sheet(menuRows);
    wsM['!cols'] = [{wch:14},{wch:3},{wch:24}];
    XLSX.utils.book_append_sheet(wb, wsM, 'منو');

    // RTL برای همه شیت‌ها
    wb.Workbook = { Views: [{RTL:true}] };

    const dateStr = (S.sheet.date||'').replace(/\//g,'-') || 'export';
    XLSX.writeFile(wb, `amar-ghaza-${dateStr}.xlsx`);
    toast('فایل اکسل دانلود شد 📥');
  } catch(e) {
    console.error(e); toast('خطا در ساخت فایل اکسل ❌');
  }
}

function downloadExcelTemplate() {
  const wb = XLSX.utils.book_new();
  /* قالب پیشنهادی: نام و نام خانوادگی جدا هستند تا سورت دقیق باشد.
     قالب قدیمی تکستون «نام» همچنان پذیرفته میشود. */
  const rows = [
    ['نام','نام خانوادگی','کد پرسنلی','واحد'],
    ['محسن','قمشه ای','1001','CNC و تراش'],
    ['رضا','احمدی','1002','آبکاری'],
    ['علی اکبر','محمدی مقدم','1003','مونتاژ'],
  ];
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [{wch:22},{wch:20},{wch:12},{wch:18}];
  XLSX.utils.book_append_sheet(wb, ws, 'پرسنل');

  const guide = XLSX.utils.aoa_to_sheet([
    ['قالب پرسنل آمار غذا'],
    ['ستون «نام» نام کوچک و «نام خانوادگی» فامیلی است؛ هر دو با هم نام کامل را میسازند.'],
    ['اگر فایل قدیمی فقط ستون «نام» دارد هم قابل قبول است؛ برنامه نام خانوادگی را حدس میزند.'],
    ['نام خانوادگیهای چندبخشی مثل «قمشه ای» یا «محمدی مقدم» را کامل در ستون دوم بنویسید.'],
    ['پس از آپلود، از تب پرسنل دکمه «🔤 سورت نام خانوادگی» را بزنید.'],
  ]);
  guide['!cols'] = [{wch:95}];
  XLSX.utils.book_append_sheet(wb, guide, 'راهنما');
  wb.Workbook = { Views: [{RTL:true}] };
  XLSX.writeFile(wb, 'nemune-personel.xlsx');
  toast('قالب اکسل نام / نام خانوادگی دانلود شد ⬇️');
}

/* تشخیص ستونهای فایل اکسل پرسنل.
   هم قالب قدیمی «نام | کد | واحد» و هم قالب جدید
   «نام | نام خانوادگی | کد | واحد» و قالب «نام کامل | نام خانوادگی | ...» را میپذیرد. */
function personCols(head, targetId) {
  const h = head.map(c => normFa(c));
  const iFamily = h.findIndex(c => /^(?:نام\s*خانوادگی|نام\s*فامیل|فامیل|family(?:\s*name)?|last(?:\s*name)?)$/i.test(c));
  const iFirst  = h.findIndex(c => /^(?:نام|نام کوچک|نام پرسنل|نام شخص|first name|first)$/i.test(c));
  const iFull   = h.findIndex(c => /نام\s*و\s*نام\s*خانوادگی|نام\s*کامل|full\s*name|^full$/i.test(c));
  const iCode   = h.findIndex(c => /کد|شماره|پرسنلی/i.test(c));
  const iUnit   = h.findIndex(c => /واحد|قسمت|بخش/i.test(c));
  const hasHeader = iFamily >= 0 || iFirst >= 0 || iFull >= 0 || iCode >= 0 || iUnit >= 0;
  if (!hasHeader) {
    return { start:0, iFirst:0, iFamily:-1, iFull:-1, iCode:1,
             iUnit: targetId ? -1 : 2, hasHeader:false };
  }
  return { start:1, iFirst, iFamily, iFull, iCode, iUnit, hasHeader:true };
}

function normFa(s){ // نرمال‌سازی متن فارسی برای مقایسه
  return String(s||'').replace(/[يى]/g,'ی').replace(/ك/g,'ک').replace(/\u200c/g,' ').replace(/\s+/g,' ').trim();
}
let IMPORT_TARGET_UNIT = null; // اگر مقدار داشته باشد، همه نفرات فایل به این واحد اضافه می‌شوند

function importToUnit(unitId) {
  const u = S.units.find(x=>x.id===unitId);
  if (!u) return;
  IMPORT_TARGET_UNIT = unitId;
  toast(`فایل اکسل پرسنل واحد «${u.name}» را انتخاب کنید 📤`);
  document.getElementById('importExcelFile').click();
}

function addUnitWithExcel() {
  const inp = document.getElementById('newUnitName');
  let name = inp.value.trim();
  if (!name) {
    name = (prompt('نام واحد جدید را وارد کنید:') || '').trim();
    if (!name) return;
  }
  if (S.units.find(u=>normFa(u.name)===normFa(name))) return toast('واحدی با این نام وجود دارد ❌');
  const u = {id:uid(), name};
  S.units.push(u);
  S.sheet.unitIds.push(u.id); // واحد جدید در آمار روز هم فعال شود
  inp.value='';
  save(); renderAll();
  IMPORT_TARGET_UNIT = u.id;
  toast(`واحد «${name}» ساخته شد — حالا فایل اکسل پرسنل را انتخاب کنید 📤`);
  document.getElementById('importExcelFile').click();
}

function importExcel(inp) {
  const f = inp.files[0];
  if (!f) { IMPORT_TARGET_UNIT = null; return; }
  const targetId = IMPORT_TARGET_UNIT; IMPORT_TARGET_UNIT = null;
  const reader = new FileReader();
  reader.onload = (ev) => {
    try {
      const wb = XLSX.read(ev.target.result, {type:'array'});
      // اولویت: شیتی به نام «پرسنل»، وگرنه شیت اول
      const shName = wb.SheetNames.find(n=>normFa(n).includes('پرسنل')) || wb.SheetNames[0];
      const rows = XLSX.utils.sheet_to_json(wb.Sheets[shName], {header:1, defval:''});
      if (!rows.length) throw new Error('empty');

      // تشخیص ستونها: قالب قدیمی تکستون نام + قالب جدید نام/نام خانوادگی
      const head = rows[0].map(c=>normFa(c));
      const ci = personCols(head, targetId);
      const start = ci.start;

      const targetUnit = targetId ? S.units.find(x=>x.id===targetId) : null;

      let added=0, updated=0, newUnits=0;
      const unitByName = {};
      S.units.forEach(u=>unitByName[normFa(u.name)]=u);

      for (let r=start; r<rows.length; r++) {
        const row = rows[r];
        let name='', family='';
        if (ci.iFull >= 0) {
          name = normFa(row[ci.iFull]);
          if (ci.iFamily >= 0) family = normFa(row[ci.iFamily]);
        } else if (ci.iFirst >= 0 && ci.iFamily >= 0) {
          const first = normFa(row[ci.iFirst]);
          family = normFa(row[ci.iFamily]);
          /* اگر ستون «نام» خودش نام کامل بود، دیگر فامیلی تکرار نشود */
          name = (family && (first === family || first.endsWith(' ' + family))) ? first : [first, family].filter(Boolean).join(' ');
        } else {
          name = normFa(row[ci.iFirst >= 0 ? ci.iFirst : 0]);
          if (ci.iFamily >= 0) family = normFa(row[ci.iFamily]);
        }
        if (!name) { continue; }
        const code = ci.iCode>=0 ? String(row[ci.iCode]||'').trim() : '';
        const unitName = (!targetUnit && ci.iUnit>=0) ? normFa(row[ci.iUnit]) : '';

        // واحد مقصد: واحد انتخابشده > ستون واحدِ فایل > واحد اول
        let unit = targetUnit;
        if (!unit) {
          if (unitName) {
            unit = unitByName[unitName];
            if (!unit) { unit = {id:uid(), name:unitName}; S.units.push(unit); unitByName[unitName]=unit; newUnits++; }
          } else {
            unit = S.units[0];
            if (!unit) { unit = {id:uid(), name:'واحد عمومی'}; S.units.push(unit); unitByName[normFa(unit.name)]=unit; newUnits++; }
          }
        }

        // تکراری؟ (کد یکسان، یا نام+واحد یکسان)
        let p = code ? S.people.find(x=>String(x.code||'').trim()===code) : null;
        if (!p) p = S.people.find(x=>normFa(x.name)===name && x.unitId===unit.id);
        if (p) {
          p.name = name; if (code) p.code = code; p.unitId = unit.id;
          if (family) { p.family = family; }
          updated++;
        } else {
          const np = {id:uid(), name, code, unitId:unit.id};
          if (family) { np.family = family; }
          S.people.push(np);
          added++;
        }
      }
      save(); renderAll();
      const dest = targetUnit ? ` به واحد «${targetUnit.name}»` : '';
      toast(`✅ آپلود شد${dest}: ${added} جدید، ${updated} به‌روزرسانی${newUnits?`، ${newUnits} واحد جدید`:''}`);
      if (targetUnit) { document.getElementById('filterUnit').value = targetUnit.id; renderPeople(); }
    } catch(e) {
      console.error(e); toast('خطا در خواندن فایل اکسل ❌');
    }
    inp.value='';
  };
  reader.readAsArrayBuffer(f);
}
