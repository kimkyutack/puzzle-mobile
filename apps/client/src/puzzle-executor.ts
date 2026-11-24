import {actionWithFrames} from '@garden/core';
import type {Action,GameState} from '@garden/contracts';
import {deferredWrite} from './after-paint';

type Result=ReturnType<typeof actionWithFrames>;
interface Pending {resolve:(result:Result)=>void;reject:(error:Error)=>void;state:GameState;action:Action;timer:ReturnType<typeof setTimeout>}

/** The worker runs the same deterministic engine as server replay, without occupying the UI thread. */
export function createPuzzleExecutor(){
 let worker:Worker|undefined,sequence=0,disposed=false;
 const pending=new Map<number,Pending>(),fallbacks=new Set<ReturnType<typeof deferredWrite>>();
 function fallback(job:Pending){
  const task=deferredWrite(()=>{
   fallbacks.delete(task);
   if(disposed){job.reject(new Error('PUZZLE_CALCULATION_CANCELLED'));return;}
   try{job.resolve(actionWithFrames(job.state,job.action));}catch(error){job.reject(error instanceof Error?error:new Error(String(error)));}
  });
  fallbacks.add(task);task.schedule();
 }
 function failed(){
  worker?.terminate();worker=undefined;
  for(const job of pending.values()){clearTimeout(job.timer);fallback(job);}
  pending.clear();
 }
 try{
  worker=new Worker(new URL('./puzzle-worker.ts',import.meta.url),{type:'module'});
  worker.onmessage=(event:MessageEvent<{id:number;result?:Result;error?:string}>)=>{
   const job=pending.get(event.data.id);if(!job)return;
   pending.delete(event.data.id);clearTimeout(job.timer);
   if(event.data.result)job.resolve(event.data.result);
   else job.reject(new Error(event.data.error??'PUZZLE_CALCULATION_FAILED'));
  };
  worker.onerror=event=>{event.preventDefault();failed();};
  worker.onmessageerror=failed;
 }catch{/* The existing engine also runs after a paint if workers are unavailable. */}
 return {
  apply(state:GameState,action:Action):Promise<Result>{
   if(disposed)return Promise.reject(new Error('PUZZLE_CALCULATION_CANCELLED'));
   return new Promise((resolve,reject)=>{
    const id=++sequence,job:Pending={resolve,reject,state,action,timer:setTimeout(failed,3000)};
    if(!worker){clearTimeout(job.timer);fallback(job);return;}
    pending.set(id,job);
    try{worker.postMessage({id,state,action});}catch{failed();}
   });
  },
  dispose(){
   disposed=true;worker?.terminate();worker=undefined;
   for(const job of pending.values()){clearTimeout(job.timer);job.reject(new Error('PUZZLE_CALCULATION_CANCELLED'));}
   pending.clear();
   // Flush cancels the queued callbacks and rejects their waiting callers.
   for(const task of [...fallbacks])task.flush();
  },
 };
}
