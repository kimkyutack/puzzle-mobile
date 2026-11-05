import {describe,it,expect} from 'vitest';
import {createGame,applyAction,legalActions,replay,stateHash} from '@garden/core';
import {getLevel,bridgeLevel,bridgeStage,rescueUnlocked} from '@garden/content';
import {ENGINE_VERSION} from '@garden/contracts';
import type {Action,LevelDefinition} from '@garden/contracts';
import legacy from '../packages/content/src/legacy-approved-v1.json';
import oldLogs from '../packages/content/src/legacy-solutions-v1.json';
import newLogs from '../packages/content/src/campaign-solutions.json';
import {restoreRescue} from '../apps/client/src/rescue-progress';
const logs=oldLogs as Record<string,{actions:Action[];hash:string}>;
describe('flow content and old-run compatibility',()=>{
 it('replays all original 1.0 runs with their exact saved hashes',()=>{for(const level of legacy as unknown as LevelDefinition[]){const log=logs[level.id]!,r=replay(level,log.actions);expect(r.state.status,'old '+level.id).toBe('won');expect(stateHash(r.state),'old '+level.id).toBe(log.hash);}});
 it('publishes broad boards and enough opening choices without deadlock shuffles on certified wins',()=>{
  const sizes=new Set<number>();for(let id=1;id<=200;id++){const l=getLevel(id);sizes.add(l.width);expect(legalActions(createGame(l)).length,'choices '+id).toBeGreaterThanOrEqual(3);const r=replay(l,(newLogs as Record<string,{actions:Action[]}>)[id]!.actions);expect(r.state.status).toBe('won');expect(r.events.filter(e=>e.type==='shuffle'),'shuffles '+id).toHaveLength(0);if(l.shape.filter(Boolean).length<49)expect(l.colors.length).toBeLessThanOrEqual(5);}
  expect([...sizes].sort()).toEqual([7,8,9]);
 });
 it('keeps old-client level definitions on the original content pack',()=>{for(const id of [1,28,200,1000])expect(getLevel(id,true).engineVersion).toBe('1.0.0');expect(getLevel(28,'1.1.0').engineVersion).toBe('1.1.0');expect(getLevel(28).engineVersion).toBe(ENGINE_VERSION);});
 it('retains a playable minimum-three-choice shuffled board without consuming a move',()=>{let s=createGame(getLevel(30));const ids=s.cells.flatMap(c=>c.tile?[c.tile.id]:[]).sort((a,b)=>a-b),r=applyAction(s,{type:'booster',item:'shuffle'});expect(r.accepted).toBe(true);expect(r.state.moves).toBe(s.moves);expect(r.state.turn).toBe(s.turn);expect(legalActions(r.state).length).toBeGreaterThanOrEqual(3);expect(r.state.cells.flatMap(c=>c.tile?[c.tile.id]:[]).sort((a,b)=>a-b)).toEqual(ids);});
});
describe('bridge story challenge',()=>{
 it('unlocks after seven clears and uses a separate three-crate board',()=>{expect(rescueUnlocked({level:7})).toBe(false);expect(rescueUnlocked({level:8})).toBe(true);expect(bridgeLevel().goals).toEqual([{kind:'crate',count:3,remaining:3}]);expect(bridgeStage([{kind:'crate',count:3,remaining:2}])).toBe(1);expect(bridgeStage([{kind:'crate',count:3,remaining:0}])).toBe(3);});
 it('restores only legal ordinary actions and rejects corrupt/booster progress',()=>{const s=createGame(bridgeLevel()),action=legalActions(s)[0]!,r=applyAction(s,action),restored=restoreRescue(JSON.stringify([action]));expect(stateHash(restored.state)).toBe(stateHash(r.state));for(const raw of ['invalid','{}',JSON.stringify([{type:'booster',item:'hammer',at:43}]),JSON.stringify([{type:'swap',from:-1,to:0}])])expect(restoreRescue(raw).actions).toEqual([]);});
});
