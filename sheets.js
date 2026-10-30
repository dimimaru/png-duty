import {parseSheets} from './parser.js';
export async function fetchGoogleSheet(spreadsheetId, apiKey, signal) {
  if(!/^[a-zA-Z0-9_-]{15,}$/.test(spreadsheetId))throw new Error('Spreadsheet ID ไม่ถูกต้อง');
  if(!apiKey?.trim())throw new Error('ยังไม่ได้ระบุ Google Sheets API Key');
  const url=new URL(`https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values:batchGet`);
  for(const range of ["'ALL เวร'!A1:AO1100", "'All OPD GP'!A1:P1100", "'เวรรวมเดือนนี้'!AR1:AT50"])url.searchParams.append('ranges',range);
  url.searchParams.set('valueRenderOption','UNFORMATTED_VALUE');
  url.searchParams.set('majorDimension','ROWS');
  url.searchParams.set('key',apiKey);
  const response=await fetch(url,{signal,cache:'no-store'});
  if(!response.ok) {
    let details='';try {const json=await response.json();details=json.error?.message||'';}catch{}
    throw new Error(`Google Sheets API ${response.status}: ${details||'อ่านข้อมูลไม่ได้'}`);
  }
  const payload=await response.json();
  const parsed=parseSheets(payload.valueRanges);
  return {...parsed,syncedAt:new Date().toISOString(),spreadsheetId};
}
