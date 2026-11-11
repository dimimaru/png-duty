import {test} from 'node:test';
import assert from 'node:assert/strict';
import {birthdaySlideActive,BIRTHDAY_IMAGE_PATH} from '../birthday.js';

const m=(hour,minute)=>hour*60+minute;
test('17 November recurring five-minute display every half-hour 08:30 to 16:30 Bangkok time',()=>{
 for(const year of [2026,2027,2030,2040]){
  const date=year+'-11-17';
  for(let n=m(8,30);n<m(16,30);n+=30){
   assert.equal(birthdaySlideActive(date,n),true,year+' active at '+n);
   assert.equal(birthdaySlideActive(date,n+4),true,year+' 5th minute');
   assert.equal(birthdaySlideActive(date,n+5),false,year+' roster resume');
   assert.equal(birthdaySlideActive(date,n+29),false,year+' before next half-hour');
  }
  assert.equal(birthdaySlideActive(date,m(8,29)),false);
  assert.equal(birthdaySlideActive(date,m(16,30)),false);
  assert.equal(birthdaySlideActive(date,m(23,59)),false);
 }
});
test('one-off 11 Nov 2026 rehearsal continuously from 20:15 up to 20:30',()=>{
 assert.equal(birthdaySlideActive('2026-11-11',m(20,14)),false);
 assert.equal(birthdaySlideActive('2026-11-11',m(20,15)),true);
 assert.equal(birthdaySlideActive('2026-11-11',m(20,20)),true);
 assert.equal(birthdaySlideActive('2026-11-11',m(20,29)),true);
 assert.equal(birthdaySlideActive('2026-11-11',m(20,30)),false);
 assert.equal(birthdaySlideActive('2027-11-11',m(20,15)),false);
 assert.equal(birthdaySlideActive('2026-11-12',m(20,15)),false);
});
test('image path is local PNG and out-of-range times never activate',()=>{
 assert.equal(BIRTHDAY_IMAGE_PATH,'./assets/birthday-53.png');
 assert.equal(birthdaySlideActive('2026-11-17',-1),false);
 assert.equal(birthdaySlideActive('2026-11-17',1440),false);
 assert.equal(birthdaySlideActive('2026-11-17',m(12,0)+.5),false);
});
