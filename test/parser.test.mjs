import {test} from 'node:test';
import assert from 'node:assert/strict';
import {excelDate,parseNames,parseAllDuty,parseOpdGp,columnIndex} from '../parser.js';
import {dailyColumns,shiftState,nextDate} from '../schedule.js';

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
