import {ER_SYNC_CONFIG} from './er-sync-config.js';
import {fetchERFeed,overlayER} from './er-sync.js';
import {canonicalName} from './names.js';
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
const parts=raw=>String(raw??'').split('/').map(canonicalName).filter(Boolean);
const first=raw=>parts(raw)[0]||'';
const isInternEntry=e=>/^(?:intern(?:\s|$)|1st call)/i.test(e.role||'');
let data=makeDemo(),config=getPreference('connection',DEFAULT_CONFIG),tab='duty',viewedDate=bangkokParts().date,selectedMonth=viewedDate.slice(0,7),auto=true,filterOpen=false;
let selectedDepts=getPreference('departments',DEPT_ORDER),selectedOpds=getPreference('opds-v4',[...OPD_GROUPS,'DENTAL']),monthDept=getPreference('monthDept','ER'),syncing=false;
let opdMode='in',opdOverrides=getPreference('opdHolidayOverrides',[]),holidaySyncTime=getPreference('opdHolidaySyncTime','');
let monthMode='dept',personName=canonicalName(getPreference('monthPerson',''));
selectedOpds=[...new Set(selectedOpds.flatMap(g=>g==='SURGICAL'?['SURG','ORTHO','URO','NEURO']:g))];
let erSyncError='',erCheckedAt='';
let index=new Map(),colors=new Map(),interns=new Set(INTERN_NAMES);
function rebuild(){
 data.entries=(data.entries||[]).map(e=>({...e,names:(e.names||[]).map(n=>parts(n).join(' / '))}));
 if(data.fixedWeekdayStaff)data.fixedWeekdayStaff=Object.fromEntries(Object.entries(data.fixedWeekdayStaff).map(([d,n])=>[d,canonicalName(n)]));
 index=new Map();interns=new Set(INTERN_NAMES);
 for(const e of data.entries||[]){const k=`${e.date}|${e.dept}|${e.key}`;if(!index.has(k))index.set(k,[]);index.get(k).push(e);if(isInternEntry(e)||e.doctorRole==='Intern')for(const n of e.names||[])parts(n).forEach(p=>interns.add(p));}
 const names=[...new Set((data.entries||[]).flatMap(e=>(e.names||[]).flatMap(parts)))].concat(CLINIC_DOCTORS,Object.values(SMC).flat(2).map(r=>r[1]),['มนตรี','อักษราภัค']).map(canonicalName).filter(Boolean).sort((a,b)=>a.localeCompare(b,'th'));
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
 for(const columns of Object.values(SMC))columns.forEach((cell,i)=>cell.forEach(([clinic,name])=>add(name,['MED','OB-GYN','SURGICAL','SURGICAL',clinic==='Eye'?'EYE':clinic==='Uro'?'URO':'PSY','DENTAL'][i])));
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
function personLink(name,cls='doctor'){
 const n=canonicalName(name);
 if(!n||n==='แพทย์ลา'||n.startsWith('โทร'))return `<span class="${cls}">${esc(n)}</span>`;
 return `<button type="button" class="person-link ${cls}" data-person="${esc(n)}">${esc(n)}</button>`;
}
function card(name,{title='',minor='',intern=false,backup=false,phone=false,companions=[]}={}){
 if(!name)return empty();const main=first(name),second=backup?parts(name).slice(1).join(' / '):'';
 const grey=intern||(interns.has(main)&&!(tab==='opd'||(tab==='month'&&monthDept==='GP')));
 const color=phone?'#edf1f5':grey?'#e9edf1':colors.get(main)||'#e7edf4';
 return `<div class="assignment${grey?' intern':''}" style="--person:${color}">${title?`<span class="role">${esc(title)}</span>`:''}<div class="staff-line">${personLink(main)}${second?`<small class="backup">/ ${parts(second).map(n=>personLink(n,'backup')).join(' / ')}</small>`:''}${minor?`<span class="first-call">1st call ${personLink(first(minor),'intern-name')}</span>`:''}${companions.length?`<span class="first-call er-companion">${companions.map(n=>personLink(n,'intern-name')).join(' / ')}</span>`:''}</div></div>`;
}
const roles={Stroke:'Stroke fast','ER / Refer':'ICU-ER-Refer','Consult ต่างแผนก':'ต่างแผนก','OPD / Ward':'OPD',Gyne:'GYN','ผู้ใหญ่ · Consult':'ผู้ใหญ่ · OPD/ต่างแผนก','ผู้ใหญ่ · ER / รพช.':'ผู้ใหญ่ · ER/Refer','เด็ก / วัยรุ่น':'จิตเวชเด็ก',OB:'OB'};
function roleTitle(e){const r=e.role||'';if(roles[r])return roles[r];if(/NICU/i.test(r))return 'Refer NICU';if(/เด็กโต|PICU/.test(r))return 'เด็กโต / PICU';if(/^OPD1/.test(r))return 'OPD';if(/OPD2/.test(r))return 'ICU / ต่างแผนก';if(/พิเศษชั้น/.test(r))return 'พิเศษชั้น 5–6';if(/newborn|รับเด็ก/i.test(r))return 'NB / หลังคลอด';return '';}
function morning(date,dept){
 if(dutyHoliday(date,data)){const a=overnight(date,dept);return a.name?[{name:a.name}]:[];}
 if(dept==='NEURO'){
  const source=entries(date,'NEURO','in').find(e=>!isInternEntry(e));
  return [{name:source?.names?.length?first(source.names[0]):'ชรินทร์'}];
 }
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
 if(dutyHoliday(viewedDate,data)){const a=overnight(viewedDate,dept);return `<div class="matrix-row"><button class="dept-tag" data-dept="${dept}">${esc($('app').classList.contains('fullscreen-mode')?({MAXILO:'MAX',FORENSIC:'FORENSIC',TRANSPORT:'OPD','OB-GYN':'OB/GYN'}[dept]||dept):(DEPT_LABELS[dept]||dept))}</button><div class="dept-grid"><div class="shared-cell">${a.name?card(a.name,{minor:a.minor}):empty()}</div></div></div>`;}
 const ins=cols.find(c=>c.key==='in'),outs=cols.find(c=>c.key==='out'),am=morning(ins.date,dept),pm=overnight(outs.date,dept);
 const richMonitor=$('app').classList.contains('fullscreen-mode')&&['MED','PED','OB-GYN','PSY'].includes(dept);
 const match=!richMonitor&&ins.date===outs.date?am.findIndex(a=>a.name&&a.name===pm.name&&!a.phone):-1,remaining=am.filter((_,i)=>i!==match);
 const monitor=$('app').classList.contains('fullscreen-mode'),stackedIn=monitor&&['MED','PED'].includes(dept);
 const inHtml=stackedIn?`<div class="monitor-in-stack" style="--in-cols:${Math.max(1,Math.ceil(remaining.length/3))}">${remaining.map(a=>card(a.name,a)).join('')||empty()}</div>`:remaining.map(a=>card(a.name,a)).join('')||empty(),outHtml=pm.name?card(pm.name,{minor:pm.minor}):empty();
 const shared=match>=0?`<div class="shared-cell${am[match].title?' with-shared-role':''}">${am[match].title?`<span class="shared-role" style="left:${cols[0].key==='in'?'0':'50%'}">${esc(am[match].title)}</span>`:''}${card(pm.name,{minor:pm.minor})}</div>`:'';
 const rest=match>=0?(remaining.length?`<div class="duty-cell" style="grid-column:${cols[0].key==='in'?1:2}">${inHtml}</div>`:''):cols.map(c=>`<div class="duty-cell">${c.key==='in'?inHtml:outHtml}</div>`).join('');
 return `<div class="matrix-row${am.length===1&&match>=0?' monitor-compact':''}"><button class="dept-tag" data-dept="${dept}">${esc(DEPT_LABELS[dept]||dept)}</button><div class="dept-grid">${shared}${rest}</div></div>`;
}
// June/July ER entries retain "EP / paired intern" from the source sheet.
// Exclude a second EP: that remains the existing morning backup display.
const ER_EP_NAMES=new Set(['กฤษฎา','โชษิตา','กฤศญา']);
function erCompanions(raw,date){
 if(!['06','07'].includes(date.slice(5,7))||!ER_EP_NAMES.has(first(raw)))return [];
 return [...new Set(parts(raw).slice(1).filter(n=>!ER_EP_NAMES.has(n)))];
}
function erShiftNames(date,key){
 const names=entries(date,'ER',key).flatMap(e=>e.names);
 return names.length?names:data.erComparisons?.[date+'|'+key]?['']:[];
}
function erSyncStatus(){
 const month=tab==='month'?selectedMonth:viewedDate.slice(0,7);
 if(month!==ER_SYNC_CONFIG.month||tab==='opd')return '';
 const feed=data.erFeed;
 const differences=Object.values(data.erComparisons||{}).filter(c=>c.different).length;
 const text=feed?'ER-duty · ฉบับจริง รุ่น '+feed.revision+' · ต่างจาก Sheet '+differences+' ช่อง':'ER ยังใช้ Google Sheet · รอตารางฉบับจริงจาก ER-duty';
 return '<div class="er-sync-status">'+esc(text)+(erSyncError?'<small>'+esc(erSyncError)+' · คงข้อมูลล่าสุดที่อ่านสำเร็จ</small>':'')+'</div>';
}
function erAssignment(raw,date,key,title=''){
 const companions=erCompanions(raw,date);
 let html=card(companions.length?first(raw):(key==='morning'?raw:first(raw)),{title,backup:key==='morning'&&!companions.length,companions});
 const comparison=data.erComparisons?.[date+'|'+key];
 if(!comparison?.different)return html;
 const badge='<span class="er-sync-warning" aria-label="ชื่อจากสองแหล่งไม่ตรงกัน">!!</span>';
 html=raw?html.replace('<div class="staff-line">','<div class="staff-line">'+badge):'<div class="assignment er-empty-conflict">'+badge+'<span>ยังไม่ระบุแพทย์ใน ER-duty</span></div>';
 return '<div class="er-sync-cell conflict">'+html+'<details class="er-sync-details"><summary>เปรียบเทียบชื่อ</summary><div>ER-duty: '+esc(comparison.erNames.join(' / ')||'ว่าง')+'</div><div>Google Sheet: '+esc(comparison.sheetNames.join(' / ')||(comparison.sheetAvailable?'ว่าง':'ยังไม่มีข้อมูลวันที่นี้'))+'</div><small>ER รุ่น '+comparison.revision+' · Sheet '+esc(lastSyncLabel(comparison.sheetSyncedAt))+'</small></details></div>';
}
function erRow(cols){
 const day=erShiftNames(viewedDate,'morning').map(n=>erAssignment(n,viewedDate,'morning','ER เช้า')).join('')||empty();
 const nightDate=auto&&bangkokParts().minutes<480?nextDate(viewedDate,-1):viewedDate;
 const shift=(key,title,date)=>erShiftNames(date,key).map(n=>erAssignment(n,date,key,title)).join('')||empty();
 const out=`<div class="er-split">${shift('evening','ER บ่าย',nightDate)}${shift('night','ER ดึก',nightDate)}</div>`;
 if(dutyHoliday(viewedDate,data))return `<div class="matrix-row"><button class="dept-tag" data-dept="ER">ER</button><div class="holiday-er">${day}${shift('evening','ER บ่าย',viewedDate)}${shift('night','ER ดึก',viewedDate)}</div></div>`;
 return `<div class="matrix-row"><button class="dept-tag" data-dept="ER">ER</button><div class="dept-grid">${cols.map(c=>`<div class="duty-cell">${c.key==='in'?day:out}</div>`).join('')}</div></div>`;
}
function transportRow(cols){
 const cells=cols.map(c=>{const h=entries(c.date,'TRANSPORT',c.key).flatMap(e=>e.names).map(n=>card(first(n))).join('')||empty();return `<div class="duty-cell">${c.key==='out'?`<div class="er-split">${h}<div class="night-blank"></div></div>`:h}</div>`;}).join('');
 return `<div class="matrix-row"><button class="dept-tag" data-dept="TRANSPORT">OPD<br>นอกเวลา</button><div class="dept-grid">${cells}</div></div>`;
}
function renderDuty(){
 const cols=dayColumns(),order=DEPT_ORDER.filter(d=>!['ER','TRANSPORT'].includes(d)).concat(['ER','TRANSPORT']);
 const visible=order.filter(d=>selectedDepts.includes(d));
 const heading=`<div class="grid-head"><span>แผนก</span>${dutyHoliday(viewedDate,data)?'<strong class="holiday-heading">นอกเวลาวันหยุด</strong>':cols.map(c=>`<strong>${c.label}</strong>`).join('')}</div>`;
 const rows=list=>list.map(d=>d==='ER'?erRow(cols):d==='TRANSPORT'?transportRow(cols):departmentRow(d,cols)).join('');
 if($('app').classList.contains('fullscreen-mode')){
  const ins=cols.find(c=>c.key==='in'),outs=cols.find(c=>c.key==='out');
  const weight=d=>{
   if(d==='ER')return 1.5;
   if(d==='TRANSPORT')return 1;
   const am=morning(ins.date,d),pm=overnight(outs.date,d);
   if(am.length===1&&am[0].name===pm.name&&!am[0].title)return .65;
   if(['MED','PED'].includes(d)&&!dutyHoliday(viewedDate,data))return 3.6;
   return Math.max(1,am.length*1.1);
  };
  const total=visible.reduce((n,d)=>n+weight(d),0);
  let split=1,best=Infinity,sum=0;
  for(let i=1;i<visible.length;i++){sum+=weight(visible[i-1]);const difference=Math.abs(total-2*sum);if(difference<best){best=difference;split=i;}}
  const groups=visible.length>1?[visible.slice(0,split),visible.slice(split)]:[visible];
  return `<div class="monitor-grid">${groups.map(group=>`<section class="monitor-column" style="grid-template-rows:${group.map(d=>`minmax(0,${weight(d)}fr)`).join(' ')}">${rows(group)}</section>`).join('')}</div>`;
 }
 return heading+rows(visible);
}

function opdChoices(){return opdMode==='smc'?['MED','OB-GYN','SURG','ORTHO','URO','EYE','PSY','DENTAL']:OPD_GROUPS;}
function clinicCard(r){
 const bare=r.doctors.length&&['OB-GYN','EYE','ENT','PSY','SKIN','SURG','ORTHO','URO','NEURO'].includes(r.group)&&r.clinic!=='Chemo';
 return `<div class="clinic-card">${bare?'':`<strong>${esc(r.clinic)}</strong>`}${r.doctors.map(raw=>{const n=canonicalName(raw);return `<small style="background:${colors.get(n)||'#edf3f7'}">${personLink(n,'clinic-doctor')}</small>`;}).join('')}${r.weeks?`<span class="clinic-note">${r.weeks.join(',')}</span>`:''}${r.note?`<span class="clinic-note">${esc(r.note)}</span>`:''}</div>`;
}
function renderSmc(){
 const day=new Date(viewedDate+'T12:00:00Z').getUTCDay(),monday=nextDate(viewedDate,1-(day||7));
 const group=['MED','OB-GYN','SURG','ORTHO',null,'DENTAL'];
 const rows=[1,2,3,4].map((d,i)=>{const date=nextDate(monday,i),closed=opdHoliday(date,data,opdOverrides);
 return `<tr class="smc-weekday-${d} ${date===viewedDate?'selected-smc':''}"><th>${['Mon','Tue','Wed','Thu'][i]}<small>${date.slice(8)}/${date.slice(5,7)}</small></th>${SMC[d].map((cell,j)=>`<td>${closed?'':cell.filter(([clinic])=>selectedOpds.includes(group[j]||(clinic==='Eye'?'EYE':clinic==='Uro'?'URO':'PSY'))).map(([clinic,n])=>clinicCard({clinic,doctors:[n]})).join('')}</td>`).join('')}</tr>`;}).join('');
 return `<div class="smc-time">SMC · 16:30–20:30 น.</div><div class="smc-scroll"><table class="smc-table"><thead><tr><th>วัน</th>${['MED','OB','Sx','Ortho','Other','Dent'].map(n=>`<th>${n}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table></div>`;
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
 if(monthDept==='ER')return erShiftNames(date,key).map(n=>erAssignment(n,date,key)).join('')||empty();
 if(monthDept==='GP'&&opdHoliday(date,data,opdOverrides))return empty();
 if(key==='in'&&dutyHoliday(date,data)&&!['ER','GP','TRANSPORT'].includes(monthDept)){const a=overnight(date,monthDept);return a.name?card(a.name,{minor:a.minor}):empty();}
 if(monthDept==='GP')return entries(date,'GP',key).flatMap(e=>e.names.map(n=>card(n,{title:e.role}))).join('')||empty();
 if(monthDept==='TRANSPORT')return entries(date,'TRANSPORT',key).flatMap(e=>e.names).map(n=>card(n)).join('')||empty();
 if(key==='in')return dayAssignments(date,monthDept);
 const a=overnight(date,monthDept);return a.name?card(a.name,{minor:a.minor}):empty();
}
function renderDepartmentMonth(){
 const fixed=['MED','PED'].includes(monthDept);
 const columns=monthDept==='ER'?[['morning','ER เช้า'],['evening','ER บ่าย'],['night','ER ดึก']]:monthDept==='GP'?[['am','เช้า'],['pm','บ่าย']]:fixed?[['out','นอกเวลา']]:[['in','ในเวลา'],['out','นอกเวลา']];
 const choices=[...DEPT_ORDER,'GP'],dates=monthDates(selectedMonth);
 const rows=dates.map(date=>{const dow=new Date(date+'T12:00:00Z').getUTCDay();return `<div class="month-row" style="--n:${columns.length}"><div class="month-day weekday-${dow}">${Number(date.slice(-2))}</div>${dutyHoliday(date,data)&&!['ER','GP','TRANSPORT'].includes(monthDept)&&!fixed?`<div class="month-slot month-holiday">${monthSlot(date,'out')}</div>`:columns.map(([key])=>`<div class="month-slot">${monthSlot(date,key)}</div>`).join('')}</div>`;}).join('');
 const fixedDate=dates.find(d=>!dutyHoliday(d,data)&&morning(d,monthDept).length)||dates[0];
 return `<div class="department-picker"><label for="month-dept">แผนก</label><select id="month-dept">${choices.map(d=>`<option value="${d}" ${d===monthDept?'selected':''}>${esc(DEPT_LABELS[d]||d)}</option>`).join('')}</select></div><div class="month-table"><div class="month-row" style="--n:${columns.length}"><div class="header-cell">วันที่</div>${columns.map(([,l])=>`<div class="header-cell">${l}</div>`).join('')}</div>${rows}</div>${fixed?`<section class="fixed-in"><h2>ในเวลา</h2><div class="fixed-grid">${dayAssignments(fixedDate,monthDept)}</div></section>`:''}`;
}

function personActivities(date,name){
 const target=canonicalName(name),found=[];
 const add=(period,label,start,end,kind)=>{const key=[period,label,start,end,kind].join('|');if(!found.some(a=>a.id===key))found.push({id:key,period,label,start,end,kind});};
 const holiday=dutyHoliday(date,data);
 for(const dept of DEPT_ORDER.filter(d=>!['ER','TRANSPORT'].includes(d))){
  const out=overnight(date,dept),label=DEPT_LABELS[dept]||dept;
  if(holiday){
   if(out.name===target)add('all',label+' · เวรวันหยุด',0,1920,'consult');
   if(first(out.minor)===target)add('all',label+' · 1st call',0,1920,'consult');
  }else{
   for(const a of morning(date,dept))if(a.name===target)add('in',label+(a.title?' · '+a.title:''),480,960,'consult');
   if(out.name===target)add('out',label+' · เวรนอกเวลา',960,1920,'consult');
   if(first(out.minor)===target)add('out',label+' · 1st call',960,1920,'consult');
  }
 }
 for(const [key,title,period,start,end] of [['morning','ER เช้า','in',480,960],['evening','ER บ่าย','out',960,1380],['night','ER ดึก','out',1380,1920]]){
  for(const e of entries(date,'ER',key))for(const raw of e.names){
   if(first(raw)===target)add(period,title+(data.erComparisons?.[date+'|'+key]?.different?' !!':''),start,end,'ER');
   if(erCompanions(raw,date).includes(target))add(period,title+' · คู่ EP '+first(raw),start,end,'ER');
   else if(key==='morning'&&parts(raw).slice(1).includes(target))add(period,title+' · ชื่อที่สอง',start,end,'ER');
  }
 }
 for(const [key,period,title,start,end] of [['in','in','OPD นอกเวลา เช้า',510,750],['out','out','OPD นอกเวลา บ่าย',990,1230]])for(const e of entries(date,'TRANSPORT',key))if(e.names.some(n=>first(n)===target))add(period,title,start,end,'OPD');
 if(!opdHoliday(date,data,opdOverrides)){
  for(const [key,title,start,end] of [['am','OPD GP เช้า',480,720],['pm','OPD GP บ่าย',780,960]])for(const e of entries(date,'GP',key))if(e.names.some(n=>parts(n).includes(target)))add('in',title+' · '+e.role,start,end,'GP');
  for(const r of clinicsForDate(date))if(r.doctors.some(n=>canonicalName(n)===target))add('in','OPD '+r.clinic+(r.session==='am'?' เช้า':' บ่าย'),r.session==='am'?480:780,r.session==='am'?720:960,'specialist');
  const day=new Date(date+'T12:00:00Z').getUTCDay();
  for(const [clinic,n] of (SMC[day]||[]).flat())if(canonicalName(n)===target)add('out','SMC · '+clinic,990,1230,'SMC');
 }
 return found;
}
function renderPersonMonth(){
 const names=[...colors.keys()].filter(n=>n!=='แพทย์ลา'&&!n.startsWith('โทร')).sort((a,b)=>a.localeCompare(b,'th'));
 if(!names.includes(personName))personName=names[0]||'';
 const rows=monthDates(selectedMonth).map(date=>{
  const activities=personActivities(date,personName),all=activities.filter(a=>a.period==='all'),dow=new Date(date+'T12:00:00Z').getUTCDay();
  const cell=period=>{
   const acts=activities.filter(a=>a.period===period);
   const overlap=acts.some((a,i)=>acts.some((b,j)=>j>i&&a.start<b.end&&b.start<a.end));
   return `<div class="person-activities${overlap?' overlapping':''}">${acts.map(a=>`<div class="activity ${a.kind==='SMC'?'smc-activity':''}">${esc(a.label)}</div>`).join('')||'<span class="activity-empty">—</span>'}</div>`;
  };
  return `<div class="person-month-row"><div class="month-day weekday-${dow}">${Number(date.slice(-2))}</div>${all.length?`<div class="all-day-activities">${all.map(a=>`<div class="activity">${esc(a.label)}</div>`).join('')}</div>`:''}${cell('in')}${cell('out')}</div>`;
 }).join('');
 return `<div class="department-picker"><label for="month-person">แพทย์</label><select id="month-person">${names.map(n=>`<option value="${esc(n)}" ${n===personName?'selected':''}>${esc(n)}</option>`).join('')}</select></div><div class="person-month-head"><span>วัน</span><span>ในเวลา</span><span>นอกเวลา</span></div>${rows}<p class="person-note">งานที่เวลาทับกันแสดงขนานกัน · คลินิกที่ระบุเพียงแพทย์หมุนเวียนยังไม่ผูกกับรายคน</p>`;
}
function renderMonth(){
 const tabs=`<div class="opd-tabs"><button data-month-mode="dept" class="${monthMode==='dept'?'active':''}">รายแผนก</button><button data-month-mode="person" class="${monthMode==='person'?'active':''}">รายคน</button></div>`;
 return tabs+(monthMode==='person'?renderPersonMonth():renderDepartmentMonth());
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
 $('date-nav').className='nav-control weekday-'+new Date(viewedDate+'T12:00:00Z').getUTCDay();
 $('view-date').value=viewedDate;$('month-input').value=selectedMonth;$('month-label').textContent=new Intl.DateTimeFormat('en-GB',{month:'short',year:'numeric',timeZone:'UTC'}).format(new Date(selectedMonth+'-01T12:00:00Z'));
 $('today-btn').textContent=monthly?'เดือนนี้':'วันนี้';$('filter-btn').textContent=tab==='opd'?'กรอง OPD':'กรองแผนก';
 $('screen').classList.toggle('monitor-layout',$('app').classList.contains('fullscreen-mode')&&tab==='duty');
 $('screen').innerHTML=erSyncStatus()+(monthly?renderMonth():tab==='opd'?renderOpd():renderDuty());
 $('demo-banner').hidden=!data.demo;$('sync-time').textContent=lastSyncLabel(data.syncedAt);$('refresh-btn').disabled=!(hasConnection()||ER_SYNC_CONFIG.feedUrl)||syncing;renderFilter();
}
function hasConnection(){return !!(config.spreadsheetId&&config.apiKey);}
function banner(message=''){$('alert-banner').hidden=!message;$('alert-banner').textContent=message;}
async function sync(){
 if(syncing||(!hasConnection()&&!ER_SYNC_CONFIG.feedUrl))return;
 syncOpdHolidays();syncing=true;render();
 try{
  const [sheetResult,erResult]=await Promise.allSettled([
   hasConnection()?fetchGoogleSheet(config.spreadsheetId,config.apiKey):Promise.reject(new Error('ยังไม่ได้เชื่อม Google Sheet')),
   fetchERFeed(ER_SYNC_CONFIG)
  ]);
  const fresh=sheetResult.status==='fulfilled'?sheetResult.value:{...data,entries:data.sheetEntries||data.entries};
  let feed=data.erFeed||null;
  if(erResult.status==='fulfilled'&&erResult.value){
   if(!feed||erResult.value.revision>=feed.revision){feed=erResult.value;erSyncError='';erCheckedAt=new Date().toISOString();}
   else erSyncError='ต้นทางส่งรุ่นเก่ากว่าที่บันทึกไว้';
  }else if(erResult.status==='rejected')erSyncError=erResult.reason.message||'เชื่อม ER-duty ไม่สำเร็จ';
  const combined=overlayER(fresh,feed,ER_SYNC_CONFIG);
  combined.erCheckedAt=erCheckedAt||data.erCheckedAt||'';
  if(sheetResult.status==='fulfilled'||erResult.status==='fulfilled'&&erResult.value){
   await saveSnapshot(combined);data=combined;rebuild();
  }
  banner(sheetResult.status==='rejected'?'Google Sheet ยังใช้สำเนาล่าสุด: '+sheetResult.reason.message:'');
 }catch(e){banner('ซิงก์ไม่สำเร็จ: '+e.message);}
 finally{syncing=false;render();}
}
function moveMonth(delta){const d=new Date(selectedMonth+'-01T12:00:00Z');d.setUTCMonth(d.getUTCMonth()+delta);selectedMonth=d.toISOString().slice(0,7);render();}
function updateFullscreenUI(active){
 $('app').classList.toggle('fullscreen-mode',active);
 $('fullscreen-btn').textContent=active?'ออกเต็มจอ':'เต็มจอ';
 $('fullscreen-btn').setAttribute('aria-label',active?'ออกจากเต็มจอ':'เปิดเต็มจอ');
 $('fullscreen-btn').title=active?'ออกจากเต็มจอ':'เปิดเต็มจอ';
 render();
}
async function toggleFullscreen(){
 const app=$('app'),active=app.classList.contains('fullscreen-mode')||document.fullscreenElement===app;
 if(active){if(document.fullscreenElement)await document.exitFullscreen();else updateFullscreenUI(false);return;}
 try{if(app.requestFullscreen){await app.requestFullscreen();updateFullscreenUI(true);}else updateFullscreenUI(true);}
 catch{updateFullscreenUI(true);}
}
function init(){
 $('fullscreen-btn').onclick=toggleFullscreen;
 document.addEventListener('fullscreenchange',()=>updateFullscreenUI(document.fullscreenElement===$('app')));
 document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{tab=b.dataset.tab;filterOpen=false;render();});
 $('view-date').onchange=e=>{viewedDate=e.target.value||bangkokParts().date;auto=false;render();};
 $('prev-date').onclick=()=>{viewedDate=nextDate(viewedDate,-1);auto=false;render();};$('next-date').onclick=()=>{viewedDate=nextDate(viewedDate,1);auto=false;render();};
 $('prev-month').onclick=()=>moveMonth(-1);$('next-month').onclick=()=>moveMonth(1);$('month-input').onchange=e=>{if(e.target.value)selectedMonth=e.target.value;render();};
 $('today-btn').onclick=()=>{if(tab==='month')selectedMonth=bangkokParts().date.slice(0,7);else{auto=true;viewedDate=bangkokParts().date;}render();};
 $('refresh-btn').onclick=sync;$('filter-btn').onclick=()=>{filterOpen=!filterOpen;renderFilter();};
 $('filter-panel').onchange=e=>{if(!e.target.matches('.filter-check'))return;const opd=tab==='opd';let list=opd?selectedOpds:selectedDepts;list=e.target.checked?[...new Set([...list,e.target.value])]:list.filter(x=>x!==e.target.value);if(opd)selectedOpds=list;else selectedDepts=list;setPreference(opd?'opds-v4':'departments',list);render();};
 $('filter-panel').onclick=e=>{if(e.target.id!=='select-all')return;if(tab==='opd')selectedOpds=[...new Set([...OPD_GROUPS,'DENTAL'])];else selectedDepts=[...DEPT_ORDER];setPreference(tab==='opd'?'opds-v4':'departments',tab==='opd'?selectedOpds:selectedDepts);render();};
 $('screen').onclick=e=>{
 const person=e.target.closest('[data-person]');
 if(person){personName=canonicalName(person.dataset.person);monthMode='person';selectedMonth=tab==='month'?selectedMonth:viewedDate.slice(0,7);tab='month';filterOpen=false;setPreference('monthPerson',personName);render();return;}
 const monthly=e.target.closest('[data-month-mode]');if(monthly){monthMode=monthly.dataset.monthMode;render();return;}
const mode=e.target.closest('[data-opd-mode]');if(mode){opdMode=mode.dataset.opdMode;filterOpen=false;render();return;}const b=e.target.closest('[data-dept]');if(b){monthDept=b.dataset.dept;monthMode='dept';selectedMonth=viewedDate.slice(0,7);tab='month';filterOpen=false;setPreference('monthDept',monthDept);render();}};
 $('screen').onchange=e=>{if(e.target.id==='month-person'){personName=canonicalName(e.target.value);setPreference('monthPerson',personName);render();return;}if(e.target.id==='month-dept'){monthDept=e.target.value;setPreference('monthDept',monthDept);render();}};
 window.addEventListener('online',()=>{sync();syncOpdHolidays();});document.addEventListener('visibilitychange',()=>{if(!document.hidden){render();if(Date.now()-Date.parse(data.syncedAt||0)>300000)sync();}});
 setInterval(()=>{render();if(document.visibilityState==='visible'&&Date.now()-Date.parse(data.syncedAt||0)>300000)sync();},30000);
}
async function boot(){try{const cached=await loadSnapshot();if(cached?.entries?.length&&cached.spreadsheetId===config.spreadsheetId)data=cached.erFeed?overlayER(cached,cached.erFeed,ER_SYNC_CONFIG):cached;}catch{}data.opdHolidays=getPreference('opdHolidayDates',null);rebuild();init();render();if(navigator.onLine){sync();syncOpdHolidays();}if('serviceWorker'in navigator&&(location.protocol==='https:'||location.hostname==='localhost'))navigator.serviceWorker.register('./sw.js').catch(()=>{});}
boot();
