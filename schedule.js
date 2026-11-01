const TZ = 'Asia/Bangkok';
export function bangkokParts(value = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', {timeZone:TZ, year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit', hourCycle:'h23'}).formatToParts(value);
  const p = Object.fromEntries(parts.filter(x => x.type !== 'literal').map(x => [x.type, x.value]));
  return {date:`${p.year}-${p.month}-${p.day}`,minutes:Number(p.hour)*60+Number(p.minute)};
}
export function nextDate(iso, delta) {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate()+delta);
  return d.toISOString().slice(0,10);
}
export function isOvernight(minutes) { return minutes < 480; }
// The duty-board display changes at 07:50; actual shift start remains 08:00.
export const DISPLAY_HANDOVER_MINUTES = 7 * 60 + 50;
export function beforeDisplayHandover(minutes) { return minutes < DISPLAY_HANDOVER_MINUTES; }
export function activeErSlot(minutes) { return minutes >= 480 && minutes < 960 ? 'morning' : minutes >= 960 && minutes < 1380 ? 'evening' : 'night'; }
export function activeRegularSlot(minutes) { return minutes >= 480 && minutes < 960 ? 'in' : 'out'; }
export function dailyColumns(date, isAuto, now=bangkokParts()) {
  const overnight = isAuto && beforeDisplayHandover(now.minutes);
  const oldDate = nextDate(date,-1);
  if(overnight) return {er:[{key:'night',date:oldDate,label:'ดึก',time:'23–08'},{key:'morning',date,label:'เช้า',time:'08–16'},{key:'evening',date,label:'บ่าย',time:'16–23'}], regular:[{key:'out',date:oldDate,label:'นอกเวลา',time:'16–08'},{key:'in',date,label:'ในเวลา',time:'08–16',preview:true}]};
  return {er:[{key:'morning',date,label:'เช้า',time:'08–16'},{key:'evening',date,label:'บ่าย',time:'16–23'},{key:'night',date,label:'ดึก',time:'23–08'}],regular:[{key:'in',date,label:'ในเวลา',time:'08–16'},{key:'out',date,label:'นอกเวลา',time:'16–08'}]};
}
export function shiftState(column, selectedDate, isAuto, now=bangkokParts()) {
  if(!isAuto || selectedDate !== now.date) return 'neutral';
  const over = isOvernight(now.minutes);
  if(column.key === 'in') return over ? 'future' : now.minutes < 960 ? 'active' : 'past';
  if(column.key === 'out') return over ? 'active' : now.minutes >= 960 ? 'active' : 'future';
  if(column.key === 'morning') return over ? 'future' : now.minutes < 960 ? 'active' : 'past';
  if(column.key === 'evening') return over ? 'future' : now.minutes >= 960 && now.minutes < 1380 ? 'active' : now.minutes < 960 ? 'future' : 'past';
  if(column.key === 'night') return over ? 'active' : now.minutes >= 1380 ? 'active' : 'future';
  return 'neutral';
}
export function thaiDate(iso, opts={day:'numeric',month:'short',year:'numeric'}) {
  return new Intl.DateTimeFormat('th-TH-u-ca-buddhist',{timeZone:TZ, ...opts}).format(new Date(`${iso}T12:00:00Z`));
}
export function lastSyncLabel(iso) {
  if(!iso) return '—';
  return new Intl.DateTimeFormat('th-TH',{timeZone:TZ,day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}).format(new Date(iso))+' น.';
}
export function todayMonth(){return bangkokParts().date.slice(0,7)}
