import {describe,it,expect} from 'vitest';
import {passPrize,type PassTrack} from '../packages/contracts/src/pass-rewards';
import {DECORATIONS} from '../packages/garden-world/src/catalog';
describe('one prize per season pass tier',()=>{
 it('budgets the repriced premium pass while keeping one real prize per tier',()=>{
  for(const [track,total]of [['free',750],['premium',6000]] as const){
   const rewards=Array.from({length:30},(_,i)=>passPrize(i+1,track));
   expect(rewards.reduce((sum,r)=>sum+(r.kind==='coins'?r.quantity:0),0)).toBe(total);
   for(const reward of rewards){expect(reward.quantity).toBeGreaterThan(0);if(reward.kind==='decoration')expect(DECORATIONS.find(d=>d.id===reward.itemId)?.layer).toBe('object')}
   expect(rewards.some(r=>r.kind==='item')).toBe(true);expect(rewards.some(r=>r.kind==='decoration')).toBe(true);
  }
  const premium=Array.from({length:30},(_,i)=>passPrize(i+1,'premium'));
  expect(premium.reduce((n,r)=>n+(r.kind==='item'?r.quantity:0),0)).toBe(30);
  expect(premium.filter(r=>r.kind==='decoration')).toHaveLength(5);
  const coins=premium.filter(r=>r.kind==='coins').map(r=>r.quantity);expect(coins).toEqual([...coins].sort((a,b)=>a-b));
  expect(passPrize(15,'premium').kind).toBe('profile');expect(passPrize(30,'premium').kind).toBe('guild-gift');
 });
 it('retains the previous paid reward amounts for already claimed revision2 tiers',()=>{
  const old=Array.from({length:30},(_,i)=>passPrize(i+1,'premium',2));
  expect(old.reduce((sum,r)=>sum+(r.kind==='coins'?r.quantity:0),0)).toBe(2250);
  expect(old.reduce((sum,r)=>sum+(r.kind==='item'?r.quantity:0),0)).toBe(11);
 });
 it('rejects invalid tier requests',()=>{for(const tier of [0,31,1.5,NaN])for(const track of ['free','premium'] as PassTrack[])expect(()=>passPrize(tier,track)).toThrow(RangeError)});
});
