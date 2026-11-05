import {describe,it,expect} from 'vitest';
import {createGame,applyAction,stateHash} from '@garden/core';
import {getLevel} from '@garden/content';
import type {Action,GameEvent} from '@garden/contracts';
import solutions from '../packages/content/src/campaign-solutions.json';
import {effectTiming,VISUAL_BEATS} from '../apps/client/src/visual-timing';
describe('event-derived presentation timing',()=>{
 it('holds rainbow targets through the enlarged charge and beam travel, including a fused pair',()=>{
  for(const combined of [false,true]){const events:GameEvent[]=[{type:'special',kind:combined?'rainbow+rainbow':'rainbow',cells:combined?[23,24]:[24]},{type:'remove',cells:[1,9,17,30,40],kind:'berry',effectId:1}];const plan=effectTiming(events,createGame(getLevel(1))),impact=(combined?VISUAL_BEATS.fusion:0)+1550;expect(plan.primaryImpactAt).toBe(impact);for(const at of events[1]!.cells)expect(plan.firstRemovalAt.get(at)).toBe(impact);}
 });
 it('keeps later cascade tiles present while the first rainbow is charging',()=>{
  const events:GameEvent[]=[{type:'special',kind:'rainbow',cells:[24]},{type:'remove',cells:[1],kind:'berry',effectId:1},{type:'fall',cells:[1],from:0,to:1},{type:'remove',cells:[12],kind:'sun',effectId:2}];
  const plan=effectTiming(events,createGame(getLevel(1)));expect(plan.firstRemovalAt.get(12)).toBe(1550);expect(plan.firstRemovalAt.get(1)).toBe(1550);
 });
 it('lets a normal match settle promptly without holding an unchanged tile',()=>{
  const state=createGame(getLevel(1)),result=applyAction(state,(solutions['1'].actions as Action[])[0]!),plan=effectTiming(result.events,result.state);
  expect(plan.special).toBe(false);expect(plan.settleAt+390+30).toBeLessThanOrEqual(750);
 });
 it('keeps glider anticipation and full flight before the authoritative target impact',()=>{
  const state=createGame(getLevel(4));const events:GameEvent[]=[{type:'special',kind:'glider',cells:[24]},{type:'special',kind:'glider-flight',cells:[24,45],from:24,to:45},{type:'remove',kind:'berry',cells:[45],effectId:3}];
  const plan=effectTiming(events,state);expect(plan.delays[1]).toBe(0);expect(plan.delays[2]).toBe(VISUAL_BEATS.charge+VISUAL_BEATS.gliderFlight);expect(plan.firstRemovalAt.get(45)).toBe(1100);expect(plan.settleAt).toBe(1280);expect(plan.primaryImpactAt).toBe(1100);
 });
 it('times horizontal and vertical wind hits against the visible sweep travel',()=>{
  const state=createGame(getLevel(1)),row:GameEvent[]=[{type:'special',kind:'wind-row',cells:[24]},{type:'remove',cells:[25],kind:'berry'},{type:'remove',cells:[27],kind:'drop'}],column:GameEvent[]=[{type:'special',kind:'wind-column',cells:[24]},{type:'remove',cells:[31],kind:'berry'},{type:'remove',cells:[45],kind:'drop'}];
  const horizontal=effectTiming(row,state),vertical=effectTiming(column,state);expect(horizontal.delays[1]).toBeGreaterThan(VISUAL_BEATS.charge);expect(horizontal.delays[2]).toBeGreaterThan(horizontal.delays[1]!);expect(vertical.delays).toEqual(horizontal.delays);
 });
 it('shows the hammer approaching before anything at its target disappears',()=>{
  const state=createGame(getLevel(1)),events:GameEvent[]=[{type:'remove',kind:'berry',cells:[20],effectId:1}];
  const plan=effectTiming(events,state,{type:'booster',item:'hammer',at:20});expect(plan.toolImpact).toBe(760);expect(plan.firstRemovalAt.get(20)).toBe(760);expect(plan.settleAt).toBe(940);
 });
 it('overlaps long chains without shortening the complete late glider flight',()=>{
  const state=createGame(getLevel(1)),events:GameEvent[]=[{type:'special',kind:'rainbow',cells:[0]},{type:'remove',kind:'glider',cells:[15],effectId:1},{type:'special',kind:'glider',cells:[15]},{type:'special',kind:'glider-flight',cells:[15,40],from:15,to:40},{type:'remove',kind:'berry',cells:[40],effectId:2}];
  const plan=effectTiming(events,state);expect(plan.delays[3]).toBeGreaterThanOrEqual(800);expect(plan.firstRemovalAt.get(40)!-plan.delays[3]!).toBe(1100);expect(plan.settleAt+420).toBeLessThanOrEqual(3000);
 });
 it('preserves all authored replay states and bounds presentation through their entire solutions',()=>{
  let checked=0,longest=0;for(const [id,fixture]of Object.entries(solutions)){let state=createGame(getLevel(Number(id)));for(const action of fixture.actions as Action[]){const result=applyAction(state,action);const before=stateHash(result.state),events=JSON.stringify(result.events);const plan=effectTiming(result.events,result.state,action);longest=Math.max(longest,plan.settleAt+420);expect(stateHash(result.state)).toBe(before);expect(JSON.stringify(result.events)).toBe(events);expect(plan.delays.every(delay=>Number.isFinite(delay)&&delay>=0)).toBe(true);expect(plan.settleAt+420).toBeLessThanOrEqual((result.events.some(event=>event.kind?.includes('rainbow'))?VISUAL_BEATS.maxChainStart+VISUAL_BEATS.rainbowCharge+VISUAL_BEATS.rainbowTravel+VISUAL_BEATS.pop+420:3000)+(plan.fusionAt.size?VISUAL_BEATS.fusion:0));state=result.state;checked++;}}
  expect(checked).toBeGreaterThan(400);expect(longest).toBeGreaterThan(1600);
 });
});
