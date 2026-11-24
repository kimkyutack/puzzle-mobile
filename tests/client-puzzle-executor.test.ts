import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {actionWithFrames,createGame,legalActions,stateHash} from '@garden/core';
import {getLevel} from '@garden/content';
import type {Action,GameState} from '@garden/contracts';
import {createPuzzleExecutor} from '../apps/client/src/puzzle-executor';
import {deferredWrite} from '../apps/client/src/after-paint';

class WorkerStub {
 static instance:WorkerStub;
 onmessage:((event:MessageEvent)=>void)|null=null;
 onerror:((event:{preventDefault:()=>void})=>void)|null=null;
 onmessageerror:(()=>void)|null=null;
 jobs:Array<{id:number;state:GameState;action:Action}>=[];
 terminate=vi.fn();
 constructor(){WorkerStub.instance=this;}
 postMessage(value:{id:number;state:GameState;action:Action}){this.jobs.push(structuredClone(value));}
 complete(index=0){const {id,state,action}=this.jobs[index]!;this.onmessage?.({data:{id,result:structuredClone(actionWithFrames(state,action))}} as MessageEvent);}
}
beforeEach(()=>{
 vi.useFakeTimers();vi.stubGlobal('Worker',WorkerStub);
 vi.stubGlobal('requestAnimationFrame',(work:FrameRequestCallback)=>setTimeout(()=>work(performance.now()),16));
 vi.stubGlobal('cancelAnimationFrame',(id:number)=>clearTimeout(id));
});
afterEach(()=>{vi.useRealTimers();vi.unstubAllGlobals();});

describe('puzzle computation away from the UI thread',()=>{
 it('returns the same result and cascade frames as server-compatible local replay',async()=>{
  const executor=createPuzzleExecutor(),before=createGame(getLevel(31)),hash=stateHash(before),action=legalActions(before)[0]!;
  const result=executor.apply(before,action),worker=WorkerStub.instance;
  let resolved=false;void result.then(()=>{resolved=true;});
  expect(worker.jobs).toHaveLength(1);expect(resolved).toBe(false);
  worker.complete();
  expect(await result).toEqual(actionWithFrames(before,action));expect(stateHash(before)).toBe(hash);
  executor.dispose();expect(worker.terminate).toHaveBeenCalledOnce();
 });
 it('correlates concurrent requests and ignores replies from a cancelled executor',async()=>{
  const executor=createPuzzleExecutor(),state=createGame(getLevel(3)),actions=legalActions(state);
  const first=executor.apply(state,actions[0]!),second=executor.apply(state,actions[1]!);
  WorkerStub.instance.complete(1);expect(await second).toEqual(actionWithFrames(state,actions[1]!));
  const rejected=expect(first).rejects.toThrow('PUZZLE_CALCULATION_CANCELLED');
  executor.dispose();await rejected;WorkerStub.instance.complete(0);
 });
 it('falls back after a paint if worker startup fails and resolves an already submitted move',async()=>{
  const executor=createPuzzleExecutor(),state=createGame(getLevel(3)),action=legalActions(state)[0]!,result=executor.apply(state,action);
  const prevented=vi.fn();WorkerStub.instance.onerror?.({preventDefault:prevented});
  let resolved=false;void result.then(()=>{resolved=true;});
  expect(prevented).toHaveBeenCalledOnce();expect(resolved).toBe(false);
  await vi.advanceTimersByTimeAsync(17);
  expect(await result).toEqual(actionWithFrames(state,action));executor.dispose();
 });
 it('recovers from an unresponsive worker without losing the submitted action',async()=>{
  const executor=createPuzzleExecutor(),state=createGame(getLevel(3)),action=legalActions(state)[0]!,result=executor.apply(state,action);
  await vi.advanceTimersByTimeAsync(3017);
  expect(await result).toEqual(actionWithFrames(state,action));executor.dispose();
 });
});

describe('durable local saves after presentation',()=>{
 it('coalesces writes, presents first, and saves the newest in-memory contents',async()=>{
  let snapshot=1;const write=vi.fn(()=>snapshot),save=deferredWrite(write);
  save.schedule();snapshot=2;save.schedule();
  expect(write).not.toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(15);expect(write).not.toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(2);expect(write).toHaveBeenCalledOnce();expect(write.mock.results[0]!.value).toBe(2);
 });
 it('flushes immediately on app suspension and cancels stale saves when a run is cleared',async()=>{
  const write=vi.fn(),save=deferredWrite(write);
  save.schedule();save.flush();expect(write).toHaveBeenCalledOnce();
  save.schedule();save.cancel();await vi.advanceTimersByTimeAsync(1000);expect(write).toHaveBeenCalledOnce();
 });
 it('saves within the deadline even when the WebView has stopped animation frames',async()=>{
  vi.stubGlobal('requestAnimationFrame',()=>1);
  const write=vi.fn(),save=deferredWrite(write);save.schedule();
  await vi.advanceTimersByTimeAsync(100);expect(write).toHaveBeenCalledOnce();
 });
});
