import type {Item} from '@garden/contracts';
import {missionPeriod} from './missions';
const rewards:readonly Item[]=['hammer','wind-row','shuffle','bomb','sweep-row','sweep-column','rainbow'];
/** One displayed item per Korean calendar day; the server decides the period and reward. */
export function bridgeDailyWindow(now:number){
 const period=missionPeriod('daily',now),day=Math.floor((period.start+9*3_600_000)/86_400_000);
 return {periodId:period.id,endsAt:period.endsAt,reward:{item:rewards[((day%rewards.length)+rewards.length)%rewards.length]!,quantity:1}};
}
