import {describe,it,expect} from 'vitest';
import type {GameEvent,PowerFestivalState,Run,Special} from '@garden/contracts';
import {createGame,applyAction,stateHash} from '@garden/core';
import {getLevel} from '@garden/content';
import {POWER_FESTIVAL_STAGES,POWER_USE_KINDS,powerUses,addPowerUses,emptyPowerUses,festivalStage,festivalClaimable} from '../packages/content/src/power-festival';
import {predictedFestival} from '../apps/client/src/power-festival-state';
import {reconcileCachedRun} from '../apps/client/src/recovery';
const event=():PowerFestivalState=>({id:'event',day:'d:test',startedAt:0,endsAt:10000,counts:emptyPowerUses(),claimedStages:0});
function board(){const state=createGame(getLevel(31));state.obstacles={};state.goals=[{kind:'special',count:100,remaining:100}];state.cells.forEach((cell,index)=>{cell.exists=true;cell.frost=0;delete cell.obstacleId;cell.tile={id:index+1,kind:'normal',color:state.colors[(index%state.width+Math.floor(index/state.width)*2)%state.colors.length]!}});state.nextTileId=500;return state;}
describe('power festival activation rules',()=>{
 it('counts both rocket directions, while formation, flying art and inventory tools do not count',()=>{
  const events:GameEvent[]=[{type:'spawn',kind:'bomb',cells:[0]},{type:'special',kind:'wind-row',cells:[1]},{type:'special',kind:'wind-column',cells:[2]},{type:'special',kind:'glider-flight',cells:[3,4]},{type:'special',kind:'world-bomb',cells:[5]},{type:'special',kind:'move-hourglass',cells:[]}];
  expect(powerUses(events)).toEqual({rocket:2,bomb:0,glider:0,rainbow:0});
 });
 for(const payload of ['wind-row','wind-column','bomb'] as const)it(`counts a carried ${payload} only once in real core events`,()=>{
  const state=board();state.cells[0]!.tile={id:100,kind:'glider'};state.cells[1]!.tile={id:101,kind:payload};
  const result=applyAction(state,{type:'swap',from:0,to:1});expect(result.accepted).toBe(true);
  const counts=powerUses(result.events);expect(counts.glider).toBe(1);expect(counts[payload==='bomb'?'bomb':'rocket']).toBe(1);
 });
 it('counts both ingredients of same-type combos and the activated tiles from a rainbow conversion',()=>{
  for(const kind of ['wind-row','bomb','glider','rainbow'] as Special[]){const state=board();state.cells[0]!.tile={id:100,kind};state.cells[1]!.tile={id:101,kind};const result=applyAction(state,{type:'swap',from:0,to:1});expect(powerUses(result.events)[kind==='wind-row'?'rocket':kind as 'bomb'|'glider'|'rainbow']).toBe(2);}
  const state=board();state.cells[0]!.tile={id:100,kind:'rainbow'};state.cells[1]!.tile={id:101,kind:'wind-column'};const result=applyAction(state,{type:'swap',from:0,to:1}),counts=powerUses(result.events);expect(counts.rainbow).toBe(1);expect(counts.rocket).toBeGreaterThan(1);
 });
 it('carries surplus into later stages and requires all four goals for every reward',()=>{
  const total=POWER_FESTIVAL_STAGES.reduce((sum,stage)=>addPowerUses(sum,stage.targets),emptyPowerUses()),e=event();e.counts=total;
  expect(festivalClaimable(e)).toBe(5);e.claimedStages=2;expect(festivalClaimable(e)).toBe(3);expect(festivalStage(total,2).progress).toEqual(POWER_FESTIVAL_STAGES[2]!.targets);
  e.counts.rainbow=0;expect(festivalClaimable(e)).toBe(0);expect(POWER_FESTIVAL_STAGES.at(-1)!.reward.items['world-bomb']).toBe(1);
 });
 it('predicts only the unsaved delta and preserves the same display after an acknowledgement',()=>{
  const e=event(),state=board(),confirmed={id:'run',state,powerUses:{rocket:4,bomb:1,glider:0,rainbow:0}} as Run,local={...confirmed,powerUses:{rocket:6,bomb:2,glider:1,rainbow:0}};
  e.counts={rocket:7,bomb:2,glider:2,rainbow:1};const predicted=predictedFestival(e,local,confirmed,500);
  expect(predicted.counts).toEqual({rocket:9,bomb:3,glider:3,rainbow:1});expect(predictedFestival(predicted,local,local,500)).toEqual(predicted);
  expect(predictedFestival(e,local,{...confirmed,id:'other'},500)).toBe(e);expect(predictedFestival(e,local,confirmed,10000)).toBe(e);
 });
 it('reconstructs predicted activation totals from saved actions after a restart',()=>{
  const state=board();state.cells[0]!.tile={id:100,kind:'wind-row'};const level=getLevel(31),run={id:'run',level,state,sequence:0} as Run,action={type:'tap',at:0} as const,result=applyAction(state,action),recovered=reconcileCachedRun(run,{runId:run.id,baseSequence:0,queue:[action]});
  expect(recovered.kind).toBe('ready');expect(recovered.run.powerUses).toEqual(powerUses(result.events));expect(stateHash(recovered.run.state)).toBe(stateHash(result.state));expect(POWER_USE_KINDS.every(kind=>recovered.run.powerUses![kind]>=0)).toBe(true);
 });
});
