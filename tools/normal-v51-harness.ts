/** Actual App/Board with controlled responses. No production request can escape this fixture. */
import {createGame,applyAction} from '@garden/core';
import {ENGINE_VERSION,SUPPORTED_ENGINE_VERSIONS,LEVEL_SCHEMA_VERSION,type Action,type Run,type LevelDefinition} from '@garden/contracts';
import {STORY_VERSION,STORY_SCENES} from '@garden/content';
import {defaultOperationsRuntime} from '../packages/contracts/src/operations';
import {publishedLevel} from '../apps/api/src/level-content';
import {newPlayer} from '../apps/api/src/db';
import {projectLiveGarden,GARDEN_SHOP_PRICES} from '../packages/garden-world/src/live';
import proofs from '../packages/content/src/midgame-proofs-v51.json';
import {completionReward} from '../apps/client/src/completion';
const params=new URLSearchParams(location.search),mode=params.get('case')??'atomic',now=Date.now(),id=86,level=publishedLevel(id,ENGINE_VERSION),actions=proofs['86'].actions as Action[];
let state=createGame(level);if(mode!=='board')for(const action of actions.slice(0,-1))state=applyAction(state,action).state;
let player=newPlayer('normal-v51-isolated-'+mode,now);player.level=id;player.settings={sound:false,music:false,haptics:false,reducedMotion:mode==='board',language:params.get('lang')==='en'?'en':'ko'};player.tutorials=['combo','special','crate','vine','frost','seed','pot','moss','cabinet','wind-row','wind-column','bomb','glider','rainbow','beehive'];player.flowerFestival={id:'flowerlight-invitation-v1',startedAt:now-1000,endsAt:now+86400000,petals:0,restoredStages:0};
let run:Run={id:'normal-v51-run',userId:player.id,level,state,sequence:mode==='board'?0:actions.length-1,status:'active',startedAt:now,expiresAt:now+86400000,preBoosters:[],heartSpent:false,heartCharge:'failure',continues:0};
let waiting:(()=>void)|null=null,fail:(()=>void)|null=null,startRequests=0;const calls:Array<{path:string;finishOnWin?:boolean}>=[],operations=new Map<string,unknown>();
if(params.get('qa')==='hide')(document.querySelector('.normal-qa') as HTMLElement).hidden=true;
const ack=document.getElementById('qa-ack') as HTMLButtonElement,reject=document.getElementById('qa-fail') as HTMLButtonElement,probe=document.getElementById('qa-probe')!;
const response=(data:unknown)=>Response.json({data,serverNow:Date.now(),stateVersion:player.version});
function report(){ack.disabled=reject.disabled=!waiting;probe.textContent=JSON.stringify({mode,waiting:!!waiting,startRequests,calls,coins:player.coins,level:player.level,status:run.status,lastAction:actions.at(-1)});document.body.dataset.qa=probe.textContent;}
ack.onclick=()=>{waiting?.();report()};reject.onclick=()=>{fail?.();report()};
function award(draft:Run){const reward=completionReward(draft);draft.status='won';draft.reward={...reward,flowerPetals:1};player={...player,coins:player.coins+draft.reward.coins,stars:player.stars+1,level:id+1,version:player.version+1,flowerFestival:{...player.flowerFestival!,petals:player.flowerFestival!.petals+1}};run=draft;}
function delayed(draft:Run,events:unknown[],key:string){return new Promise<Response>(resolve=>{waiting=()=>{award(draft);const data=structuredClone({player,run,events});operations.set(key,data);waiting=fail=null;resolve(response(data));};fail=()=>{waiting=fail=null;resolve(Response.json({error:{code:'INTERNAL_ERROR',message:'격리 검사: 저장 응답 실패'}},{status:503}));};report();});}
async function preview(map:LevelDefinition){const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(map)));return {schemaVersion:LEVEL_SCHEMA_VERSION,contentVersion:map.version,level:map,levelHash:Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,'0')).join('')};}
const original=fetch.bind(globalThis);globalThis.fetch=async(input,init)=>{
 const url=new URL(input instanceof Request?input.url:String(input),location.href);if(!url.pathname.includes('/api/'))return original(input,init);
 const path=url.pathname.slice(url.pathname.indexOf('/api/')+4),method=init?.method??'GET',body=typeof init?.body==='string'?JSON.parse(init.body):{};calls.push({path,...(body.finishOnWin?{finishOnWin:true}:{})});report();
 if(path==='/auth/guest'||path==='/me'&&method==='GET')return response({player,activeRun:run.status==='active'?run:null,accessToken:'isolated-local-token',refreshToken:'isolated-local-refresh'});
 if(path==='/health')return response({ok:true,engineVersion:ENGINE_VERSION,supportedEngineVersions:SUPPORTED_ENGINE_VERSIONS});
 if(path==='/operations/bootstrap'||path==='/operations')return response({settings:defaultOperationsRuntime(),revision:0,notices:[],events:[],maintenanceActive:false});
 if(path==='/levels/next')return response(await preview(publishedLevel(Number(url.searchParams.get('levelId')??player.level),ENGINE_VERSION)));
 if(path==='/story')return response({contentVersion:STORY_VERSION,unlocked:STORY_SCENES.map(s=>s.id),seen:STORY_SCENES.map(s=>s.id),styles:{}});
 if(path==='/garden/world')return response({world:projectLiveGarden(player,null),prices:GARDEN_SHOP_PRICES});
 if(path==='/progression')return response({player,daily:{missions:[]},weekly:{missions:[]},milestone:{clears:85,progress:5,target:10,awarded:8,owned:0},minigame:{remaining:3},notifications:{missions:0,pass:0,gifts:0,friends:0,guild:0,events:0,minigame:0,shop:0}});
 if(path===`/runs/${run.id}/actions`){const key=body.idempotencyKey??body.key;if(operations.has(key))return response(operations.get(key));if(body.sequence!==run.sequence)throw Error('Fixture sequence mismatch');const draft=structuredClone(run),events=[];for(const action of body.actions){const r=applyAction(draft.state,action);if(!r.accepted)throw Error('Fixture invalid replay');draft.state=r.state;draft.sequence++;events.push(...r.events);}if(draft.state.status==='won'&&body.finishOnWin&&mode!=='legacy')return delayed(draft,events,key);run=draft;player.version++;const data=structuredClone({player,run,events});operations.set(key,data);return response(data);}
 if(path===`/runs/${run.id}/finish`)return delayed(structuredClone(run),[],body.key);
 if(path==='/runs/start'){startRequests++;report();if(run.status!=='won')throw Error('Fixture detected a start before confirmed clear');const next=publishedLevel(player.level,ENGINE_VERSION);run={...run,id:'normal-v51-next',level:next,state:createGame(next),sequence:0,status:'active',reward:undefined};report();return response({player,run});}
 return Response.json({error:{code:'QA_BLOCKED',message:'격리 검사: 외부 API 차단'}},{status:404});
};
report();await import('../apps/client/src/main');
