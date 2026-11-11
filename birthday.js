// Birthday slide schedule; all times use the Asia/Bangkok wall clock.
// 17 November every year: 08:30–16:30, first 5 minutes of every 30-minute cycle.
// One-off rehearsal: 11 November 2026, 20:15–20:30, continuously.
export const BIRTHDAY_IMAGE_PATH='./assets/birthday-53.png';

export function birthdaySlideActive(date,minutes){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(String(date))||!Number.isInteger(minutes)||minutes<0||minutes>=1440)return false;
 if(date==='2026-11-11')return minutes>=20*60+15&&minutes<20*60+30;
 if(!date.endsWith('-11-17'))return false;
 const first=8*60+30,last=16*60+30;
 return minutes>=first&&minutes<last&&(minutes-first)%30<5;
}
