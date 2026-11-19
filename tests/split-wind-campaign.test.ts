import {describe,expect,it} from 'vitest';
import {ENGINE_VERSION,GREENHOUSE_ENGINE_VERSION,OBSTACLE_GARDEN_ENGINE_VERSION} from '@garden/contracts';
import {actionWithFrames,applyAction,createGame,replay,validateLevel} from '@garden/core';
import {publishedLevel} from '../apps/api/src/level-content';
import {prepareRunInitial} from '../apps/api/src/run-initial';
import {effectTiming,WIND_SEED_FLIGHT} from '../apps/client/src/visual-timing';
import {splitWindLevel,SPLIT_WIND_VERSION} from '../packages/content/src/split-wind-campaign';
import {solve} from '../tools/level-validation/validate';

describe('split wind campaign',()=>{
 it('interleaves three layouts once every 200 levels without replacing the neighboring levels',()=>{
  const first=publishedLevel(357,ENGINE_VERSION);
  const featured=Array.from({length:20_000},(_,n)=>{
   const level={...first,id:n+1};
   return splitWindLevel(level)!==level?n+1:0;
  }).filter(Boolean);
  expect(featured).toEqual(Array.from({length:99},(_,i)=>357+200*i));
  for(const id of [356,358,360,397,2390])expect(publishedLevel(id,ENGINE_VERSION).strategy?.id.startsWith('split-wind/')).not.toBe(true);
  expect(publishedLevel(357,GREENHOUSE_ENGINE_VERSION).version).not.toBe(SPLIT_WIND_VERSION);
  expect(publishedLevel(19957,ENGINE_VERSION).strategy?.id).toMatch(/^split-wind\//);
 });

 it('only hits the upper windmill once the seed from a lower pouch arrives',()=>{
  const initial=createGame(publishedLevel(357,ENGINE_VERSION));
  const mill=Object.values(initial.obstacles).find(o=>o.kind==='windmill')!;
  const pod=Object.values(initial.obstacles).find(o=>o.kind==='wind-pod')!;
  const lower=5*initial.width,upper=4*initial.width;
  expect(pod.anchor).toBeGreaterThanOrEqual(lower);
  expect(mill.anchor).toBeLessThan(upper);
  expect(applyAction(initial,{type:'booster',item:'hammer',at:mill.anchor}).accepted).toBe(false);
  const action={type:'booster',item:'hammer',at:pod.anchor} as const;
  const {state,events}=actionWithFrames(initial,action);
  expect(state.obstacles[mill.id]?.hp).toBe(mill.hp-1);
  const launch=events.findIndex(event=>event.kind==='wind-seed-flight');
  const impact=events.findIndex(event=>event.obstacleId===mill.id&&event.effectId===events[launch]?.effectId);
  expect(events[launch]).toMatchObject({from:pod.anchor,to:mill.anchor});
  const timing=effectTiming(events,initial,action);
  expect(timing.delays[impact]!-timing.delays[launch]!).toBe(WIND_SEED_FLIGHT);
  expect(state.cells.slice(upper,lower).every(cell=>!cell.exists&&!cell.tile)).toBe(true);
  expect(state.gravity.every(lane=>lane.every(at=>at<upper)||lane.every(at=>at>=lower))).toBe(true);
 });

 it('opens space above by combining the two gliders below',()=>{
  const level=publishedLevel(357,ENGINE_VERSION);
  const state=createGame(level),upper=4*level.width,lower=5*level.width;
  expect(state.cells.slice(0,upper).every(cell=>!cell.tile&&cell.obstacleId)).toBe(true);
  const result=applyAction(state,{type:'swap',from:49,to:50});
  expect(result.accepted).toBe(true);
  expect(result.events.filter(event=>event.kind==='glider-flight'&&event.from!>=lower&&event.to!<upper)).toHaveLength(3);
  expect(result.state.cells.slice(0,upper).some(cell=>cell.tile)).toBe(true);
 });

 for(const id of [357,557,757])it(`clears layout ${id} on its base board and two randomized attempts with no items`,()=>{
  const level=publishedLevel(id,OBSTACLE_GARDEN_ENGINE_VERSION);
  for(const attempt of [level,...[17347,89381].map(seed=>prepareRunInitial(level,[],true,seed).level)]){
   expect(validateLevel(attempt)).toEqual([]);
   const special=solve(attempt,'special');
   const proof=special.status==='won'&&!special.shuffles?special:solve(attempt,'goal');
   expect(proof.status).toBe('won');
   expect(proof.shuffles).toBe(0);
   expect(proof.actions.every(action=>action.type==='swap'||action.type==='tap')).toBe(true);
   const result=replay(attempt,proof.actions);
   expect(result.state.status).toBe('won');
   expect(result.events.filter(event=>event.kind==='wind-seed-flight')).toHaveLength(attempt.obstacles.filter(o=>o.kind==='wind-pod').length);
  }
 });
});
