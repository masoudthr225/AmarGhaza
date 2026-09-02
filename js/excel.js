/* ================= اکسل: دانلود و آپلود ================= */
function exportExcel() {
  try {
    const wb = XLSX.utils.book_new();

    // شیت ۱: پرسنل
    const pplRows = [['نام','کد پرسنلی','واحد']];
    S.people.forEach(p=>{
      const u = S.units.find(x=>x.id===p.unitId);
      pplRows.push([p.name, p.code||'', u?u.name:'']);
    });
    const wsP = XLSX.utils.aoa_to_sheet(pplRows);
    wsP['!cols'] = [{wch:26},{wch:12},{wch:18}];
    XLSX.utils.book_append_sheet(wb, wsP, 'پرسنل');

    // شیت ۲: آمار امروز (با وضعیت حضور)
    const meal = S.meals.find(m=>m.id===S.sheet.mealId);
    const food = S.foods.find(f=>f.id===S.sheet.foodId);
    const stRows = [
      ['تاریخ', S.sheet.date||'', 'وعده', meal?meal.name:'', 'غذا', food?food.name:''],
      [],
      ['ردیف','نام','کد پرسنلی','واحد','وضعیت'],
    ];
    let i=0, tot=0, abs=0;
    selectedUnits().forEach(u=>{
      unitPeople(u.id).forEach(p=>{
        const a = !!S.sheet.absent[p.id];
        tot++; if(a) abs++;
        stRows.push([++i, p.name, p.code||'', u.name, a?'غایب':'حاضر']);
      });
    });
    stRows.push([]);
    stRows.push(['کل', tot, 'حاضر (پرس)', tot-abs, 'غایب', abs]);
    if (S.sheet.note) stRows.push(['توضیحات', S.sheet.note]);
    const wsS = XLSX.utils.aoa_to_sheet(stRows);
    wsS['!cols'] = [{wch:6},{wch:26},{wch:12},{wch:18},{wch:10}];
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
  const rows = [
    ['نام','کد پرسنلی','واحد'],
    ['علی محمدی','1001','CNC و تراش'],
    ['رضا احمدی','1002','آبکاری'],
    ['حسین کریمی','1003','مونتاژ'],
  ];
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [{wch:26},{wch:12},{wch:18}];
  XLSX.utils.book_append_sheet(wb, ws, 'پرسنل');
  wb.Workbook = { Views: [{RTL:true}] };
  XLSX.writeFile(wb, 'nemune-personel.xlsx');
  toast('فایل نمونه دانلود شد ⬇️');
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

      // تشخیص ستون‌ها از سطر عنوان (اگر بود)
      let start=0, ci={name:0, code:1, unit:2};
      const head = rows[0].map(c=>normFa(c));
      const iName = head.findIndex(c=>/نام/.test(c) && !/واحد/.test(c));
      const iCode = head.findIndex(c=>/کد|شماره/.test(c));
      const iUnit = head.findIndex(c=>/واحد|قسمت|بخش/.test(c));
      if (iName>=0) { ci={name:iName, code:iCode, unit:iUnit}; start=1; }
      else {
        // بدون سطر عنوان: اگر ستون دوم عددی بود، همان نام+کد است
        ci = {name:0, code:1, unit: targetId ? -1 : 2};
      }

      const targetUnit = targetId ? S.units.find(x=>x.id===targetId) : null;

      let added=0, updated=0, newUnits=0;
      const unitByName = {};
      S.units.forEach(u=>unitByName[normFa(u.name)]=u);

      for (let r=start; r<rows.length; r++) {
        const row = rows[r];
        const name = normFa(row[ci.name]);
        if (!name) { continue; }
        const code = ci.code>=0 ? String(row[ci.code]||'').trim() : '';
        const unitName = (!targetUnit && ci.unit>=0) ? normFa(row[ci.unit]) : '';

        // واحد مقصد: واحد انتخاب‌شده > ستون واحدِ فایل > واحد اول
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
          updated++;
        } else {
          S.people.push({id:uid(), name, code, unitId:unit.id});
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
