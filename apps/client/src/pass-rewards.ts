export interface PassRewardProgress {points:number;premium:boolean;tiers:ReadonlyArray<{tier:number;points:number;freeClaimed:boolean;premiumClaimed:boolean}>}
export function availablePassRewards(pass:PassRewardProgress){
 return pass.tiers.flatMap(tier=>pass.points<tier.points?[]:([
  ...(!tier.freeClaimed?[{tier:tier.tier,track:'free' as const}]:[]),
  ...(pass.premium&&!tier.premiumClaimed?[{tier:tier.tier,track:'premium' as const}]:[])
 ]));
}
export function passClaimState(pass:PassRewardProgress){
 const available=availablePassRewards(pass);
 if(available.length)return {available,state:'available' as const};
 return {available,state:pass.tiers.some(tier=>pass.points>=tier.points)?'claimed' as const:'locked' as const};
}

/** Advance from the reward that was actually confirmed, including a claim-all
 * response or a click on another visible row. Unchanged/failed claims do not move. */
export function confirmedPassSelection(previous:PassRewardProgress['tiers'],next:PassRewardProgress['tiers']):number|undefined{
 const changed=next.filter(tier=>{const before=previous.find(item=>item.tier===tier.tier);return before&&(!before.freeClaimed&&tier.freeClaimed||!before.premiumClaimed&&tier.premiumClaimed)});
 if(!changed.length)return undefined;
 const last=Math.max(...changed.map(tier=>tier.tier)),at=next.findIndex(tier=>tier.tier===last);
 return next[at+1]?.tier??next[at]?.tier;
}
