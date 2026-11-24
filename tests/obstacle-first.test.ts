import {describe,expect,it} from 'vitest';
import {CHAPTER_OBSTACLE_ENGINE_VERSION,CONTINUOUS_REFILL_ENGINE_VERSION,COLORS,ENGINE_VERSION,OBJECTIVE_POWERS_ENGINE_VERSION,type Goal} from '@garden/contracts';
import {applyAction,createGame,validateLevel} from '@garden/core';
import {publishedLevel} from '../apps/api/src/level-content';

const colorGoals=new Set<Goal['kind']>(COLORS);

describe('obstacle-first campaign',()=>{
 it('replaces long color quotas with connected on-board targets for new attempts',()=>{
  for(const id of [31,62,72,74,78,87,94,98,144,158,198,334,394]){
   const old=publishedLevel(id,OBJECTIVE_POWERS_ENGINE_VERSION);
   const level=publishedLevel(id,CHAPTER_OBSTACLE_ENGINE_VERSION);
   expect(old.goals.some(goal=>colorGoals.has(goal.kind)),String(id)).toBe(true);
   expect(level.goals.some(goal=>colorGoals.has(goal.kind)),String(id)).toBe(false);
   expect(level.moves).toBe(old.moves);
   expect(level.exits).toEqual(old.exits);
   expect(level.startBoosterGuide).toEqual(old.startBoosterGuide);
   const bank=level.obstacles.filter(obstacle=>obstacle.id.startsWith('obstacle-bank-'));
   expect(bank.length).toBeGreaterThanOrEqual(5);
   const visited=new Set([bank[0]!.anchor]);
   for(const at of visited)for(const obstacle of bank){
    const next=obstacle.anchor;
    const distance=Math.abs(at%level.width-next%level.width)+Math.abs(Math.floor(at/level.width)-Math.floor(next/level.width));
    if(distance===1)visited.add(next);
   }
   expect(visited.size).toBe(bank.length);
   expect(validateLevel(level),String(id)).toEqual([]);
   expect(createGame(level).status).toBe('playing');
  }
 });

 it('exposes three distinct hit states for each lantern, counting only the final break',()=>{
  let state=createGame(publishedLevel(227,CONTINUOUS_REFILL_ENGINE_VERSION));
  const lamp=Object.values(state.obstacles).find(obstacle=>obstacle.kind==='starlight-lantern')!;
  const remaining=state.goals.find(goal=>goal.kind==='starlight-lantern')!.remaining;
  for(const hp of [2,1,0]){
   const result=applyAction(state,{type:'booster',item:'hammer',at:lamp.anchor});
   expect(result.accepted).toBe(true);
   const hit=result.events.find(event=>event.obstacleId===lamp.id&&event.type==='hit')!;
   expect(hit.obstacleAfter?.hp??0).toBe(hp);
   const after=result.state.goals.find(goal=>goal.kind==='starlight-lantern')!.remaining;
   expect(after).toBe(remaining-Number(hp===0));
   state=result.state;
  }
 });
});
