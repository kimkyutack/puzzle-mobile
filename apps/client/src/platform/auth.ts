import {tr} from "../i18n";
import { Capacitor, type PluginListenerHandle } from '@capacitor/core';
import { App } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import { Preferences } from '@capacitor/preferences';
import { SocialLogin, type InitializeOptions } from '@capgo/capacitor-social-login';
export type SignInProvider='google'|'apple';
let initialized=false;
export function identityAvailable(provider:SignInProvider):boolean {
  if(provider==='google') return !!import.meta.env.VITE_GOOGLE_WEB_CLIENT_ID;
  return Capacitor.getPlatform()==='ios' || !!(import.meta.env.VITE_APPLE_SERVICE_ID && import.meta.env.VITE_APPLE_REDIRECT_URL);
}
async function initialize() {
  if(initialized) return;
  const options:InitializeOptions={};
  if(import.meta.env.VITE_GOOGLE_WEB_CLIENT_ID) options.google={webClientId:import.meta.env.VITE_GOOGLE_WEB_CLIENT_ID,iOSClientId:import.meta.env.VITE_GOOGLE_IOS_CLIENT_ID,mode:'online'};
  options.apple={clientId:import.meta.env.VITE_APPLE_SERVICE_ID,redirectUrl:Capacitor.getPlatform()==='ios'?'':import.meta.env.VITE_APPLE_REDIRECT_URL,useProperTokenExchange:true};
  await SocialLogin.initialize(options);initialized=true;
}
/** Request challenge from POST /api/auth/challenge first. Nonce is one-use and server-owned. */
export async function signIn(provider:SignInProvider,nonce:string,challengeId:string):Promise<{idToken?:string;authorizationCode?:string;appleFlow?:'native'|'web';provider:SignInProvider;challengeId:string}> {
  if(!identityAvailable(provider)) throw new Error(tr("{0} 로그인 설정이 아직 연결되지 않았습니다.",{0:(provider==='google'?'Google':'Apple')}));
  if(provider==='apple' && Capacitor.getPlatform()==='android') {
    await appleAndroid(nonce,challengeId);
    return {provider,challengeId};
  }
  await initialize();
  const response=provider==='google'
    ?await SocialLogin.login({provider:'google',options:{nonce,scopes:['openid','email','profile'],forcePrompt:true,prompt:'select_account'}})
    :await SocialLogin.login({provider:'apple',options:{nonce,state:challengeId,scopes:['email','name']}});
  const result=response.result;
  if(!('idToken'in result)||!result.idToken) throw new Error(tr("계정 인증 토큰이 반환되지 않았습니다."));
  if(provider==='apple'){
    const authorizationCode='authorizationCode'in result?result.authorizationCode:undefined;
    if(!authorizationCode)throw new Error(tr("Apple 연결 관리에 필요한 인증 코드가 반환되지 않았습니다. 다시 로그인해 주세요."));
    return {idToken:result.idToken,authorizationCode,appleFlow:Capacitor.getPlatform()==='ios'?'native':'web',provider,challengeId};
  }
  return {idToken:result.idToken,provider,challengeId};
}

const PENDING_APPLE='garden.apple.pending-challenge';
/** Pending opaque state survives app switching; no OAuth token is stored in a URL or Preferences. */
export async function pendingAppleChallenge():Promise<string|null>{return (await Preferences.get({key:PENDING_APPLE})).value;}
export async function clearAppleChallenge(){await Preferences.remove({key:PENDING_APPLE});}
async function appleAndroid(nonce:string,challengeId:string){
  const redirect=import.meta.env.VITE_APPLE_REDIRECT_URL;
  if(!redirect?.startsWith('https://')) throw new Error(tr("Apple 인증 콜백 HTTPS 주소 설정이 필요합니다."));
  const url=new URL('https://appleid.apple.com/auth/authorize');
  url.search=new URLSearchParams({client_id:import.meta.env.VITE_APPLE_SERVICE_ID,redirect_uri:redirect,response_type:'code',response_mode:'form_post',scope:'name email',state:challengeId,nonce}).toString();
  await Preferences.set({key:PENDING_APPLE,value:challengeId});
  let finish:(error?:Error)=>void=()=>{};
  const result=new Promise<void>((resolve,reject)=>{finish=(error)=>error?reject(error):resolve();});
  const handles:PluginListenerHandle[]=[];
  let callbackReceived=false;
  handles.push(await App.addListener('appUrlOpen',({url:callback})=>{
    const parsed=new URL(callback);
    if(parsed.protocol!=='cloudgarden:'||parsed.host!=='auth'||parsed.searchParams.get('state')!==challengeId) return;
    callbackReceived=true;
    if(parsed.searchParams.get('success')==='true') finish(); else finish(new Error(tr("Apple 로그인이 완료되지 않았습니다.")));
  }));
  handles.push(await Browser.addListener('browserFinished',()=>{if(!callbackReceived)finish(new Error(tr("Apple 로그인을 취소했습니다.")));}));
  try {await Browser.open({url:url.toString()});await result;}
  finally {for(const handle of handles)await handle.remove();await Browser.close().catch(()=>{});}
}
