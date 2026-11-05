// Actual App + Board, controlled local responses only. Never contact any API.
import {applyAction,createGame} from '@garden/core';
import {getLevel,STORY_VERSION,STORY_SCENES} from '@garden/content';
import type {Action,Run} from '@garden/contracts';
import {newPlayer} from '../apps/api/src/db';
import {completionReward} from '../apps/client/src/completion';
import {projectLiveGarden,GARDEN_SHOP_PRICES} from '../packages/garden-world/src/live';
import solutions from '../packages/content/src/solutions.json';

const now=Date.now(),session=new URLSearchParams(location.search).get('case')??'delayed',level=getLevel(13),actions=solutions['13'].actions as Action[];
let state=createGame(level);for(const action of actions.slice(0,-1))state=applyAction(state,action).state;
let player=newPlayer('latency-fixture-'+session,now);player.level=13;player.settings={sound:false,music:false,haptics:false,reducedMotion:false,language:'ko'};player.tutorials=['crate','vine','frost','seed','pot','moss','cabinet','wind-row','wind-column','bomb','glider','rainbow'];
let run:Run={id:'latency-run-'+session,userId:player.id,level,state,sequence:actions.length-1,status:'active',startedAt:now,expiresAt:now+86400000,preBoosters:[],heartSpent:false,heartCharge:'failure',continues:0};
const storageKey='latency-qa-server-'+session,stored=sessionStorage.getItem(storageKey);if(stored){const data=JSON.parse(stored);player=data.player;run=data.run;}
const keys:string[]=[],pending:Array<(response:Response)=>void>=[],operations=new Map<string,unknown>();
const ack=document.getElementById('qa-ack') as HTMLButtonElement,fail=document.getElementById('qa-fail') as HTMLButtonElement,probe=document.getElementById('qa-probe')!;
const response=(data:unknown)=>Response.json({data,serverNow:Date.now(),stateVersion:player.version});
function persist(){sessionStorage.setItem(storageKey,JSON.stringify({player,run}));}
function report(){ack.disabled=fail.disabled=!pending.length;probe.textContent=JSON.stringify({waiting:pending.length,finishKeys:keys,coins:player.coins,status:run.status,lastAction:actions.at(-1)});}
ack.onclick=()=>{if(run.status==='active'){run.reward=completionReward(run);run.status='won';player.coins+=run.reward.coins;player.stars+=run.reward.stars;player.level=14;player.version++;persist();}const result={player,run};for(const resolve of pending.splice(0))resolve(response(result));report();};
fail.onclick=()=>{pending.shift()?.(Response.json({error:{code:'INTERNAL_ERROR',message:'격리 검사: 응답 실패'}},{status:503}));report();};
const original=window.fetch.bind(window);
window.fetch=async(input,init)=>{
 const url=new URL(input instanceof Request?input.url:String(input),location.href);if(!url.pathname.includes('/api/'))return original(input,init);
 const path=url.pathname.slice(url.pathname.indexOf('/api/')+4),method=init?.method??'GET',body=typeof init?.body==='string'?JSON.parse(init.body):{};
 if(path==='/auth/guest'||path==='/me'&&method==='GET')return response({player,activeRun:run.status==='active'?run:null,accessToken:'isolated-no-server-token',refreshToken:'isolated-no-server-token'});
 if(path==='/story')return response({contentVersion:STORY_VERSION,unlocked:STORY_SCENES.map(s=>s.id),seen:STORY_SCENES.map(s=>s.id),styles:{}});
 if(path==='/garden/world')return response({world:projectLiveGarden(player,null),prices:GARDEN_SHOP_PRICES});
 if(path==='/progression')return response({player,daily:{missions:[]},weekly:{missions:[]},milestone:{clears:12,progress:2,target:10,awarded:1,owned:0},minigame:{remaining:3},notifications:{missions:0,pass:0,gifts:0,friends:0,guild:0,events:0,minigame:0,shop:0}});
 if(path===`/runs/${run.id}/actions`){const id=body.idempotencyKey??body.key;if(operations.has(id))return response(operations.get(id));if(body.sequence!==run.sequence)throw Error('QA sequence mismatch');const events=[];for(const action of body.actions as Action[]){const result=applyAction(run.state,action);if(!result.accepted)throw Error('QA invalid replay');run.state=result.state;events.push(...result.events);run.sequence++;}player.version++;persist();const result=structuredClone({player,run,events});operations.set(id,result);return response(result);}
 if(path===`/runs/${run.id}/finish`){keys.push(body.key);if(run.status==='won'){report();return response({player,run});}return new Promise<Response>(resolve=>{pending.push(resolve);report();});}
 // Missing fixture endpoints fail locally; they never reach the real Worker.
 return Response.json({error:{code:'QA_BLOCKED',message:'격리 검사: 외부 API 차단'}},{status:404});
};
report();
await import('../apps/client/src/main');
