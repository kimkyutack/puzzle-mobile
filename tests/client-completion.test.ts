import {afterEach,describe,it,expect,vi} from 'vitest';
import type {Action,Run} from '@garden/contracts';
import {createGame,applyAction} from '@garden/core';
import {getLevel} from '@garden/content';
import {completionReward,needsFinish,nextPreviewLevel} from '../apps/client/src/completion';
import {reconcileCachedRun,type CachedRun} from '../apps/client/src/recovery';
import {homeRewardTotal,landHomeRewards,pendingHomeRewards,rememberHomeReward,rememberPuzzleReward,rewardPieces} from '../apps/client/src/home-rewards';
import {newPlayer} from '../apps/api/src/db';
import solutions from '../packages/content/src/campaign-solutions.json';

function winningRun(){const level=getLevel(1);let state=createGame(level);for(const action of solutions['1'].actions as Action[])state=applyAction(state,action).state;const run:Run={id:'pending-clear',userId:'user-a',level,state,sequence:solutions['1'].actions.length,status:'active',startedAt:0,expiresAt:86400000,preBoosters:[],heartSpent:false,heartCharge:'failure',continues:0};return run;}
describe('victory before authoritative reward commit',()=>{
 it('previews a local clear without granting coins, stars or a reward',()=>{const run=winningRun(),before=structuredClone(run);expect(needsFinish(run)).toBe(true);expect(completionReward(run)).toEqual({coins:30,stars:1});expect(run).toEqual(before);expect(run.reward).toBeUndefined();});
 it('previews the next stage while the clear is pending without mutating progress',()=>{const run=winningRun();expect(nextPreviewLevel(run.level.id,run)).toBe(run.level.id+1);expect(nextPreviewLevel(run.level.id+2,run)).toBe(run.level.id+2);expect(run.reward).toBeUndefined();});
 it('uses the confirmed reward including milestone items instead of estimating it',()=>{const run={...winningRun(),status:'won' as const,reward:{coins:75,stars:1,items:{'world-bomb':1}}};expect(needsFinish(run)).toBe(false);expect(completionReward(run)).toEqual(run.reward);});
 it('retains a finish-only retry after the last action acknowledgement empties the queue',()=>{const run=winningRun(),batch={id:'winning-batch',sequence:0,actions:solutions['1'].actions as Action[]},cache:CachedRun={runId:run.id,baseSequence:0,queue:batch.actions,batch,finishPending:true};const initial={...run,sequence:0,state:createGame(run.level)},decision=reconcileCachedRun(initial,cache,run);expect(decision.kind).toBe('ready');expect(decision.cache.queue).toEqual([]);expect(decision.cache.finishPending).toBe(true);expect(decision.run.state.status).toBe('won');});
 it('keeps a pending finish through restart and clears it on a committed server response',()=>{const run=winningRun(),saved:CachedRun={runId:run.id,queue:[],baseSequence:run.sequence,finishPending:true};expect(reconcileCachedRun(run,saved).cache.finishPending).toBe(true);const committed={...run,status:'won' as const,reward:{coins:50,stars:1}};expect(reconcileCachedRun(committed,saved).cache.finishPending).toBeUndefined();});
});

describe('rewards waiting for the home header',()=>{
 afterEach(()=>vi.unstubAllGlobals());
 it('records each server-confirmed clear once and preserves undelivered rewards',async()=>{
  const saved=new Map<string,string>();
  vi.stubGlobal('localStorage',{getItem:(key:string)=>saved.get(key)??null,setItem:(key:string,value:string)=>saved.set(key,value)});
  const player={...newPlayer('home-reward-user',0),version:7,level:3};
  const pending={...winningRun(),userId:player.id},first={...pending,status:'won' as const,reward:{coins:35,stars:1}};
  rememberPuzzleReward(player,pending);
  rememberPuzzleReward(player,{...first,userId:'other-account'});
  rememberPuzzleReward({...player,level:1},first);
  expect(pendingHomeRewards(player.id)).toEqual([]);
  rememberPuzzleReward(player,first);
  rememberPuzzleReward(player,first);
  rememberHomeReward(player,'run:another-clear',{coins:45,stars:1});
  rememberHomeReward({...player,version:8},'gold-garden:100',{coins:60,stars:0});
  expect(homeRewardTotal(pendingHomeRewards(player.id))).toEqual({coins:140,stars:2});
  expect(pendingHomeRewards('other-account')).toEqual([]);
  const receipts=new Set([`run:${first.id}`,'run:another-clear']);
  landHomeRewards(player.id,receipts,{coins:10});
  expect(homeRewardTotal(pendingHomeRewards(player.id))).toEqual({coins:130,stars:2});
  vi.resetModules();
  const restored=await import('../apps/client/src/home-rewards');
  expect(restored.pendingHomeRewards(player.id)).toEqual(pendingHomeRewards(player.id));
  restored.landHomeRewards(player.id,receipts);
  restored.rememberPuzzleReward(player,first);
  expect(restored.pendingHomeRewards(player.id)).toEqual([{id:'gold-garden:100',version:8,coins:60,stars:0}]);
 });
 it('shows multiple particles and adds exactly the confirmed amount',()=>{
  const coins=rewardPieces('coins',83),stars=rewardPieces('stars',1);
  expect(coins.length).toBeGreaterThan(1);
  expect(stars).toHaveLength(3);
  expect(coins.reduce((a,b)=>a+b,0)).toBe(83);
  expect(stars.reduce((a,b)=>a+b,0)).toBe(1);
 });
});
