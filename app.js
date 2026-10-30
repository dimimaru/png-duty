import {fetchGoogleSheet} from './sheets.js';
import {DEPT_LABELS, DEPT_ORDER, INTERN_NAMES} from './parser.js';
import {bangkokParts,dailyColumns,shiftState,thaiDate,nextDate,lastSyncLabel} from './schedule.js';
import {loadSnapshot,saveSnapshot,clearSnapshot,getPreference,setPreference,clearPreferences} from './storage.js';
import {makeDemo} from './demo.js';
import {DEFAULT_CONFIG} from './config.js';

const $=id=>document.getElementById(id);
const esc=v=>String(v??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const palette=[['#91C7F5','#E5F3FE','#184F7A'],['#9DDBB5','#E6F5EB','#1F6741'],['#F6C594','#FFF1E2','#885021'],['#D3B8F5','#F2E9FE','#653C95'],['#F3B3CA','#FCE7EF','#883A58'],['#A2DCD8','#E7F7F5','#216965'],['#E5CF8C','#F9F3DE','#795C1F'],['#A7C5EC','#E9F0FA','#315A84']];
function tint(name){let sum=0;for(const c of String(name)) sum=(sum*31+c.codePointAt(0))>>>0;return palette[sum%palette.length]}
function chip(name,state='neutral',role=''){
  const [active,future,ink]=tint(name);
  return `<div class="assignment ${state}" style="--active:${active};--future:${future};--ink:${ink}">${role?`<span class="role">${esc(role)}</span>`:''}<span class="doctor">${esc(name)}</span></div>`;
}
function emptyCell(){return `<div class="assignment placeholder" aria-label="ไม่มีรายการ">—</div>`}
let data=makeDemo(), config=getPreference('connection',DEFAULT_CONFIG),tab='duty',now=bangkokParts();
let viewedDate=now.date,auto=true,filterOpen=false,roleFilter='all',selectedDepts=getPreference('departments',DEPT_ORDER);
let selectedMonth=now.date.slice(0,7),monthDept=getPreference('monthDept','ER'),syncInFlight=false;
function hasConnection(){return !!(config.spreadsheetId&&config.apiKey)}
function isDemo(){return !!data.demo}
function buildIndex(){const map=new Map();for(const e of data.entries||[]){const key=`${e.date}|${e.dept}|${e.key}`;if(!map.has(key))map.set(key,[]);map.get(key).push(e)}return map}
let index=buildIndex();
function getEntries(date,dept,key){return index.get(`${date}|${dept}|${key}`)||[]}
function stateFor(column){return shiftState(column,viewedDate,auto,now)}
function renderSlot(date,dept,key,state,showRoles=true){
  const entries=getEntries(date,dept,key);
  if(!entries.length)return emptyCell();
  return entries.map(e=>e.names.map(name=>chip(name,state,showRoles?e.role:'' )).join('')).join('');
}
function renderHead(columns,er=false){return `<div class="grid-head${er?' er-head':''}">${er?'':'<div class="header-cell"><strong>แผนก</strong></div>'}${columns.map(c=>`<div class="header-cell"><strong>${esc(c.label)}</strong><small>${esc(c.time)}</small></div>`).join('')}</div>`}
function renderDuty(){
  const cols=dailyColumns(viewedDate,auto,now);
  const er=cols.er.map(c=>`<div class="duty-cell">${renderSlot(c.date,'ER',c.key,stateFor(c),false)}</div>`).join('');
  const regular=DEPT_ORDER.filter(dep=>dep!=='ER'&&selectedDepts.includes(dep))
   .filter(dep=>cols.regular.some(c=>getEntries(c.date,dep,c.key).length))
   .map(dep=>`<div class="matrix-row"><div class="dept-tag">${esc(DEPT_LABELS[dep]||dep)}</div>${cols.regular.map(c=>`<div class="duty-cell">${renderSlot(c.date,dep,c.key,stateFor(c))}</div>`).join('')}</div>`).join('');
  const note=auto&&now.minutes<480?'นอกเวลาทางซ้ายเป็นเวรต่อเนื่องจากเมื่อคืน · ในเวลาทางขวาเป็นเวรเช้าวันใหม่':'';
  return `${selectedDepts.includes('ER')?`<div class="section-head"><h2>ER · ห้องฉุกเฉิน</h2><span class="meta">${esc(thaiDate(viewedDate))}${auto?' · Auto':''}</span></div><div class="er-grid">${renderHead(cols.er,true)}<div class="matrix-row er-row">${er}</div></div>`:''}
  <div class="section-head"><h2>เวรทุกแผนก</h2><span class="meta">${selectedDepts.length} แผนกที่เลือก</span></div>
  <div class="regular-grid">${renderHead(cols.regular)}${regular||'<div class="empty-message">ไม่พบเวรตามแผนกที่เลือกในวันดังกล่าว</div>'}</div>
  ${note?`<p class="inline-note">${note}</p>`:''}`;
}
function roleOf(name){return INTERN_NAMES.includes(name)?'intern':'unknown'}
function renderOpd(){
  const keys=[{key:'am',label:'เช้า'},{key:'pm',label:'บ่าย'}];
  const visible=(key)=>getEntries(viewedDate,'GP',key).map(e=>({...e,names:e.names.filter(n=>roleFilter==='all'||roleOf(n)===roleFilter)})).filter(e=>e.names.length);
  return `<div class="section-head"><h2>OPD · ${esc(thaiDate(viewedDate))}</h2><span class="meta">GP จากชีตปัจจุบัน</span></div>
  <div class="opd-toolbar"><div class="seg" role="group" aria-label="ประเภทแพทย์">${[['all','ทั้งหมด'],['staff','Staff'],['intern','Intern']].map(([value,label])=>`<button data-role="${value}" class="${roleFilter===value?'active':''}">${label}</button>`).join('')}</div></div>
  <div class="regular-grid">${renderHead([{label:'เช้า',time:'OPD'},{label:'บ่าย',time:'OPD'}])}
  <div class="matrix-row"><div class="dept-tag">GP</div>${keys.map(c=>`<div class="duty-cell">${visible(c.key).map(e=>e.names.map(n=>chip(n,'neutral',e.role)).join('')).join('')||emptyCell()}</div>`).join('')}</div></div>
  <p class="inline-note">ขณะนี้อ่านเฉพาะ OPD GP เท่านั้น · ตาราง OPD Staff เฉพาะทางยังไม่ได้เพิ่ม · ตัวกรอง Staff/Intern ใช้ทะเบียน Intern เบื้องต้น ชื่อที่ยังไม่จำแนกจะแสดงใน “ทั้งหมด” เท่านั้น</p>`;
}
function monthDates(ym){const [y,m]=ym.split('-').map(Number);const days=new Date(Date.UTC(y,m,0)).getUTCDate();return Array.from({length:days},(_,i)=>`${ym}-${String(i+1).padStart(2,'0')}`)}
function renderMonth(){
  const choices=DEPT_ORDER.concat('GP');const isEr=monthDept==='ER';const isGp=monthDept==='GP';
  const columns=isEr?[{key:'morning',label:'เช้า'},{key:'evening',label:'บ่าย'},{key:'night',label:'ดึก'}]:isGp?[{key:'am',label:'เช้า'},{key:'pm',label:'บ่าย'}]:[{key:'in',label:'ในเวลา'},{key:'out',label:'นอกเวลา'}];
  const head=`<div class="month-row" style="--n:${columns.length}"><div class="header-cell"><strong>วัน</strong></div>${columns.map(c=>`<div class="header-cell"><strong>${c.label}</strong></div>`).join('')}</div>`;
  const rows=monthDates(selectedMonth).map(date=>{
   const day=Number(date.slice(-2));const dow=new Intl.DateTimeFormat('th-TH',{weekday:'short',timeZone:'Asia/Bangkok'}).format(new Date(date+'T12:00:00Z'));
   const cells=columns.map(c=>`<div class="month-slot">${renderSlot(date,monthDept,c.key,'neutral',!isEr)}</div>`).join('');
   return `<div class="month-row" style="--n:${columns.length}"><div class="month-day">${day}<span class="dow"> ${dow}</span></div>${cells}</div>`;
  }).join('');
  return `<div class="section-head"><h2>ตารางเวรรายเดือน</h2><span class="meta">แยกตามแผนก</span></div>
  <div class="month-toolbar"><input type="month" id="month-input" value="${esc(selectedMonth)}" aria-label="เลือกเดือน"><select id="month-dept" aria-label="เลือกแผนก">${choices.map(d=>`<option value="${esc(d)}" ${d===monthDept?'selected':''}>${esc(DEPT_LABELS[d]||d)}</option>`).join('')}</select></div><div class="month-table">${head}${rows}</div>`;
}
function renderFilter(){
  const all=DEPT_ORDER;
  $('filter-panel').hidden=!filterOpen;$('filter-btn').setAttribute('aria-expanded',String(filterOpen));
  $('filter-panel').innerHTML=`<div class="filter-title">เลือกแผนกที่แสดงในเครื่องนี้ <button id="select-all-depts">เลือกทั้งหมด</button></div><div class="filter-options">${all.map(dep=>`<label><input class="dept-check" type="checkbox" value="${esc(dep)}" ${selectedDepts.includes(dep)?'checked':''}>${esc(DEPT_LABELS[dep]||dep)}</label>`).join('')}</div>`;
}
function render(){now=bangkokParts();if(auto)viewedDate=now.date;
  $('view-date').value=viewedDate;
  $('today-btn').classList.toggle('primary',auto);
  document.querySelectorAll('[data-tab]').forEach(b=>{const active=b.dataset.tab===tab;b.classList.toggle('active',active);b.setAttribute('aria-selected',String(active));});
  $('screen').innerHTML=tab==='duty'?renderDuty():tab==='opd'?renderOpd():renderMonth();
  $('demo-banner').hidden=!isDemo();
  $('source-label').textContent=isDemo()?'โหมดสาธิต':'Google Sheets · Read-only';
  $('sync-status').textContent=isDemo()?'ยังไม่เชื่อมข้อมูล':(navigator.onLine?'ซิงก์ล่าสุด':'Offline · ข้อมูลในเครื่อง');
  $('sync-time').textContent=lastSyncLabel(data.syncedAt);
  renderFilter();
}
function banner(message=''){$('alert-banner').hidden=!message;$('alert-banner').textContent=message;}
async function sync(){
  if(syncInFlight||!hasConnection())return;
  syncInFlight=true;$('refresh-btn').classList.add('spin');
  try {
    const fresh=await fetchGoogleSheet(config.spreadsheetId,config.apiKey);
    // Atomic: only replace in-memory and persistent cache after a successful, valid response.
    await saveSnapshot(fresh);data=fresh;index=buildIndex();banner(fresh.warnings.length?`ซิงก์สำเร็จ แต่พบ ${fresh.warnings.length} เซลล์ที่มีข้อผิดพลาด กรุณาตรวจใน Google Sheets`: '');
  } catch(e) {
    banner(`ซิงก์ไม่สำเร็จ: ${e.message} · ยังแสดงข้อมูล ${isDemo()?'สาธิต':'ที่บันทึกไว้'} ต่อไป`);
  } finally {syncInFlight=false;$('refresh-btn').classList.remove('spin');render();}
}
function initEvents(){
  document.querySelectorAll('[data-tab]').forEach(b=>b.addEventListener('click',()=>{tab=b.dataset.tab;filterOpen=false;render();}));
  $('view-date').addEventListener('change',e=>{viewedDate=e.target.value||now.date;auto=false;render();});
  $('today-btn').addEventListener('click',()=>{auto=true;viewedDate=bangkokParts().date;render();});
  $('refresh-btn').addEventListener('click',()=>hasConnection()?sync():$('settings-dialog').showModal());
  $('filter-btn').addEventListener('click',()=>{filterOpen=!filterOpen;renderFilter();});
  $('filter-panel').addEventListener('change',e=>{if(e.target.matches('.dept-check')) {selectedDepts=e.target.checked?[...new Set([...selectedDepts,e.target.value])]:selectedDepts.filter(x=>x!==e.target.value);setPreference('departments',selectedDepts);render();}});
  $('filter-panel').addEventListener('click',e=>{if(e.target.id==='select-all-depts'){selectedDepts=[...DEPT_ORDER];setPreference('departments',selectedDepts);render();}});
  $('screen').addEventListener('click',e=>{const b=e.target.closest('[data-role]');if(b){roleFilter=b.dataset.role;render();}});
  $('screen').addEventListener('change',e=>{if(e.target.id==='month-input'){selectedMonth=e.target.value;render();}if(e.target.id==='month-dept'){monthDept=e.target.value;setPreference('monthDept',monthDept);render();}});
  function openSettings(){$('spreadsheet-id').value=config.spreadsheetId||'';$('api-key').value=config.apiKey||'';$('settings-dialog').showModal();}
  $('settings-btn').addEventListener('click',openSettings);$('setup-quick').addEventListener('click',openSettings);
  $('close-settings').addEventListener('click',()=>$('settings-dialog').close());
  $('settings-form').addEventListener('submit',e=>{
    e.preventDefault();const next={spreadsheetId:$('spreadsheet-id').value.trim(),apiKey:$('api-key').value.trim()};
    if(!next.spreadsheetId||!next.apiKey){banner('กรุณากรอก Spreadsheet ID และ Google Sheets API Key ให้ครบ');$('settings-dialog').close();return;}
    config=next;setPreference('connection',config);$('settings-dialog').close();sync();
  });
  $('clear-data').addEventListener('click',async()=>{
    if(!confirm('ล้างการตั้งค่าและข้อมูลเวร Offline ในเครื่องนี้ทั้งหมด?'))return;
    await clearSnapshot();clearPreferences();config={spreadsheetId:'',apiKey:''};data=makeDemo();index=buildIndex();selectedDepts=[...DEPT_ORDER];banner('ล้างข้อมูลในเครื่องแล้ว');$('settings-dialog').close();render();
  });
  window.addEventListener('online',()=>{render();sync();});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden){render();if(Date.now()-Date.parse(data.syncedAt||0)>300000)sync();}});
  // Keeps 00:00 and 08:00 transitions correct while the PWA stays open.
  setInterval(()=>{const t=bangkokParts();if(t.date!==now.date||t.minutes!==now.minutes)render();if(hasConnection()&&document.visibilityState==='visible'&&Date.now()-Date.parse(data.syncedAt||0)>=300000)sync();},30000);
}
async function boot(){
  try {const cached=await loadSnapshot();if(cached?.entries?.length&&cached.spreadsheetId===config.spreadsheetId&&hasConnection()){data=cached;index=buildIndex();}} catch {banner('ไม่สามารถอ่าน Offline Cache ได้');}
  initEvents();render();if(hasConnection()&&navigator.onLine)sync();
  if('serviceWorker' in navigator && (location.protocol==='https:' || location.hostname==='localhost'))navigator.serviceWorker.register('./sw.js').catch(()=>{});
}
boot();
