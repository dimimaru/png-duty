// Mapping from the uploaded workbook's ALL เวร (headers row 3/4, data from row 5).
// Review these mappings against the live Google Sheet before public release.
export const DUTY_MAP = [
  {col:'C',dept:'ER',key:'morning',role:'ER เช้า'},
  {col:'E',dept:'ER',key:'evening',role:'ER บ่าย'},
  {col:'F',dept:'ER',key:'night',role:'ER ดึก'},
  {col:'G',dept:'OB-GYN',key:'out',role:'Intern / 1st call'},
  {col:'H',dept:'OB-GYN',key:'out',role:'Consult OB'},
  {col:'I',dept:'OB-GYN',key:'out',role:'Consult Gyne'},
  {col:'AI',dept:'OB-GYN',key:'in',role:'Gyne'},
  {col:'J',dept:'SURG',key:'out',role:'Intern / 1st call'},
  {col:'K',dept:'SURG',key:'out',role:'Consult ER'},
  {col:'L',dept:'SURG',key:'out',role:'Consult IPD'},
  {col:'J',dept:'SURG',key:'in',role:'Intern'},
  {col:'K',dept:'SURG',key:'in',role:'Staff'},
  {col:'M',dept:'ORTHO',key:'out',role:'Consult 1'},
  {col:'N',dept:'ORTHO',key:'out',role:'Consult 2'},
  {col:'O',dept:'PED',key:'out',role:'Intern / 1st call'},
  {col:'P',dept:'PED',key:'out',role:'Consult 1'},
  {col:'Q',dept:'PED',key:'out',role:'Consult 2'},
  {col:'R',dept:'MED',key:'out',role:'Intern / 1st call'},
  {col:'S',dept:'MED',key:'out',role:'Consult 1'},
  {col:'T',dept:'MED',key:'out',role:'Consult 2'},
  {col:'AJ',dept:'MED',key:'in',role:'Stroke'},
  {col:'AK',dept:'MED',key:'in',role:'ER / Refer'},
  {col:'AL',dept:'MED',key:'in',role:'Consult ต่างแผนก'},
  {col:'AM',dept:'MED',key:'in',role:'OPD / Ward'},
  {col:'U',dept:'TRANSPORT',key:'in',role:'โอนอกเช้า'},
  {col:'V',dept:'TRANSPORT',key:'out',role:'โอนอกเย็น'},
  {col:'W',dept:'ENT',key:'out',role:'On-call'},
  {col:'X',dept:'RADIO',key:'out',role:'On-call'},
  {col:'AN',dept:'RADIO',key:'in',role:'ในเวลา'},
  {col:'Y',dept:'EYE',key:'out',role:'On-call'},
  {col:'AO',dept:'EYE',key:'in',role:'ในเวลา'},
  {col:'Z',dept:'MAXILO',key:'out',role:'On-call'},
  {col:'AA',dept:'ANES',key:'out',role:'On-call'},
  {col:'AB',dept:'NEURO',key:'out',role:'On-call'},
  {col:'AC',dept:'FORENSIC',key:'out',role:'On-call'},
  {col:'AD',dept:'URO',key:'out',role:'On-call'},
  {col:'AE',dept:'PSY',key:'out',role:'นอกเวลา'},
  {col:'AF',dept:'PSY',key:'out',role:'เด็ก / วัยรุ่น'},
  // Note: AG/AH indicate "A - Consult" and "A - ER/รพช." in the source.
  // Tentative in-hours classification; confirm with roster owner before release.
  {col:'AG',dept:'PSY',key:'in',role:'ผู้ใหญ่ · Consult'},
  {col:'AH',dept:'PSY',key:'in',role:'ผู้ใหญ่ · ER / รพช.'}
];
export const DEPT_LABELS = {
  ER:'ER',MED:'MED',SURG:'SURG', 'OB-GYN':'OB-GYN',PED:'PED',ORTHO:'ORTHO',
  PSY:'PSY',NEURO:'NEURO',ENT:'ENT',EYE:'EYE',RADIO:'RADIO',URO:'URO',
  ANES:'ANES',MAXILO:'MAXILO',FORENSIC:'FORENSIC',TRANSPORT:'โอนอก', GP:'GP'
};
export const DEPT_ORDER = ['ER','MED','SURG','OB-GYN','PED','ORTHO','PSY','NEURO','ENT','EYE','RADIO','URO','ANES','MAXILO','FORENSIC','TRANSPORT'];
export const INTERN_NAMES = [
  'กษิดิศ','จุฑาทิพย์','ฉันทัช','ฝากฝัน','อัฐภิญญา','เอกอุมา','เอมมิกา','ณัฐเมศร์'
]; // Provisional registry; verify and extend when OPD Staff sheet is added.
export function columnIndex(label) {return [...label].reduce((n,ch)=>n*26+ch.charCodeAt(0)-64,0)-1;}
export function excelDate(value) {
  if(typeof value === 'number' && Number.isFinite(value) && value > 30000 && value < 70000) {
    const d = new Date(Date.UTC(1899,11,30) + Math.floor(value)*86400000);
    return d.toISOString().slice(0,10);
  }
  if(typeof value !== 'string') return null;
  const s=value.trim();
  if(/^\d{4}-\d\d-\d\d$/.test(s)) return s;
  const m=s.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
  if(!m)return null;
  let y=Number(m[3]);if(y>2400)y-=543;
  const mm=Number(m[2]),dd=Number(m[1]);
  const date=new Date(Date.UTC(y,mm-1,dd));
  if(date.getUTCFullYear()!==y||date.getUTCMonth()!==mm-1||date.getUTCDate()!==dd)return null;
  return `${y}-${String(mm).padStart(2,'0')}-${String(dd).padStart(2,'0')}`;
}
const BAD = /^(?:-|—|none|null|n\/a|#ref!|#n\/a|#value!|#error!|#div\/0!)$/i;
export function parseNames(raw) {
  if(raw===null||raw===undefined)return [];
  if(typeof raw==='number')return [];
  const val=String(raw).trim();
  if(!val||BAD.test(val)||/^\d+(?:st|nd|rd|th)$/i.test(val))return [];
  return [...new Set(val.split(/\s*[\n\r,;+]+\s*/g).map(s=>s.trim()).filter(n=>n&&!BAD.test(n)&&n.length<=90))];
}
export function parseAllDuty(rows) {
  const output=[];const warnings=[];const dates=new Set();
  for(let i=4;i<rows.length;i++) {
    const row=rows[i]||[];const date=excelDate(row[0]);if(!date)continue;
    dates.add(date);
    for(const m of DUTY_MAP) {
      const raw=row[columnIndex(m.col)];
      if(typeof raw==='string'&&raw.startsWith('#')) {warnings.push(`${date}: ${m.col} ${raw}`);continue;}
      const names=parseNames(raw);
      if(names.length) output.push({date,dept:m.dept,key:m.key,role:m.role,names,source:'ALL เวร',col:m.col});
    }
  }
  return {entries:output,dates:dates.size,warnings};
}
export function parseInTimePed(rows, referenceDate=new Date()) {
  const heading=rows.findIndex(row=>String(row?.[0]??'').trim()==='Consult ในเวลา');
  if(heading<0)return [];
  const monthRow=[...rows.slice(0,heading)].reverse().find(row=>{
    const current=Number(row?.[1]),next=Number(row?.[2]);
    return Number.isInteger(current)&&current>=1&&current<=12&&Number.isInteger(next)&&next>=1&&next<=12;
  });
  if(!monthRow)return [];
  const monthNow=Number(monthRow[1]),monthNext=Number(monthRow[2]);
  const todayParts=new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Bangkok',year:'numeric',month:'2-digit'}).formatToParts(referenceDate);
  const todayYear=Number(todayParts.find(part=>part.type==='year')?.value);
  const todayMonth=Number(todayParts.find(part=>part.type==='month')?.value);
  let yearNow=todayYear;
  if(monthNow-todayMonth>6)yearNow--;
  else if(todayMonth-monthNow>6)yearNow++;
  const yearNext=yearNow+(monthNext<monthNow?1:0);
  const monthKeys=[`${yearNow}-${String(monthNow).padStart(2,'0')}`,`${yearNext}-${String(monthNext).padStart(2,'0')}`];
  const output=[];let inPed=false;
  for(let i=heading+1;i<rows.length;i++) {
    const row=rows[i]||[];const label=String(row[0]??'').trim();
    if(label==='PED'){inPed=true;continue;}
    if(!inPed)continue;
    const currentNames=parseNames(row[1]),nextNames=parseNames(row[2]);
    if(label&&!currentNames.length&&!nextNames.length)break;
    if(!label)continue;
    if(currentNames.length)output.push({date:monthKeys[0],dept:'PED',key:'in',role:label,names:currentNames,source:'Consult ในเวลา'});
    if(nextNames.length)output.push({date:monthKeys[1],dept:'PED',key:'in',role:label,names:nextNames,source:'Consult ในเวลา'});
  }
  return output;
}
export const GP_MAP = [
  {col:'D',key:'am',role:'หลัก 1'},{col:'E',key:'am',role:'หลัก 2'},
  {col:'F',key:'am',role:'หลัก 3'},{col:'O',key:'am',role:'หลัก 4'},
  {col:'G',key:'am',role:'Standby 1'},{col:'H',key:'am',role:'Standby 2'},
  {col:'I',key:'pm',role:'หลัก 1'},{col:'J',key:'pm',role:'หลัก 2'},
  {col:'P',key:'pm',role:'หลัก 3'},
  {col:'K',key:'pm',role:'Standby 1'},{col:'L',key:'pm',role:'Standby 2'}
];
export function parseOpdGp(rows) {
  const output=[];const warnings=[];const dates=new Set();
  for(let i=1;i<rows.length;i++) {
    const row=rows[i]||[];const date=excelDate(row[1]);if(!date)continue;
    dates.add(date);
    for(const m of GP_MAP) {
      const raw=row[columnIndex(m.col)];
      if(typeof raw==='string'&&raw.startsWith('#')){warnings.push(`${date}: ${m.col} ${raw}`);continue;}
      const names=parseNames(raw);if(names.length)output.push({date,dept:'GP',key:m.key,role:m.role,names,source:'All OPD GP',col:m.col});
    }
  }
  return {entries:output,dates:dates.size,warnings};
}
export function parseSheets(valueRanges) {
  if(!Array.isArray(valueRanges)||valueRanges.length<2)throw new Error('Google API ส่งข้อมูลชีตไม่ครบ');
  const all=parseAllDuty(valueRanges[0].values||[]);
  const opd=parseOpdGp(valueRanges[1].values||[]);
  const pedIn=parseInTimePed(valueRanges[2]?.values||[]);
  if(all.dates<1 || all.entries.length<1)throw new Error('ไม่พบข้อมูลเวรใน ALL เวร — ตรวจชื่อชีตและคอลัมน์');
  return {entries:[...all.entries,...opd.entries,...pedIn],warnings:[...all.warnings,...opd.warnings],count:{duty:all.entries.length,opd:opd.entries.length},dateCounts:{duty:all.dates,opd:opd.dates}};
}
