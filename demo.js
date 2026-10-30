import {bangkokParts, nextDate} from './schedule.js';
export function makeDemo(){
  const today=bangkokParts().date; const dates=[nextDate(today,-1),today,nextDate(today,1)];
  const src=[
    {dept:'ER',key:'morning',role:'ER เช้า',names:['แพทย์ ก']},
    {dept:'ER',key:'evening',role:'ER บ่าย',names:['แพทย์ ข']},
    {dept:'ER',key:'night',role:'ER ดึก',names:['แพทย์ ค']},
    {dept:'MED',key:'in',role:'ER / Refer',names:['แพทย์ ง']},
    {dept:'MED',key:'in',role:'OPD / Ward',names:['แพทย์ จ']},
    {dept:'MED',key:'out',role:'Consult 1',names:['แพทย์ ฉ']},
    {dept:'MED',key:'out',role:'Consult 2',names:['แพทย์ ช']},
    {dept:'SURG',key:'out',role:'Consult ER',names:['แพทย์ ซ']},
    {dept:'SURG',key:'out',role:'Consult IPD',names:['แพทย์ ฌ']},
    {dept:'OB-GYN',key:'in',role:'Gyne',names:['แพทย์ ญ']},
    {dept:'OB-GYN',key:'out',role:'Consult OB',names:['แพทย์ ฎ']},
    {dept:'OB-GYN',key:'out',role:'Consult Gyne',names:['แพทย์ ฏ']},
    {dept:'PED',key:'out',role:'Consult 1',names:['แพทย์ ฐ']},
    {dept:'PSY',key:'in',role:'ผู้ใหญ่ · Consult',names:['แพทย์ ฑ']},
    {dept:'PSY',key:'out',role:'เด็ก / วัยรุ่น',names:['แพทย์ ฒ']},
    {dept:'ORTHO',key:'out',role:'Consult 1',names:['แพทย์ ณ']},
    {dept:'EYE',key:'out',role:'On-call',names:['แพทย์ ด']},
    {dept:'ENT',key:'out',role:'On-call',names:['แพทย์ ต']},
    {dept:'GP',key:'am',role:'หลัก 1',names:['แพทย์ ถ','แพทย์ ท']},
    {dept:'GP',key:'am',role:'Standby 1',names:['แพทย์ ธ']},
    {dept:'GP',key:'pm',role:'หลัก 1',names:['แพทย์ น']},
    {dept:'GP',key:'pm',role:'Standby 1',names:['แพทย์ บ']}
  ];
  return {demo:true,entries:dates.flatMap(date=>src.map(x=>({...x,date}))),warnings:[],syncedAt:null};
}
