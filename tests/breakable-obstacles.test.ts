import {describe,expect,it} from 'vitest';
import {CHAPTER_OBSTACLE_ENGINE_VERSION,SEED_DELIVERY_ENGINE_VERSION} from '@garden/contracts';
import {applyAction,createGame,legalActions,replay,validateLevel} from '@garden/core';
import {publishedLevel} from '../apps/api/src/level-content';
import {breakableSlot} from '../packages/content/src/breakable-campaign-plan';
import {impactOverlays} from '../apps/client/src/impact-overlays';

const level=(id:number)=>publishedLevel(id,CHAPTER_OBSTACLE_ENGINE_VERSION);
const hit=(state:ReturnType<typeof createGame>,at:number)=>applyAction(state,{type:'booster',item:'hammer',at});

describe('direct obstacles',()=>{
 it('opens a crate into a fresh obstacle and counts the contents only when they break',()=>{
  const board=level(604),original=createGame(board);
  const crate=Object.values(original.obstacles).find(obstacle=>obstacle.contents?.kind==='urn')!;
  const opened=hit(original,crate.anchor);
  expect(opened.accepted).toBe(true);
  expect(opened.state.cells[crate.anchor]?.obstacleId).toBe(crate.id);
  expect(opened.state.obstacles[crate.id]).toMatchObject({kind:'urn',hp:2});
  expect(opened.state.goals).toEqual(original.goals);
  const visuals=impactOverlays(original,opened.state,opened.events,{delays:opened.events.map(()=>100),settleAt:500});
  expect(visuals).toContainEqual({delay:100,kind:'obstacle',id:crate.id,value:opened.state.obstacles[crate.id]});
  const cracked=hit(opened.state,crate.anchor);
  expect(cracked.state.obstacles[crate.id]).toMatchObject({kind:'urn',hp:1});
  const destroyed=hit(cracked.state,crate.anchor);
  expect(destroyed.state.obstacles[crate.id]).toBeUndefined();
  expect(destroyed.state.goals[0]?.remaining).toBe(original.goals[0]!.remaining-1);
  expect(replay(board,Array.from({length:3},()=>({type:'booster',item:'hammer',at:crate.anchor}))).state).toEqual(destroyed.state);
 });

 it('uses ten independent, six-hit statues and lets one rocket reach several of them',()=>{
  const state=createGame(level(504)),statues=Object.values(state.obstacles).filter(o=>o.kind==='statue');
  expect(statues).toHaveLength(10);
  expect(statues.every(o=>o.footprint.length===1&&o.hp===6)).toBe(true);
  const at=statues[0]!.anchor,row=Math.floor(at/state.width);
  const result=applyAction(state,{type:'booster',item:'sweep-row',at});
  const struck=statues.filter(o=>Math.floor(o.anchor/state.width)===row);
  expect(struck).toHaveLength(6);
  for(const target of statues)expect(result.state.obstacles[target.id]?.hp).toBe(struck.includes(target)?5:6);
  const lone=statues.find(o=>!struck.includes(o))!;
  let current=result.state;
  for(let remaining=5;remaining>=0;remaining--){
   current=hit(current,lone.anchor).state;
   expect(current.obstacles[lone.id]?.hp??0).toBe(remaining);
   expect(current.goals.find(goal=>goal.kind==='statue')?.remaining).toBe(remaining===0?9:10);
  }
 });

 it('still applies one damage per effect to a statue with a shared four-cell footprint',()=>{
  const board=Array.from({length:1000},(_,index)=>index+401).find(id=>breakableSlot(id)?.pattern==='statue-court')!;
  const state=createGame(level(board)),statue=Object.values(state.obstacles).find(o=>o.kind==='statue')!;
  const result=applyAction(state,{type:'booster',item:'sweep-row',at:statue.anchor});
  expect(result.state.obstacles[statue.id]?.hp).toBe(statue.hp-1);
  expect(result.events.filter(event=>event.obstacleId===statue.id)).toHaveLength(1);
  expect(statue.footprint.every(at=>result.state.cells[at]?.obstacleId===statue.id)).toBe(true);
 });

 it('damages urns with adjacent matches and reserves crystal damage for direct effects',()=>{
  const urns=createGame(level(404));
  expect(legalActions(urns).some(action=>applyAction(urns,action).events.some(event=>event.type==='hit'&&event.kind==='urn'))).toBe(true);
  const crystals=createGame(level(704)),crystal=Object.values(crystals.obstacles).find(o=>o.kind==='crystal')!;
  expect(Object.values(crystals.obstacles)).toHaveLength(10);
  const actions=legalActions(crystals).map(action=>applyAction(crystals,action));
  const adjacentMatch=actions.find(result=>!result.events.some(event=>event.type==='special')&&
   Object.values(crystals.obstacles).some(obstacle=>result.events.some(event=>event.type==='remove'&&event.cells.some(at=>
    Math.abs(at%9-obstacle.anchor%9)+Math.abs(Math.floor(at/9)-Math.floor(obstacle.anchor/9))===1))));
  expect(adjacentMatch?.state.obstacles).toEqual(crystals.obstacles);
  expect(hit(crystals,crystal.anchor).state.obstacles[crystal.id]).toBeUndefined();
 });

 it('schedules direct obstacles in each band and serves retained boards to older engines',()=>{
  const patterns=new Set<string>();let boards=0;
  for(let id=401;id<=20000;id++){
   const plan=breakableSlot(id);
   if(!plan)continue;
   boards++;patterns.add(plan.pattern);
   const board=level(id);
   expect(validateLevel(board),String(id)).toEqual([]);
   expect(board.strategy?.id).toBe(plan.pattern);
   expect(board.moves).toBeGreaterThanOrEqual(publishedLevel(id,SEED_DELIVERY_ENGINE_VERSION).moves);
  }
  expect([boards,patterns.size]).toEqual([1776,10]);
  expect(level(404).obstacles.filter(o=>o.kind==='urn')).toHaveLength(10);
  expect(level(604).obstacles.filter(o=>o.contents?.kind==='urn')).toHaveLength(10);
  expect(validateLevel({...level(406),engineVersion:SEED_DELIVERY_ENGINE_VERSION})).toContain('BREAKABLE_ENGINE');
  expect(publishedLevel(406,SEED_DELIVERY_ENGINE_VERSION).obstacles.some(o=>o.kind==='urn')).toBe(false);
 },20000);
});
