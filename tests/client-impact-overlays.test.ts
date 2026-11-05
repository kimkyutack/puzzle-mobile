import {describe,it,expect} from 'vitest';
import {createGame,applyAction,stateHash} from '@garden/core';
import {getLevel} from '@garden/content';
import type {GameEvent} from '@garden/contracts';
import {effectTiming} from '../apps/client/src/visual-timing';
import {impactOverlays} from '../apps/client/src/impact-overlays';
describe('obstacle and frost impact presentation',()=>{
 it('keeps a real hammer target crate until the 760 ms impact without changing replay state',()=>{const before=createGame(getLevel(7)),crate=Object.values(before.obstacles).find(o=>o.kind==='crate')!,action={type:'booster' as const,item:'hammer' as const,at:crate.anchor},result=applyAction(before,action),hash=stateHash(result.state),plan=effectTiming(result.events,result.state,action),steps=impactOverlays(before,result.state,result.events,plan);expect(result.accepted).toBe(true);expect(steps.find(step=>step.kind==='obstacle'&&step.id===crate.id)).toEqual({kind:'obstacle',id:crate.id,value:null,delay:760});expect(before.obstacles[crate.id]!.hp).toBe(1);expect(stateHash(result.state)).toBe(hash);expect(plan.primaryImpactAt).toBe(760);});
 it('keeps real frost visible until the hammer lands and aligns its only impact cue',()=>{const before=createGame(getLevel(13)),at=before.cells.findIndex(cell=>cell.frost>0),action={type:'booster' as const,item:'hammer' as const,at},result=applyAction(before,action),plan=effectTiming(result.events,result.state,action);expect(result.accepted).toBe(true);const step=impactOverlays(before,result.state,result.events,plan).find(step=>step.kind==='frost'&&step.at===at);expect(step).toEqual({kind:'frost',at,value:0,delay:760});expect(plan.primaryImpactAt).toBe(step?.delay);});
 it('keeps the vine cover above its piece until the actual removal impact',()=>{const before=createGame(getLevel(10)),vine=Object.values(before.obstacles).find(obstacle=>obstacle.kind==='vine')!,action={type:'booster' as const,item:'hammer' as const,at:vine.anchor},result=applyAction(before,action);expect(before.cells[vine.anchor]!.tile).not.toBeNull();expect(result.accepted).toBe(true);const plan=effectTiming(result.events,result.state,action);expect(impactOverlays(before,result.state,result.events,plan).find(step=>step.kind==='obstacle'&&step.id===vine.id)).toEqual({kind:'obstacle',id:vine.id,value:null,delay:760});});
 it('retains the inner ice layer after one hit and removes the last layer on the next real hit',()=>{
  let before=createGame(getLevel(53));const at=46;
  expect(before.cells[at]!.frost).toBe(2);
  for(const remaining of [1,0]){
   const hash=stateHash(before),action={type:'booster' as const,item:'hammer' as const,at},result=applyAction(before,action);
   expect(result.accepted).toBe(true);expect(result.state.cells[at]!.frost).toBe(remaining);
   const steps=impactOverlays(before,result.state,result.events,effectTiming(result.events,result.state,action));
   expect(steps.filter(step=>step.kind==='frost')).toEqual([{kind:'frost',at,value:remaining,delay:760}]);
   expect(stateHash(before)).toBe(hash);before=result.state;
  }
 });
 it('shows each HP layer in order for distinct chained hits on a multi-cell obstacle',()=>{const before=createGame(getLevel(7)),crate=Object.values(before.obstacles)[0]!;crate.hp=3;crate.maxHp=3;crate.footprint=[crate.anchor,crate.anchor+1];const after=structuredClone(before);after.obstacles[crate.id]!.hp=1;const events:GameEvent[]=[{type:'hit',kind:'crate',cells:crate.footprint,effectId:1},{type:'hit',kind:'crate',cells:crate.footprint,effectId:2}],plan=effectTiming(events,after);plan.delays=[450,1100];const steps=impactOverlays(before,after,events,plan).filter(step=>step.kind==='obstacle');expect(steps.map(step=>({delay:step.delay,hp:step.value?.hp}))).toEqual([{delay:450,hp:2},{delay:1100,hp:1}]);expect(crate.hp).toBe(3);});
});
