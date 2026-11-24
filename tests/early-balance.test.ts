import {describe,it,expect} from 'vitest';
import {CHAPTER_OBSTACLE_ENGINE_VERSION,COLORS,ENGINE_VERSION,ENDPOINT_PIPE_ENGINE_VERSION,FLOW_GRAVITY_ENGINE_VERSION,LAYERED_OBSTACLE_ENGINE_VERSION,SUPPORTED_ENGINE_VERSIONS,supportsLayeredObstacles,type Action} from '@garden/contracts';
import {getLevel} from '@garden/content';
import {createGame,replay,validateLevel,applyAction} from '@garden/core';
import {progressiveLevel} from '../packages/content/src/progressive';
import {earlyBalancedLevel,EARLY_BALANCE_VERSION} from '../packages/content/src/early-balance';
import {EARLY_MID_BALANCE_VERSION,earlyMidBalancedLevel} from '../packages/content/src/early-mid-balance';
import {midgameBalancedLevel} from '../packages/content/src/midgame-balance';
import {publishedLevel} from '../apps/api/src/level-content';
import {engineRequest} from '../apps/api/src/level-content';
import proofsJson from '../packages/content/src/gravity-flow-proofs.json';
const old=(id:number,engine=ENGINE_VERSION)=>progressiveLevel(getLevel(id,engine));
describe('beginner balance 1 through 100',()=>{
 it('preserves the exact first five guided boards and limits this balance pass to level 100',()=>{for(const id of [1,2,3,4,5,101,104,204,404,708,9998,19998]){const before=old(id);expect(earlyBalancedLevel(before)).toBe(before);if(id<=5)expect(publishedLevel(id,ENGINE_VERSION)).toEqual(before);}});
 it('raises new early budgets without changing geometry, goals, locked pieces or random state',()=>{for(let id=6;id<=100;id++){const before=old(id),saved=structuredClone(before),level=earlyBalancedLevel(before);expect(before).toEqual(saved);expect(level.moves,String(id)).toBeGreaterThanOrEqual(20);expect(level.moves).toBeGreaterThanOrEqual(before.moves);expect({...level,moves:before.moves,version:before.version}).toEqual(before);expect(createGame(level)).toEqual({...createGame(before),moves:level.moves});expect(validateLevel(level)).toEqual([]);expect(earlyBalancedLevel(level)).toBe(level);expect(level.version).toContain(EARLY_BALANCE_VERSION);}});
 it('preserves the beginner buffer on retained content while the current campaign tightens after 30',()=>{
  expect([old(5).moves,publishedLevel(6,ENGINE_VERSION).moves]).toEqual([24,20]);expect(publishedLevel(8,ENGINE_VERSION).moves).toBe(25);
  expect(publishedLevel(38,LAYERED_OBSTACLE_ENGINE_VERSION).moves).toBe(25);expect(publishedLevel(48,LAYERED_OBSTACLE_ENGINE_VERSION).moves).toBe(28);
  expect(publishedLevel(38,ENGINE_VERSION).moves).toBeLessThan(25);expect(publishedLevel(48,ENGINE_VERSION).moves).toBeLessThan(28);
  expect(earlyBalancedLevel(old(53)).moves).toBe(20);expect(earlyBalancedLevel(old(58)).moves).toBe(25);
  for(const id of [10,20,30])expect(publishedLevel(id,ENGINE_VERSION).moves).toBe(22);
  for(const id of [50,60,70,80,90,100])expect(publishedLevel(id,ENGINE_VERSION).moves).toBeLessThan(22);
 });
 it('keeps all 63 retained early winning paths and guided openings replayable on their certified engine',()=>{const proofs=proofsJson as Record<string,{actions:Action[]}>;let checked=0;for(let id=1;id<=100;id++){const level=earlyBalancedLevel(old(id,FLOW_GRAVITY_ENGINE_VERSION));if(level.tutorial){expect(applyAction(createGame(level),{type:'swap',from:level.tutorial.from,to:level.tutorial.to}).accepted).toBe(true);}const proof=proofs['early/'+id];if(proof){const result=replay(level,proof.actions);expect(result.accepted,String(id)).toBe(true);expect(result.state.status,String(id)).toBe('won');checked++;}}expect(checked).toBe(63);});
 it('changes downloaded content for existing compatible apps without changing engine negotiation',()=>{expect(engineRequest({engineVersion:ENDPOINT_PIPE_ENGINE_VERSION,supportedEngineVersions:[ENDPOINT_PIPE_ENGINE_VERSION]}).engineVersion).toBe(ENDPOINT_PIPE_ENGINE_VERSION);for(const engine of SUPPORTED_ENGINE_VERSIONS){const original=old(13,engine),next=publishedLevel(13,engine);expect(next.engineVersion).toBe(engine);expect(next.moves).toBeGreaterThanOrEqual(original.moves);if(!supportsLayeredObstacles(engine))expect(next.shape).toEqual(original.shape);} });
 it('tightens selected new attempts while preserving onboarding, mechanics, obstacles and the board',()=>{
  for(const engine of [CHAPTER_OBSTACLE_ENGINE_VERSION,FLOW_GRAVITY_ENGINE_VERSION]){
   let adjusted=0;
   for(let id=1;id<=101;id++){
    const base=midgameBalancedLevel(earlyBalancedLevel(old(id,engine))),level=earlyMidBalancedLevel(base);
    if(!level.version.endsWith(EARLY_MID_BALANCE_VERSION)){expect(level).toEqual(base);continue;}
    adjusted++;
    expect(id).toBeGreaterThan(5);expect(id).toBeLessThan(100);expect(base.gardenStage).toBeUndefined();
    expect(base.moves-level.moves).toBeGreaterThanOrEqual(0);expect(base.moves-level.moves).toBeLessThanOrEqual(2);
    expect(level.goals.length).toBeLessThanOrEqual(4);
    expect({...level,moves:base.moves,goals:base.goals,version:base.version}).toEqual(base);
    expect(level.goals.filter(g=>!COLORS.some(color=>color===g.kind))).toEqual(base.goals.filter(g=>!COLORS.some(color=>color===g.kind)));
    expect(level.goals.every(g=>g.count===g.remaining)).toBe(true);
    expect(validateLevel(level),String(id)).toEqual([]);
    expect(earlyMidBalancedLevel(level)).toBe(level);
   }
   expect(adjusted).toBeGreaterThanOrEqual(50);
   expect(publishedLevel(6,engine).goals[0]).toMatchObject({kind:'sun',count:22});
   expect(publishedLevel(35,engine).goals).toContainEqual({kind:'berry',count:24,remaining:24});
  }
 });
});
