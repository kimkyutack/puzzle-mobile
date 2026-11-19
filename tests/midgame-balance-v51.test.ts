import {describe,it,expect} from 'vitest';
import {ENGINE_VERSION,FLOW_GRAVITY_ENGINE_VERSION,type LevelDefinition,type Action} from '@garden/contracts';
import {getLevel} from '@garden/content';
import {createGame,applyAction,replay,validateLevel,legalActions,stateHash} from '@garden/core';
import {publishedLevel} from '../apps/api/src/level-content';
import {progressiveLevel} from '../packages/content/src/progressive';
import {earlyBalancedLevel} from '../packages/content/src/early-balance';
import {midgameBalancedLevel,MIDGAME_BALANCE_VERSION} from '../packages/content/src/midgame-balance';
import {prepareRunInitial} from '../apps/api/src/run-initial';
import catalogue from '../packages/content/src/midgame-catalogue-v51.json';
import proofsJson from '../packages/content/src/midgame-proofs-v51.json';
const maps=catalogue.levels as unknown as Record<string,LevelDefinition>,proofs=proofsJson as Record<string,{actions:Action[];hash:string}>;
describe('reviewed 70-100 campaign pacing and visible seed delivery',()=>{
 it('replaces fifteen underloaded challenge maps and keeps rest, story and other engine content intact',()=>{
  expect(Object.keys(maps).map(Number)).toEqual([72,73,74,76,77,78,82,84,86,87,92,94,96,97,98]);
  for(const id of [1,5,69,70,71,75,79,80,81,83,85,88,89,90,91,93,95,99,100,101,9998]){const before=earlyBalancedLevel(progressiveLevel(getLevel(id)));expect(midgameBalancedLevel(before)).toBe(before);}
  for(const engine of ['1.2.0','1.8.0','1.9.0']){const old=earlyBalancedLevel(progressiveLevel(getLevel(86,engine)));expect(midgameBalancedLevel(old)).toBe(old);}
 });
 it('certifies every changed map without paid tools or forced shuffles and leaves a player margin',()=>{
  for(const [id,map]of Object.entries(maps)){const copy=structuredClone(map),base=progressiveLevel(getLevel(Number(id),FLOW_GRAVITY_ENGINE_VERSION)),level=midgameBalancedLevel(earlyBalancedLevel(base)),result=replay(level,proofs[id]!.actions);expect(map).toEqual(copy);expect(validateLevel(level)).toEqual([]);expect(level.version).toBe(MIDGAME_BALANCE_VERSION);expect(result.accepted,id).toBe(true);expect(result.state.status,id).toBe('won');expect(stateHash(result.state)).toBe(proofs[id]!.hash);expect(result.state.moves).toBeGreaterThanOrEqual(7);expect(result.events.some(e=>e.type==='shuffle')).toBe(false);expect(proofs[id]!.actions.every(a=>a.type==='swap'||a.type==='tap')).toBe(true);expect(proofs[id]!.actions.length).toBeGreaterThanOrEqual(level.difficulty==='super'?18:level.difficulty==='hard'?14:12);expect(level.goals.length).toBeLessThanOrEqual(4);}
 });
 it('keeps emitted seeds on the board after a chest opens instead of collecting them in the same step',()=>{
  for(const id of [74,86,98]){const level=publishedLevel(id,ENGINE_VERSION);for(const chest of level.obstacles.filter(o=>o.kind==='cabinet')){expect(chest.footprint.every(at=>!level.exits!.includes(at))).toBe(true);let state=createGame(level);const seedGoal=state.goals.find(g=>g.kind==='seed')!.remaining;let result;for(let hit=0;hit<chest.hp;hit++){result=applyAction(state,{type:'booster',item:'hammer',at:chest.anchor});expect(result.accepted).toBe(true);state=result.state;}
   expect(state.obstacles[chest.id]).toBeUndefined();expect(state.goals.find(g=>g.kind==='seed')!.remaining).toBe(seedGoal);expect(state.cells.some(c=>c.tile?.kind==='seed')).toBe(true);expect(result!.events.some(e=>e.type==='remove'&&e.kind==='seed')).toBe(false);}}
 });
 it('randomizes ordinary tiles while retaining the new objectives, chest routes and legal opening moves',()=>{
  for(const id of Object.keys(maps).map(Number))for(const seed of [1234,77891,987654]){const level=publishedLevel(id,ENGINE_VERSION),next=prepareRunInitial(level,[],true,seed);expect(next.level.obstacles).toEqual(level.obstacles);expect(next.level.goals).toEqual(level.goals);expect(next.level.exits).toEqual(level.exits);expect(legalActions(next.state).length).toBeGreaterThan(0);}
 });
});
