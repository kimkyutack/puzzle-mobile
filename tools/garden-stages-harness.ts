// Actual App, StartLevelModal and Board; all API requests stay in this isolated fixture.
import {ENGINE_VERSION,SUPPORTED_ENGINE_VERSIONS,CONTENT_VERSION,type Action,type Run} from '@garden/contracts';
import {getLevel,STORY_VERSION,STORY_SCENES} from '@garden/content';
import {createGame,applyAction} from '@garden/core';
import {newPlayer} from '../apps/api/src/db';
import {projectLiveGarden,GARDEN_SHOP_PRICES} from '../packages/garden-world/src/live';
import {completionReward} from '../apps/client/src/completion';
import currentProofs from '../packages/content/src/garden-stage-proofs-v3.json';
import openProofs from '../packages/content/src/garden-stage-proofs-v2.json';
import retainedProofs from '../packages/content/src/garden-stage-proofs.json';
const params=new URLSearchParams(location.search),initial=Number(params.get('level')||10),rules=['1.6.0','1.7.0'].includes(params.get('rules')??'')?params.get('rules')!:ENGINE_VERSION,proofs=rules==='1.6.0'?retainedProofs:rules==='1.7.0'?openProofs:currentProofs,now=Date.now();
let player=newPlayer('garden-stage-fixture-'+initial+'-'+crypto.randomUUID(),now),run:Run|null=null;
player.level=initial;player.tutorials=['swap','crate','vine','pot','frost','moss','seed','cabinet','pipe','bud','carousel','curtain','wind-row','wind-column','bomb','glider','rainbow','beehive'];
if(initial!==10&&initial!==20)player.tutorials.push('garden-water','garden-animal');
player.settings={sound:false,music:false,haptics:false,reducedMotion:false,language:'ko'};
const operations=new Map<string,unknown>(),probe=document.getElementById('stage-qa')!;
if(params.has('clean'))probe.hidden=true;
const timeline:unknown[]=[],started=performance.now();let lastVisual='';
function report(){const layer=document.querySelector('.garden-stage-overlay'),visual={connected:layer?.getAttribute('data-stage-connected'),completed:layer?.getAttribute('data-stage-completed'),walking:layer?.getAttribute('data-stage-travelling'),win:!!document.querySelector('[role=dialog][aria-label="정원이 활짝 피었어요!"]'),phase:document.querySelector('.board')?.getAttribute('data-input-phase')},visualKey=JSON.stringify(visual);if(visualKey!==lastVisual){lastVisual=visualKey;timeline.push({ms:Math.round(performance.now()-started),...visual});probe.dataset.timeline=JSON.stringify(timeline);}const shown=Number(document.querySelector('.hud-moves-v32 strong')?.textContent),turn=run?run.level.moves-shown:0,proof=proofs.find(p=>p.kind===run?.level.gardenStage?.kind&&p.variant===Math.floor((run!.level.id-10)/20)%12);probe.textContent=JSON.stringify({level:player.level,run:run?.level.id,turn:Math.max(0,turn||0),next:proof?.actions[turn||0],serverSequence:run?.sequence,status:run?.status,engine:run?.state.engineVersion,boardStatus:run?.state.status});}
new MutationObserver(report).observe(document.getElementById('root')!,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['data-stage-connected','data-stage-completed','data-stage-travelling','data-input-phase']});
const response=(data:unknown)=>Response.json({data,serverNow:Date.now(),stateVersion:player.version});
const original=fetch.bind(window),requests:string[]=[];
window.fetch=async(input,init)=>{
 const url=new URL(input instanceof Request?input.url:String(input),location.href);if(!url.pathname.includes('/api/'))return original(input,init);
 const path=url.pathname.slice(url.pathname.indexOf('/api/')+4);requests.push(path);probe.dataset.requests=JSON.stringify(requests);const method=init?.method??'GET',body=typeof init?.body==='string'?JSON.parse(init.body):{};
 if(path==='/health')return response({ok:true,engineVersion:'1.3.0',latestEngineVersion:rules,supportedEngineVersions:SUPPORTED_ENGINE_VERSIONS.filter(v=>rules===ENGINE_VERSION||v!==ENGINE_VERSION)});
 if(path==='/auth/guest'||path==='/me'&&method==='GET')return response({player,activeRun:run?.status==='active'?run:null,accessToken:'fixture-only',refreshToken:'fixture-only'});
 if(path==='/me'&&method==='PATCH'){if(body.tutorials)player.tutorials=[...new Set([...player.tutorials,...body.tutorials])];if(body.settings)Object.assign(player.settings,body.settings);player.version++;return response({player});}
 if(path==='/story')return response({contentVersion:STORY_VERSION,unlocked:STORY_SCENES.map(s=>s.id),seen:STORY_SCENES.map(s=>s.id),styles:{}});
 if(path==='/garden/world')return response({world:projectLiveGarden(player,null),prices:GARDEN_SHOP_PRICES});
 if(path==='/progression')return response({player,daily:{missions:[]},weekly:{missions:[]},milestone:{clears:initial-1,progress:(initial-1)%10,target:10,awarded:0,owned:0},minigame:{remaining:3},notifications:{missions:0,pass:0,gifts:0,friends:0,guild:0,events:0,minigame:0,shop:0}});
 if(path==='/levels/next'){const level=getLevel(player.level,url.searchParams.get('engineVersion')||ENGINE_VERSION),bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(level)));return response({schemaVersion:1,contentVersion:CONTENT_VERSION,level,levelHash:Array.from(new Uint8Array(bytes),n=>n.toString(16).padStart(2,'0')).join('')});}
 if(path==='/runs/start'){
  if(!run||run.status!=='active'){const level=getLevel(player.level,body.engineVersion);run={id:'stage-run-'+player.level+'-'+crypto.randomUUID(),userId:player.id,level,state:createGame(level,body.preBoosters),sequence:0,status:'active',startedAt:now,expiresAt:now+86400000,preBoosters:body.preBoosters,heartSpent:false,heartCharge:'failure',continues:0};}
  return response({player,run});
 }
 if(run&&path===`/runs/${run.id}/actions`){const key=body.idempotencyKey;if(operations.has(key))return response(operations.get(key));if(body.sequence!==run.sequence)throw Error('Fixture sequence mismatch');const events=[];for(const action of body.actions as Action[]){const result=applyAction(run.state,action);if(!result.accepted)throw Error('Fixture replay mismatch');run.state=result.state;run.sequence++;events.push(...result.events);}player.version++;const result=structuredClone({player,run,events});operations.set(key,result);report();return response(result);}
 if(run&&path===`/runs/${run.id}/finish`){if(run.status!=='won'){if(run.state.status!=='won')throw Error('Fixture premature finish');run.reward=completionReward(run);run.status='won';player.level++;player.stars++;player.coins+=run.reward.coins;player.version++;}report();return response({player,run});}
 return Response.json({error:{code:'QA_BLOCKED',message:'격리 검사: 외부 API 차단'}},{status:404});
};
report();await import('../apps/client/src/main');
