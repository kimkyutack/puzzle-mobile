import {beforeEach,describe,it,expect,vi} from 'vitest';
import {ENGINE_VERSION,SCULPTED_ENGINE_VERSION,SUPPORTED_ENGINE_VERSIONS,type Player,type Run} from '@garden/contracts';
import {APPROVED_LEVEL_COUNT,getLevel} from '@garden/content';
import {createGame,isSpecial,stateHash} from '@garden/core';
import type {ApiEnv,MutationContext} from '../apps/api/src/db';
const scope=vi.hoisted(()=>({tx:null as unknown as MutationContext}));
vi.mock('../apps/api/src/db',async original=>{
 const actual=await original<typeof import('../apps/api/src/db')>();
 return {...actual,activeRun:vi.fn(async()=>null),mutate:vi.fn(async(_env,_id,_key,_operation,fn)=>(fn(scope.tx))),sql:vi.fn(()=>({})),uid:()=> 'campaign-test-run'};
});
import {startRun} from '../apps/api/src/runs';
import {activeRun,digest} from '../apps/api/src/db';
import {engineRequest,publishedLevel} from '../apps/api/src/level-content';
beforeEach(()=>{
 vi.mocked(activeRun).mockResolvedValue(null);
 scope.tx={player:{id:'campaign-qa',level:201,coins:500,boundCoins:0,hearts:5,unlimitedUntil:0,inventory:{},version:1} as Player,now:1000,db:{} as MutationContext['db'],statements:[],seasonActive:false,changed:new Map(),sourceId:'campaign-test',touch:()=>{},notify:()=>{}} satisfies MutationContext;
});
describe('campaign API negotiation and publication boundaries',()=>{
 it('creates a fresh reproducible board only for new random-start requests',async()=>{
  scope.tx.player.level=31;const before=publishedLevel(31,ENGINE_VERSION),body={engineVersion:ENGINE_VERSION,supportedEngineVersions:SUPPORTED_ENGINE_VERSIONS,randomStart:true,preBoosters:[],idempotencyKey:'fresh-random-board',levelHash:await digest(JSON.stringify(before))};
  const result=await startRun({} as ApiEnv,'campaign-qa',body);
  expect(result.run.level.initial).not.toEqual(before.initial);expect(result.run.level.goals).toEqual(before.goals);expect(result.run.level.obstacles).toEqual(before.obstacles);expect(result.run.level.shape).toEqual(before.shape);
  expect(stateHash(result.run.state)).toBe(stateHash(createGame(result.run.level)));expect(result.player.hearts).toBe(5);
  vi.mocked(activeRun).mockResolvedValue(result.run);const resumed=await startRun({} as ApiEnv,'campaign-qa',{...body,idempotencyKey:'resume-random-board'});expect(resumed.run).toEqual(result.run);
 });
 it('starts an authored chain board with its placed powers and no inventory charge',async()=>{
  scope.tx.player.level=39;
  const inventory=structuredClone(scope.tx.player.inventory),level=publishedLevel(39,ENGINE_VERSION);
  const result=await startRun({} as ApiEnv,'campaign-qa',{engineVersion:ENGINE_VERSION,
   idempotencyKey:'chain-board-start',randomStart:true,preBoosters:[],levelHash:await digest(JSON.stringify(level))});
  const placed=level.initial!.flatMap((tile,index)=>isSpecial(tile)?[[index,tile.kind] as const]:[]);
  expect(placed.length).toBeGreaterThanOrEqual(8);
  for(const [index,kind]of placed)expect(result.run.state.cells[index]?.tile?.kind).toBe(kind);
  expect(result.run.preBoosters).toEqual([]);
  expect(result.player.inventory).toEqual(inventory);
  expect(result.player.hearts).toBe(5);
  expect(stateHash(result.run.state)).toBe(stateHash(createGame(result.run.level)));
 });
 it('keeps unseen tutorials fixed and randomizes later attempts after the tutorial was learned',async()=>{
  scope.tx.player.level=2;const template=getLevel(2),body={engineVersion:ENGINE_VERSION,randomStart:true,preBoosters:[],idempotencyKey:'new-lesson'};
  const first=await startRun({} as ApiEnv,'campaign-qa',body);expect(first.run.level).toEqual(template);
  scope.tx.player.tutorials=[template.tutorial!.feature];const retry=await startRun({} as ApiEnv,'campaign-qa',{...body,idempotencyKey:'learned-lesson'});
  expect(retry.run.level.tutorial).toBeUndefined();expect(retry.run.level.initial).not.toEqual(template.initial);
 });
 it('starts new mechanics with the same deterministic state as local play and no entry heart cost',async()=>{
  scope.tx.player.level=501;
  const result=await startRun({} as ApiEnv,'campaign-qa',{engineVersion:ENGINE_VERSION,preBoosters:[],idempotencyKey:'campaign-check'});
  expect(result.run.level.id).toBe(501);expect(result.run.level.obstacles.some(o=>o.kind==='petal-launcher')).toBe(true);expect(result.run.state.engineVersion).toBe(ENGINE_VERSION);expect(stateHash(result.run.state)).toBe(stateHash(createGame(result.run.level)));expect(result.player.hearts).toBe(5);expect(result.run.heartSpent).toBe(false);
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
 it('negotiates a known common ruleset even if the requesting app knows a newer one',()=>{
  expect(engineRequest({engineVersion:'9.0.0',supportedEngineVersions:['9.0.0','1.2.0']}).engineVersion).toBe('1.2.0');
  expect(engineRequest({supportedEngineVersions:SUPPORTED_ENGINE_VERSIONS}).engineVersion).toBe(ENGINE_VERSION);
  expect(()=>engineRequest({supportedEngineVersions:['9.0.0']})).toThrow();
 });
 it('resumes the saved rules and board instead of replacing it with the latest engine',async()=>{
  const level=getLevel(13,'1.2.0'),existing={id:'saved-classic',level,state:createGame(level),expiresAt:99999} as Run,before=structuredClone(existing);
  existing.state.moves-=2;before.state.moves-=2;vi.mocked(activeRun).mockResolvedValue(existing);
  const result=await startRun({} as ApiEnv,'campaign-qa',{engineVersion:ENGINE_VERSION,supportedEngineVersions:SUPPORTED_ENGINE_VERSIONS,idempotencyKey:'resume-old-rules'});
  expect(result.run).toEqual(before);expect(scope.tx.statements).toHaveLength(0);
 });
 it('keeps a saved current-engine board when new difficulty data changes the next start',async()=>{
  scope.tx.player.level=501;const level=getLevel(201),existing={id:'saved-before-rotation',level,state:createGame(level),expiresAt:99999} as Run,snapshot=structuredClone(existing);
  expect(publishedLevel(201,ENGINE_VERSION)).not.toEqual(level);vi.mocked(activeRun).mockResolvedValue(existing);
  const result=await startRun({} as ApiEnv,'campaign-qa',{engineVersion:ENGINE_VERSION,supportedEngineVersions:SUPPORTED_ENGINE_VERSIONS,idempotencyKey:'resume-before-curve'});
  expect(result.run).toEqual(snapshot);expect(scope.tx.statements).toHaveLength(0);
 });
 it('rejects a changed preview before creating a run or spending a starting booster',async()=>{
  const body={engineVersion:ENGINE_VERSION,supportedEngineVersions:SUPPORTED_ENGINE_VERSIONS,preBoosters:['rainbow'],idempotencyKey:'changed-content',levelHash:'0'.repeat(64)},before=structuredClone(scope.tx.player);
  await expect(startRun({} as ApiEnv,'campaign-qa',body)).rejects.toMatchObject({code:'CONTENT_CHANGED'});
  expect(scope.tx.player).toEqual(before);expect(scope.tx.statements).toHaveLength(0);
  const level=publishedLevel(scope.tx.player.level,ENGINE_VERSION),result=await startRun({} as ApiEnv,'campaign-qa',{...body,preBoosters:[],levelHash:await digest(JSON.stringify(level))});
  expect(result.run.level).toEqual(level);
 });
});
