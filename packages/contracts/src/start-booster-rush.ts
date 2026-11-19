/** Daily start times use Korea Standard Time, independent of the device timezone. */
export interface StartBoosterSchedule {enabled:boolean;dailyTimes:string[]}
export interface StartBoosterWindow {active:boolean;startsAt:number|null;endsAt:number|null;nextStartsAt:number|null}
export const START_BOOSTER_RUSH_MS=10*60*1000;
export const defaultStartBoosterSchedule=():StartBoosterSchedule=>({enabled:true,dailyTimes:['12:00','18:00','21:00']});
const DAY=86400000,KST=9*3600000;
export function startBoosterWindow(schedule:StartBoosterSchedule|undefined,now:number):StartBoosterWindow {
 const empty:StartBoosterWindow={active:false,startsAt:null,endsAt:null,nextStartsAt:null};
 if(!schedule?.enabled||!Number.isFinite(now))return empty;
 const day=Math.floor((now+KST)/DAY)*DAY-KST;
 const times=[...new Set(schedule.dailyTimes)].filter(time=>/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time)).map(time=>Number(time.slice(0,2))*3600000+Number(time.slice(3))*60000);
 const starts=times.flatMap(time=>[-1,0,1].map(offset=>day+offset*DAY+time)).sort((a,b)=>a-b);
 const active=starts.find(start=>start<=now&&now<start+START_BOOSTER_RUSH_MS);
 return {active:active!==undefined,startsAt:active??null,endsAt:active===undefined?null:active+START_BOOSTER_RUSH_MS,nextStartsAt:starts.find(start=>start>now)??null};
}
