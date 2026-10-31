import {canonicalName} from './names.js';
const keys=['morning','evening','night'];
// Match the legal given name, never the nickname/abbreviation in shortName.
const givenName=raw=>canonicalName(canonicalName(raw).split(' ')[0]);
const normalize=raw=>String(raw??'').split('/').map(givenName).filter(Boolean);
export function validateERFeed(feed,config){
 if(feed?.format!=='png-duty-roster-v1'||feed.status!=='final'||feed.department!==config.department||feed.month!==config.month||!Number.isInteger(feed.revision)||feed.revision<1||!Array.isArray(feed.days))throw new Error('รูปแบบตาราง ER-duty ไม่ตรงกับเดือนทดลอง');
 const count=new Date(Number(config.month.slice(0,4)),Number(config.month.slice(5)),0).getDate();
 const dates=new Set();
 for(const day of feed.days){
  if(!new RegExp('^'+config.month+'-\\d{2}$').test(day.date)||dates.has(day.date)||Number(day.date.slice(8))<1||Number(day.date.slice(8))>count||!Array.isArray(day.shifts))throw new Error('วันที่ ER-duty ไม่ครบหรือซ้ำ');
  dates.add(day.date);const slots=new Set();
  for(const shift of day.shifts){
   if(!keys.includes(shift.slot)||slots.has(shift.slot))throw new Error('ช่องเวร ER-duty ไม่ถูกต้อง');
   slots.add(shift.slot);
   if(shift.doctor!==null&&(!shift.doctor||typeof shift.doctor.name!=='string'||typeof shift.doctor.shortName!=='string'||!shift.doctor.id))throw new Error('ชื่อแพทย์ ER-duty ไม่ถูกต้อง');
  }
  if(slots.size!==3)throw new Error('ER-duty ส่งช่องเวรไม่ครบ');
 }
 if(dates.size!==count)throw new Error('ER-duty ส่งจำนวนวันไม่ครบเดือน');
 return feed;
}
export async function fetchERFeed(config,fetcher=fetch){
 if(!config.feedUrl)return null;
 const url=new URL(config.feedUrl);if(url.protocol!=='https:')throw new Error('ลิงก์ ER-duty ต้องใช้ HTTPS');
 url.searchParams.set('department',config.department);url.searchParams.set('month',config.month);
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),12000);
 try{
  const response=await fetcher(url,{cache:'no-store',credentials:'omit',signal:controller.signal});
  if(!response.ok)throw new Error(response.status===404?'ER-duty ยังไม่มีตารางฉบับจริงที่เผยแพร่':'อ่าน ER-duty ไม่สำเร็จ ('+response.status+')');
  return validateERFeed(await response.json(),config);
 }finally{clearTimeout(timer);}
}
export function overlayER(sheetData,feed,config){
 const sheetEntries=sheetData.sheetEntries||sheetData.entries||[];
 if(!feed)return {...sheetData,entries:sheetEntries,sheetEntries,erFeed:null,erComparisons:{}};
 validateERFeed(feed,config);
 const comparisons={},replacement=[];
 for(const day of feed.days)for(const shift of day.shifts){
  const erNames=shift.doctor?[givenName(shift.doctor.name)].filter(Boolean):[];
  const sheetRows=sheetEntries.filter(e=>e.date===day.date&&e.dept==='ER'&&e.key===shift.slot);
  const sheetNames=sheetRows.flatMap(e=>(e.names||[]).flatMap(normalize));
  const matches=erNames.length===sheetNames.length&&erNames.every((n,i)=>n===sheetNames[i]);
  comparisons[day.date+'|'+shift.slot]={erNames,sheetNames,different:erNames.length>0&&sheetNames.length>0&&!matches,sheetAvailable:sheetNames.length>0,revision:feed.revision,erUpdatedAt:feed.updatedAt,sheetSyncedAt:sheetData.syncedAt};
  if(!erNames.length&&sheetNames.length){replacement.push(...sheetRows);continue;}
  replacement.push({date:day.date,dept:'ER',key:shift.slot,role:'ER '+({morning:'เช้า',evening:'บ่าย',night:'ดึก'}[shift.slot]),names:erNames,source:'ER-duty',doctorId:shift.doctor?.id||null,doctorRole:shift.doctor?.role||null});
 }
 return {...sheetData,sheetEntries,entries:[...sheetEntries.filter(e=>!(e.dept==='ER'&&e.date.startsWith(config.month+'-'))),...replacement],erFeed:feed,erComparisons:comparisons};
}
