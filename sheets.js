import {parseSheets} from './parser.js';
export async function fetchGoogleSheet(spreadsheetId,apiKey,signal){
 if(!/^[a-zA-Z0-9_-]{15,}$/.test(spreadsheetId))throw new Error('Spreadsheet ID ไม่ถูกต้อง');
 if(!apiKey?.trim())throw new Error('ยังไม่ได้ระบุ Google Sheets API Key');
 async function read(ranges,mode){
  const url=new URL('https://sheets.googleapis.com/v4/spreadsheets/'+encodeURIComponent(spreadsheetId)+'/values:batchGet');
  for(const range of ranges)url.searchParams.append('ranges',range);
  url.searchParams.set('valueRenderOption',mode);url.searchParams.set('majorDimension','ROWS');url.searchParams.set('key',apiKey);
  const response=await fetch(url,{signal,cache:'no-store'});
  if(!response.ok){let detail='';try{detail=(await response.json()).error?.message||'';}catch{}throw new Error('Google Sheets API '+response.status+': '+(detail||'อ่านข้อมูลไม่ได้'));}
  return (await response.json()).valueRanges||[];
 }
 const [roster,fixed]=await Promise.all([
  read(["'ALL เวร'!A1:AP1100","'All OPD GP'!A1:P1100","'เวรรวมเดือนนี้'!AR1:AT50"],'UNFORMATTED_VALUE'),
  read(["'เวรวันนี้'!D27:D29"],'FORMULA')
 ]);
 const parsed=parseSheets([...roster,...fixed]);
 return {...parsed,syncedAt:new Date().toISOString(),spreadsheetId};
}

// Optional OPD Holidays tab: A=date (YYYY-MM-DD or actual date), B=CLOSED/OPEN, C=note.
// AP is refreshed separately so an OPD refresh does not depend on reloading the duty roster.
export async function fetchOpdHolidayOverrides(spreadsheetId,apiKey){
 const makeUrl=range=>{
  const u=new URL('https://sheets.googleapis.com/v4/spreadsheets/'+encodeURIComponent(spreadsheetId)+'/values:batchGet');
  u.searchParams.set('ranges',range);u.searchParams.set('valueRenderOption','UNFORMATTED_VALUE');u.searchParams.set('key',apiKey);return u;
 };
 const iso=value=>{
  if(typeof value==='number')return new Date(Date.UTC(1899,11,30)+Math.floor(value)*86400000).toISOString().slice(0,10);
  const s=String(value||'').trim();return /^\d{4}-\d{2}-\d{2}$/.test(s)?s:null;
 };
 const base=await fetch(makeUrl("'ALL เวร'!A5:AP1100"),{cache:'no-store'});
 if(!base.ok)throw new Error('อ่านวันหยุดจากชีตไม่สำเร็จ');
 const rows=(await base.json()).valueRanges?.[0]?.values||[];
 const holidays=rows.filter(r=>String(r[41]||'').toLowerCase()==='holiday').map(r=>iso(r[0])).filter(Boolean);
 let overrides;
 try{
  const extra=await fetch(makeUrl("'OPD Holidays'!A2:C1000"),{cache:'no-store'});
  if(extra.ok)overrides=((await extra.json()).valueRanges?.[0]?.values||[]).map(r=>({date:iso(r[0]),state:String(r[1]||'').trim().toUpperCase(),note:String(r[2]||'')})).filter(r=>r.date&&['CLOSED','OPEN'].includes(r.state)).map(r=>({...r,closed:r.state==='CLOSED'}));
 }catch{}
 return {holidays,overrides,syncedAt:new Date().toISOString()};
}
