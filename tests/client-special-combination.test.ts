import {describe,it,expect} from 'vitest';
import {createGame,applyAction,stateHash} from '@garden/core';
import {getLevel} from '@garden/content';
import type {Special} from '@garden/contracts';
import {combinationAt,combinationParts} from '../apps/client/src/special-combination';
import {fusionPose} from '../apps/client/src/effect-motion';
import {CROSS_ROCKET_BEATS,effectTiming,isCrossRocket,VISUAL_BEATS,windArrival} from '../apps/client/src/visual-timing';
import {impactCues} from '../apps/client/src/tile-impact';
const kinds:Special[]=['wind-row','wind-column','bomb','glider','rainbow'];
describe('two-power fusion presentation',()=>{
 it('recognizes every ordered power pair without changing the board or accepting normal, seed, blocked or distant pieces',()=>{
  const state=createGame(getLevel(1));for(const a of kinds)for(const b of kinds){state.cells[24]!.tile={id:500,kind:a};state.cells[25]!.tile={id:501,kind:b};const hash=stateHash(state);expect(combinationAt(state,24,25)).toEqual([a,b]);expect(stateHash(state)).toBe(hash);}
  expect(combinationAt(state,24,26)).toBeNull();state.cells[25]!.obstacleId='locked';expect(combinationAt(state,24,25)).toBeNull();expect(combinationParts('bomb+normal')).toBeNull();expect(combinationParts('glider-flight')).toBeNull();
 });
 it('joins both original positions at one anchor before the combined effect releases',()=>{
  const from={x:175,y:175},target={x:225,y:175};expect(fusionPose(0,from,target,-1,50)).toMatchObject({...from,alpha:1});
  for(const [point,side]of [[from,-1],[target,1]] as const){expect(fusionPose(.64,point,target,side,50).x).toBeCloseTo(target.x);expect(fusionPose(.64,point,target,side,50).y).toBeCloseTo(target.y);expect(fusionPose(1,point,target,side,50)).toMatchObject({...target,alpha:0});}
  expect(fusionPose(.3,from,target,-1,50).y).toBeLessThan(from.y);
 });
 it('gives every actual engine combination a fusion phase and keeps both input pieces out of the ordinary pop sequence',()=>{
  for(const a of kinds)for(const b of kinds){const before=createGame(getLevel(1));before.cells[24]!.tile={id:500,kind:a};before.cells[25]!.tile={id:501,kind:b};before.nextTileId=502;const hash=stateHash(before),action={type:'swap',from:24,to:25} as const,result=applyAction(before,action),plan=effectTiming(result.events,result.state,action),index=result.events.findIndex(event=>event.type==='special'&&event.kind===`${a}+${b}`);
   const cross=isCrossRocket(result.events[index]!.kind!),release=cross?CROSS_ROCKET_BEATS.fusion:VISUAL_BEATS.fusion;
   expect(result.accepted).toBe(true);expect(plan.fusionAt.get(index)).toBe(0);expect(plan.delays[index]).toBe(release);expect(plan.activationAt.get(24)).toBe(0);expect(plan.activationAt.get(25)).toBe(0);expect(plan.primaryImpactAt).toBeGreaterThanOrEqual(release+(cross?0:VISUAL_BEATS.charge));expect(stateHash(before)).toBe(hash);
   for(const flight of result.events.flatMap((event,i)=>event.kind==='glider-flight'&&event.from===25?[i]:[]))expect(plan.delays[flight]).toBe(VISUAL_BEATS.fusion);
  }
 });
 it('times a crossed arm, its triggered rocket, and a multi-cell obstacle by their own contacts',()=>{
  const before=createGame(getLevel(1));
  before.cells[23]!.tile={id:500,kind:'wind-row'};
  before.cells[24]!.tile={id:501,kind:'wind-column'};
  before.cells[26]!.tile={id:502,kind:'wind-column'};
  before.nextTileId=503;
  const action={type:'swap',from:23,to:24} as const,result=applyAction(before,action);
  const {events,state}=result;
  const plan=effectTiming(events,state,action),cross=events.findIndex(event=>event.type==='special'&&isCrossRocket(event.kind??''));
  const relayed=events.findIndex((event,i)=>i>cross&&event.type==='special'&&event.cells[0]===26);
  const childId=events[relayed]!.effectId!;
  const contact=CROSS_ROCKET_BEATS.fusion+windArrival(2/3.5,CROSS_ROCKET_BEATS.travel);
  expect(plan.delays[relayed-1]).toBe(contact);
  expect(plan.rocketLaunches.get(relayed)).toBe(contact+CROSS_ROCKET_BEATS.relay);
  const childHit=events.findIndex(event=>event.type==='remove'&&event.effectId===childId&&event.cells[0]===19);
  expect(plan.delays[childHit]).toBe(contact+CROSS_ROCKET_BEATS.relay+windArrival(1/3.5,CROSS_ROCKET_BEATS.travel));

  const crossId=events[cross]!.effectId!;
  const stagedEvents=[events[cross]!,{type:'remove',kind:'sun',cells:[25],effectId:crossId} as const,
   {type:'hit',kind:'crate',cells:[33,27,34],effectId:crossId} as const].map(event=>({...event,cells:[...event.cells]}));
  const staged=effectTiming(stagedEvents,state);
  const crack=CROSS_ROCKET_BEATS.fusion+windArrival(3/3.5,CROSS_ROCKET_BEATS.travel);
  expect(staged.rocketContacts.get(2)).toBe(27);
  expect(staged.delays[2]).toBe(crack);
  expect(impactCues(stagedEvents,staged).some(cue=>cue.name==='crack'&&cue.delay===crack)).toBe(true);
 });
});
