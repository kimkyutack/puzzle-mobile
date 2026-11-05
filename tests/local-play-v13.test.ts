import {afterEach,describe,expect,it,vi} from 'vitest';
import {createGame,applyAction,legalActions,perimeterCells,stateHash} from '@garden/core';
import {getLevel} from '@garden/content';
import type {Action,Player,Run} from '@garden/contracts';
import {availableBooster,backgroundSave} from '../apps/client/src/local-play';
import {reconcileCachedRun} from '../apps/client/src/recovery';
import {effectTiming} from '../apps/client/src/visual-timing';

afterEach(()=>vi.useRealTimers());
describe('local play while server verification is pending',()=>{
 it('coalesces a burst and leaves later inputs independent of an unresolved save',async()=>{
  vi.useFakeTimers();let release!:()=>void;const flush=vi.fn(()=>new Promise<void>(resolve=>{release=resolve;})),save=backgroundSave(flush);
  save.schedule();await vi.advanceTimersByTimeAsync(1200);save.schedule();await vi.advanceTimersByTimeAsync(1000);expect(flush).toHaveBeenCalledTimes(1);
  save.schedule();await vi.advanceTimersByTimeAsync(2200);expect(flush).toHaveBeenCalledTimes(2);release();save.cancel();
 });
 it('accounts for unacknowledged consumables without mutating confirmed inventory',()=>{
  const player={inventory:{hammer:{normal:1,bound:1}}} as Player,queue:Action[]=[{type:'booster',item:'hammer',at:0}];
  expect(availableBooster(player,queue,'hammer')).toBe(1);queue.push({type:'booster',item:'hammer',at:1});expect(availableBooster(player,queue,'hammer')).toBe(0);expect(player.inventory.hammer).toEqual({normal:1,bound:1});expect(availableBooster(player,queue,'sweep-border')).toBe(0);
 });
 it('keeps a later local item use when an earlier batch returns, including restart recovery',()=>{
  const level=getLevel(10),state=createGame(level),run:Run={id:'r',userId:'u',level,state,sequence:0,status:'active',startedAt:0,expiresAt:86400000,preBoosters:[],heartSpent:false,continues:0};
  const first=legalActions(state)[0]!,acked={...run,sequence:1,state:applyAction(state,first).state},next:Action={type:'booster',item:'sweep-border'};
  const cache={runId:run.id,baseSequence:0,queue:[first,next],batch:{id:'durable-key',sequence:0,actions:[first]}};
  const decision=reconcileCachedRun(run,cache,acked);expect(decision.kind).toBe('ready');expect(decision.cache.queue).toEqual([next]);expect(stateHash(decision.run.state)).toBe(stateHash(applyAction(acked.state,next).state));
  const restarted=reconcileCachedRun(acked,decision.cache);expect(stateHash(restarted.run.state)).toBe(stateHash(decision.run.state));
 });
});
describe('outer perimeter firework',()=>{
 const shape=(width:number,height:number,holes:number[]=[])=>({width,height,cells:Array.from({length:width*height},(_,index)=>({exists:!holes.includes(index),tile:null,frost:0}))});
 it('includes every outer cell once and leaves a closed inner hole alone',()=>{
  const outline=perimeterCells(shape(7,7,[24]));expect(outline).toHaveLength(24);expect(new Set(outline).size).toBe(24);expect(outline).not.toContain(17);expect(outline).not.toContain(23);
 });
 it('follows a stepped outline and handles disconnected strips and one-cell boards',()=>{
  const s=shape(5,5,[0,1,3,4,5,9]);expect(perimeterCells(s)).toContain(6);expect(perimeterCells(s)).not.toContain(7);expect(perimeterCells(shape(1,1))).toEqual([0]);expect(perimeterCells(shape(3,3,[1,4,7]))).toEqual([0,2,3,5,6,8]);
 });
 it('runs deterministically without spending a move and schedules the actual perimeter impact after anticipation',()=>{
  const before=createGame(getLevel(10)),action:Action={type:'booster',item:'sweep-border'},result=applyAction(before,action);
  expect(result.accepted).toBe(true);expect(result.state.status).not.toBe('error');expect(result.state.moves).toBe(before.moves);expect(stateHash(result.state)).toBe(stateHash(applyAction(before,action).state));
  const timing=effectTiming(result.events,result.state,action);expect(timing.primaryImpactAt).toBe(1150);expect([...timing.firstRemovalAt.values()].some(ms=>ms>=1150)).toBe(true);
 });
});
