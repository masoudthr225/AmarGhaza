const assert = require('assert');
const fs = require('fs');
const vm = require('vm');
const XLSX = require('../js/xlsx.full.min.js');
const elements = {filterUnit:{value:''}, searchPerson:{value:''}};
const ctx = {console, XLSX, esc:s=>String(s ?? ''), S:{setup:{sortKey:'family',sortDir:1},units:[{id:'u',name:'تولید'}],people:[],sheet:{unitIds:[],absent:{}}},
  document:{getElementById:id=>elements[id] || (elements[id]={value:'',classList:{add(){},remove(){}}}),querySelector:()=>({}),querySelectorAll:()=>[]},
  uid:(()=>{let n=0;return ()=>`id${++n}`})(), save(){},renderAll(){},renderAttendance(){},renderPreview(){},toast(){},confirm(){return true}, setTimeout(){}};
ctx.FileReader = class {readAsArrayBuffer(file){this.onload({target:{result:file.data}})}};
vm.createContext(ctx);
for(const f of ['js/sheet.js','js/excel.js','js/manage.js']) vm.runInContext(fs.readFileSync(f,'utf8'),ctx,{filename:f});
const run = s=>vm.runInContext(s,ctx);
function importRows(rows) {
  const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(rows),'پرسنل');
  ctx.input={files:[{data:XLSX.write(wb,{type:'array',bookType:'xlsx'})}],value:'x'};
  run('importExcel(input)');
}
assert.equal(run("familyOf({name:'محسن قمشه ای'})"),'قمشه ای');
assert.equal(run("familyOf({name:'علی اکبر محمدی مقدم'})"),'محمدی مقدم');
assert.equal(run("familyOf({name:'علی اکبر محمدی مقدم',family:'اکبر محمدی'})"),'اکبر محمدی');
importRows([['نام','نام خانوادگی','کد پرسنلی','واحد'],['علی اکبر','محمدی مقدم','12','تولید'],['رضا','احمدی','2','تولید']]);
assert.equal(ctx.S.people[0].name,'علی اکبر محمدی مقدم');
assert.equal(ctx.S.people[0].family,'محمدی مقدم');
assert.equal(run('sortPeople(S.people)[0].name'),'رضا احمدی');
assert.equal(run("unitPeople('u')[0].name"),'رضا احمدی');
ctx.S.setup.sortDir=-1; assert.equal(run('sortPeople(S.people)[0].name'),'علی اکبر محمدی مقدم');
importRows([['نام و نام خانوادگی','کد پرسنلی','واحد'],['حسین رضایی','13','تولید']]);
assert.equal(ctx.S.people[2].name,'حسین رضایی'); assert.equal(ctx.S.people[2].family,undefined);
importRows([['نام کامل','نام خانوادگی','کد پرسنلی','واحد'],['محسن قمشه ای','قمشه ای','14','تولید']]);
assert.equal(ctx.S.people[3].name,'محسن قمشه ای'); assert.equal(ctx.S.people[3].family,'قمشه ای');
importRows([['نام','نام خانوادگی','کد پرسنلی','واحد'],['علی اکبر محمدی مقدم','محمدی مقدم','12','تولید']]);
assert.equal(ctx.S.people.length,4); assert.equal(ctx.S.people[0].name,'علی اکبر محمدی مقدم');
importRows([['مریم زمانی','15','تولید']]); assert.equal(ctx.S.people[4].name,'مریم زمانی');
run('sortByFamily()'); assert.equal(ctx.S.setup.sortKey,'family'); assert.equal(ctx.S.setup.sortDir,1);
run('toggleSortDir()'); assert.equal(ctx.S.setup.sortDir,-1);
ctx.S.people[0].family='اکبر محمدی'; ctx.el={textContent:'اکبر محمدی'}; run("updPersonInline(S.people[0].id,'family',el)"); assert.equal(ctx.S.people[0].family,'اکبر محمدی');
console.log('Family sorting and Excel import: passed');
