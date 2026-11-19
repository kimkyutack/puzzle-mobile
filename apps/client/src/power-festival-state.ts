import type {PowerFestivalState,Run} from '@garden/contracts';
import {addPowerUses,emptyPowerUses,POWER_USE_KINDS,festivalClaimable,POWER_FESTIVAL_STAGES} from '../../../packages/content/src/power-festival';
/** Only the unacknowledged activation delta is predicted; acknowledgements do not double-count it. */
export function predictedFestival(event:PowerFestivalState,run:Run|null,confirmed:Run|null,now:number):PowerFestivalState{
 if(!run||!confirmed||run.id!==confirmed.id||now<event.startedAt||now>=event.endsAt)return event;
 const pending=Object.fromEntries(POWER_USE_KINDS.map(kind=>[kind,Math.max(0,(run.powerUses?.[kind]??0)-(confirmed.powerUses?.[kind]??0))])) as ReturnType<typeof emptyPowerUses>;
 return {...event,counts:addPowerUses(event.counts,pending)};
}
export function showFestival(event:PowerFestivalState|undefined,now:number):boolean{return !!event&&event.claimedStages<POWER_FESTIVAL_STAGES.length&&(event.endsAt>now||festivalClaimable(event)>0);}
