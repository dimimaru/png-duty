import {OPD_GROUPS,OPD_LABELS,clinicsForDate,CLINIC_DOCTORS,SMC,SMC_COLUMNS,dutyHoliday,opdHoliday} from './opd.js';
import {fetchOpdHolidayOverrides} from './sheets.js';
import {fetchGoogleSheet} from './sheets.js';
import {DEPT_LABELS,DEPT_ORDER,INTERN_NAMES} from './parser.js';
import {bangkokParts,nextDate,lastSyncLabel} from './schedule.js';
import {loadSnapshot,saveSnapshot,getPreference,setPreference} from './storage.js';
import {makeDemo} from './demo.js';
import {DEFAULT_CONFIG} from './config.js';
const $=id=>document.getElementById(id);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const parts=raw=>String(raw??'').split('/').map(s=>s.trim()).filter(Boolean);
const first=raw=>parts(raw)[0]||'';
const isInternEntry=e=>/^(?:intern(?:\s|$)|1st call)/i.test(e.role||'');
let data=makeDemo(),config=getPreference('connection',DEFAULT_CONFIG),tab='duty',viewedDate=bangkokParts().date,selectedMonth=viewedDate.slice(0,7),auto=true,filterOpen=false;
let selectedDepts=getPreference('departments',DEPT_ORDER),selectedOpds=getPreference('opds-v4',[...OPD_GROUPS,'DENTAL']),monthDept=getPreference('monthDept','ER'),syncing=false;
let opdMode='in',opdOverrides=getPreference('opdHolidayOverrides',[]),holidaySyncTime=getPreference('opdHolidaySyncTime','');
let index=new Map(),colors=new Map(),interns=new Set(INTERN_NAMES);
function rebuild(){
 index=new Map();interns=new Set(INTERN_NAMES);
 for(const e of data.entries||[]){const k=`${e.date}|${e.dept}|${e.key}`;if(!index.has(k))index.set(k,[]);index.get(k).push(e);if(isInternEntry(e))for(const n of e.names||[])parts(n).forEach(p=>interns.add(p));}
 const names=[...new Set((data.entries||[]).flatMap(e=>(e.names||[]).flatMap(parts)))].concat(CLINIC_DOCTORS,Object.values(SMC).flat(2).map(r=>r[1]),['มนตรี','อักษราภัค']).filter(Boolean).sort((a,b)=>a.localeCompare(b,'th'));
 colors=departmentColors([...new Set(names)]);
}
// Compare actual background colors in CIELAB, prioritising doctors in the
// same department, then departments displayed next to each other.
function colorLab(hex){
 const rgb=hex.slice(1).match(/../g).map(v=>parseInt(v,16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);
 const [r,g,b]=rgb;
 const f=v=>v>.008856?Math.cbrt(v):7.787*v+16/116;
 const x=f((.4124564*r+.3575761*g+.1804375*b)/.95047),y=f(.2126729*r+.7151522*g+.072175*b),z=f((.0193339*r+.119192*g+.9503041*b)/1.08883);
 return [116*y-16,500*(x-y),200*(y-z)];
}
function pastelHex(h,l){
 const s=.66,a=s*Math.min(l,1-l);
 const c=n=>{const k=(n+h/30)%12;return Math.round(255*(l-a*Math.max(-1,Math.min(k-3,9-k,1)))).toString(16).padStart(2,'0');};
 return '#'+c(0)+c(8)+c(4);
}
function departmentColors(names){
 const memberships=new Map(names.map(n=>[n,new Set()]));
 const add=(raw,dept)=>{for(const name of parts(raw)){if(!memberships.has(name))continue;memberships.get(name).add(dept);if(['SURG','ORTHO','URO','NEURO'].includes(dept))memberships.get(name).add('SURGICAL');}};
 for(const e of data.entries||[])for(const name of e.names||[])add(name,e.dept);
 // Include specialists who only appear in the recurring OPD/SMC schedule.
 for(let day=1;day<=35;day++){
  const date=new Date(Date.UTC(2026,0,day)).toISOString().slice(0,10);
  for(const clinic of clinicsForDate(date))for(const name of clinic.doctors)add(name,clinic.group);
 }
 for(const columns of Object.values(SMC))columns.forEach((cell,i)=>cell.forEach(([clinic,name])=>add(name,['MED','OB-GYN','SURGICAL','SURGICAL',clinic==='Eye'?'EYE':clinic==='Uro'?'SURGICAL':'PSY','DENTAL'][i])));
 for(const [dept,name] of Object.entries(data.fixedWeekdayStaff||{}))add(name,dept);
 add('มนตรี','FORENSIC');add('อักษราภัค','FORENSIC');
 const order=DEPT_ORDER.filter(d=>!['ER','TRANSPORT'].includes(d)).concat(['ER','TRANSPORT','GP','DENTAL']);
 const weight=(a,b)=>{
  const ga=memberships.get(a),gb=memberships.get(b);
  for(const group of ga)if(gb.has(group))return 1;
  let gap=Infinity;
  for(const x of ga)for(const y of gb){const i=order.indexOf(x),j=order.indexOf(y);if(i>=0&&j>=0)gap=Math.min(gap,Math.abs(i-j));}
  return gap<=1?.42:gap===2?.22:.09;
 };
 const palette=[];
 for(const l of [.70,.79,.87])for(let h=0;h<360;h+=10){const hex=pastelHex(h,l);palette.push({hex,lab:colorLab(hex)});}
 const assigned=new Map(),used=new Set(),labs=new Map();
 const put=(n,hex)=>{assigned.set(n,hex);used.add(hex);labs.set(n,colorLab(hex));};
 // Stable, clearly separated colors for the pairs highlighted by the user.
 for(const [n,hex] of [['พัทธมน','#aad8f0'],['สุจิตราภรณ์','#f8bf94'],['นาถชนก','#d1b4ef'],['เล็ก','#abe1ad']])if(memberships.has(n))put(n,hex);
 const sizes=new Map();
 for(const groups of memberships.values())for(const g of groups)sizes.set(g,(sizes.get(g)||0)+1);
 const degree=n=>[...memberships.get(n)].reduce((sum,g)=>sum+(sizes.get(g)||0),0);
 const pending=names.filter(n=>!assigned.has(n)).sort((a,b)=>degree(b)-degree(a)||a.localeCompare(b,'th'));
 for(const name of pending){
  let best=null,bestScore=-Infinity;
  for(const candidate of palette){
   if(used.has(candidate.hex))continue;
   let minimum=Infinity,total=0;
   for(const [other,lab] of labs){const distance=Math.hypot(...lab.map((v,i)=>v-candidate.lab[i]));minimum=Math.min(minimum,distance/weight(name,other));total+=distance;}
   const score=(Number.isFinite(minimum)?minimum:0)+total*.00001;
   if(score>bestScore){bestScore=score;best=candidate;}
  }
  // Extend deterministically if a larger future roster exhausts the palette.
  if(!best){let i=assigned.size,hex;do{hex=pastelHex((i++*137.507764)%360,.76);}while(used.has(hex));best={hex};}
  put(name,best.hex);
 }
 return assigned;
}
function entries(date,dept,key){return index.get(`${date}|${dept}|${key}`)||index.get(`${date.slice(0,7)}|${dept}|${key}`)||[];}
function empty(){return '<div class="empty-cell">—</div>';}
function card(name,{title='',minor='',intern=false,backup=false,phone=false}={}){
 if(!name)return empty();const main=first(name),second=backup?parts(name).slice(1).join(' / '):'';
 const grey=intern||(interns.has(main)&&!(tab==='opd'||(tab==='month'&&monthDept==='GP')));
 const color=phone?'#edf1f5':grey?'#e9edf1':colors.get(main)||'#e7edf4';
 return `<div class="assignment${grey?' intern':''}" style="--person:${color}">${title?`<span class="role">${esc(title)}</span>`:''}<div class="staff-line"><span class="doctor">${esc(main)}</span>${second?`<small class="backup">/ ${esc(second)}</small>`:''}${minor?`<span class="first-call">1st call ${esc(first(minor))}</span>`:''}</div></div>`;
}
const roles={Stroke:'Stroke fast','ER / Refer':'ICU-ER-Refer','Consult ต่างแผนก':'ต่างแผนก','OPD / Ward':'OPD',Gyne:'GYN','ผู้ใหญ่ · Consult':'ผู้ใหญ่ · OPD/ต่างแผนก','ผู้ใหญ่ · ER / รพช.':'ผู้ใหญ่ · ER/Refer','เด็ก / วัยรุ่น':'จิตเวชเด็ก',OB:'OB'};
function roleTitle(e){const r=e.role||'';if(roles[r])return roles[r];if(/NICU/i.test(r))return 'Refer NICU';if(/เด็กโต|PICU/.test(r))return 'เด็กโต / PICU';if(/^OPD1/.test(r))return 'OPD';if(/OPD2/.test(r))return 'ICU / ต่างแผนก';if(/พิเศษชั้น/.test(r))return 'พิเศษชั้น 5–6';if(/newborn|รับเด็ก/i.test(r))return 'NB / หลังคลอด';return '';}
function morning(date,dept){
 if(dutyHoliday(date,data)){const a=overnight(date,dept);return a.name?[{name:a.name}]:[];}
 if(dept==='FORENSIC')return [{name:data.fixedWeekdayStaff?.FORENSIC==='อักษราภัค'?'อักษราภัค':'มนตรี'}];
 if(dept==='ANES')return [{name:'โทร 3203',phone:true}];
 const weekday=new Date(date+'T12:00:00Z').getUTCDay();
 if(['FORENSIC','MAXILO'].includes(dept)&&weekday>0&&weekday<6&&!(data.holidays||[]).includes(date)&&data.fixedWeekdayStaff?.[dept])return [{name:data.fixedWeekdayStaff[dept]}];
 let es=entries(date,dept,'in').filter(e=>!isInternEntry(e));
 if(!es.length&&['SURG','ORTHO','NEURO','URO','ENT','FORENSIC','MAXILO'].includes(dept))es=entries(date,dept,'out').filter(e=>!isInternEntry(e)).slice(0,1);
 return es.flatMap(e=>e.names.map(name=>({name:first(name),title:roleTitle(e)})));
}
function overnight(date,dept){
 const es=entries(date,dept,'out'),staff=es.find(e=>!isInternEntry(e)),trainee=es.find(e=>isInternEntry(e));
 const raw=first(staff?.names?.[0]);return {name:dept==='FORENSIC'?(raw==='อักษราภัค'?raw:'มนตรี'):raw,minor:trainee?.names?.[0]||''};
}
function dayAssignments(date,dept){return morning(date,dept).map(a=>card(a.name,a)).join('')||empty();}
function dayColumns(){return auto&&bangkokParts().minutes<480?[{key:'out',date:nextDate(viewedDate,-1),label:'นอกเวลา'},{key:'in',date:viewedDate,label:'ในเวลา'}]:[{key:'in',date:viewedDate,label:'ในเวลา'},{key:'out',date:viewedDate,label:'นอกเวลา'}];}
function departmentRow(dept,cols){
 if(dutyHoliday(viewedDate,data)){const a=overnight(viewedDate,dept);return `<div class="matrix-row"><button class="dept-tag" data-dept="${dept}">${esc(DEPT_LABELS[dept]||dept)}</button><div class="dept-grid"><div class="shared-cell">${a.name?card(a.name,{minor:a.minor}):empty()}</div></div></div>`;}
 const ins=cols.find(c=>c.key==='in'),outs=cols.find(c=>c.key==='out'),am=morning(ins.date,dept),pm=overnight(outs.date,dept);
 const match=ins.date===outs.date?am.findIndex(a=>a.name&&a.name===pm.name&&!a.phone):-1,remaining=am.filter((_,i)=>i!==match);
 const inHtml=remaining.map(a=>card(a.name,a)).join('')||empty(),outHtml=pm.name?card(pm.name,{minor:pm.minor}):empty();
 const shared=match>=0?`<div class="shared-cell">${card(pm.name,{...am[match],minor:pm.minor})}</div>`:'';
 const rest=match>=0?(remaining.length?`<div class="duty-cell" style="grid-column:${cols[0].key==='in'?1:2}">${inHtml}</div>`:''):cols.map(c=>`<div class="duty-cell">${c.key==='in'?inHtml:outHtml}</div>`).join('');
 return `<div class="matrix-row"><button class="dept-tag" data-dept="${dept}">${esc(DEPT_LABELS[dept]||dept)}</button><div class="dept-grid">${shared}${rest}</div></div>`;
}
function erRow(cols){
 const day=entries(viewedDate,'ER','morning').flatMap(e=>e.names).map(n=>card(n,{title:'ER เช้า',backup:true})).join('')||empty();
 const nightDate=auto&&bangkokParts().minutes<480?nextDate(viewedDate,-1):viewedDate;
 const shift=(key,title,date)=>entries(date,'ER',key).flatMap(e=>e.names).map(n=>card(first(n),{title})).join('')||empty();
 const out=`<div class="er-split">${shift('evening','ER บ่าย',nightDate)}${shift('night','ER ดึก',nightDate)}</div>`;
 if(dutyHoliday(viewedDate,data))return `<div class="matrix-row"><button class="dept-tag" data-dept="ER">ER</button><div class="holiday-er">${day}${shift('evening','ER บ่าย',viewedDate)}${shift('night','ER ดึก',viewedDate)}</div></div>`;
 return `<div class="matrix-row"><button class="dept-tag" data-dept="ER">ER</button><div class="dept-grid">${cols.map(c=>`<div class="duty-cell">${c.key==='in'?day:out}</div>`).join('')}</div></div>`;
}
function transportRow(cols){
 const cells=cols.map(c=>{const h=entries(c.date,'TRANSPORT',c.key).flatMap(e=>e.names).map(n=>card(first(n))).join('')||empty();return `<div class="duty-cell">${c.key==='out'?`<div class="er-split">${h}<div class="night-blank"></div></div>`:h}</div>`;}).join('');
 return `<div class="matrix-row"><button class="dept-tag" data-dept="TRANSPORT">OPD<br>นอกเวลา</button><div class="dept-grid">${cells}</div></div>`;
}
function renderDuty(){
 const cols=dayColumns(),order=DEPT_ORDER.filter(d=>!['ER','TRANSPORT'].includes(d));
 return `<div class="grid-head"><span>แผนก</span>${dutyHoliday(viewedDate,data)?'<strong class="holiday-heading">นอกเวลาวันหยุด</strong>':cols.map(c=>`<strong>${c.label}</strong>`).join('')}</div>${order.filter(d=>selectedDepts.includes(d)).map(d=>departmentRow(d,cols)).join('')}${selectedDepts.includes('ER')?erRow(cols):''}${selectedDepts.includes('TRANSPORT')?transportRow(cols):''}`;
}

function opdChoices(){return opdMode==='smc'?['MED','OB-GYN','SURGICAL','EYE','PSY','DENTAL']:OPD_GROUPS;}
function clinicCard(r){return `<div class="clinic-card"><strong>${esc(r.clinic)}</strong>${r.doctors.map(n=>`<small style="background:${colors.get(n)||'#edf3f7'}">${esc(n)}</small>`).join('')}${r.weeks?`<span class="clinic-note">${r.weeks.join(',')}</span>`:''}${r.note?`<span class="clinic-note">${esc(r.note)}</span>`:''}</div>`;}
function renderSmc(){
 const day=new Date(viewedDate+'T12:00:00Z').getUTCDay(),monday=nextDate(viewedDate,1-(day||7));
 const group=['MED','OB-GYN','SURGICAL','SURGICAL',null,'DENTAL'];
 const rows=[1,2,3,4].map((d,i)=>{const date=nextDate(monday,i),closed=opdHoliday(date,data,opdOverrides);
 return `<tr class="${date===viewedDate?'selected-smc':''}"><th>${['จันทร์','อังคาร','พุธ','พฤหัส'][i]}<small>${date.slice(8)}/${date.slice(5,7)}</small></th>${SMC[d].map((cell,j)=>`<td>${closed?'':cell.filter(([clinic])=>selectedOpds.includes(group[j]||(clinic==='Eye'?'EYE':clinic==='Uro'?'SURGICAL':'PSY'))).map(([clinic,n])=>clinicCard({clinic,doctors:[n]})).join('')}</td>`).join('')}</tr>`;}).join('');
 return `<div class="smc-time">SMC · 16:30–20:30 น.</div><div class="smc-scroll"><table class="smc-table"><thead><tr><th>วัน</th>${SMC_COLUMNS.map(n=>`<th>${n}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table></div>`;
}
function renderOpd(){
 const nav=`<div class="opd-tabs"><button data-opd-mode="in" class="${opdMode==='in'?'active':''}">ในเวลา</button><button data-opd-mode="smc" class="${opdMode==='smc'?'active':''}">SMC นอกเวลา</button></div>`;
 const status=`<small class="holiday-status">วันหยุด: เสาร์–อาทิตย์ + ชีตต้นทาง${holidaySyncTime?' · ตรวจล่าสุด '+esc(lastSyncLabel(holidaySyncTime)):''}</small>`;
 if(opdHoliday(viewedDate,data,opdOverrides))return nav+status+'<div class="opd-closed">วันหยุด · ไม่มี OPD</div>';
 if(opdMode==='smc')return nav+status+renderSmc();
 const gp=selectedOpds.includes('GP')?`<section class="opd-section"><h2>OPD GP</h2><div class="opd-grid">${['am','pm'].map((key,i)=>`<div class="opd-column"><h3>${i?'บ่าย':'เช้า'}</h3>${entries(viewedDate,'GP',key).flatMap(e=>e.names.map(n=>card(n,{title:e.role}))).join('')||empty()}</div>`).join('')}</div></section>`:'';
 const clinics=clinicsForDate(viewedDate);
 const rows=OPD_GROUPS.filter(g=>g!=='GP'&&selectedOpds.includes(g)&&clinics.some(c=>c.group===g)).map(g=>`<tr><th>${esc(OPD_LABELS[g])}</th>${['am','pm'].map(key=>`<td>${clinics.filter(c=>c.group===g&&c.session===key).map(clinicCard).join('')}</td>`).join('')}</tr>`).join('');
 return nav+status+gp+`<table class="specialist-table"><thead><tr><th>OPD</th><th>เช้า</th><th>บ่าย</th></tr></thead><tbody>${rows}</tbody></table>`;
}
async function syncOpdHolidays(){
 if(!hasConnection())return;
 try{const result=await fetchOpdHolidayOverrides(config.spreadsheetId,config.apiKey);if(result.overrides)opdOverrides=result.overrides;data.opdHolidays=result.holidays;setPreference('opdHolidayDates',result.holidays);holidaySyncTime=result.syncedAt;setPreference('opdHolidayOverrides',opdOverrides);setPreference('opdHolidaySyncTime',holidaySyncTime);if(tab==='opd')render();}catch{/* Retain the last successfully cached override list. */}
}
function monthDates(ym){const [y,m]=ym.split('-').map(Number);return Array.from({length:new Date(Date.UTC(y,m,0)).getUTCDate()},(_,i)=>`${ym}-${String(i+1).padStart(2,'0')}`);}
function monthSlot(date,key){
 if(monthDept==='ER')return entries(date,'ER',key).flatMap(e=>e.names).map(n=>card(key==='morning'?n:first(n),{backup:key==='morning'})).join('')||empty();
 if(monthDept==='GP'&&opdHoliday(date,data,opdOverrides))return empty();
 if(key==='in'&&dutyHoliday(date,data)&&!['ER','GP','TRANSPORT'].includes(monthDept)){const a=overnight(date,monthDept);return a.name?card(a.name,{minor:a.minor}):empty();}
 if(monthDept==='GP')return entries(date,'GP',key).flatMap(e=>e.names.map(n=>card(n,{title:e.role}))).join('')||empty();
 if(monthDept==='TRANSPORT')return entries(date,'TRANSPORT',key).flatMap(e=>e.names).map(n=>card(n)).join('')||empty();
 if(key==='in')return dayAssignments(date,monthDept);
 const a=overnight(date,monthDept);return a.name?card(a.name,{minor:a.minor}):empty();
}
function renderMonth(){
 const fixed=['MED','PED'].includes(monthDept);
 const columns=monthDept==='ER'?[['morning','ER เช้า'],['evening','ER บ่าย'],['night','ER ดึก']]:monthDept==='GP'?[['am','เช้า'],['pm','บ่าย']]:fixed?[['out','นอกเวลา']]:[['in','ในเวลา'],['out','นอกเวลา']];
 const choices=[...DEPT_ORDER,'GP'],dates=monthDates(selectedMonth);
 const rows=dates.map(date=>{const dow=new Date(date+'T12:00:00Z').getUTCDay();return `<div class="month-row" style="--n:${columns.length}"><div class="month-day weekday-${dow}">${Number(date.slice(-2))}</div>${dutyHoliday(date,data)&&!['ER','GP','TRANSPORT'].includes(monthDept)&&!fixed?`<div class="month-slot month-holiday">${monthSlot(date,'out')}</div>`:columns.map(([key])=>`<div class="month-slot">${monthSlot(date,key)}</div>`).join('')}</div>`;}).join('');
 const fixedDate=dates.find(d=>!dutyHoliday(d,data)&&morning(d,monthDept).length)||dates[0];
 return `<div class="department-picker"><label for="month-dept">แผนก</label><select id="month-dept">${choices.map(d=>`<option value="${d}" ${d===monthDept?'selected':''}>${esc(DEPT_LABELS[d]||d)}</option>`).join('')}</select></div><div class="month-table"><div class="month-row" style="--n:${columns.length}"><div class="header-cell">วันที่</div>${columns.map(([,l])=>`<div class="header-cell">${l}</div>`).join('')}</div>${rows}</div>${fixed?`<section class="fixed-in"><h2>ในเวลา</h2><div class="fixed-grid">${dayAssignments(fixedDate,monthDept)}</div></section>`:''}`;
}
function renderFilter(){
 const isOpd=tab==='opd',all=isOpd?opdChoices():DEPT_ORDER,selected=isOpd?selectedOpds:selectedDepts;
 $('filter-panel').hidden=!filterOpen||tab==='month';$('filter-btn').setAttribute('aria-expanded',String(filterOpen));
 $('filter-panel').innerHTML=`<div class="filter-title">${isOpd?'เลือก OPD':'เลือกแผนก'}<button id="select-all">เลือกทั้งหมด</button></div><div class="filter-options">${all.map(d=>`<label><input class="filter-check" type="checkbox" value="${d}" ${selected.includes(d)?'checked':''}>${esc(isOpd?OPD_LABELS[d]||d:DEPT_LABELS[d]||d)}</label>`).join('')}</div>`;
}
function render(){
 if(auto)viewedDate=bangkokParts().date;
 document.querySelectorAll('[data-tab]').forEach(b=>{const active=b.dataset.tab===tab;b.classList.toggle('active',active);b.setAttribute('aria-selected',String(active));});
 const monthly=tab==='month';$('date-nav').hidden=monthly;$('month-nav').hidden=!monthly;$('filter-btn').hidden=monthly;
 $('view-date').value=viewedDate;$('month-input').value=selectedMonth;$('month-label').textContent=new Intl.DateTimeFormat('en-GB',{month:'short',year:'numeric',timeZone:'UTC'}).format(new Date(selectedMonth+'-01T12:00:00Z'));
 $('today-btn').textContent=monthly?'เดือนนี้':'วันนี้';$('filter-btn').textContent=tab==='opd'?'กรอง OPD':'กรองแผนก';
 $('screen').innerHTML=monthly?renderMonth():tab==='opd'?renderOpd():renderDuty();
 $('demo-banner').hidden=!data.demo;$('sync-time').textContent=lastSyncLabel(data.syncedAt);$('refresh-btn').disabled=!hasConnection()||syncing;renderFilter();
}
function hasConnection(){return !!(config.spreadsheetId&&config.apiKey);}
function banner(message=''){$('alert-banner').hidden=!message;$('alert-banner').textContent=message;}
async function sync(){syncOpdHolidays();if(syncing||!hasConnection())return;syncing=true;render();try{const fresh=await fetchGoogleSheet(config.spreadsheetId,config.apiKey);await saveSnapshot(fresh);data=fresh;rebuild();banner(fresh.warnings?.length?`พบข้อมูลผิดพลาด ${fresh.warnings.length} รายการในชีต`:'');}catch(e){banner(`ซิงก์ไม่สำเร็จ: ${e.message}`);}finally{syncing=false;render();}}
function moveMonth(delta){const d=new Date(selectedMonth+'-01T12:00:00Z');d.setUTCMonth(d.getUTCMonth()+delta);selectedMonth=d.toISOString().slice(0,7);render();}
function init(){
 document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{tab=b.dataset.tab;filterOpen=false;render();});
 $('view-date').onchange=e=>{viewedDate=e.target.value||bangkokParts().date;auto=false;render();};
 $('prev-date').onclick=()=>{viewedDate=nextDate(viewedDate,-1);auto=false;render();};$('next-date').onclick=()=>{viewedDate=nextDate(viewedDate,1);auto=false;render();};
 $('prev-month').onclick=()=>moveMonth(-1);$('next-month').onclick=()=>moveMonth(1);$('month-input').onchange=e=>{if(e.target.value)selectedMonth=e.target.value;render();};
 $('today-btn').onclick=()=>{if(tab==='month')selectedMonth=bangkokParts().date.slice(0,7);else{auto=true;viewedDate=bangkokParts().date;}render();};
 $('refresh-btn').onclick=sync;$('filter-btn').onclick=()=>{filterOpen=!filterOpen;renderFilter();};
 $('filter-panel').onchange=e=>{if(!e.target.matches('.filter-check'))return;const opd=tab==='opd';let list=opd?selectedOpds:selectedDepts;list=e.target.checked?[...new Set([...list,e.target.value])]:list.filter(x=>x!==e.target.value);if(opd)selectedOpds=list;else selectedDepts=list;setPreference(opd?'opds-v4':'departments',list);render();};
 $('filter-panel').onclick=e=>{if(e.target.id!=='select-all')return;if(tab==='opd')selectedOpds=[...new Set([...OPD_GROUPS,'DENTAL'])];else selectedDepts=[...DEPT_ORDER];setPreference(tab==='opd'?'opds-v4':'departments',tab==='opd'?selectedOpds:selectedDepts);render();};
 $('screen').onclick=e=>{const mode=e.target.closest('[data-opd-mode]');if(mode){opdMode=mode.dataset.opdMode;filterOpen=false;render();return;}const b=e.target.closest('[data-dept]');if(b){monthDept=b.dataset.dept;selectedMonth=viewedDate.slice(0,7);tab='month';filterOpen=false;setPreference('monthDept',monthDept);render();}};
 $('screen').onchange=e=>{if(e.target.id==='month-dept'){monthDept=e.target.value;setPreference('monthDept',monthDept);render();}};
 window.addEventListener('online',()=>{sync();syncOpdHolidays();});document.addEventListener('visibilitychange',()=>{if(!document.hidden){render();if(Date.now()-Date.parse(data.syncedAt||0)>300000)sync();}});
 setInterval(()=>{render();if(document.visibilityState==='visible'&&Date.now()-Date.parse(data.syncedAt||0)>300000)sync();},30000);
}
async function boot(){try{const cached=await loadSnapshot();if(cached?.entries?.length&&cached.spreadsheetId===config.spreadsheetId)data=cached;}catch{}data.opdHolidays=getPreference('opdHolidayDates',null);rebuild();init();render();if(navigator.onLine){sync();syncOpdHolidays();}if('serviceWorker'in navigator&&(location.protocol==='https:'||location.hostname==='localhost'))navigator.serviceWorker.register('./sw.js').catch(()=>{});}
boot();
