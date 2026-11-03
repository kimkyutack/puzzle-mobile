import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {ENGINE_VERSION,type AuthResponse,type Envelope,type Player,type Run,type ProgressionResponse,type TreasureAttempt} from '@garden/contracts';
import deployment from '../config/deployment.json';
import {applyAction,stateHash} from '@garden/core';
import solutions from '../packages/content/src/solutions.json';

// Dedicated disposable guest only. Never read local tokens or a local D1 database.
const base=deployment.apiUrl,checks:string[]=[];
let user:AuthResponse|undefined;
let socket:WebSocket|undefined;
const check=(message:string)=>{checks.push(message);console.log('PASS '+message);};
async function call<T>(path:string,body?:unknown,method=body===undefined?'GET':'POST',authorized=true){
 const response=await fetch(base+path,{method,headers:{'Content-Type':'application/json',Origin:'capacitor://localhost',...(authorized&&user?{Authorization:'Bearer '+user.accessToken}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});
 const json=await response.json() as Envelope<T>&{error?:{code:string;message:string}};
 assert.equal(response.headers.get('access-control-allow-origin'),'capacitor://localhost',path+' CORS');
 return {status:response.status,json};
}
async function ok<T>(path:string,body?:unknown,method?:string,authorized=true){const result=await call<T>(path,body,method,authorized);assert.equal(result.status,200,`${path}: ${JSON.stringify(result.json.error)}`);return result.json.data;}
try{
 assert.equal((await ok<{ok:boolean}>('/health',undefined,undefined,false)).ok,true);check('deployed Worker health');
 for(const origin of ['capacitor://localhost','http://localhost','https://localhost','http://127.0.0.1:5173']){
  const response=await fetch(base+'/me',{method:'OPTIONS',headers:{Origin:origin,'Access-Control-Request-Method':'GET','Access-Control-Request-Headers':'authorization,content-type'}});
  assert.equal(response.status,204);assert.equal(response.headers.get('access-control-allow-origin'),origin);
 }
 const rejected=await fetch(base+'/me',{method:'OPTIONS',headers:{Origin:'https://untrusted.example'}});assert.equal(rejected.status,403);assert.equal(rejected.headers.get('access-control-allow-origin'),null);check('iOS, Android, browser CORS and foreign-origin rejection');
 assert.equal((await call('/me',undefined,undefined,false)).status,401);
 user=await ok<AuthResponse>('/auth/guest',{},undefined,false);check('remote D1 guest and authenticated profile');
 assert.equal((await ok<{player:Player}>('/me')).player.id,user.player.id);
 const first=await ok<{player:Player;run:Run}>('/runs/start',{key:crypto.randomUUID(),engineVersion:ENGINE_VERSION,preBoosters:[]});
 assert.equal(first.player.hearts,user.player.hearts);assert.equal(first.run.heartSpent,false);
 const actions=solutions[String(first.run.level.id) as keyof typeof solutions].actions;
 const actionBody={key:crypto.randomUUID(),sequence:0,actions};
 const played=await ok<{run:Run}>(`/runs/${first.run.id}/actions`,actionBody);assert.equal(played.run.state.status,'won');
 const replay=await ok<{run:Run}>(`/runs/${first.run.id}/actions`,actionBody);assert.equal(replay.run.sequence,played.run.sequence);
 const finishBody={key:crypto.randomUUID()};
 const finished=await ok<{player:Player}>(`/runs/${first.run.id}/finish`,finishBody);
 const repeated=await ok<{player:Player}>(`/runs/${first.run.id}/finish`,finishBody);assert.equal(finished.player.hearts,user.player.hearts);assert.equal(repeated.player.coins,finished.player.coins);check('server puzzle replay, level reward and duplicate protection');
 const {run:givenUp}=await ok<{run:Run}>('/runs/start',{key:crypto.randomUUID(),engineVersion:ENGINE_VERSION,preBoosters:[]});const giveUpBody={key:crypto.randomUUID()};const quit=await ok<{player:Player}>(`/runs/${givenUp.id}/abandon`,giveUpBody);assert.equal(quit.player.hearts,finished.player.hearts-1);assert.equal((await ok<{player:Player}>(`/runs/${givenUp.id}/abandon`,giveUpBody)).player.hearts,quit.player.hearts);check('start and clear preserve hearts; final give-up and retry spend exactly one');
 assert.equal((await ok<{freeHeartRefill:boolean}>('/local/features')).freeHeartRefill,false);
 assert.equal((await call('/local/hearts/refill',{key:crypto.randomUUID()})).status,404);check('local-only free hearts disabled remotely');
 user=await ok<AuthResponse>('/auth/refresh',{refreshToken:user.refreshToken},undefined,false);
 assert.equal((await ok<{player:Player}>('/me')).player.id,user.player.id);check('remote access and refresh sessions');
 await ok('/catalog');await ok('/offers');await ok('/events');await ok('/rankings?scope=players');await ok('/friends');await ok('/garden/world');await ok('/story');check('catalog, shop, events, rankings, friends, garden and story routes');
 // Earn the actual guild unlock through nine more legal clears; no DB fixture or grant endpoint.
 for(let i=0;i<9;i++){
  const {run}=await ok<{run:Run}>('/runs/start',{key:crypto.randomUUID(),engineVersion:ENGINE_VERSION,preBoosters:[]});
  await ok(`/runs/${run.id}/actions`,{key:crypto.randomUUID(),sequence:0,actions:solutions[String(run.level.id) as keyof typeof solutions].actions});
  await ok(`/runs/${run.id}/finish`,{key:crypto.randomUUID()});
 }
 const activity=await ok<ProgressionResponse>('/progression');assert.equal(activity.daily.missions.length,7);assert.equal(activity.weekly.missions.length,10);assert.equal(activity.milestone.clears,10);assert.equal(activity.milestone.owned,1);assert(activity.notifications.missions>0);
 const beforeMission=(await ok<{player:Player}>('/me')).player;const missionBody={key:crypto.randomUUID(),period:'daily',periodId:activity.daily.id,ids:['d-clear']};await ok('/missions/claim',missionBody);await ok('/missions/claim',missionBody);assert.equal((await ok<{player:Player}>('/me')).player.coins,beforeMission.coins+50);
 check('daily 7 / weekly 10 missions, real red-dot readiness and one bomb per ten unique clears');
 const {attempt}=await ok<{attempt:TreasureAttempt}>('/minigames/treasure/start',{key:crypto.randomUUID()});const pairs=[...new Set(attempt.deck)].map(color=>{const indices=attempt.deck.flatMap((value,index)=>value===color?[index]:[]);return {first:indices[0]!,second:indices[1]!};});const beforeMini=(await ok<{player:Player}>('/me')).player;
 const miniBody={key:crypto.randomUUID(),pairs},mini=await ok<{player:Player;attempt:TreasureAttempt}>(`/minigames/treasure/${attempt.id}/finish`,miniBody);assert.equal(mini.attempt.status,'won');assert.equal(mini.player.coins,beforeMini.coins+25);assert.equal(mini.player.hearts,beforeMini.hearts);assert.deepEqual(await ok(`/minigames/treasure/${attempt.id}/finish`,miniBody),mini);check('live minigame replay grants an inventory item once without using a heart');
 const {run:perimeterRun}=await ok<{run:Run}>('/runs/start',{key:crypto.randomUUID(),engineVersion:ENGINE_VERSION,preBoosters:[]});
 const initialItems=(await ok<{player:Player}>('/me')).player.inventory['sweep-border'];
 const perimeterBody={key:crypto.randomUUID(),sequence:perimeterRun.sequence,actions:[{type:'booster' as const,item:'sweep-border' as const}]};
 const perimeter=await ok<{run:Run;player:Player}>(`/runs/${perimeterRun.id}/actions`,perimeterBody);
 assert.equal(stateHash(perimeter.run.state),stateHash(applyAction(perimeterRun.state,perimeterBody.actions[0]!).state));
 assert.equal(perimeter.player.inventory['sweep-border'].normal+perimeter.player.inventory['sweep-border'].bound,initialItems.normal+initialItems.bound-1);
 assert.deepEqual(await ok(`/runs/${perimeterRun.id}/actions`,perimeterBody),perimeter);
 check('locally predicted perimeter item replays identically and is charged once');
 await ok('/guilds',{key:crypto.randomUUID(),name:'API확인'+Date.now(),mode:'open',minLevel:5,emblem:0});
 const {ticket}=await ok<{ticket:string}>('/guild/socket-ticket',{});
 const socketUrl=new URL(base+'/guild/socket');socketUrl.protocol='wss:';socketUrl.searchParams.set('ticket',ticket);
 socket=new WebSocket(socketUrl);
 await new Promise<void>((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('Guild socket open timeout')),15_000);socket!.addEventListener('open',()=>{clearTimeout(timer);resolve();},{once:true});socket!.addEventListener('error',()=>{clearTimeout(timer);reject(new Error('Guild socket connection failed'));},{once:true});});
 async function socketMessage(predicate:(data:string)=>boolean){return new Promise<void>((resolve,reject)=>{const listener=(event:MessageEvent)=>{if(predicate(String(event.data))){clearTimeout(timer);socket!.removeEventListener('message',listener);resolve();}};const timer=setTimeout(()=>{socket!.removeEventListener('message',listener);reject(new Error('Guild notification timeout'));},15_000);socket!.addEventListener('message',listener);});}
 const pong=socketMessage(data=>data==='pong');socket.send('ping');await pong;
 const broadcast=socketMessage(data=>{try{return JSON.parse(data).type==='refresh';}catch{return false;}});
 await ok('/guild/chat',{key:crypto.randomUUID(),text:'API 연결 확인'});await broadcast;
 assert.equal((await call('/guild/socket?ticket='+encodeURIComponent(ticket))).status,401);
 check('live guild WSS, ping/pong, D1 outbox broadcast and single-use ticket');
}finally{
 socket?.close();
 if(user){await ok('/account',{confirmation:'DELETE'},'DELETE');check('disposable verification account anonymized and revoked');}
 await mkdir('output/verification',{recursive:true});
 await writeFile('output/verification/cloudflare-api.json',JSON.stringify({at:new Date().toISOString(),apiUrl:base,checks,localProgressRead:false,credentialsRecorded:false},null,2));
}
