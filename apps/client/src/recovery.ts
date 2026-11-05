import { applyAction } from '@garden/core';
import type { Action, Player, Run } from '@garden/contracts';
import {needsFinish} from './completion';

export interface PendingBatch {id:string;sequence:number;actions:Action[]}
export interface CachedRun {runId:string;queue:Action[];baseSequence?:number;batch?:PendingBatch;finishPending?:boolean}
export interface ArchivedActions {runId:string;serverRunId:string;serverSequence:number;reason:string;cache:CachedRun}
export type RecoveryDecision =
 | {kind:'retry-batch';batch:PendingBatch;cache:CachedRun;run:Run}
 | {kind:'ready';cache:CachedRun;run:Run}
 | {kind:'conflict';cache:CachedRun;run:Run;archive:ArchivedActions};
const clone=<T>(value:T):T=>structuredClone(value);
const same=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b);

/** Never infer that an ambiguous in-flight request committed from sequence alone.
 * Pass acknowledgedBatchRun only after retrying the EXACT stored batch key/input.
 * latestRun can be an earlier /me snapshot or a newer authoritative GET result.
 */
export function reconcileCachedRun(latestRun:Run,saved:CachedRun|null,acknowledgedBatchRun?:Run):RecoveryDecision {
 const clean=(run:Run):CachedRun=>({runId:run.id,queue:[],baseSequence:run.sequence,...(needsFinish(run)?{finishPending:true}:{})});
 if(!saved)return {kind:'ready',cache:clean(latestRun),run:latestRun};
 const cached=clone(saved);
 const conflict=(run:Run,reason:string):RecoveryDecision=>({kind:'conflict',cache:clean(run),run,archive:{runId:cached.runId,serverRunId:run.id,serverSequence:run.sequence,reason,cache:clone(cached)}});
 if(cached.runId!==latestRun.id)return cached.queue.length?conflict(latestRun,'RUN_CHANGED'):{kind:'ready',cache:clean(latestRun),run:latestRun};
 let authoritative=latestRun;
 if(cached.batch){
  const batch=cached.batch;
  if(!batch.id||!Number.isInteger(batch.sequence)||batch.sequence<0||batch.actions.length<1||!same(cached.queue.slice(0,batch.actions.length),batch.actions))return conflict(latestRun,'CORRUPT_BATCH_PREFIX');
  if(cached.baseSequence!==undefined&&cached.baseSequence!==batch.sequence)return conflict(latestRun,'CORRUPT_BASE_SEQUENCE');
  if(!acknowledgedBatchRun)return {kind:'retry-batch',batch:clone(batch),cache:cached,run:latestRun};
  const expected=batch.sequence+batch.actions.length;
  if(acknowledgedBatchRun.id!==cached.runId||acknowledgedBatchRun.sequence!==expected)return conflict(latestRun,'ACKNOWLEDGEMENT_MISMATCH');
  cached.queue=cached.queue.slice(batch.actions.length);delete cached.batch;cached.baseSequence=expected;
  if(latestRun.sequence>expected){if(cached.queue.length)return conflict(latestRun,'OTHER_DEVICE_PROGRESS');authoritative=latestRun;}
  else authoritative=acknowledgedBatchRun;
 }
 if(!cached.queue.length)return {kind:'ready',cache:clean(authoritative),run:authoritative};
 if(cached.baseSequence===undefined)return conflict(authoritative,'UNKNOWN_BASE_SEQUENCE');
 if(cached.baseSequence!==authoritative.sequence)return conflict(authoritative,'OTHER_DEVICE_PROGRESS');
 let state=authoritative.state;
 for(const action of cached.queue){if(action.type!=='swap'&&action.type!=='tap'&&action.type!=='booster')return conflict(authoritative,'UNAUTHORIZED_OFFLINE_ACTION');const result=applyAction(state,action);if(!result.accepted||result.state.status==='error')return conflict(authoritative,'INVALID_REPLAY');state=result.state;}
 return {kind:'ready',cache:cached,run:{...authoritative,state}};
}

/** Parallel profile and action responses may arrive in reverse order. */
export function latestPlayer(current:Player|null,incoming:Player):Player {
 return current&&current.id===incoming.id&&current.version>incoming.version?current:incoming;
}
