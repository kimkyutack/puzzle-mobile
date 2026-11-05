import {beforeEach,describe,it,expect,vi} from 'vitest';
import {ENGINE_VERSION,SCULPTED_ENGINE_VERSION,type Player} from '@garden/contracts';
import {APPROVED_LEVEL_COUNT} from '@garden/content';
import {createGame,stateHash} from '@garden/core';
import type {ApiEnv,MutationContext} from '../apps/api/src/db';
const scope=vi.hoisted(()=>({tx:null as unknown as MutationContext}));
vi.mock('../apps/api/src/db',async original=>{
 const actual=await original<typeof import('../apps/api/src/db')>();
 return {...actual,activeRun:vi.fn(async()=>null),mutate:vi.fn(async(_env,_id,_key,_operation,fn)=>(fn(scope.tx))),sql:vi.fn(()=>({})),uid:()=> 'campaign-test-run'};
});
import {startRun} from '../apps/api/src/runs';
beforeEach(()=>{
 scope.tx={player:{id:'campaign-qa',level:201,coins:500,boundCoins:0,hearts:5,unlimitedUntil:0,inventory:{},version:1} as Player,now:1000,db:{} as MutationContext['db'],statements:[],seasonActive:false,changed:new Map(),sourceId:'campaign-test',touch:()=>{},notify:()=>{}} satisfies MutationContext;
});
describe('campaign API negotiation and publication boundaries',()=>{
 it('starts new mechanics with the same deterministic state as local play and no entry heart cost',async()=>{
  const result=await startRun({} as ApiEnv,'campaign-qa',{engineVersion:ENGINE_VERSION,preBoosters:[],idempotencyKey:'campaign-check'});
  expect(result.run.level.id).toBe(201);expect(result.run.level.obstacles.some(o=>o.kind==='pipe')).toBe(true);expect(result.run.state.engineVersion).toBe('1.3.0');expect(stateHash(result.run.state)).toBe(stateHash(createGame(result.run.level)));expect(result.player.hearts).toBe(5);expect(result.run.heartSpent).toBe(false);
 });
 it('preserves old-client content and rejects unknown engines',async()=>{
  const result=await startRun({} as ApiEnv,'campaign-qa',{engineVersion:SCULPTED_ENGINE_VERSION,preBoosters:[],idempotencyKey:'classic-check'});
  expect(result.run.state.engineVersion).toBe('1.2.0');expect(result.run.level.obstacles.some(o=>['pipe','bud','carousel','curtain'].includes(o.kind))).toBe(false);
  await expect(startRun({} as ApiEnv,'campaign-qa',{engineVersion:'9.0.0'})).rejects.toThrow();
 });
 it('starts a published late-stage variant with the same local state',async()=>{
  scope.tx.player.level=9998;
  const result=await startRun({} as ApiEnv,'campaign-qa',{engineVersion:ENGINE_VERSION,preBoosters:[],idempotencyKey:'bulk-start'});
  expect(result.run.level.id).toBe(9998);expect(result.run.level.width).toBe(9);expect(result.run.level.difficulty).toBe('super');
  expect(stateHash(result.run.state)).toBe(stateHash(createGame(result.run.level)));expect(scope.tx.player.hearts).toBe(5);
 });
 it('returns a deliberate unavailable response with no ledger write at the unpublished boundary',async()=>{
  scope.tx.player.level=APPROVED_LEVEL_COUNT+1;
  await expect(startRun({} as ApiEnv,'campaign-qa',{engineVersion:ENGINE_VERSION,preBoosters:[],idempotencyKey:'pending-check'})).rejects.toMatchObject(APPROVED_LEVEL_COUNT===30000?{code:'CAMPAIGN_COMPLETE',status:409}:{code:'CONTENT_NOT_READY',status:503});
  expect(scope.tx.statements).toHaveLength(0);expect(scope.tx.player.hearts).toBe(5);
 });
});
