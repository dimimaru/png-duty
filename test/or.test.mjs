import {test} from 'node:test';
import assert from 'node:assert/strict';
import {OR_ROOM_IDS,OR_DAY_LABELS,OR_SCHEDULE,OR_DOCTORS,orOwnerSlots} from '../or.js';
import {renderOrSchedule,orWeekStart} from '../or-ui.js';
test('OR v5.2 always has six rooms with morning and afternoon for Mon–Fri',()=>{
 assert.equal(OR_ROOM_IDS.length,6);
 assert.equal(Object.keys(OR_DAY_LABELS).length,5);
 for(const day of [1,2,3,4,5]){
  for(const room of OR_ROOM_IDS){
   assert.ok(OR_SCHEDULE[day][room], 'missing '+day+' room '+room);
   for(const period of ['am','pm'])assert.ok(OR_SCHEDULE[day][room][period]?.length, 'empty '+day+' '+room+' '+period);
  }
 }
});
test('user-confirmed doctor spelling and owner slots',()=>{
 assert.equal(OR_SCHEDULE[1][1].am[0].doctor,'ศุภฤกษ์');
 assert.deepEqual(OR_SCHEDULE[1][2].pm[0],{department:'NeuroSx',doctor:'ชรินทร์'});
 assert.equal(OR_SCHEDULE[1][3].am[0].doctor,'สุพิศ');
 assert.equal(OR_SCHEDULE[1][4].am[0].doctor,'ธิดารัตน์');
 assert.equal(OR_SCHEDULE[2][5].am[0].doctor,'เดชตระการ');
 assert.equal(OR_SCHEDULE[3][2].am[0].doctor,'กชนิภา');
 assert.equal(OR_SCHEDULE[4][3].am[0].doctor,'สุพิศ');
 assert.equal(OR_SCHEDULE[4][5].pm[0].doctor,'ทนงศักดิ์');
 assert.equal(orOwnerSlots('2026-11-02','ศุภฤกษ์').length,2);
 assert.equal(orOwnerSlots('2026-11-07','ศุภฤกษ์').length,0);
 assert.ok(OR_DOCTORS.includes('พรเทพ'));
});
test('department allocations have no doctor and are not person links',()=>{
 assert.equal(OR_SCHEDULE[3][5].am.every(x=>!x.doctor),true);
 assert.equal(OR_SCHEDULE[5][2].am.every(x=>!x.doctor),true);
 const html=renderOrSchedule('2026-11-02','day',new Map([['ศุภฤกษ์','#aabbee']]),n=>'<button data-person="'+n+'">'+n+'</button>',()=>false);
 assert.match(html,/data-person="ศุภฤกษ์"/);
 assert.match(html,/EYE Emergency/);
 assert.doesNotMatch(html,/data-person="EYE Emergency"/);
 assert.match(html,/data-or-day="5"/);
});
test('minor is separate; weekly overview provides weekday buttons and navigation',()=>{
 assert.equal(orWeekStart('2026-11-08'),'2026-11-02');
 const html=renderOrSchedule('2026-11-02','week',new Map(),n=>'<button data-person="'+n+'">'+n+'</button>',()=>false);
 assert.match(html,/Minor/);
 assert.match(html,/data-or-layout="day"/);
 assert.match(html,/or-week-table/);
});
