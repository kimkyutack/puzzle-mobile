import {describe,it,expect} from 'vitest';
import {passPrize,type PassTrack} from '../packages/contracts/src/pass-rewards';
import {DECORATIONS} from '../packages/garden-world/src/catalog';
describe('one prize per season pass tier',()=>{
 it('keeps season coin totals and six premium hammers while mixing real placeable art and tools',()=>{
  for(const [track,total]of [['free',750],['premium',2250]] as const){
   const rewards=Array.from({length:30},(_,i)=>passPrize(i+1,track));
   expect(rewards.reduce((sum,r)=>sum+(r.kind==='coins'?r.quantity:0),0)).toBe(total);
   for(const reward of rewards){expect(reward.quantity).toBeGreaterThan(0);if(reward.kind==='decoration')expect(DECORATIONS.find(d=>d.id===reward.itemId)?.layer).toBe('object')}
   expect(rewards.some(r=>r.kind==='item')).toBe(true);expect(rewards.some(r=>r.kind==='decoration')).toBe(true);
  }
  expect(Array.from({length:30},(_,i)=>passPrize(i+1,'premium')).reduce((n,r)=>n+(r.kind==='item'&&r.item==='hammer'?r.quantity:0),0)).toBe(6);
  expect(passPrize(15,'premium').kind).toBe('profile');expect(passPrize(30,'premium').kind).toBe('guild-gift');
 });
 it('rejects invalid tier requests',()=>{for(const tier of [0,31,1.5,NaN])for(const track of ['free','premium'] as PassTrack[])expect(()=>passPrize(tier,track)).toThrow(RangeError)});
});
