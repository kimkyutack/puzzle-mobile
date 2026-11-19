// Real App, local simulation and UI; isolated responses only. Never reaches an account or live Worker.
import {createGame,applyAction} from '@garden/core';
import {getLevel,STORY_VERSION,STORY_SCENES} from '@garden/content';
import {ENGINE_VERSION,SUPPORTED_ENGINE_VERSIONS,CONTENT_VERSION,LEVEL_SCHEMA_VERSION,type Action,type Run} from '@garden/contracts';
import {POWER_FESTIVAL_DURATION,POWER_FESTIVAL_STAGES,addPowerUses,powerUses,emptyPowerUses,festivalStage,festivalClaimable} from '../packages/content/src/power-festival';
import {newPlayer} from '../apps/api/src/db';
import {projectLiveGarden,GARDEN_SHOP_PRICES} from '../packages/garden-world/src/live';
import {saveLanguagePreference} from '../apps/client/src/locale-preference';
const params=new URLSearchParams(location.search),mode=params.get('case')??'active',now=Date.now();
if(params.get('lang'))saveLanguagePreference(params.get('lang')==='en'?'en':'ko');
let player=newPlayer('festival-isolated-'+mode,now);player.level=31;player.settings={sound:false,music:false,haptics:false,reducedMotion:false,language:'ko'};
player.tutorials=['swap','crate','vine','pot','moss','cabinet','pipe','bud','carousel','curtain','frost','seed','combo','special','wind-row','wind-column','bomb','glider','rainbow'];
if(mode!=='fresh')player.powerFestival={id:'fixture-event',day:'d:fixture',startedAt:now,endsAt:now+POWER_FESTIVAL_DURATION,counts:mode==='ready'?{...POWER_FESTIVAL_STAGES[0]!.targets}:{rainbow:1,glider:2,bomb:1,rocket:4},claimedStages:0};
const level=getLevel(31),state=createGame(level),rocket=state.cells.findIndex(c=>c.tile?.kind==='normal'&&!c.obstacleId);state.cells[rocket]!.tile={id:state.nextTileId++,kind:'wind-row'};
let run:Run={id:'festival-local-run',userId:player.id,level,state,sequence:0,status:'active',startedAt:now,expiresAt:now+86400000,preBoosters:[],heartSpent:false,heartCharge:'failure',continues:0,powerUses:emptyPowerUses()};
const operations=new Map<string,unknown>(),calls:string[]=[],original=fetch.bind(window),output=document.getElementById('festival-qa')!;
function report(){output.textContent=JSON.stringify({rocket,serverUses:player.powerFestival?.counts,claimed:player.powerFestival?.claimedStages,coins:player.coins,calls:calls.slice(-4)});}
function response(data:unknown){return Response.json({data:structuredClone(data),serverNow:Date.now(),stateVersion:player.version})}
window.fetch=async(input,init)=>{
 const url=new URL(input instanceof Request?input.url:String(input),location.href);if(!url.pathname.includes('/api/'))return original(input,init);
 const path=url.pathname.slice(url.pathname.indexOf('/api/')+4),body=typeof init?.body==='string'?JSON.parse(init.body):{},method=init?.method??'GET';calls.push(method+' '+path);report();
 if(path==='/health')return response({ok:true,engineVersion:ENGINE_VERSION,supportedEngineVersions:SUPPORTED_ENGINE_VERSIONS});
 if(path==='/auth/guest'||path==='/me'&&method==='GET')return response({player,activeRun:run.status==='active'&&!params.has('home')?run:null,accessToken:'fixture-only',refreshToken:'fixture-only'});
 if(path==='/me'&&method==='PATCH'){player={...player,version:player.version+1,tutorials:body.tutorials??player.tutorials,settings:{...player.settings,...body.settings}};return response({player})}
 if(path==='/story')return response({contentVersion:STORY_VERSION,unlocked:STORY_SCENES.map(s=>s.id),seen:STORY_SCENES.map(s=>s.id),styles:{}});
 if(path==='/garden/world')return response({world:projectLiveGarden(player,null),prices:GARDEN_SHOP_PRICES});
 if(path==='/offers')return response({offers:[],serverTime:Date.now()});
 if(path==='/events')return response({pass:{points:0,premium:false,tiers:[],guildGifts:[]},daily:{available:false,coins:50,nextReset:Date.now()+86400000},attendance:{total:1,claimedDays:1,cycleDay:1,bonusItem:'hammer',bonusQuantity:1},season:null,personal:{progress:0,target:10,coins:300,claimed:false},guild:{progress:0,target:30,coins:500,claimed:false}});
 if(path==='/progression')return response({player,daily:{id:'d',missions:[]},weekly:{id:'w',missions:[]},milestone:{clears:30,progress:0,target:10,awarded:3,owned:0},minigame:{remaining:3},notifications:{missions:0,pass:0,gifts:0,friends:0,guild:0,events:0,minigame:0,shop:0,festival:player.powerFestival?festivalClaimable(player.powerFestival):0}});
 if(path==='/power-festival/start'){player.powerFestival={id:'fixture-started',day:'fixture',startedAt:Date.now(),endsAt:Date.now()+POWER_FESTIVAL_DURATION,counts:emptyPowerUses(),claimedStages:0};player.version++;report();return response({player})}
 if(path==='/power-festival/claim'){
  if(!operations.has(body.key)){const e=player.powerFestival!,stage=festivalStage(e.counts,e.claimedStages);if(!stage.ready)throw Error('Fixture goal not met');player.coins+=stage.reward.coins;for(const [item,count]of Object.entries(stage.reward.items))player.inventory[item as keyof typeof player.inventory].bound+=count!;e.claimedStages++;player.version++;operations.set(body.key,structuredClone({player,granted:true}));}
  report();return response(operations.get(body.key));
 }
 if(path===`/runs/${run.id}/actions`){
  if(!operations.has(body.idempotencyKey)){const events=[];for(const action of body.actions as Action[]){const r=applyAction(run.state,action);if(!r.accepted)throw Error('Fixture invalid replay');run.state=r.state;events.push(...r.events);run.sequence++;}run.powerUses=addPowerUses(run.powerUses,powerUses(events));if(player.powerFestival)player.powerFestival.counts=addPowerUses(player.powerFestival.counts,powerUses(events));player.version++;operations.set(body.idempotencyKey,structuredClone({player,run,events}));}
  report();await new Promise(resolve=>setTimeout(resolve,1800));return response(operations.get(body.idempotencyKey));
 }
 if(path===`/runs/${run.id}/finish`){run.status=run.state.status==='won'?'won':'lost';if(run.status==='won'&&!run.reward){run.reward={coins:50,stars:1};player.coins+=50;player.stars++;player.level++;player.version++;}return response({player,run})}
 return Response.json({error:{code:'QA_BLOCKED',message:'Isolated fixture: endpoint blocked'}},{status:404});
};
report();await import('../apps/client/src/main');
