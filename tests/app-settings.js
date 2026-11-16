const assert = require('assert'), fs = require('fs'), vm = require('vm');
const radios = ['green','blue','purple','amber'].map(value => ({value,checked:false,focus(){}}));
const colors = ['original','green','blue','purple','amber','slate'].map(value => ({value,checked:false}));
const elements = {glassButtons:{checked:false},appSettings:{hidden:true,querySelector(){return radios.find(r=>r.checked)}}};
for (const key of ['appearance','sound','files']) { elements['settings-'+key]={hidden:false}; elements['settings-tab-'+key]={setAttribute(k,v){this[k]=v}}; }
const classes = new Set(); let saved, fail=false;
const ctx={S:{setup:{}}, document:{documentElement:{dataset:{}},body:{dataset:{},classList:{toggle(k,v){if(v)classes.add(k);else classes.delete(k)}}},getElementById:id=>elements[id],querySelectorAll:sel=>sel.includes('glassColor') ? colors : radios,querySelector:sel=>sel.includes('glassColor') ? colors.find(r=>r.checked) : radios.find(r=>r.checked)},save(){if(fail) throw Error('full'); saved=JSON.stringify(ctx.S)},toast(){}};
vm.createContext(ctx);vm.runInContext(fs.readFileSync('js/app-settings.js','utf8'),ctx);
ctx.applyAppAppearance();assert.equal(ctx.document.documentElement.dataset.appTheme,'green');assert.equal(ctx.document.body.dataset.glassColor,'original');
ctx.openAppSettings();assert(!elements.appSettings.hidden);assert(radios[0].checked);assert(colors[0].checked);ctx.showSettingsTab('sound');assert(!elements['settings-sound'].hidden);assert(elements['settings-files'].hidden);assert.equal(elements['settings-tab-sound']['aria-selected'],'true');
radios[0].checked=false;radios[2].checked=true;elements.glassButtons.checked=true;colors.forEach(c=>c.checked=c.value==='blue');ctx.closeAppSettings();assert.equal(ctx.S.setup.appearance,undefined);
ctx.openAppSettings();assert(radios[0].checked);radios[0].checked=false;radios[2].checked=true;elements.glassButtons.checked=true;colors.forEach(c=>c.checked=c.value==='blue');ctx.saveAppSettings();
assert.equal(ctx.document.documentElement.dataset.appTheme,'purple');assert(classes.has('glass-buttons'));assert.equal(ctx.document.body.dataset.glassColor,'blue');assert.equal(JSON.parse(saved).setup.appearance.glassColor,'blue');assert(elements.appSettings.hidden);
ctx.S=JSON.parse(saved);ctx.applyAppAppearance();assert.equal(ctx.document.body.dataset.glassColor,'blue');
ctx.openAppSettings();assert(colors.find(c=>c.value==='blue').checked);radios[2].checked=false;radios[1].checked=true;fail=true;ctx.saveAppSettings();assert.equal(ctx.S.setup.appearance.theme,'purple');assert(!elements.appSettings.hidden);
console.log('PASS: tabs, defaults, cancel, color save, reload and storage error');
