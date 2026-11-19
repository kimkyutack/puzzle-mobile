import {describe,expect,it} from 'vitest';
import {CUTOUT_REFILL_ENGINE_VERSION,DENSE_GARDEN_PUZZLE_ENGINE_VERSION} from '@garden/contracts';
import {actionWithFrames,applyAction,createGame,replay,validateLevel} from '@garden/core';
import {publishedLevel} from '../apps/api/src/level-content';
import {tileFallPaths,tileOrigins} from '../apps/client/src/tile-origins';
import {solve} from '../tools/level-validation/validate';

describe('refill and seed cabinet revisions',()=>{
 it('feeds the lower center of level 34 from the side without a new inlet beneath the cutout',()=>{
  const before=createGame(publishedLevel(34,CUTOUT_REFILL_ENGINE_VERSION));
  const result=actionWithFrames(before,{type:'booster',item:'hammer',at:51});
  expect(result.accepted).toBe(true);
  expect(result.events).toContainEqual({type:'fall',from:34,to:43,cells:[43]});
  expect(result.events.filter(event=>event.type==='spawn'&&event.kind==='normal')
   .flatMap(event=>event.cells).every(at=>!([43,51,59,44,52,60].includes(at)))).toBe(true);
  expect(result.state.cells.every(cell=>cell.exists?!!cell.tile||!!cell.obstacleId:!cell.tile)).toBe(true);
  let previous=before;
  for(const frame of result.frames){
   const routes=[...tileFallPaths(previous,frame.state,frame.events).values()];
   for(const origin of tileOrigins(previous,frame.state,frame.events).values())routes.push(origin.points);
   for(const route of routes)for(const {x,y} of route)if(y>=0&&y<before.height){
    expect(before.cells[Math.floor(y)*before.width+Math.floor(x)]!.exists).toBe(true);
   }
   previous=frame.state;
  }
 });

 it('preserves the old level 34 inlet for saved boards using the old engine',()=>{
  const before=createGame(publishedLevel(34,DENSE_GARDEN_PUZZLE_ENGINE_VERSION));
  const result=applyAction(before,{type:'booster',item:'hammer',at:51});
  expect(result.events).toContainEqual({type:'spawn',kind:'normal',cells:[43]});
 });

 it('supplies each island separately when a gap splits the entire board',()=>{
  const level=publishedLevel(357,CUTOUT_REFILL_ENGINE_VERSION);
  const before=createGame({...level,initial:undefined,obstacles:[],goals:[{kind:level.colors[0]!,count:999,remaining:999}]});
  const result=applyAction(before,{type:'booster',item:'sweep-row',at:54});
  expect(result.accepted).toBe(true);
  expect(result.events.some(event=>event.type==='spawn'&&event.cells.some(at=>at>=45))).toBe(true);
  expect(result.state.cells.every(cell=>!!cell.tile===cell.exists)).toBe(true);
 });

 it('clears level 38 by breaking the two cabinets and keeps the real seed route in level 86',()=>{
  const board=publishedLevel(38,CUTOUT_REFILL_ENGINE_VERSION);
  expect(validateLevel(board)).toEqual([]);
  expect(board.exits).toBeUndefined();
  expect(board.obstacles.map(obstacle=>[obstacle.kind,obstacle.seeds])).toEqual([['cabinet',undefined],['cabinet',undefined]]);
  expect(board.goals.map(goal=>goal.kind)).toEqual(['cabinet']);
  const proof=solve(board);
  const result=replay(board,proof.actions);
  expect(result.state.status).toBe('won');
  expect(result.events.some(event=>event.kind==='seed')).toBe(false);
  expect(publishedLevel(38,DENSE_GARDEN_PUZZLE_ENGINE_VERSION).goals.some(goal=>goal.kind==='seed')).toBe(true);
  const seedLevel=publishedLevel(86,CUTOUT_REFILL_ENGINE_VERSION);
  expect(seedLevel.obstacles.filter(obstacle=>obstacle.seeds).length).toBe(2);
  expect(seedLevel.goals.some(goal=>goal.kind==='seed')).toBe(true);
 });
});
