// Compact daily and weekly OR boards. Person links reuse the app's existing monthly profile navigation.
import {OR_ROOM_IDS,OR_DAY_LABELS,OR_SCHEDULE,orDayOfDate} from './or.js';
import {canonicalName} from './names.js';
import {nextDate} from './schedule.js';
const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const shortDate=date=>new Intl.DateTimeFormat('th-TH',{timeZone:'Asia/Bangkok',day:'numeric',month:'short'}).format(new Date(date+'T12:00:00Z'));
const roomName=room=>room==='M'?'Minor': 'OR '+room;
const sessionName=period=>period==='am'?'เช้า':'บ่าย';
function orEntry(item,colors,personLink){
 const n=item.doctor?canonicalName(item.doctor):'';
 if(!n)return `<div class="or-entry or-department-only"><span class="or-specialty">${esc(item.department)}</span><small class="or-as-needed">ตามเคส</small></div>`;
 const color=colors.get(n)||'#e9edf1';
 return `<div class="or-entry or-owner" style="--or-person:${esc(color)}"><span class="or-specialty">${esc(item.department)}</span>${personLink(n,'or-person')}</div>`;
}
function roomSlots(day,room,period,colors,personLink){
 return (OR_SCHEDULE[day]?.[room]?.[period]||[]).map(item=>orEntry(item,colors,personLink)).join('')||'<div class="or-empty">—</div>';
}
export function orWeekStart(viewedDate){
 const dow=orDayOfDate(viewedDate);
 return nextDate(viewedDate,1-(dow||7));
}
export function renderOrSchedule(viewedDate,layout,colors,personLink,holidayCheck){
 const monday=orWeekStart(viewedDate),dow=orDayOfDate(viewedDate);
 const selected=dow>=1&&dow<=5?dow:1;
 const activeDate=nextDate(monday,selected-1);
 const weekdays=Object.keys(OR_DAY_LABELS).map(Number);
 const dayChoices=weekdays.map(day=>`<button type="button" data-or-day="${day}" class="or-day-button ${layout==='day'&&selected===day?'active':''}" aria-pressed="${layout==='day'&&selected===day}">${OR_DAY_LABELS[day]}</button>`).join('');
 const toolbar=`<div class="or-controls"><div class="or-day-choices" role="group" aria-label="เลือกวันผ่าตัด">${dayChoices}</div><button class="or-view-button" type="button" data-or-layout="${layout==='week'?'day':'week'}">${layout==='week'?'ดูรายวัน':'ดูทั้งสัปดาห์'}</button></div>`;
 const intro=`<div class="or-intro"><strong>ตารางห้องผ่าตัด (OR)</strong><small>ตารางประจำสัปดาห์ · ฉบับแก้ไข 5.2</small></div><p class="or-explain">สีตามแพทย์ = <b>เจ้าของห้อง</b> กดชื่อดูตารางรายคนได้ · ช่องสีเทา = <b>แผนกใช้เมื่อมีเคส</b> ไม่ได้ระบุแพทย์เจ้าของห้อง · M = Minor</p>`;
 if(layout==='week'){
  const heading=weekdays.map(day=>`<th colspan="2" class="or-weekday weekday-${day}"><button type="button" data-or-day="${day}">${OR_DAY_LABELS[day]}<small>${shortDate(nextDate(monday,day-1))}</small></button></th>`).join('');
  const periods=weekdays.map(()=>'<th>เช้า</th><th>บ่าย</th>').join('');
  const rows=OR_ROOM_IDS.map(room=>`<tr><th scope="row" class="or-week-room">${roomName(room)}</th>${weekdays.map(day=>['am','pm'].map(period=>`<td class="or-week-slot">${roomSlots(day,room,period,colors,personLink)}</td>`).join('')).join('')}</tr>`).join('');
  return intro+toolbar+`<p class="or-week-hint">เลื่อนตารางซ้าย–ขวาเพื่อดูวันอื่น หรือแตะหัววันเพื่อดูแบบรายวัน</p><div class="or-week-scroll" tabindex="0" aria-label="ตาราง OR ทั้งสัปดาห์ เลื่อนซ้ายขวาได้"><table class="or-week-table"><thead><tr><th rowspan="2" class="or-week-room">ห้อง</th>${heading}</tr><tr>${periods}</tr></thead><tbody>${rows}</tbody></table></div>`;
 }
 const holiday=holidayCheck(activeDate);
 const warning=holiday?'<p class="or-closed-warning">วันนี้เป็นวันหยุดหรือวันที่ OPD ปิด · ตารางนี้เป็นผังประจำสัปดาห์ ไม่ใช่การยืนยันว่าเปิดห้องผ่าตัด</p>':'';
 const rows=OR_ROOM_IDS.map(room=>`<div class="or-day-row"><div class="or-room">${roomName(room)}${room==='M'?'<small>หัตถการเล็ก</small>':''}</div><div class="or-session">${roomSlots(selected,room,'am',colors,personLink)}</div><div class="or-session">${roomSlots(selected,room,'pm',colors,personLink)}</div></div>`).join('');
 return intro+toolbar+`<div class="or-date-title">${OR_DAY_LABELS[selected]} · ${shortDate(activeDate)}</div>`+warning+`<div class="or-day-board"><div class="or-day-heading"><span>ห้อง</span><span>เช้า</span><span>บ่าย</span></div>${rows}</div>`;
}
