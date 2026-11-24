import {duration} from './api';
import {getLocale,tr} from './i18n';

/** Keep home badges compact: whole days plus the remaining hours and minutes. */
export function homeCountdown(ms:number,compactDays=false){
 const seconds=Math.max(0,Math.ceil(ms/1000)),days=Math.floor(seconds/86400);
 if(!days)return duration(ms);
 const hours=Math.floor(seconds/3600)%24,minutes=Math.floor(seconds/60)%60;
 const dayLabel=compactDays&&getLocale()==='en'?`${days}d`:tr('{0}일',{0:days});
 return `${dayLabel} ${hours}:${String(minutes).padStart(2,'0')}`;
}
