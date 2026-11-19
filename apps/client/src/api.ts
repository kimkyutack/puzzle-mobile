import {clientRelease} from './platform/app-info';
import {gardenArtRequest} from './garden-art-request';
import {localizeApiError,tr} from "./i18n";
import type {Envelope,AuthResponse,LocalFeatures,Player,RankingScope,RankingsResponse} from '@garden/contracts';
import {ENGINE_VERSION} from '@garden/contracts';
import {tokenStorage,type Tokens} from './platform/storage';
import {apiBase as base} from './api-endpoint';
import {clearAccountAge} from './platform/account-age';
const apiPath=(path:string)=>base+path+(path.includes('?')?'&':'?')+'expeditionEngine='+encodeURIComponent(ENGINE_VERSION);
let token='';let sessionRevision=0;let serverEpoch=Date.now();let monotonic=performance.now();
let renewing:Promise<void>|null=null;
export const serverNow=()=>serverEpoch+(performance.now()-monotonic);
export const key=()=>crypto.randomUUID();
export class ApiFailure extends Error {constructor(public code:string,message:string){super(localizeApiError(code,message))}}
export const hasSession=()=>!!token;
export const setToken=(value:string)=>{if(token!==value)clearAccountAge();token=value;sessionRevision++;if(typeof window!=='undefined')window.dispatchEvent(new Event('game-session'));};
/** Invalidate in-flight old-account work before any asynchronous keychain write begins. */
export async function installSession(tokens:Tokens){
 clearAccountAge();
 const revision=++sessionRevision;token=tokens.accessToken;
 try{await tokenStorage.set(tokens);}catch(error){if(revision===sessionRevision){token='';sessionRevision++;}throw error;}
 if(revision!==sessionRevision)throw new ApiFailure('SESSION_CHANGED',tr("계정이 변경되었어요. 다시 시도해 주세요."));
 if(typeof window!=='undefined')window.dispatchEvent(new Event('game-session'));
}
export async function clearSession(){setToken('');await tokenStorage.clear();}
const GAME_REQUEST_TIMEOUT_MS=8_000;
const DEFAULT_REQUEST_TIMEOUT_MS=20_000;
function networkError(){return new ApiFailure('NETWORK',tr('연결을 확인해 주세요.'));}

function withinDeadline<T>(milliseconds:number,work:(signal:AbortSignal)=>Promise<T>):Promise<T>{
 const controller=new AbortController();
 return new Promise<T>((resolve,reject)=>{
  const timer=setTimeout(()=>{controller.abort();reject(networkError());},milliseconds);
  Promise.resolve().then(()=>work(controller.signal)).then(
   result=>{clearTimeout(timer);resolve(result);},
   error=>{clearTimeout(timer);reject(error);},
  );
 });
}

async function fetchEnvelope<T>(path:string,init:RequestInit,signal:AbortSignal){
 if(signal.aborted)throw networkError();
 try{
  const response=await fetch(apiPath(path),{...init,signal});
  const result=await response.json() as Envelope<T>&{error?:{code:string;message:string}};
  if(signal.aborted||!result||typeof result!=='object')throw networkError();
  return {response,result};
 }catch{throw networkError();}
}

function time<T>(result:Envelope<T>){if(result.serverNow){serverEpoch=result.serverNow;monotonic=performance.now();}}
async function renewSession(revision:number){
 if(renewing)return renewing;
 renewing=withinDeadline(GAME_REQUEST_TIMEOUT_MS,async signal=>{
  const tokens=await tokenStorage.get();
  if(!tokens||revision!==sessionRevision)throw new ApiFailure('SESSION_CHANGED',tr("계정이 변경되었어요. 다시 시도해 주세요."));
  const {response,result}=await fetchEnvelope<AuthResponse>('/auth/refresh',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({refreshToken:tokens.refreshToken})},signal);
  if(!response.ok||result.error)throw new ApiFailure(result.error?.code||'UNAUTHORIZED',result.error?.message||tr("다시 로그인해 주세요."));
  if(revision!==sessionRevision)throw new ApiFailure('SESSION_CHANGED',tr("계정이 변경되었어요. 다시 시도해 주세요."));
  await tokenStorage.set({accessToken:result.data.accessToken,refreshToken:result.data.refreshToken});
  if(revision!==sessionRevision)throw new ApiFailure('SESSION_CHANGED',tr("계정이 변경되었어요. 다시 시도해 주세요."));
  token=result.data.accessToken;time(result);
 });
 try{await renewing;}finally{renewing=null;}
}
export function request<T>(path:string,body?:unknown,method=body===undefined?'GET':'POST',retry=true):Promise<T>{
 const revision=sessionRevision,route=path.split('?')[0]!;
 const timeout=route.startsWith('/runs/')||['/health','/me','/levels/next','/operations/bootstrap'].includes(route)
  ?GAME_REQUEST_TIMEOUT_MS:DEFAULT_REQUEST_TIMEOUT_MS;
 return withinDeadline(timeout,async signal=>{
  const release=await clientRelease();
  async function send(canRefresh:boolean):Promise<T>{
   if(revision!==sessionRevision)throw new ApiFailure('SESSION_CHANGED',tr('계정이 변경되었어요. 다시 시도해 주세요.'));
   const sentToken=token;
   const {response,result}=await fetchEnvelope<T>(gardenArtRequest(path),{method,
    headers:{'Content-Type':'application/json','X-App-Platform':release.platform,'X-App-Version':release.version,
     ...(sentToken?{Authorization:`Bearer ${sentToken}`}:{})},
    ...(body===undefined?{}:{body:JSON.stringify(body)}),
   },signal);
   if(revision!==sessionRevision)throw new ApiFailure('SESSION_CHANGED',tr('계정이 변경되었어요. 다시 시도해 주세요.'));
   time(result);
   if(response.status===401&&canRefresh&&sentToken&&!path.startsWith('/auth/')&&['UNAUTHORIZED','SESSION_EXPIRED','AUTH_REQUIRED'].includes(result.error?.code||'')){
    if(signal.aborted)throw networkError();
    if(token===sentToken)await renewSession(revision);
    return send(false);
   }
   if(!response.ok||result.error){
    if(result.error?.code==='AGE_ACCESS_REQUIRED'&&sentToken&&!path.startsWith('/age/'))window.dispatchEvent(new Event('garden:age-access-required'));
    throw new ApiFailure(result.error?.code||'NETWORK',result.error?.message||tr("연결을 확인해 주세요."));
   }
   return result.data;
  }
  return send(retry);
 });
}
export async function guest(ageToken?:string){const result=await request<AuthResponse>('/auth/guest',ageToken?{ageToken}:{});await installSession(result);return result;}
export const getRankings=(scope:RankingScope)=>request<RankingsResponse>('/rankings?scope='+scope);
export async function getLocalFeatures():Promise<LocalFeatures>{
 if(!import.meta.env.DEV&&import.meta.env.VITE_LOCAL_DEV_TOOLS!=='enabled')return {freeHeartRefill:false};
 return request<LocalFeatures>('/local/features');
}
export async function refillLocalHearts(idempotencyKey:string){
 if(!(await getLocalFeatures()).freeHeartRefill)throw new ApiFailure('NOT_FOUND',tr("이 환경에서는 사용할 수 없어요."));
 return request<{player:Player}>('/local/hearts/refill',{key:idempotencyKey});
}
export function duration(ms:number){const seconds=Math.max(0,Math.ceil(ms/1000));return `${Math.floor(seconds/3600)>0?Math.floor(seconds/3600)+':':''}${String(Math.floor(seconds/60)%60).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}`;}
