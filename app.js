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
let selectedDepts=getPreference('departments',DEPT_ORDER),selectedOpds=getPreference('opds',['GP']),monthDept=getPreference('monthDept','ER'),syncing=false;
let index=new Map(),colors=new Map(),interns=new Set(INTERN_NAMES);
function rebuild(){
 index=new Map();interns=new Set(INTERN_NAMES);
 for(const e of data.entries||[]){const k=`${e.date}|${e.dept}|${e.key}`;if(!index.has(k))index.set(k,[]);index.get(k).push(e);if(isInternEntry(e))for(const n of e.names||[])parts(n).forEach(p=>interns.add(p));}
 const names=[...new Set((data.entries||[]).flatMap(e=>(e.names||[]).flatMap(parts)))].sort((a,b)=>a.localeCompare(b,'th'));
 colors=new Map(names.map((n,i)=>[n,`hsl(${((i*137.507764)%360).toFixed(5)} 64% ${[81,89,74][i%3]}%)`]));
}
function entries(date,dept,key){return index.get(`${date}|${dept}|${key}`)||index.get(`${date.slice(0,7)}|${dept}|${key}`)||[];}
function empty(){return '<div class="empty-cell">—</div>';}
function card(name,{title='',minor='',intern=false,backup=false,phone=false}={}){
 if(!name)return empty();const main=first(name),second=backup?parts(name).slice(1).join(' / '):'';
 const grey=intern||(interns.has(main)&&!(tab==='opd'||(tab==='month'&&monthDept==='GP')));
 const color=phone?'#edf1f5':grey?'#e9edf1':colors.get(main)||'#e7edf4';
 return `<div class="assignment${grey?' intern':''}" style="--person:${color}">${title?`<span class="role">${esc(title)}</span>`:''}<span class="doctor">${esc(main)}</span>${second?`<small class="backup">/ ${esc(second)}</small>`:''}${minor?`<div class="first-call"><span>1st call</span><small>${esc(first(minor))}</small></div>`:''}</div>`;
}
const roles={Stroke:'Stroke fast','ER / Refer':'ICU-ER-Refer','Consult ต่างแผนก':'ต่างแผนก','OPD / Ward':'OPD',Gyne:'GYN','ผู้ใหญ่ · Consult':'ผู้ใหญ่ · OPD/ต่างแผนก','ผู้ใหญ่ · ER / รพช.':'ผู้ใหญ่ · ER/Refer','เด็ก / วัยรุ่น':'จิตเวชเด็ก',OB:'OB'};
function roleTitle(e){const r=e.role||'';if(roles[r])return roles[r];if(/NICU/i.test(r))return 'Refer NICU';if(/เด็กโต|PICU/.test(r))return 'เด็กโต / PICU';if(/^OPD1/.test(r))return 'OPD';if(/OPD2/.test(r))return 'ICU / ต่างแผนก';if(/พิเศษชั้น/.test(r))return 'พิเศษชั้น 5–6';if(/newborn|รับเด็ก/i.test(r))return 'NB / หลังคลอด';return '';}
function morning(date,dept){
 if(dept==='ANES')return [{name:'โทร 3203',phone:true}];
 const weekday=new Date(date+'T12:00:00Z').getUTCDay();
 if(['FORENSIC','MAXILO'].includes(dept)&&weekday>0&&weekday<6&&!(data.holidays||[]).includes(date)&&data.fixedWeekdayStaff?.[dept])return [{name:data.fixedWeekdayStaff[dept]}];
 let es=entries(date,dept,'in').filter(e=>!isInternEntry(e));
 if(!es.length&&['SURG','ORTHO','NEURO','URO','ENT','FORENSIC','MAXILO'].includes(dept))es=entries(date,dept,'out').filter(e=>!isInternEntry(e)).slice(0,1);
 return es.flatMap(e=>e.names.map(name=>({name:first(name),title:roleTitle(e)})));
}
function overnight(date,dept){
 const es=entries(date,dept,'out'),staff=es.find(e=>!isInternEntry(e)),trainee=es.find(e=>isInternEntry(e));
 return {name:first(staff?.names?.[0]),minor:trainee?.names?.[0]||''};
}
function dayAssignments(date,dept){return morning(date,dept).map(a=>card(a.name,a)).join('')||empty();}
function dayColumns(){return auto&&bangkokParts().minutes<480?[{key:'out',date:nextDate(viewedDate,-1),label:'นอกเวลา'},{key:'in',date:viewedDate,label:'ในเวลา'}]:[{key:'in',date:viewedDate,label:'ในเวลา'},{key:'out',date:viewedDate,label:'นอกเวลา'}];}
function departmentRow(dept,cols){
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
 return `<div class="matrix-row"><button class="dept-tag" data-dept="ER">ER</button><div class="dept-grid">${cols.map(c=>`<div class="duty-cell">${c.key==='in'?day:out}</div>`).join('')}</div></div>`;
}
function transportRow(cols){return `<div class="matrix-row"><button class="dept-tag" data-dept="TRANSPORT">OPD<br>นอกเวลา</button><div class="dept-grid">${cols.map(c=>`<div class="duty-cell">${entries(c.date,'TRANSPORT',c.key).flatMap(e=>e.names).map(n=>card(first(n))).join('')||empty()}</div>`).join('')}</div></div>`;}
function renderDuty(){
 const cols=dayColumns(),order=DEPT_ORDER.filter(d=>!['ER','TRANSPORT'].includes(d));
 return `<div class="grid-head"><span>แผนก</span>${cols.map(c=>`<strong>${c.label}</strong>`).join('')}</div>${order.filter(d=>selectedDepts.includes(d)).map(d=>departmentRow(d,cols)).join('')}${selectedDepts.includes('ER')?erRow(cols):''}${selectedDepts.includes('TRANSPORT')?transportRow(cols):''}`;
}
function opdChoices(){return [...new Set(['GP',...(data.entries||[]).filter(e=>e.source==='All OPD GP'||e.opd).map(e=>e.dept)])];}
function renderOpd(){
 return opdChoices().filter(d=>selectedOpds.includes(d)).map(d=>`<section class="opd-section"><h2>OPD ${esc(d)}</h2><div class="opd-grid">${['am','pm'].map((key,i)=>`<div class="opd-column"><h3>${i?'บ่าย':'เช้า'}</h3>${entries(viewedDate,d,key).flatMap(e=>e.names.map(n=>card(n,{title:e.role}))).join('')||empty()}</div>`).join('')}</div></section>`).join('')||'<p class="empty-message">ไม่มี OPD ที่เลือก</p>';
}
function monthDates(ym){const [y,m]=ym.split('-').map(Number);return Array.from({length:new Date(Date.UTC(y,m,0)).getUTCDate()},(_,i)=>`${ym}-${String(i+1).padStart(2,'0')}`);}
function monthSlot(date,key){
 if(monthDept==='ER')return entries(date,'ER',key).flatMap(e=>e.names).map(n=>card(key==='morning'?n:first(n),{backup:key==='morning'})).join('')||empty();
 if(monthDept==='GP')return entries(date,'GP',key).flatMap(e=>e.names.map(n=>card(n,{title:e.role}))).join('')||empty();
 if(monthDept==='TRANSPORT')return entries(date,'TRANSPORT',key).flatMap(e=>e.names).map(n=>card(n)).join('')||empty();
 if(key==='in')return dayAssignments(date,monthDept);
 const a=overnight(date,monthDept);return a.name?card(a.name,{minor:a.minor}):empty();
}
function renderMonth(){
 const fixed=['MED','PED'].includes(monthDept);
 const columns=monthDept==='ER'?[['morning','ER เช้า'],['evening','ER บ่าย'],['night','ER ดึก']]:monthDept==='GP'?[['am','เช้า'],['pm','บ่าย']]:fixed?[['out','นอกเวลา']]:[['in','ในเวลา'],['out','นอกเวลา']];
 const choices=[...DEPT_ORDER,'GP'],dates=monthDates(selectedMonth);
 const rows=dates.map(date=>{const dow=new Date(date+'T12:00:00Z').getUTCDay();return `<div class="month-row" style="--n:${columns.length}"><div class="month-day weekday-${dow}">${Number(date.slice(-2))}</div>${columns.map(([key])=>`<div class="month-slot">${monthSlot(date,key)}</div>`).join('')}</div>`;}).join('');
 const fixedDate=dates.find(d=>morning(d,monthDept).length)||dates[0];
 return `<div class="department-picker"><label for="month-dept">แผนก</label><select id="month-dept">${choices.map(d=>`<option value="${d}" ${d===monthDept?'selected':''}>${esc(DEPT_LABELS[d]||d)}</option>`).join('')}</select></div><div class="month-table"><div class="month-row" style="--n:${columns.length}"><div class="header-cell">วันที่</div>${columns.map(([,l])=>`<div class="header-cell">${l}</div>`).join('')}</div>${rows}</div>${fixed?`<section class="fixed-in"><h2>ในเวลา</h2><div class="fixed-grid">${dayAssignments(fixedDate,monthDept)}</div></section>`:''}`;
}
function renderFilter(){
 const isOpd=tab==='opd',all=isOpd?opdChoices():DEPT_ORDER,selected=isOpd?selectedOpds:selectedDepts;
 $('filter-panel').hidden=!filterOpen||tab==='month';$('filter-btn').setAttribute('aria-expanded',String(filterOpen));
 $('filter-panel').innerHTML=`<div class="filter-title">${isOpd?'เลือก OPD':'เลือกแผนก'}<button id="select-all">เลือกทั้งหมด</button></div><div class="filter-options">${all.map(d=>`<label><input class="filter-check" type="checkbox" value="${d}" ${selected.includes(d)?'checked':''}>${esc(isOpd?'OPD '+d:DEPT_LABELS[d]||d)}</label>`).join('')}</div>`;
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
async function sync(){if(syncing||!hasConnection())return;syncing=true;render();try{const fresh=await fetchGoogleSheet(config.spreadsheetId,config.apiKey);await saveSnapshot(fresh);data=fresh;rebuild();banner(fresh.warnings?.length?`พบข้อมูลผิดพลาด ${fresh.warnings.length} รายการในชีต`:'');}catch(e){banner(`ซิงก์ไม่สำเร็จ: ${e.message}`);}finally{syncing=false;render();}}
function moveMonth(delta){const d=new Date(selectedMonth+'-01T12:00:00Z');d.setUTCMonth(d.getUTCMonth()+delta);selectedMonth=d.toISOString().slice(0,7);render();}
function init(){
 document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{tab=b.dataset.tab;filterOpen=false;render();});
 $('view-date').onchange=e=>{viewedDate=e.target.value||bangkokParts().date;auto=false;render();};
 $('prev-date').onclick=()=>{viewedDate=nextDate(viewedDate,-1);auto=false;render();};$('next-date').onclick=()=>{viewedDate=nextDate(viewedDate,1);auto=false;render();};
 $('prev-month').onclick=()=>moveMonth(-1);$('next-month').onclick=()=>moveMonth(1);$('month-input').onchange=e=>{if(e.target.value)selectedMonth=e.target.value;render();};
 $('today-btn').onclick=()=>{if(tab==='month')selectedMonth=bangkokParts().date.slice(0,7);else{auto=true;viewedDate=bangkokParts().date;}render();};
 $('refresh-btn').onclick=sync;$('filter-btn').onclick=()=>{filterOpen=!filterOpen;renderFilter();};
 $('filter-panel').onchange=e=>{if(!e.target.matches('.filter-check'))return;const opd=tab==='opd';let list=opd?selectedOpds:selectedDepts;list=e.target.checked?[...new Set([...list,e.target.value])]:list.filter(x=>x!==e.target.value);if(opd)selectedOpds=list;else selectedDepts=list;setPreference(opd?'opds':'departments',list);render();};
 $('filter-panel').onclick=e=>{if(e.target.id!=='select-all')return;if(tab==='opd')selectedOpds=opdChoices();else selectedDepts=[...DEPT_ORDER];setPreference(tab==='opd'?'opds':'departments',tab==='opd'?selectedOpds:selectedDepts);render();};
 $('screen').onclick=e=>{const b=e.target.closest('[data-dept]');if(b){monthDept=b.dataset.dept;selectedMonth=viewedDate.slice(0,7);tab='month';filterOpen=false;setPreference('monthDept',monthDept);render();}};
 $('screen').onchange=e=>{if(e.target.id==='month-dept'){monthDept=e.target.value;setPreference('monthDept',monthDept);render();}};
 window.addEventListener('online',()=>sync());document.addEventListener('visibilitychange',()=>{if(!document.hidden){render();if(Date.now()-Date.parse(data.syncedAt||0)>300000)sync();}});
 setInterval(()=>{render();if(document.visibilityState==='visible'&&Date.now()-Date.parse(data.syncedAt||0)>300000)sync();},30000);
}
async function boot(){try{const cached=await loadSnapshot();if(cached?.entries?.length&&cached.spreadsheetId===config.spreadsheetId)data=cached;}catch{}rebuild();init();render();if(navigator.onLine)sync();if('serviceWorker'in navigator&&(location.protocol==='https:'||location.hostname==='localhost'))navigator.serviceWorker.register('./sw.js').catch(()=>{});}
boot();
