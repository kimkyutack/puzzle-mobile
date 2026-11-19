// Actual App/Board, isolated in-memory server. All /api traffic stays in this fixture.
import {createGame,applyAction} from '@garden/core';
import {PERPENDICULAR_ROCKET_ENGINE_VERSION as ENGINE_VERSION,SUPPORTED_ENGINE_VERSIONS,type Action,type Run,type StateResponse} from '@garden/contracts';
import {getLevel,STORY_VERSION,STORY_SCENES} from '@garden/content';
import {newPlayer} from '../apps/api/src/db';
import {projectLiveGarden,GARDEN_SHOP_PRICES} from '../packages/garden-world/src/live';
import {saveLanguagePreference} from '../apps/client/src/locale-preference';
import {rememberHelp} from '../apps/client/src/help-history';
const now=Date.now(),id='tutorial-flow-'+crypto.randomUUID();
let player=newPlayer(id,now),run:Run|null=null;
player.level=2;player.tutorials=['swap'];player.settings={sound:false,music:false,haptics:false,reducedMotion:false,language:'ko'};
rememberHelp(id,['swap']);saveLanguagePreference('ko',false,id);
let slowRefresh=false,release:(()=>void)|undefined,delayedGets=0,invalidActions=0;
const probe=document.getElementById('qa-state')!,releaseButton=document.getElementById('qa-release') as HTMLButtonElement;
const response=(data:unknown)=>Response.json({data:structuredClone(data),serverNow:Date.now(),stateVersion:player.version});
const report=()=>{probe.textContent=JSON.stringify({serverLevel:player.level,runLevel:run?.level.id,turn:run?.state.turn,sequence:run?.sequence,delayedGets,invalidActions});releaseButton.disabled=!release;};
document.getElementById('qa-refresh')!.onclick=()=>{slowRefresh=true;window.dispatchEvent(new Event('online'));};
releaseButton.onclick=()=>{release?.();release=undefined;report();};
const original=window.fetch.bind(window);
window.fetch=async(input,init)=>{
 const url=new URL(input instanceof Request?input.url:String(input),location.href);if(!url.pathname.includes('/api/'))return original(input,init);
 const path=url.pathname.slice(url.pathname.indexOf('/api/')+4),method=init?.method??'GET',body=typeof init?.body==='string'?JSON.parse(init.body):{};
 if(path==='/health')return response({ok:true,engineVersion:'1.3.0',latestEngineVersion:ENGINE_VERSION,supportedEngineVersions:SUPPORTED_ENGINE_VERSIONS.filter(v=>v!=='1.5.0')});
 if(path==='/auth/guest'||path==='/me'&&method==='GET'){
  const snapshot:StateResponse={player:structuredClone(player),activeRun:run?.status==='active'?structuredClone(run):null};
  if(slowRefresh){slowRefresh=false;delayedGets++;const captured=response(snapshot);return new Promise<Response>(resolve=>{release=()=>resolve(captured);report();});}
  return response({...snapshot,accessToken:'isolated-fixture-token',refreshToken:'isolated-fixture-token'});
 }
 if(path==='/me'&&method==='PATCH'){
  if(body.tutorials)player.tutorials=[...new Set([...player.tutorials,...body.tutorials])];if(body.settings)Object.assign(player.settings,body.settings);player.version++;
  const snapshot=response({player});await new Promise(resolve=>setTimeout(resolve,2000));return snapshot;
 }
 if(path.startsWith('/levels/next')){const level=getLevel(player.level,url.searchParams.get('engineVersion')!);const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(level)));return response({schemaVersion:1,contentVersion:level.version,level,levelHash:Array.from(new Uint8Array(digest),v=>v.toString(16).padStart(2,'0')).join('')});}
 if(path==='/runs/start'){
  if(!run||run.status!=='active'){const level=getLevel(player.level,body.engineVersion);run={id:'flow-run-'+player.level,userId:id,level,state:createGame(level),sequence:0,status:'active',startedAt:now,expiresAt:now+86400000,preBoosters:[],heartSpent:false,heartCharge:'failure',continues:0};}
  report();return response({player,run});
 }
 if(path===`/runs/${run?.id}/actions`&&run){const events=[];for(const action of body.actions as Action[]){const result=applyAction(run.state,action);if(!result.accepted){invalidActions++;report();return Response.json({error:{code:'INVALID_ACTION',message:'Fixture replay rejected'}},{status:409});}run.state=result.state;run.sequence++;events.push(...result.events);}player.version++;report();return response({player,run,events});}
 if(path===`/runs/${run?.id}/finish`&&run){run.status='won';run.reward={coins:50,stars:1};player.coins+=50;player.stars++;player.level++;player.version++;report();return response({player,run});}
 if(path==='/story')return response({contentVersion:STORY_VERSION,unlocked:STORY_SCENES.map(s=>s.id),seen:STORY_SCENES.map(s=>s.id),styles:{}});
 if(path==='/garden/world')return response({world:projectLiveGarden(player,null),prices:GARDEN_SHOP_PRICES});
 if(path==='/progression')return response({player,daily:{missions:[]},weekly:{missions:[]},milestone:{clears:1,progress:1,target:10,awarded:0,owned:0},minigame:{remaining:3},notifications:{missions:0,pass:0,gifts:0,friends:0,guild:0,events:0,minigame:0,shop:0}});
 if(path==='/shop/offers')return response({offers:[],serverTime:now});
 return Response.json({error:{code:'QA_BLOCKED',message:'격리 검사: 외부 API 차단'}},{status:404});
};
report();await import('../apps/client/src/main');
