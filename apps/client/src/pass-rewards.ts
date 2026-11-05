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
