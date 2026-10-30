// Weekly OPD schedule transcribed from OPD Spec. PNG Hosp..pdf (pages 2–4).
// Week numbers mean the 1st/2nd/etc occurrence of that weekday in the month.
export const OPD_GROUPS=['GP','MED','PED','OB-GYN','SURGICAL','EYE','ENT','PSY','SKIN'];
export const OPD_LABELS={GP:'GP',MED:'MED',PED:'PED','OB-GYN':'OB-GYN',SURGICAL:'คลินิกศัลยกรรม',EYE:'Eye',ENT:'ENT',PSY:'Psych',SKIN:'Skin',DENTAL:'Dental'};
const rules=[];
function add(days,session,group,clinic,doctors=[],weeks=null,note=''){for(const day of days)rules.push({day,session,group,clinic,doctors,weeks,note});}
add([1,2,4],'am','MED','MED');
add([1],'am','MED','CAPD',['พฤฒินาถ']);add([1],'am','MED','HT');
add([2,5],'am','MED','DM');add([3],'am','MED','CKD',['พฤฒินาถ','พีรวิชญ์']);
add([3],'am','MED','Onco',['ธญาณินท์']);add([4],'am','MED','Asthma');
add([5],'am','MED','Warfarin',[],[1,3]);add([5],'am','MED','Cardio',[],[2,4]);
add([1,2,3,4,5],'am','PED','PED');
add([1],'am','OB-GYN','OB-GYN');add([2],'am','OB-GYN','OB-GYN',['ธิดารัตน์']);
add([3],'am','OB-GYN','OB-GYN',['นิรมล']);add([4],'am','OB-GYN','OB-GYN',['นิธิพร']);add([5],'am','OB-GYN','OB-GYN',['ศุภกาญจน์']);
add([1],'am','SURGICAL','Surgery',['ธารางกูร']);add([2],'am','SURGICAL','Surgery',['เบญญา']);add([5],'am','SURGICAL','Surgery',['ศุภฤกษ์']);
add([2],'am','SURGICAL','Chemo',['ศุภฤกษ์']);add([3],'am','SURGICAL','Chemo',['ธารางกูร']);
for(const [d,n] of [[1,'อภิชา'],[2,'สุพิศ'],[3,'สุพิศ'],[4,'วชิรวิทย์'],[5,'วราพงษ์']])add([d],'am','SURGICAL','Ortho',[n]);
for(const [d,n] of [[1,'ปริชญะ'],[2,'อธิภัทร'],[3,'ปริชญะ'],[4,'อธิภัทร']])add([d],'am','SURGICAL','Uro',[n]);
add([2,4],'am','EYE','Eye',['กชนิภา']);add([3,5],'am','EYE','Eye',['โชคชัย']);
add([1,3],'am','ENT','ENT',['มนฑิรา']);add([2,5],'am','ENT','ENT',['วราลักษณ์']);
add([2],'am','PSY','Adult Psych',['ชนิกา']);
add([3],'am','PSY','พุธพักใจ',['ชนิกา'],[1,3],'เฉพาะเจ้าหน้าที่สาธารณสุข');
add([4],'am','PSY','Adult Psych',['ปรัชนันท์']);add([4],'am','PSY','Child Psych',['ธีวินท์']);add([5],'am','PSY','Psych',['ธีวินท์']);
add([3,5],'am','SKIN','Skin',['พรเทพ']);
add([1],'pm','MED','TB',['พีรวิชญ์','เดชตระการ']);add([1],'pm','MED','Thyroid',['พัทธมน']);add([1],'pm','MED','ID',['สุจิตราภรณ์']);
add([3],'pm','MED','GI',['ทนงศักร']);add([4],'pm','MED','Neuro Med',['พัทธมน']);
add([4],'pm','MED','Pulmonary',['เดชตระการ']);add([4],'pm','MED','HD',['พฤฒินาถ']);add([5],'pm','MED','Geriatric',['พัทธมน']);
add([1],'pm','PED','Asthma',[],[2,3,4,5]);add([3],'pm','PED','HIV',[],[1]);
add([3],'pm','PED','Lactation',[],[2,3,4,5]);add([3],'pm','PED','High-risk Infant',[],[2,3,4,5]);
add([4],'pm','PED','Development');add([4],'pm','PED','Hematology',[],[4]);
add([3],'pm','OB-GYN','High-risk ANC');add([4],'pm','OB-GYN','Menopause',[],[2,4]);
add([3],'pm','SURGICAL','NeuroSx',['ชรินทร์'],null,'ควรมี imaging หรือ condition ทาง NeuroSx ชัดเจน');
add([3,5],'pm','EYE','Eye',['โชคชัย']);
export function clinicsForDate(date){
 const d=new Date(date+'T12:00:00Z'),day=d.getUTCDay(),week=Math.floor((d.getUTCDate()-1)/7)+1;
 return rules.filter(r=>r.day===day&&(!r.weeks||r.weeks.includes(week)));
}
export const CLINIC_DOCTORS=[...new Set(rules.flatMap(r=>r.doctors))];
export const SMC_COLUMNS=['MED','OB-GYN','Surgery','Ortho','อื่น ๆ','Dental'];
export const SMC={
 1:[[['Onco','ธญาณินท์'],['Neuro Med','พัทธมน']],[['OB-GYN','นิธิพร']],[],[],[],[['Dental','ทพ.ธรรมารักษ์']]],
 2:[[['GI','ทนงศักร']],[['OB-GYN','ธิดารัตน์']],[['Surgery','เบญญา']],[],[['Eye','กชนิภา']],[['Dental','ทพญ.ชนะจิต']]],
 3:[[['Pulmonary','เดชตระการ']],[],[['Surgery','ศุภฤกษ์']],[['Ortho','สุพิศ']],[['Adult / Child Psych','ธีวินท์']],[['Dental','ทพ.จิตติพันธ์']]],
 4:[[['CKD','พฤฒินาถ'],['MED','สุจิตราภรณ์']],[['OB-GYN','ธิดารัตน์']],[],[['Ortho','อภิชา']],[['Uro','ปริชญะ']],[['Dental','ทพ.พิมพ์พ่อ']]]
};
export function weekend(date){const day=new Date(date+'T12:00:00Z').getUTCDay();return day===0||day===6;}
export function dutyHoliday(date,data){return weekend(date)||(data.holidays||[]).includes(date);}
export function opdHoliday(date,data,overrides=[]){const row=overrides.find(r=>r.date===date);return weekend(date)||(row?row.closed:((data.opdHolidays||data.holidays||[]).includes(date)));}
