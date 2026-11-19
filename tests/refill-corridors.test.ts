import {describe,expect,it} from 'vitest';
import {ENGINE_VERSION,LAYERED_OBSTACLE_ENGINE_VERSION,type GameState} from '@garden/contracts';
import {applyAction,createGame,validateLevel} from '@garden/core';
import {BULK_PUBLISHED_LEVEL} from '@garden/content';
import {publishedLevel} from '../apps/api/src/level-content';
import {unsuppliedTileCells} from '../packages/content/src/refill-corridors';
import {impactOverlays} from '../apps/client/src/impact-overlays';
import {effectTiming} from '../apps/client/src/visual-timing';

const holes=(state:GameState)=>state.cells.flatMap((cell,at)=>cell.exists&&!cell.tile&&!cell.obstacleId&&
 !state.gardenStage?.connected.includes(at)?[at]:[]);

describe('continuous campaign refill',()=>{
 it('keeps level 94 jars and cutouts while feeding a cleared lower row from above',()=>{
  const previous=publishedLevel(94,LAYERED_OBSTACLE_ENGINE_VERSION),level=publishedLevel(94,ENGINE_VERSION);
  expect(unsuppliedTileCells(previous).length).toBeGreaterThan(0);
  expect(unsuppliedTileCells(level)).toEqual([]);
  expect(level.shape).toEqual(previous.shape);
  expect(level.goals).toEqual(previous.goals);
  expect(level.obstacles.map(({id,hp})=>[id,hp])).toEqual(previous.obstacles.map(({id,hp})=>[id,hp]));
  const action={type:'booster',item:'sweep-row',at:55} as const;
  const result=applyAction(createGame(level),action);
  expect(result.accepted).toBe(true);
  expect(result.state.status).toBe('playing');
  expect(holes(result.state)).toEqual([]);
  expect(result.state.cells.every(c=>c.exists||!c.tile)).toBe(true);
  expect(result.events.some(e=>e.localRefill)).toBe(false);
  expect(holes(applyAction(createGame(previous),action).state).length).toBeGreaterThan(0);
 });

 it('drops the actual level 93 stack, preserving the surviving box ID and layers',()=>{
  const level=publishedLevel(93,ENGINE_VERSION),state=createGame(level);
  const result=applyAction(state,{type:'booster',item:'hammer',at:40});
  expect(result.accepted).toBe(true);
  expect(result.state.status).toBe('playing');
  expect(holes(result.state)).toEqual([]);
  const id=state.cells[32]!.obstacleId!,old=state.obstacles[id]!;
  expect(result.state.cells[40]!.obstacleId).toBe(id);
  expect(result.state.obstacles[id]).toEqual({...old,anchor:40,footprint:[40]});
  const event=result.events.find(e=>e.kind==='crate-fall'&&e.obstacleId===id);
  expect(event).toMatchObject({from:32,to:40});
  const overlays=impactOverlays(state,result.state,result.events,effectTiming(result.events,result.state));
  expect(overlays.find(step=>step.kind==='obstacle'&&step.id===id&&step.fallFrom===32)).toBeDefined();
 });

 it('publishes distinct rules at chapter starts and repeats them in the next two practice boards',()=>{
  const signature=(id:number)=>{
   const level=publishedLevel(id,ENGINE_VERSION);
   return level.obstacles.flatMap(o=>o.chapter?[o.chapter.kind]:o.kind==='pipe'&&o.endOnly?['end-rail']:
    o.contents?.innerCrateHp?['nested']:o.kind==='supply-crate'&&o.footprint.length>1?['chest']:
    o.kind==='windmill'||o.kind==='carousel'?[o.kind]:[]);
  };
  const rules=['end-rail','windmill','carousel','chest','nested','guard','thaw','slide','compost','color-wave','relay'];
  for(const [i,rule] of rules.entries()){
   const id=101+i*100;
   expect(publishedLevel(id,ENGINE_VERSION).campaign?.beat).toBe('introduction');
   for(const next of [id,id+1,id+2])expect(signature(next),String(next)).toContain(rule);
  }
  expect(publishedLevel(1201,ENGINE_VERSION).campaign?.beat).not.toBe('introduction');
 });

 it('provides a refill route to playable cells in every published opening',()=>{
  for(let id=1;id<=BULK_PUBLISHED_LEVEL;id++){
   const level=publishedLevel(id,ENGINE_VERSION),errors=validateLevel(level),stranded=unsuppliedTileCells(level);
   if(errors.length||stranded.length)throw Error(`Level ${id}: ${errors.join(',')} / no supply at ${stranded.join(',')}`);
  }
 },90000);
});
