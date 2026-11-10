import {test} from 'node:test';
import assert from 'node:assert/strict';
import {excelDate,parseNames,parseAllDuty,parseOpdGp,columnIndex} from '../parser.js';
import {dailyColumns,shiftState,nextDate,fullscreenColumns,fullscreenDutyPhase,fullscreenMutedDutyKey,continuousDutyNames} from '../schedule.js';

test('Excel serial date and Buddhist date',()=>{
  assert.equal(excelDate(46325),'2026-10-30');
  assert.equal(excelDate('30/10/2569'),'2026-10-30');
  assert.equal(nextDate('2026-10-30',1),'2026-10-31');
});
test('splits shared doctors and ignores errors',()=>{
  assert.deepEqual(parseNames('กฤษฎา / โชษิตา'),['กฤษฎา','โชษิตา']);
  assert.deepEqual(parseNames('#REF!'),[]);
  assert.deepEqual(parseNames('None'),[]);
});
test('ALL เวร maps ER, MED and Psychiatry columns',()=>{
  const rows=Array.from({length:6},()=>[]);rows[5][0]=46325;
  rows[5][columnIndex('C')]='กฤษฎา / โชษิตา';
  rows[5][columnIndex('AK')]='ทนงศักร';
  rows[5][columnIndex('AF')]='ธีวินท์';
  const parsed=parseAllDuty(rows);
  assert.equal(parsed.dates,1);
  assert.equal(parsed.entries.length,3);
  assert.deepEqual(parsed.entries.find(e=>e.dept==='ER').names,['กฤษฎา','โชษิตา']);
  assert.equal(parsed.entries.find(e=>e.dept==='MED').role,'ER / Refer');
  assert.equal(parsed.entries.find(e=>e.dept==='PSY').role,'เด็ก / วัยรุ่น');
});
test('OPD GP reads date from B and shifts',()=>{
  const rows=Array.from({length:4},()=>[]);rows[2][1]=46325;
  rows[2][columnIndex('D')]='เอกอุมา';rows[2][columnIndex('J')]='จุฑาทิพย์';
  const parsed=parseOpdGp(rows);
  assert.equal(parsed.entries.length,2);assert.equal(parsed.entries[0].key,'am');assert.equal(parsed.entries[1].key,'pm');
});
test('00:30 previous night on left and new day on right',()=>{
  const p=dailyColumns('2026-10-31',true,{date:'2026-10-31',minutes:30});
  assert.deepEqual(p.er.map(x=>x.key),['night','morning','evening']);
  assert.deepEqual(p.er.map(x=>x.date),['2026-10-30','2026-10-31','2026-10-31']);
  assert.deepEqual(p.regular.map(x=>x.key),['out','in']);
  assert.equal(shiftState(p.regular[0],'2026-10-31',true,{date:'2026-10-31',minutes:30}),'active');
  assert.equal(shiftState(p.regular[1],'2026-10-31',true,{date:'2026-10-31',minutes:30}),'future');
});
test('08:00 new shift starts',()=>{
  const p=dailyColumns('2026-10-31',true,{date:'2026-10-31',minutes:480});
  assert.equal(p.er[0].key,'morning');assert.equal(p.regular[0].key,'in');
  assert.equal(shiftState(p.er[0],'2026-10-31',true,{date:'2026-10-31',minutes:480}),'active');
});

test('daytime preview remains muted until 07:49 and switches at 07:50',()=>{
  const date='2026-11-02';
  const before=dailyColumns(date,true,{date,minutes:469});
  assert.deepEqual(before.regular.map(c=>c.key),['out','in']);
  assert.equal(before.regular[0].date,'2026-11-01');
  assert.equal(before.regular[1].preview,true);
  const after=dailyColumns(date,true,{date,minutes:470});
  assert.deepEqual(after.regular.map(c=>c.key),['in','out']);
  assert.equal(after.regular[0].preview,undefined);
  assert.equal(after.regular[1].date,date);
  // Manual date browsing is never greyed out.
  const manual=dailyColumns(date,false,{date,minutes:30});
  assert.deepEqual(manual.regular.map(c=>c.key),['in','out']);
  assert.equal(manual.regular[0].preview,undefined);
});

test('fullscreen weekday board uses correct dates and left/right order at every boundary',()=>{
 const date='2026-11-02';
 const cols=minutes=>fullscreenColumns(date,true,false,{date,minutes});
 const first=cols(0);
 assert.deepEqual(first.map(c=>[c.key,c.date]),[['out','2026-11-01'],['in',date]]);
 assert.equal(cols(474)[1].preview,true);
 assert.deepEqual(cols(475).map(c=>c.key),['out','in']);
 assert.equal(cols(475)[1].preview,undefined); // animated, not permanently faded
 assert.deepEqual(cols(479).map(c=>c.key),['out','in']);
 assert.deepEqual(cols(480).map(c=>[c.key,c.date]),[['in',date],['out',date]]);
 assert.deepEqual(cols(954).map(c=>c.key),['in','out']);
 assert.deepEqual(cols(955).map(c=>c.key),['in','out']);
 assert.deepEqual(cols(989).map(c=>c.key),['in','out']);
 assert.deepEqual(cols(990).map(c=>[c.key,c.date]),[['in',date],['out',date]]);
 assert.equal(cols(990)[0].preview,undefined); // elapsed same-day morning, not tomorrow preview
 assert.deepEqual(cols(1439).map(c=>[c.key,c.date]),[['in',date],['out',date]]);
});
test('fullscreen shading and handover windows match specified times',()=>{
 const date='2026-11-02',at=minutes=>fullscreenDutyPhase(date,true,false,{date,minutes});
 for(const [minute,key,transition] of [
  [0,'in',null],[474,'in',null],[475,'in','handover'],[479,'in','handover'],
  [480,'out',null],[954,'out',null],[955,'out','handover'],
  [989,'out','handover'],[990,'in',null],[1439,'in',null]
 ])assert.deepEqual(at(minute),{mutedKey:key,transition});
 assert.equal(fullscreenMutedDutyKey(date,true,false,{date,minutes:954}),'out');
 assert.equal(fullscreenMutedDutyKey(date,true,false,{date,minutes:990}),'in');
});
test('holidays, manual date selections and other dates never use fullscreen highlighting',()=>{
 const date='2026-11-02',now={date,minutes:600};
 for(const [selection,automatic,holiday] of [[date,true,true],[date,false,false],['2026-11-01',true,false]]){
  assert.deepEqual(fullscreenDutyPhase(selection,automatic,holiday,now),{mutedKey:null,transition:null});
 }
 const manual=fullscreenColumns(date,false,false,{date,minutes:1320});
 assert.deepEqual(manual.map(c=>[c.key,c.date]),[['in',date],['out',date]]);
 const holiday=fullscreenColumns(date,true,true,{date,minutes:1320});
 assert.deepEqual(holiday.map(c=>[c.key,c.date]),[['in',date],['out',date]]);
});
test('same doctor on morning and out-of-hours retains own color',()=>{
 const same=continuousDutyNames(['ศุภฤกษ์','กชนิภา'],['ศุภฤกษ์','โชคชัย']);
 assert.deepEqual([...same],['ศุภฤกษ์']);
 assert.equal(same.has('โชคชัย'),false);
});

test('regression: 10 Nov 2026 ER and surgery morning use the first on-duty physician, not second or evening',()=>{
 const rows=Array.from({length:6},()=>[]);
 const firstDay=rows[4],nextDay=rows[5];
 firstDay[0]=46336; // 2026-11-10
 firstDay[columnIndex('C')]='โชษิตา'; // ER morning
 firstDay[columnIndex('E')]='กฤษฎา'; // ER evening, NOT morning
 firstDay[columnIndex('K')]='ศุภฤกษ์'; // Sx ER consult, primary
 firstDay[columnIndex('L')]='เบญญา'; // Sx IPD consult, secondary
 nextDay[0]=46337; // 2026-11-11
 nextDay[columnIndex('C')]='กฤษฎา';
 nextDay[columnIndex('K')]='เบญญา';
 nextDay[columnIndex('L')]='ธารางกูร';
 const {entries}=parseAllDuty(rows);
 const get=(date,dept,key)=>entries.filter(e=>e.date===date&&e.dept===dept&&e.key===key).flatMap(e=>e.names);
 assert.deepEqual(get('2026-11-10','ER','morning'),['โชษิตา']);
 assert.deepEqual(get('2026-11-10','ER','evening'),['กฤษฎา']);
 assert.deepEqual(get('2026-11-10','SURG','in'),['ศุภฤกษ์']);
 assert.deepEqual(get('2026-11-11','ER','morning'),['กฤษฎา']);
 assert.deepEqual(get('2026-11-11','SURG','in'),['เบญญา']);
 const cols=fullscreenColumns('2026-11-10',true,false,{date:'2026-11-10',minutes:1278});
 assert.deepEqual(cols.map(c=>[c.key,c.date]),[['in','2026-11-10'],['out','2026-11-10']]);
});

test('regression: fullscreen evening 10 Nov always shows original morning and out-of-hours of 10 Nov',()=>{
 const today='2026-11-10';
 for(const minute of [990,1100,1278,1439]){
  const columns=fullscreenColumns(today,true,false,{date:today,minutes:minute});
  assert.deepEqual(columns.map(c=>[c.key,c.date,c.preview??false]),[['in',today,false],['out',today,false]]);
 }
 // Midnight is the ONLY boundary when left OUT belongs to yesterday.
 const midnight=fullscreenColumns('2026-11-11',true,false,{date:'2026-11-11',minutes:0});
 assert.deepEqual(midnight.map(c=>[c.key,c.date]),[['out',today],['in','2026-11-11']]);
});
