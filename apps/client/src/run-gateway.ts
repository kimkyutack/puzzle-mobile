import {CONTENT_VERSION,LEVEL_SCHEMA_VERSION,SUPPORTED_ENGINE_VERSIONS,commonEngine,type LevelDefinition,type LevelPreview,type Player,type PreBooster,type Run} from '@garden/contracts';
import {getLevel} from '@garden/content';
import {validateLevel} from '@garden/core';
import {tr} from './i18n';
import {BREAKABLE_OBSTACLES} from '../../../packages/contracts/src/breakable-obstacles';

export interface RunStartInput {idempotencyKey:string;preBoosters:PreBooster[];freeStartBoosters?:boolean;useFreeStartTrial?:boolean;levelId?:number;randomStart?:boolean}
type Transport=<T>(path:string,body?:unknown)=>Promise<T>;
const failure=(code:string,message:string)=>Object.assign(new Error(tr(message)),{code});
const codeOf=(error:unknown)=>error&&typeof error==='object'&&'code' in error?String(error.code):'';
/** Common simulation rules are independent of the server's current release. */
export function createRunGateway(request:Transport,supportedVersions:readonly string[]=SUPPORTED_ENGINE_VERSIONS){
 let engine:Promise<string>|undefined,currentVersion:string|undefined;
 const levels=new Map<string,Promise<LevelPreview>>();
 const preparedLevels=new Map<string,LevelPreview>();
 function resolveEngine(refresh=false):Promise<string>{
  if(refresh)engine=undefined;
  if(!engine){
   const pending=request<{ok:boolean;engineVersion:string;supportedEngineVersions?:string[]}>('/health').then(health=>{
    if(!health.ok)throw failure('NETWORK','서버에 연결하지 못했어요. 잠시 후 다시 시도해 주세요.');
    const compatible=commonEngine(supportedVersions,health.supportedEngineVersions??[health.engineVersion]);
    if(!compatible)throw failure('UPDATE_REQUIRED','지원하는 퍼즐 규칙이 없어요. 앱을 업데이트해 주세요.');
    if(engine===pending)currentVersion=compatible;
    return compatible;
   });
   engine=pending;
   void pending.catch(()=>{if(engine===pending)engine=undefined;});
  }
  return engine;
 }
 async function loadPreview(levelId:number,version:string,refresh:boolean):Promise<LevelPreview>{
  const cacheKey=version+':'+levelId;
  if(refresh){levels.delete(cacheKey);preparedLevels.delete(cacheKey);}
  if(!levels.has(cacheKey)){
   const pending=(async()=>{
    let result:LevelPreview;
    try{result=await request<LevelPreview>('/levels/next?engineVersion='+encodeURIComponent(version)+'&levelId='+levelId);if(!result.levelHash)throw failure('CONTENT_INVALID','퍼즐 정보를 확인하지 못했어요. 다시 불러와 주세요.');}
    catch(error){
     // A previously deployed API can still run its bundled, compatible content.
     if(codeOf(error)!=='NOT_FOUND')throw error;
     try{result={schemaVersion:LEVEL_SCHEMA_VERSION,contentVersion:CONTENT_VERSION,level:getLevel(levelId,version)};}
     catch{throw failure('CONTENT_NOT_READY','새 퍼즐을 준비 중이에요. 잠시 후 다시 확인해 주세요.');}
    }
    await validatePreview(result,levelId,version);return result;
   })();
   levels.set(cacheKey,pending);
   void pending.then(result=>{if(levels.get(cacheKey)===pending)preparedLevels.set(cacheKey,result);},()=>{if(levels.get(cacheKey)===pending)levels.delete(cacheKey);});
  }
  return levels.get(cacheKey)!;
 }
 async function preview(levelId:number,refresh=false):Promise<LevelPreview>{
  const version=await resolveEngine();
  try{return await loadPreview(levelId,version,refresh);}catch(error){
   // A compatible server deployment can happen while this session is open.
   // Refresh capabilities before asking the player to update the installed app.
   if(codeOf(error)!=='UPDATE_REQUIRED')throw error;
   const updated=await resolveEngine(true);if(updated===version)throw error;
   return loadPreview(levelId,updated,refresh);
  }
 }
 async function start(input:RunStartInput){
  const prepared=input.levelId===undefined?undefined:await preview(input.levelId);
  const version=prepared?.level.engineVersion??await resolveEngine();
  const send=(engineVersion:string)=>request<{player:Player;run:Run}>('/runs/start',{idempotencyKey:input.idempotencyKey,preBoosters:input.preBoosters,...(input.freeStartBoosters?{freeStartBoosters:true}:{}),...(input.useFreeStartTrial?{useFreeStartTrial:true}:{}),randomStart:input.randomStart??true,engineVersion,supportedEngineVersions:supportedVersions,...(prepared?.levelHash?{levelHash:prepared.levelHash}:{})});
  try{return await send(version);}catch(error){
   if(codeOf(error)==='CONTENT_CHANGED'){levels.clear();preparedLevels.clear();throw error;}
   // A deployment can change while the app is open. Retry only a rejected version,
   // once, using the exact original purchase key and booster selection.
   if(!['INVALID_INPUT','UPDATE_REQUIRED'].includes(codeOf(error)))throw error;
   const updated=await resolveEngine(true);if(updated===version)throw error;
   levels.clear();preparedLevels.clear();
   if(prepared)throw failure('CONTENT_CHANGED','퍼즐 구성이 바뀌었어요. 새 목표를 확인한 뒤 다시 시작해 주세요.');
   return send(updated);
  }
 }
 const peek=(levelId:number)=>currentVersion?preparedLevels.get(currentVersion+':'+levelId):undefined;
 return {resolveEngine,preview,peek,start};
}

async function validatePreview(preview:LevelPreview,id:number,engine:string){
 try{
  const level:LevelDefinition=preview.level;
  const kinds=['crate','vine','pot','moss','cabinet','pipe','bud','carousel','curtain',...BREAKABLE_OBSTACLES];
  if(preview.schemaVersion!==LEVEL_SCHEMA_VERSION||level.id!==id||level.engineVersion!==engine||!level.approved||validateLevel(level).length||level.obstacles.some(o=>!kinds.includes(o.kind)))throw Error('Invalid map');
  if(preview.levelHash){
   const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(level)));
   if(Array.from(new Uint8Array(digest),value=>value.toString(16).padStart(2,'0')).join('')!==preview.levelHash)throw Error('Invalid map hash');
  }
 }catch{throw failure('CONTENT_INVALID','퍼즐 정보를 확인하지 못했어요. 다시 불러와 주세요.');}
}
