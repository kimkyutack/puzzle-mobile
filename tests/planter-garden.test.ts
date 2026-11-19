import {describe,expect,it} from 'vitest';
import {PLANTER_GARDEN_ENGINE_VERSION,POWER_RAINBOW_ENGINE_VERSION,type Action} from '@garden/contracts';
import {applyAction,createGame,replay,stateHash,validateLevel} from '@garden/core';
import {publishedLevel} from '../apps/api/src/level-content';
import {prepareRunInitial} from '../apps/api/src/run-initial';
import {effectTiming,PLANTER_REVEAL_TRAVEL} from '../apps/client/src/visual-timing';
import {PLANTER_GARDEN_VERSION} from '../packages/content/src/planter-garden';
import {solve} from '../tools/level-validation/validate';

const board=(id:number)=>publishedLevel(id,PLANTER_GARDEN_ENGINE_VERSION);
const tap=(at:number):Action=>({type:'tap',at});

describe('garden planters',()=>{
 it('opens only the mud covers linked to the sluice that the rocket hits',()=>{
  const level=board(251),before=createGame(level),original=Object.values(before.obstacles).filter(o=>o.cover);
  const target=original[0]!;
  const locked=applyAction(before,{type:'booster',item:'hammer',at:target.anchor});
  expect(locked).toMatchObject({accepted:false,reason:'PLANTER_COVERED'});
  expect(locked.state).toBe(before);

  const action=tap(22),{state,events}=applyAction(before,action);
  const opener=events.find(e=>e.kind==='greenhouse-sluice-open')!;
  expect(opener).toMatchObject({type:'mechanic',from:20,cells:original.filter(o=>o.cover?.source===target.cover?.source).map(o=>o.anchor)});
  const revealed=events.filter(e=>e.kind==='planter-reveal');
  expect(revealed).toHaveLength(6);
  expect(revealed.every(e=>e.obstacleAfter?.hp===1&&!e.obstacleAfter?.cover)).toBe(true);
  expect(Object.values(state.obstacles).filter(o=>o.cover)).toHaveLength(6);
  expect(state.moves).toBe(level.moves-1);
  const timing=effectTiming(events,state,action);
  expect(timing.delays[events.indexOf(revealed[0]!)])
   .toBe(timing.delays[events.indexOf(opener)]!+PLANTER_REVEAL_TRAVEL);
 });

 it('makes shelf rockets playable and replays their separate hits deterministically',()=>{
  const level=board(451),first=applyAction(createGame(level),tap(22));
  expect(first.state.status).toBe('playing');
  expect(first.state.goals[0]?.remaining).toBe(12);
  const rockets=first.state.cells.flatMap((cell,at)=>cell.tile?.kind==='wind-column'?[at]:[]);
  expect(rockets).toEqual([19,25]);
  expect(first.events.filter(e=>e.type==='spawn'&&e.kind==='wind-column')).toHaveLength(2);
  const actions=[tap(22),...rockets.map(tap)],result=replay(level,actions);
  expect(result.state.status).toBe('won');
  expect(stateHash(replay(JSON.parse(JSON.stringify(level)),actions).state)).toBe(stateHash(result.state));
 });

 it('validates cover links and preserves the previous engine’s boards',()=>{
  const older=publishedLevel(251,POWER_RAINBOW_ENGINE_VERSION);
  expect(older.version).not.toBe(PLANTER_GARDEN_VERSION);
  expect(validateLevel(older)).toEqual([]);
  expect(board(251).moves).toBeGreaterThanOrEqual(older.moves);
  expect(validateLevel({...board(251),engineVersion:POWER_RAINBOW_ENGINE_VERSION})).toContain('PLANTER_GARDEN_ENGINE');
  const broken=board(351);
  broken.obstacles.find(o=>o.cover)!.cover!.source='missing';
  expect(validateLevel(broken)).toContain('PLANTER_GARDEN_COVER');
 });

 for(const id of [251,252,351,352,451,452,551,552,651,652,19951,19952])it(`can clear level ${id} with no purchased items`,()=>{
  const original=board(id);
  expect(original.version).toBe(PLANTER_GARDEN_VERSION);
  expect(original.goals[0]).toMatchObject({kind:'garden-planter'});
  expect(original.goals[0]!.count).toBeGreaterThanOrEqual(12);
  for(const level of [original,prepareRunInitial(original,[],true,89381).level]){
   expect(validateLevel(level)).toEqual([]);
   const preferred=solve(level,'special');
   const solution=preferred.status==='won'&&!preferred.shuffles?preferred:solve(level,'goal');
   expect(solution.status).toBe('won');
   expect(solution.shuffles).toBe(0);
   expect(solution.actions.every(action=>action.type==='swap'||action.type==='tap')).toBe(true);
   expect(replay(level,solution.actions).state.status).toBe('won');
  }
 });
});
