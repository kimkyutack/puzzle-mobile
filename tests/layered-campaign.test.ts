import {describe,expect,it} from 'vitest';
import {CHAPTER_OBSTACLE_ENGINE_VERSION,CONTINUOUS_REFILL_ENGINE_VERSION as ENGINE_VERSION,LAYERED_OBSTACLE_ENGINE_VERSION,type GameEvent,type LevelDefinition} from '@garden/contracts';
import {applyAction,createGame,findMatches,legalActions,validateLevel} from '@garden/core';
import {publishedLevel} from '../apps/api/src/level-content';
import {prepareRunInitial} from '../apps/api/src/run-initial';
import {effectTiming} from '../apps/client/src/visual-timing';

function matchThree(level:LevelDefinition,accept:(events:GameEvent[])=>boolean){
 const before=createGame(level);
 for(const action of legalActions(before)){
  if(action.type!=='swap')continue;
  const swapped=structuredClone(before),from=swapped.cells[action.from]!,to=swapped.cells[action.to]!;
  [from.tile,to.tile]=[to.tile,from.tile];
  const matches=findMatches(swapped);
  if(matches.length!==1||matches[0]!.cells.length!==3||matches[0]!.kind)continue;
  const result=applyAction(before,action);
  if(result.accepted&&accept(result.events))return result;
 }
 throw new Error(`No direct three-tile move for level ${level.id}`);
}

describe('campaign obstacle layers',()=>{
 it('opens a large box with an ordinary triple and preserves four separate target pieces',()=>{
  const level=publishedLevel(401,ENGINE_VERSION),box=level.obstacles[0]!;
  expect(box.kind).toBe('supply-crate');
  expect(box.footprint).toHaveLength(4);
  expect(level.goals).toEqual([{kind:'urn',count:4,remaining:4}]);
  expect(validateLevel({...level,engineVersion:CHAPTER_OBSTACLE_ENGINE_VERSION})).toContain('BREAKABLE_FOOTPRINT');
  const result=matchThree(level,events=>events.some(event=>event.type==='hit'&&event.obstacleId===box.id&&event.effectId===1));
  const openings=result.events.filter(event=>event.kind==='crate-pieces-reveal');
  expect(openings.map(event=>event.obstacleAfter?.anchor)).toEqual(box.footprint);
  expect(new Set(openings.map(event=>event.obstacleId)).size).toBe(4);
  expect(openings.every(event=>event.obstacleAfter?.kind==='urn'&&event.obstacleAfter.hp===1)).toBe(true);
  expect(result.events.some(event=>event.type==='hit'&&event.kind==='urn'&&event.effectId===1)).toBe(false);
  const timing=effectTiming(result.events,result.state);
  const hit=result.events.findIndex(event=>event.obstacleId===box.id);
  expect(openings.every(event=>timing.delays[result.events.indexOf(event)]!>timing.delays[hit]!)).toBe(true);
 });

 it('reveals four small boxes before the jars on the nested layout',()=>{
  const level=publishedLevel(501,ENGINE_VERSION);
  const result=matchThree(level,events=>events.some(event=>event.type==='hit'&&event.kind==='supply-crate'&&event.effectId===1));
  const boxes=result.events.flatMap(event=>event.kind==='crate-pieces-reveal'&&event.obstacleAfter?[event.obstacleAfter]:[]);
  expect(boxes).toHaveLength(4);
  for(const box of boxes)expect(box).toMatchObject({kind:'supply-crate',hp:1,contents:{kind:'urn',hp:1}});
 });

 it('delivers a hit across the board after a three-tile match beside a pouch',()=>{
  const level=publishedLevel(201,ENGINE_VERSION),windmill=level.obstacles.find(obstacle=>obstacle.kind==='windmill')!;
  const result=matchThree(level,events=>events.some(event=>event.type==='hit'&&event.kind==='wind-pod'&&event.effectId===1));
  const launch=result.events.findIndex(event=>event.kind==='wind-seed-flight');
  const hit=result.events.findIndex(event=>event.type==='hit'&&event.obstacleId===windmill.id);
  expect(launch).toBeGreaterThan(0);
  expect(hit).toBeGreaterThan(launch);
  const event=result.events[launch]!;
  expect(event.to).toBe(windmill.anchor);
  expect(level.obstacles.find(obstacle=>obstacle.anchor===event.from)?.link).toBe(windmill.id);
  expect(result.events[hit]!.obstacleAfter?.hp).toBe(windmill.hp-1);
 });

 it('retains the previous publication and its seed variant for already installed apps',()=>{
  const previous=publishedLevel(401,CHAPTER_OBSTACLE_ENGINE_VERSION),level=publishedLevel(401,LAYERED_OBSTACLE_ENGINE_VERSION);
  expect(previous.devices?.length).toBeGreaterThan(0);
  expect(level.devices).toBeUndefined();
  expect(level.goals.map(goal=>goal.kind)).toEqual(['windmill']);
  const regular=publishedLevel(403,LAYERED_OBSTACLE_ENGINE_VERSION);
  const leftBank=new Set(regular.obstacles.flatMap(obstacle=>obstacle.footprint).filter(at=>at%regular.width<4));
  expect(leftBank.size).toBe(4*regular.height);
  const next=prepareRunInitial(regular,[],true,1).level;
  expect(next.seed).not.toBe(regular.seed);
  expect(next.obstacles).toEqual(regular.obstacles);
  for(let id=4301;id<=5901;id+=100){
   expect(publishedLevel(id,LAYERED_OBSTACLE_ENGINE_VERSION).campaign?.beat).toBe('introduction');
   expect(publishedLevel(id+1,LAYERED_OBSTACLE_ENGINE_VERSION).campaign?.beat).not.toBe('introduction');
  }
 });
});
