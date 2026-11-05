import {describe,it,expect} from 'vitest';
import {availablePassRewards,passClaimState,type PassRewardProgress} from '../apps/client/src/pass-rewards';
const progress=(points:number,premium=false):PassRewardProgress=>({points,premium,tiers:[1,2,3].map(tier=>({tier,points:tier*10,freeClaimed:false,premiumClaimed:false}))});
describe('pass claim-all presentation eligibility',()=>{
 it('uses the exact point boundary and never offers unowned premium rewards',()=>{
  expect(availablePassRewards(progress(9))).toEqual([]);
  expect(availablePassRewards(progress(10))).toEqual([{tier:1,track:'free'}]);
  expect(availablePassRewards(progress(20))).toEqual([{tier:1,track:'free'},{tier:2,track:'free'}]);
 });
 it('includes owned premium and excludes independently claimed tracks',()=>{
  const pass=progress(20,true);pass.tiers[0].freeClaimed=true;pass.tiers[1].premiumClaimed=true;
  expect(availablePassRewards(pass)).toEqual([{tier:1,track:'premium'},{tier:2,track:'free'}]);
 });
 it('distinguishes no unlocked gifts from all currently unlocked gifts already collected',()=>{
  expect(passClaimState(progress(0)).state).toBe('locked');
  const pass=progress(10);pass.tiers[0].freeClaimed=true;
  expect(passClaimState(pass)).toEqual({state:'claimed',available:[]});
  pass.premium=true;expect(passClaimState(pass).state).toBe('available');
 });
});
