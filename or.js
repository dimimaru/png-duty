// OR weekly room ownership map, transcribed from operating room table revision 5.2.
// Doctor entries indicate room owners. Entries without a doctor are specialty
// allocations to be used when cases exist; they are not guaranteed bookings.
import {canonicalName} from './names.js';
export const OR_ROOM_IDS=['1','2','3','4','5','M'];
export const OR_DAY_LABELS={1:'จันทร์',2:'อังคาร',3:'พุธ',4:'พฤหัสบดี',5:'ศุกร์'};
const owner=(department,doctor)=>({department,doctor});
const specialty=department=>({department});
const both=(...slots)=>({am:slots,pm:slots});
export const OR_SCHEDULE={
 1:{
  '1':both(owner('ศัลย์','ศุภฤกษ์')),
  '2':{am:[specialty('EYE Emergency')],pm:[owner('NeuroSx','ชรินทร์')]},
  '3':{am:[owner('Ortho','สุพิศ')],pm:[owner('Ortho','วราพงษ์')]},
  '4':both(owner('สูติ','ธิดารัตน์')),
  '5':both(owner('ศัลย์','เบญญา'),specialty('GI Scope')),
  'M':{am:[specialty('สูติ'),specialty('Ortho')],pm:[specialty('ENT'),specialty('ศัลย์'),specialty('Uro')]}
 },
 2:{
  '1':{am:[owner('ENT','มนทิรา')],pm:[owner('Uro','ปริชญะ')]},
  '2':both(owner('EYE','โชคชัย')),
  '3':both(owner('Maxillo','ฐัชญา')),
  '4':both(owner('สูติ','นิรมล')),
  '5':{am:[owner('Chest Med','เดชตระการ')],pm:[owner('Uro','อธิภัทร')]},
  'M':{am:[specialty('Uro'),specialty('สูติ'),specialty('Chest Med')],pm:[specialty('ENT'),specialty('Ortho')]}
 },
 3:{
  '1':both(owner('Uro','อธิภัทร')),
  '2':both(owner('EYE','กชนิภา')),
  '3':both(owner('Ortho','วชิรวิทย์')),
  '4':both(owner('สูติ','ศุภกาญจน์')),
  '5':both(specialty('ศัลย์'),specialty('Uro / Scope'),specialty('GI Scope')),
  'M':{am:[owner('Skin','พรเทพ'),specialty('ศัลย์')],pm:[specialty('ENT'),specialty('Ortho'),specialty('Uro')]}
 },
 4:{
  '1':both(owner('ENT','วราลักษณ์')),
  '2':both(owner('EYE','โชคชัย')),
  '3':{am:[owner('Ortho','สุพิศ')],pm:[owner('Ortho','วราพงษ์')]},
  '4':both(owner('สูติ','นิรมล')),
  '5':both(owner('GI','ทนงศักดิ์')),
  'M':{am:[specialty('สูติ'),specialty('Ortho')],pm:[specialty('ศัลย์')]}
 },
 5:{
  '1':both(owner('ศัลย์','ธารางกูร')),
  '2':{am:[specialty('Eye emer'),specialty('Nephro'),specialty('Neuro')],pm:[specialty('Neuro')]},
  '3':both(owner('Ortho','อภิชา')),
  '4':both(owner('สูติ','นิธิพร')),
  '5':both(owner('ศัลย์','ธารางกูร')),
  'M':{am:[specialty('Skin'),specialty('สูติ'),specialty('ศัลย์')],pm:[specialty('ENT'),specialty('ศัลย์')]}
 }
};
export const OR_DOCTORS=[...new Set(Object.values(OR_SCHEDULE).flatMap(day=>
 OR_ROOM_IDS.flatMap(room=>['am','pm'].flatMap(period=>(day[room]?.[period]||[]).map(e=>e.doctor).filter(Boolean)))
).map(canonicalName))];
export function orDayOfDate(date){
 return new Date(date+'T12:00:00Z').getUTCDay();
}
export function orOwnerSlots(date,rawName){
 const day=OR_SCHEDULE[orDayOfDate(date)],name=canonicalName(rawName);
 if(!day||!name)return [];
 return OR_ROOM_IDS.flatMap(room=>['am','pm'].flatMap(period=>
  (day[room]?.[period]||[]).filter(item=>item.doctor&&canonicalName(item.doctor)===name)
  .map(item=>({room,period,department:item.department}))
 ));
}
