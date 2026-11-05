import {localizeApiError,tr} from "./i18n";
import type {Envelope,AuthResponse,LocalFeatures,Player,RankingScope,RankingsResponse} from '@garden/contracts';
import {tokenStorage,type Tokens} from './platform/storage';
import {apiBase as base} from './api-endpoint';
let token='';let sessionRevision=0;let serverEpoch=Date.now();let monotonic=performance.now();
let renewing:Promise<void>|null=null;
export const serverNow=()=>serverEpoch+(performance.now()-monotonic);
export const key=()=>crypto.randomUUID();
export class ApiFailure extends Error {constructor(public code:string,message:string){super(localizeApiError(code,message))}}
export const setToken=(value:string)=>{token=value;sessionRevision++;};
/** Invalidate in-flight old-account work before any asynchronous keychain write begins. */
export async function installSession(tokens:Tokens){
 const revision=++sessionRevision;token=tokens.accessToken;
 try{await tokenStorage.set(tokens);}catch(error){if(revision===sessionRevision){token='';sessionRevision++;}throw error;}
 if(revision!==sessionRevision)throw new ApiFailure('SESSION_CHANGED',tr("계정이 변경되었어요. 다시 시도해 주세요."));
}
export async function clearSession(){setToken('');await tokenStorage.clear();}
function time<T>(result:Envelope<T>){if(result.serverNow){serverEpoch=result.serverNow;monotonic=performance.now();}}
async function renewSession(revision:number){
 if(renewing)return renewing;
 renewing=(async()=>{
  const tokens=await tokenStorage.get();
  if(!tokens||revision!==sessionRevision)throw new ApiFailure('SESSION_CHANGED',tr("계정이 변경되었어요. 다시 시도해 주세요."));
  const response=await fetch(base+'/auth/refresh',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({refreshToken:tokens.refreshToken})});
  const result=await response.json() as Envelope<AuthResponse>&{error?:{code:string;message:string}};
  if(!response.ok||result.error)throw new ApiFailure(result.error?.code||'UNAUTHORIZED',result.error?.message||tr("다시 로그인해 주세요."));
  if(revision!==sessionRevision)throw new ApiFailure('SESSION_CHANGED',tr("계정이 변경되었어요. 다시 시도해 주세요."));
  await tokenStorage.set({accessToken:result.data.accessToken,refreshToken:result.data.refreshToken});
  if(revision!==sessionRevision)throw new ApiFailure('SESSION_CHANGED',tr("계정이 변경되었어요. 다시 시도해 주세요."));
  token=result.data.accessToken;time(result);
 })();
 try{await renewing;}finally{renewing=null;}
}
export async function request<T>(path:string,body?:unknown,method=body===undefined?'GET':'POST',retry=true):Promise<T>{
 const revision=sessionRevision;const sentToken=token;
 const controller=new AbortController(),deadline=['/health','/runs/start','/story/seen','/garden/restore'].includes(path)?setTimeout(()=>controller.abort(),20000):undefined;
 let response:Response,result:Envelope<T>&{error?:{code:string;message:string}};
 try{
  response=await fetch(base+path,{method,signal:controller.signal,headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});
  result=await response.json();
 }catch(error){if(controller.signal.aborted)throw new ApiFailure('NETWORK',tr('연결을 확인해 주세요.'));throw error;}finally{if(deadline)clearTimeout(deadline);}
 time(result);
 if(response.status===401&&retry&&token&&!path.startsWith('/auth/')&&['UNAUTHORIZED','SESSION_EXPIRED','AUTH_REQUIRED'].includes(result.error?.code||'')){
  if(revision!==sessionRevision)throw new ApiFailure('SESSION_CHANGED',tr("계정이 변경되었어요. 다시 시도해 주세요."));
  if(token===sentToken)await renewSession(revision);
  if(revision!==sessionRevision)throw new ApiFailure('SESSION_CHANGED',tr("계정이 변경되었어요. 다시 시도해 주세요."));
  return request<T>(path,body,method,false);
 }
 if(!response.ok||result.error)throw new ApiFailure(result.error?.code||'NETWORK',result.error?.message||tr("연결을 확인해 주세요."));
 return result.data;
}
export async function guest(){const result=await request<AuthResponse>('/auth/guest',{});setToken(result.accessToken);return result;}
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
