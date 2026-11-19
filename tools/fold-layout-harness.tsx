// Actual product components with synthetic local responses; no live API requests.
import React from 'react';
import {createRoot} from 'react-dom/client';
import {createGame,applyAction} from '@garden/core';
import {getLevel} from '@garden/content';
import {CONTENT_VERSION,ENGINE_VERSION,SUPPORTED_ENGINE_VERSIONS,LEVEL_SCHEMA_VERSION,type Action,type Goal,type Player,type Run} from '@garden/contracts';
import dataSource from './fold-layout-data.json';
import {saveLanguagePreference,LANGUAGE_KEY} from '../apps/client/src/locale-preference';
import LoadingScreen from '../apps/client/src/LoadingScreen';
const data:Record<string,unknown>=structuredClone(dataSource),params=new URLSearchParams(location.search),mode=params.get('screen')??'app';
let player=(data['/me'] as {player:Player}).player,run:Run|null=null,frameWrites=0,calls=0;
const goalSamples:Array<[Goal['kind'],number]>=[['drop',28],['sprout',24],['crate',3],['berry',16],['frost',5],['vine',4],['sun',12],['pot',2],['flower',18]];
function fixtureLevel(version:string){
 return structuredClone(getLevel(player.level,version));
}
function fixtureRun(version:string):Run{
 const level=fixtureLevel(version),state=createGame(level);
 // Display-only stress cases; authored level definitions and engine validation
 // stay intact. Published maps currently have at most four goal kinds.
 const count=Number(params.get('goals'));
 if(count>0)state.goals=goalSamples.slice(0,count).map(([kind,count])=>({kind,count,remaining:count}));
 if(params.has('moves'))state.moves=Number(params.get('moves'));
 if(params.get('complete')==='1')state.goals=state.goals.map(goal=>({...goal,remaining:0}));
 return {id:params.get('play')==='1'?'header-v32-'+location.search:'fold-run',userId:player.id,level,state,sequence:0,status:'active',startedAt:Date.now(),expiresAt:Date.now()+86400000,preBoosters:[],heartSpent:false,heartCharge:'failure',continues:0};
}
if(params.get('play')==='1')run=fixtureRun(ENGINE_VERSION);
if(mode!=='language')saveLanguagePreference(params.get('lang')==='en'?'en':'ko',false,player.id);
const report=()=>{document.getElementById('qa-perf')!.textContent=JSON.stringify({frameWrites,frames:document.querySelectorAll('[data-local-frame]').length,calls,viewport:[innerWidth,innerHeight]});};
const observer=new MutationObserver(records=>{frameWrites+=records.filter(r=>r.type==='attributes'&&r.attributeName==='style'&&r.target instanceof HTMLElement&&r.target.hasAttribute('data-local-frame')).length;});
observer.observe(document.getElementById('root')!,{subtree:true,attributes:true,attributeFilter:['style']});
document.getElementById('qa-reset')!.onclick=()=>{frameWrites=0;report()};
document.getElementById('qa-bump')!.onclick=()=>{player={...player,coins:player.coins+1,version:player.version+1};(data['/me'] as {player:Player}).player=player;(data['/progression'] as {player:Player}).player=player;window.dispatchEvent(new Event('online'));};
setInterval(report,500);
const response=(value:unknown)=>Response.json({data:structuredClone(value),serverNow:Date.now(),stateVersion:player.version});
const original=fetch.bind(window);
window.fetch=async(input,init)=>{
 const url=new URL(input instanceof Request?input.url:String(input),location.href);if(!url.pathname.includes('/api/'))return original(input,init);
 url.searchParams.delete('gardenArt');calls++;const path=url.pathname.slice(url.pathname.indexOf('/api/')+4)+url.search,method=init?.method??'GET',body=typeof init?.body==='string'?JSON.parse(init.body):{};
 if(path==='/health')return response({ok:true,engineVersion:'1.3.0',latestEngineVersion:ENGINE_VERSION,supportedEngineVersions:SUPPORTED_ENGINE_VERSIONS});
 if(path==='/auth/guest'||path==='/me'&&method==='GET')return response({player,activeRun:run?.status==='active'?run:null,accessToken:'fixture-only',refreshToken:'fixture-only'});
 if(path==='/me'&&method==='PATCH'){Object.assign(player,{version:player.version+1,settings:{...player.settings,...body.settings},tutorials:body.tutorials??player.tutorials});return response({player});}
 if(path.startsWith('/levels/next')){const level=fixtureLevel(url.searchParams.get('engineVersion')!);const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(level)));return response({schemaVersion:LEVEL_SCHEMA_VERSION,contentVersion:CONTENT_VERSION,level,levelHash:Array.from(new Uint8Array(digest),v=>v.toString(16).padStart(2,'0')).join('')});}
 if(path==='/runs/start'){run=fixtureRun(body.engineVersion);return response({player,run});}
 if(path===`/runs/${run?.id}/actions`&&run){const events=[];for(const action of body.actions as Action[]){const result=applyAction(run.state,action);if(!result.accepted)throw Error('Invalid fixture action');run.state=result.state;run.sequence++;events.push(...result.events);}return response({player,run,events});}
 if(path===`/runs/${run?.id}/finish`&&run){run.status=run.state.status==='won'?'won':'lost';return response({player,run});}
 if(path==='/rankings?scope=friends')return response({...data['/rankings?scope=players'] as object,scope:'friends'});
 if(method==='GET'&&path in data)return response(data[path]);
 return Response.json({error:{code:'QA_BLOCKED',message:'격리 검사: 외부 API 및 구매 차단'}},{status:404});
};
if(mode==='loading'){
 await import('../apps/client/src/style.css');await import('../apps/client/src/fonts.css');await import('../apps/client/src/loading-story.css');
 createRoot(document.getElementById('root')!).render(<LoadingScreen progress={.57} error="" recovering={false} busy={false} onRecover={()=>{}} onRetry={()=>{}}/>);
}
else{if(mode==='language')localStorage.removeItem(LANGUAGE_KEY);await import('../apps/client/src/main');}
