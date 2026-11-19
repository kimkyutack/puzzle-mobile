import {describe,it,expect} from 'vitest';
import {CONTENT_VERSION,LEVEL_SCHEMA_VERSION,SUPPORTED_ENGINE_VERSIONS,type LevelDefinition,type LevelPreview,type Player,type Run} from '@garden/contracts';
import {getLevel,APPROVED_LEVEL_COUNT} from '@garden/content';
import {createGame} from '@garden/core';
import {createRunGateway} from '../apps/client/src/run-gateway';
async function packet(level:LevelDefinition):Promise<LevelPreview>{
 const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(level)));
 return {schemaVersion:LEVEL_SCHEMA_VERSION,contentVersion:'server-content-next',level,levelHash:Array.from(new Uint8Array(bytes),v=>v.toString(16).padStart(2,'0')).join('')};
}
const health={ok:true,engineVersion:'9.0.0',supportedEngineVersions:['9.0.0','1.3.0','1.2.0']};
describe('downloaded compatible puzzle data',()=>{
 it('exposes only validated previews synchronously and reuses a warmed preview when opening again',async()=>{
  const data=await packet(getLevel(1,'1.3.0'));let release!:(value:LevelPreview)=>void,reads=0;
  const pending=new Promise<LevelPreview>(resolve=>{release=resolve;});
  const gateway=createRunGateway(async<T>(path:string)=>{if(path==='/health')return health as T;reads++;return await pending as T;});
  expect(gateway.peek(1)).toBeUndefined();
  const warming=gateway.preview(1);await gateway.resolveEngine();
  expect(gateway.peek(1)).toBeUndefined();release(data);await warming;
  expect(gateway.peek(1)).toEqual(data);expect(gateway.peek(2)).toBeUndefined();
  expect(await gateway.preview(1)).toEqual(data);expect(reads).toBe(1);
 });
 it('drops the prepared preview during explicit refresh and never publishes an invalid replacement',async()=>{
  const valid=await packet(getLevel(1,'1.3.0'));let reads=0;
  const gateway=createRunGateway(async<T>(path:string)=>(path==='/health'?health:++reads===1?valid:{...valid,levelHash:'invalid'}) as T);
  await gateway.preview(1);expect(gateway.peek(1)).toEqual(valid);
  await expect(gateway.preview(1,true)).rejects.toMatchObject({code:'CONTENT_INVALID'});
  expect(gateway.peek(1)).toBeUndefined();
 });
 it('previews and starts a newly published map beyond the app bundled catalog',async()=>{
  const level={...getLevel(1,'1.3.0'),id:APPROVED_LEVEL_COUNT+1},preview=await packet(level),calls:Array<{path:string;body:unknown}>=[];
  const gateway=createRunGateway(async<T>(path:string,body?:unknown)=>{calls.push({path,body});return (path==='/health'?health:path.startsWith('/levels/next')?preview:{player:{} as Player,run:{level,state:createGame(level)} as Run}) as T;});
  expect((await gateway.preview(level.id)).level).toEqual(level);
  const result=await gateway.start({idempotencyKey:'remote-new-stage',preBoosters:[],levelId:level.id});
  expect(result.run.level.id).toBe(APPROVED_LEVEL_COUNT+1);expect(calls.filter(c=>c.path.startsWith('/levels/next'))).toHaveLength(1);
  expect(calls.find(c=>c.path==='/runs/start')!.body).toMatchObject({engineVersion:'1.3.0',levelHash:preview.levelHash});
 });
 it('shares a pending download and explicitly reloads server data for a reopened preview',async()=>{
  const first=await packet(getLevel(1,'1.3.0')),second=await packet({...first.level,moves:first.level.moves+1});let reads=0;
  const gateway=createRunGateway(async<T>(path:string)=>(path==='/health'?health:++reads===1?first:second) as T);
  const both=await Promise.all([gateway.preview(1),gateway.preview(1)]);expect(both[0]).toEqual(both[1]);expect(reads).toBe(1);
  expect((await gateway.preview(1,true)).level.moves).toBe(second.level.moves);expect(reads).toBe(2);
 });
 it('refreshes stale capabilities during preview and starts with the newly confirmed compatible rules',async()=>{
  const level=getLevel(1,'1.2.0'),data=await packet(level),calls:Array<{path:string;body:unknown}>=[];let reads=0;
  const gateway=createRunGateway(async<T>(path:string,body?:unknown)=>{
   calls.push({path,body});
   if(path==='/health')return {ok:true,engineVersion:'1.3.0',supportedEngineVersions:++reads===1?['1.3.0','1.2.0']:['1.2.0']} as T;
   if(path==='/levels/next?engineVersion=1.3.0&levelId=1')throw {code:'UPDATE_REQUIRED'};
   if(path==='/levels/next?engineVersion=1.2.0&levelId=1')return data as T;
   return {player:{} as Player,run:{level,state:createGame(level)} as Run} as T;
  });
  const input={idempotencyKey:'deploy-during-preview',preBoosters:['rainbow'] as ['rainbow'],levelId:1};
  expect((await gateway.start(input)).run.level).toEqual(level);
  expect(reads).toBe(2);expect(calls.filter(c=>c.path.startsWith('/levels/next'))).toHaveLength(2);
  expect(calls.filter(c=>c.path==='/runs/start')).toEqual([{path:'/runs/start',body:{idempotencyKey:input.idempotencyKey,preBoosters:input.preBoosters,randomStart:true,engineVersion:'1.2.0',supportedEngineVersions:SUPPORTED_ENGINE_VERSIONS,levelHash:data.levelHash}}]);
 });
 it('bounds preview renegotiation and never creates a run while compatible content is unavailable',async()=>{
  let reads=0;const calls:string[]=[];
  const gateway=createRunGateway(async<T>(path:string)=>{
   calls.push(path);
   if(path==='/health')return {ok:true,engineVersion:'1.3.0',supportedEngineVersions:++reads===1?['1.3.0','1.2.0']:['1.2.0']} as T;
   throw {code:'UPDATE_REQUIRED'};
  });
  await expect(gateway.start({idempotencyKey:'deploy-retry-bound',preBoosters:['rainbow'],levelId:1})).rejects.toMatchObject({code:'UPDATE_REQUIRED'});
  expect(reads).toBe(2);expect(calls.filter(path=>path.startsWith('/levels/next'))).toHaveLength(2);expect(calls).not.toContain('/runs/start');
 });
 it('uses bundled maps only when an older server has no preview endpoint',async()=>{
  const legacy=createRunGateway(async<T>(path:string)=>{if(path==='/health')return {ok:true,engineVersion:'1.2.0'} as T;throw {code:'NOT_FOUND'};});
  expect(await legacy.preview(20)).toEqual({schemaVersion:1,contentVersion:CONTENT_VERSION,level:getLevel(20,'1.2.0')});
  for(const code of ['NETWORK','UNAUTHORIZED','CONTENT_NOT_READY']){
   const gateway=createRunGateway(async<T>(path:string)=>{if(path==='/health')return health as T;throw {code};});
   await expect(gateway.preview(1)).rejects.toMatchObject({code});
  }
 });
 it('rejects corrupted, unsupported or mismatched definitions before any start request',async()=>{
  const original=await packet(getLevel(1,'1.3.0'));
  for(const change of [{levelHash:'0'.repeat(64)},{schemaVersion:2},{level:{...original.level,id:2}},{level:{...original.level,engineVersion:'9.0.0'}},{level:{...original.level,width:100}},{levelHash:undefined}]){
   const calls:string[]=[],send=async<T>(path:string):Promise<T>=>{calls.push(path);return (path==='/health'?health:{...original,...change}) as T;},gateway=createRunGateway(send);
   await expect(gateway.start({idempotencyKey:'corrupt-map-test',preBoosters:['rainbow'],levelId:1})).rejects.toMatchObject({code:'CONTENT_INVALID'});
   expect(calls.includes('/runs/start')).toBe(false);
  }
 });
 it('never retries a stale content purchase silently and downloads new goals before retry',async()=>{
  const first=await packet(getLevel(1,'1.3.0')),second=await packet({...first.level,moves:first.level.moves+1});let reads=0,starts=0;
  const gateway=createRunGateway(async<T>(path:string)=>{if(path==='/health')return health as T;if(path.startsWith('/levels/next'))return (++reads===1?first:second) as T;starts++;throw {code:'CONTENT_CHANGED'};});
  await gateway.preview(1);await expect(gateway.start({idempotencyKey:'same-purchase-key',preBoosters:['rainbow'],levelId:1})).rejects.toMatchObject({code:'CONTENT_CHANGED'});
  expect(gateway.peek(1)).toBeUndefined();expect(starts).toBe(1);expect((await gateway.preview(1)).level).toEqual(second.level);expect(reads).toBe(2);
 });
});
