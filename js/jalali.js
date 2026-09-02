/* ================= تقویم شمسی (جلالی) ================= */
// تبدیل میلادی -> جلالی و برعکس (الگوریتم استاندارد)
function div(a,b){return ~~(a/b);}
function g2j(gy,gm,gd){
  const g_d_m=[0,31,59,90,120,151,181,212,243,273,304,334];
  let gy2=(gm>2)?(gy+1):gy;
  let days=355666+(365*gy)+div(gy2+3,4)-div(gy2+99,100)+div(gy2+399,400)+gd+g_d_m[gm-1];
  let jy=-1595+(33*div(days,12053)); days%=12053;
  jy+=4*div(days,1461); days%=1461;
  if(days>365){jy+=div(days-1,365); days=(days-1)%365;}
  let jm,jd;
  if(days<186){jm=1+div(days,31); jd=1+(days%31);}
  else{jm=7+div(days-186,30); jd=1+((days-186)%30);}
  return [jy,jm,jd];
}
function j2g(jy,jm,jd){
  jy+=1595;
  let days=-355668+(365*jy)+(div(jy,33)*8)+div((jy%33)+3,4)+jd+((jm<7)?(jm-1)*31:((jm-7)*30)+186);
  let gy=400*div(days,146097); days%=146097;
  if(days>36524){gy+=100*div(--days,36524); days%=36524; if(days>=365)days++;}
  gy+=4*div(days,1461); days%=1461;
  if(days>365){gy+=div(days-1,365); days=(days-1)%365;}
  let gd=days+1;
  const sal_a=[0,31,((gy%4===0&&gy%100!==0)||(gy%400===0))?29:28,31,30,31,30,31,31,30,31,30,31];
  let gm;
  for(gm=0;gm<13&&gd>sal_a[gm];gm++) gd-=sal_a[gm];
  return [gy,gm,gd];
}
function jalaliLeap(jy){
  // اگر ۳۰ اسفند به همان تاریخ برگردد، سال کبیسه است
  const [gy,gm,gd]=j2g(jy,12,30);
  const back=g2j(gy,gm,gd);
  return back[0]===jy && back[1]===12 && back[2]===30;
}
function jMonthLen(jy,jm){ if(jm<7)return 31; if(jm<12)return 30; return jalaliLeap(jy)?30:29; }
function todayJ(){ const d=new Date(); return g2j(d.getFullYear(), d.getMonth()+1, d.getDate()); }
function jDow(jy,jm,jd){ // 0=شنبه ... 6=جمعه
  const [gy,gm,gd]=j2g(jy,jm,jd);
  const w=new Date(gy,gm-1,gd).getDay(); // 0=Sun
  return (w+1)%7;
}
const J_MONTHS=['فروردین','اردیبهشت','خرداد','تیر','مرداد','شهریور','مهر','آبان','آذر','دی','بهمن','اسفند'];
const J_DOWS=['ش','ی','د','س','چ','پ','ج'];

const JDP = { input:null, y:0, m:1, view:'days' };
function jdpEl(){ return document.getElementById('jdp'); }

function parseJDate(str){
  const m = String(str||'').replace(/[۰-۹]/g, d=>'۰۱۲۳۴۵۶۷۸۹'.indexOf(d)).match(/(\d{4})\s*[\/\-\.]\s*(\d{1,2})\s*[\/\-\.]\s*(\d{1,2})/);
  if(!m) return null;
  const jy=+m[1], jm=Math.min(12,Math.max(1,+m[2])), jd=Math.min(jMonthLen(jy,jm),Math.max(1,+m[3]));
  return [jy,jm,jd];
}
function fmtJ(jy,jm,jd){ return `${jy}/${String(jm).padStart(2,'0')}/${String(jd).padStart(2,'0')}`; }

function openJdp(input){
  JDP.input = input; JDP.view='days';
  const cur = parseJDate(input.value) || todayJ();
  JDP.y = cur[0]; JDP.m = cur[1];
  renderJdp();
  const el = jdpEl(); el.classList.add('open');
  const r = input.getBoundingClientRect();
  const top = r.bottom + window.scrollY + 6;
  let left = r.left + window.scrollX;
  el.style.top = top+'px';
  el.style.left = 'auto'; el.style.right = 'auto';
  // جا دادن در صفحه
  requestAnimationFrame(()=>{
    const w = el.offsetWidth;
    if (left + w > window.scrollX + document.documentElement.clientWidth - 8)
      left = window.scrollX + document.documentElement.clientWidth - w - 8;
    if (left < 4) left = 4;
    el.style.left = left+'px';
  });
}
function closeJdp(){ jdpEl().classList.remove('open'); JDP.input=null; }

function renderJdp(){
  const el = jdpEl();
  const [ty,tm,td] = todayJ();
  const sel = JDP.input ? parseJDate(JDP.input.value) : null;
  let h = `<div class="jdp-head">
    <button onclick="jdpNav(1)" title="ماه قبل">‹</button>
    <span class="jdp-title" onclick="jdpSetView('${JDP.view==='days'?'months':'days'}')">${J_MONTHS[JDP.m-1]} ${JDP.y}</span>
    <button onclick="jdpNav(-1)" title="ماه بعد">›</button>
  </div>`;

  if (JDP.view==='months') {
    h += `<div class="jdp-months">` + J_MONTHS.map((mn,i)=>
      `<button class="${i+1===JDP.m?'sel':''}" onclick="jdpPickMonth(${i+1})">${mn}</button>`).join('') + `</div>`;
    h += `<div class="jdp-foot"><button onclick="jdpSetView('years')">انتخاب سال (${JDP.y})</button><button onclick="jdpSetView('days')">بازگشت</button></div>`;
  } else if (JDP.view==='years') {
    let ys='';
    for(let y=JDP.y-8; y<=JDP.y+7; y++)
      ys += `<button class="${y===JDP.y?'sel':''}" onclick="jdpPickYear(${y})">${y}</button>`;
    h += `<div class="jdp-years">${ys}</div>`;
    h += `<div class="jdp-foot"><button onclick="JDP.y-=16;renderJdp()">« قبل‌تر</button><button onclick="JDP.y+=16;renderJdp()">بعدتر »</button></div>`;
  } else {
    h += `<div class="jdp-grid">` + J_DOWS.map(d=>`<div class="jdp-dow">${d}</div>`).join('');
    const firstDow = jDow(JDP.y, JDP.m, 1);
    const len = jMonthLen(JDP.y, JDP.m);
    // روزهای ماه قبل
    const pm = JDP.m===1 ? 12 : JDP.m-1;
    const py = JDP.m===1 ? JDP.y-1 : JDP.y;
    const plen = jMonthLen(py,pm);
    for(let i=firstDow-1;i>=0;i--) h += `<div class="jdp-day other">${plen-i}</div>`;
    for(let d=1;d<=len;d++){
      const isToday = (JDP.y===ty && JDP.m===tm && d===td);
      const isSel = sel && sel[0]===JDP.y && sel[1]===JDP.m && sel[2]===d;
      const dow = (firstDow + d - 1) % 7;
      h += `<div class="jdp-day ${isToday?'today':''} ${isSel?'sel':''} ${dow===6?'fri':''}" onclick="jdpPickDay(${d})">${d}</div>`;
    }
    h += `</div>`;
    h += `<div class="jdp-foot"><button onclick="jdpToday()">📍 امروز</button><button onclick="closeJdp()">بستن</button></div>`;
  }
  el.innerHTML = h;
}
function jdpNav(dir){ // dir=1 قبلی، -1 بعدی (RTL)
  JDP.m -= dir;
  if(JDP.m<1){JDP.m=12;JDP.y--;} if(JDP.m>12){JDP.m=1;JDP.y++;}
  renderJdp();
}
function jdpSetView(v){ JDP.view=v; renderJdp(); }
function jdpPickMonth(m){ JDP.m=m; JDP.view='days'; renderJdp(); }
function jdpPickYear(y){ JDP.y=y; JDP.view='months'; renderJdp(); }
function jdpPickDay(d){
  if(!JDP.input) return;
  JDP.input.value = fmtJ(JDP.y, JDP.m, d);
  JDP.input.dispatchEvent(new Event('change'));
  closeJdp();
}
function jdpToday(){
  const [y,m,d]=todayJ();
  JDP.y=y; JDP.m=m; JDP.view='days';
  if(JDP.input){ JDP.input.value=fmtJ(y,m,d); JDP.input.dispatchEvent(new Event('change')); }
  renderJdp();
}
// باز شدن تقویم با کلیک روی فیلدهای تاریخ
document.addEventListener('click', e=>{
  const inp = e.target.closest && e.target.closest('input.has-jdp');
  const inJdp = e.target.closest && e.target.closest('#jdp');
  if (inp) { openJdp(inp); }
  else if (!inJdp) { closeJdp(); }
});
