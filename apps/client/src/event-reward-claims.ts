import type {OpsEvent,OpsReward} from '../../../packages/contracts/src/operations';
export const hasEventReward=(event:Pick<OpsEvent,'reward'>)=>event.reward.coins+event.reward.stars+event.reward.hearts+Object.values(event.reward.items).reduce((sum,value)=>sum+value,0)>0;
export function collectedEventRewards(events:readonly OpsEvent[]):OpsReward{
 const total:OpsReward={coins:0,stars:0,hearts:0,items:{}};
 for(const event of events)if(event.claimed){total.coins+=event.reward.coins;total.stars+=event.reward.stars;total.hearts+=event.reward.hearts;for(const [item,count]of Object.entries(event.reward.items))total.items[item]=(total.items[item]??0)+count;}
 return total;
}
/** Use each existing authoritative claim endpoint; retain successful claims if a later request fails. */
export async function claimEventRewardBatch(events:readonly OpsEvent[],claim:(id:string)=>Promise<unknown>,onClaimed:(id:string)=>void){
 const claimed:string[]=[];
 for(const event of events)if(!event.claimed&&hasEventReward(event)){await claim(event.id);onClaimed(event.id);claimed.push(event.id);}
 return claimed;
}
