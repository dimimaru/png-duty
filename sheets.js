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
