import type {WeeklyEventId} from '../../../packages/contracts/src/weekly-events';

const seen=new Set<string>();
const guideKey=(owner:string,event:WeeklyEventId)=>`garden.weekly-guide.v1:${owner}:${event}`;
export function hasSeenWeeklyGuide(owner:string,event:WeeklyEventId){
 const key=guideKey(owner,event);
 if(seen.has(key))return true;
 try{return localStorage.getItem(key)==='seen';}catch{return false;}
}
export function markWeeklyGuideSeen(owner:string,event:WeeklyEventId){
 const key=guideKey(owner,event);seen.add(key);
 try{localStorage.setItem(key,'seen');}catch{/* Keep the current session usable without storage. */}
}
