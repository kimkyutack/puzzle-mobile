import {describe,it,expect} from 'vitest';
import {createGame,actionWithFrames,stateHash,legalActions} from '@garden/core';
import {getLevel} from '@garden/content';
import {effectTiming,VISUAL_BEATS,windArrival} from '../apps/client/src/visual-timing';
import {matchBreakPose,MATCH_RELEASE,MATCH_SQUEEZE,tileGathering,impactCues} from '../apps/client/src/tile-impact';
import type {GameEvent} from '@garden/contracts';

describe('one body, one contact, one refill',()=>{
 it('shrinks the tile in place and releases gravity as soon as its body disappears',()=>{
  const state=createGame(getLevel(1)),events:GameEvent[]=[{type:'remove',kind:'berry',cells:[1,2,3]}],timing=effectTiming(events,state);
  expect(timing.delays[0]).toBe(MATCH_SQUEEZE);
  expect(matchBreakPose(0)).toEqual({scaleX:1,scaleY:1,alpha:1});
  const atContact=matchBreakPose(MATCH_SQUEEZE);
  expect(atContact.scaleX).toBeLessThan(.4);
  expect(atContact.scaleY).toBe(atContact.scaleX);
  expect(matchBreakPose(MATCH_SQUEEZE+MATCH_RELEASE).alpha).toBe(0);
  expect(timing.settleAt).toBe(MATCH_SQUEEZE+MATCH_RELEASE);
  expect(effectTiming([...events,{type:'spawn',kind:'wind-row',cells:[2]}],state).settleAt).toBe(MATCH_SQUEEZE+VISUAL_BEATS.normalPop);
  expect(impactCues(events,timing)).toEqual([{delay:MATCH_SQUEEZE,name:'match',strength:'light',shake:.85}]);
 });
 it('synchronizes a wind contact with the travelling head, not the launch or consumed item',()=>{
  const before=createGame(getLevel(31));before.cells[40]!.tile={id:90000,kind:'wind-column'};before.nextTileId=90001;
  const result=actionWithFrames(before,{type:'tap',at:40}),frame=result.frames[0]!,timing=effectTiming(frame.events,frame.state),cues=impactCues(frame.events,timing);
  expect(cues[0]!.delay).toBe(VISUAL_BEATS.charge+windArrival(1/4.5));
  expect(cues[0]!.delay).toBeGreaterThan(VISUAL_BEATS.charge);
  expect(cues.length).toBeLessThanOrEqual(4);
  for(let i=1;i<cues.length;i++)expect(cues[i]!.delay-cues[i-1]!.delay).toBeGreaterThanOrEqual(100);
  const damage=frame.events.flatMap((e,i)=>e.type==='hit'||e.type==='remove'&&e.kind!=='wind-column'?[timing.delays[i]]:[]);
  expect(cues.every(cue=>damage.includes(cue.delay))).toBe(true);
 });
 it('gathers only the matched original IDs into the actual special birth, without changing replay state',()=>{
  let state=createGame(getLevel(31)),formations=0;
  for(let turn=0;turn<20&&state.status==='playing';turn++){
   const action=legalActions(state)[0]!,result=actionWithFrames(state,action);let before=state;
   for(const frame of result.frames){const hash=stateHash(before),gathering=tileGathering(before,frame.events),original=new Set(before.cells.flatMap(c=>c.tile?[c.tile.id]:[]));
    for(const [id,plan]of gathering){formations++;expect(original.has(id)).toBe(true);expect(frame.events.some(e=>e.type==='spawn'&&e.kind!=='normal'&&e.cells.includes(plan.anchor))).toBe(true);expect(plan.at===plan.anchor||frame.events.some(e=>e.type==='remove'&&e.cells.includes(plan.at))).toBe(true);}
    expect(stateHash(before)).toBe(hash);before=frame.state;
   }state=result.state;
  }expect(formations).toBeGreaterThan(0);
 });
 it('collapses reduced motion to a single feedback cue and ignores preparation-only events',()=>{
  const events:GameEvent[]=[{type:'special',kind:'wind-row',cells:[24]},{type:'remove',kind:'wind-row',cells:[24]}],plan=effectTiming(events,createGame(getLevel(1)));
  expect(impactCues(events,plan)).toEqual([]);
  const hits:GameEvent[]=[{type:'remove',kind:'berry',cells:[1]},{type:'hit',kind:'crate',cells:[4]}];
  expect(impactCues(hits,effectTiming(hits),true)).toHaveLength(1);
  expect(impactCues(hits,effectTiming(hits),true)[0]!.shake).toBe(0);
 });
});
