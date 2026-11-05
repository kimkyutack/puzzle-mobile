import {describe,it,expect} from 'vitest';
import type {Action,Run} from '@garden/contracts';
import {createGame,applyAction} from '@garden/core';
import {getLevel} from '@garden/content';
import {completionReward,needsFinish} from '../apps/client/src/completion';
import {reconcileCachedRun,type CachedRun} from '../apps/client/src/recovery';
import solutions from '../packages/content/src/campaign-solutions.json';

function winningRun(){const level=getLevel(1);let state=createGame(level);for(const action of solutions['1'].actions as Action[])state=applyAction(state,action).state;const run:Run={id:'pending-clear',userId:'user-a',level,state,sequence:solutions['1'].actions.length,status:'active',startedAt:0,expiresAt:86400000,preBoosters:[],heartSpent:false,heartCharge:'failure',continues:0};return run;}
describe('victory before authoritative reward commit',()=>{
 it('previews a local clear without granting coins, stars or a reward',()=>{const run=winningRun(),before=structuredClone(run);expect(needsFinish(run)).toBe(true);expect(completionReward(run)).toEqual({coins:50,stars:1});expect(run).toEqual(before);expect(run.reward).toBeUndefined();});
 it('uses the confirmed reward including milestone items instead of estimating it',()=>{const run={...winningRun(),status:'won' as const,reward:{coins:75,stars:1,items:{'world-bomb':1}}};expect(needsFinish(run)).toBe(false);expect(completionReward(run)).toEqual(run.reward);});
 it('retains a finish-only retry after the last action acknowledgement empties the queue',()=>{const run=winningRun(),batch={id:'winning-batch',sequence:0,actions:solutions['1'].actions as Action[]},cache:CachedRun={runId:run.id,baseSequence:0,queue:batch.actions,batch,finishPending:true};const initial={...run,sequence:0,state:createGame(run.level)},decision=reconcileCachedRun(initial,cache,run);expect(decision.kind).toBe('ready');expect(decision.cache.queue).toEqual([]);expect(decision.cache.finishPending).toBe(true);expect(decision.run.state.status).toBe('won');});
 it('keeps a pending finish through restart and clears it on a committed server response',()=>{const run=winningRun(),saved:CachedRun={runId:run.id,queue:[],baseSequence:run.sequence,finishPending:true};expect(reconcileCachedRun(run,saved).cache.finishPending).toBe(true);const committed={...run,status:'won' as const,reward:{coins:50,stars:1}};expect(reconcileCachedRun(committed,saved).cache.finishPending).toBeUndefined();});
});
