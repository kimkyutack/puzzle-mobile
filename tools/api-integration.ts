import assert from 'node:assert/strict';
import { mkdir,writeFile } from 'node:fs/promises';
import type { AuthResponse, Envelope, Player, Run, Action, Gift } from '@garden/contracts';
import solutions from '../packages/content/src/solutions.json';

const base=process.env.API_URL??'http://127.0.0.1:8787/api';
assert(new URL(base).hostname==='127.0.0.1'||new URL(base).hostname==='localhost','Integration mutates accounts: local API only');
type User={token:string;refreshToken:string;player:Player};
type RunResponse={player:Player;run:Run};
const checks:Array<{name:string;passed:boolean}>=[];
const key=()=>crypto.randomUUID();
async function request<T>(user:User|null,path:string,body?:unknown,method=body?'POST':'GET'){
  const response=await fetch(base+path,{method,headers:{'Content-Type':'application/json',...(user?{Authorization:`Bearer ${user.token}`}:{})},...(body?{body:JSON.stringify(body)}:{})});
  const json=await response.json() as Envelope<T>&{error?:{code:string;message:string}};
  return {status:response.status,data:json.data,error:json.error};
}
async function ok<T>(user:User|null,path:string,body?:unknown,method?:string){const r=await request<T>(user,path,body,method);assert.equal(r.status,200,`${path}: ${JSON.stringify(r.error)}`);return r.data;}
function check(name:string){checks.push({name,passed:true});console.log(`PASS ${name}`);}
async function newUser(){const data=await ok<AuthResponse>(null,'/auth/guest',{});return {token:data.accessToken,refreshToken:data.refreshToken,player:data.player};}
async function me(user:User){const data=await ok<{player:Player;activeRun:Run|null}>(user,'/me');user.player=data.player;return data;}
async function win(user:User,existing?:Run){
  const {run}=existing?{run:existing}:await ok<RunResponse>(user,'/runs/start',{key:key(),preBoosters:[]});
  const actions=(solutions as Record<string,{actions:Action[]}>)[run.level.id]!.actions;
  const res=await ok<RunResponse>(user,`/runs/${run.id}/actions`,{key:key(),sequence:0,actions});assert.equal(res.run.state.status,'won');
  const finishKey=key();const [a,b]=await Promise.all([ok<RunResponse>(user,`/runs/${run.id}/finish`,{key:finishKey}),ok<RunResponse>(user,`/runs/${run.id}/finish`,{key:finishKey})]);assert.equal(a.player.coins,b.player.coins);user.player=a.player;return a;
}
try{
 const a=await newUser(),b=await newUser();assert.equal(a.player.coins,500);assert.equal(a.player.hearts,5);check('real D1 guest creation, initial economy');
 const startKey=key();const starts=await Promise.all([ok<RunResponse>(a,'/runs/start',{key:startKey,preBoosters:[]}),ok<RunResponse>(a,'/runs/start',{key:startKey,preBoosters:[]})]);assert.equal(starts[0].run.id,starts[1].run.id);assert.equal(starts[0].player.hearts,5);assert.equal((await me(a)).player.hearts,5);check('concurrent duplicate start creates one run without spending a heart');
 const again=await ok<RunResponse>(a,'/runs/start',{key:key(),preBoosters:[]});assert.equal(again.run.id,starts[0].run.id);assert.equal(again.player.hearts,5);check('different start key resumes existing run without a second spend');
 const fake=await request(a,`/runs/${again.run.id}/finish`,{key:key(),win:true,coins:100000});assert.equal(fake.status,400);check('client win and reward claims cannot settle an unfinished run');
 const invalid=await request(a,`/runs/${again.run.id}/booster`,{key:key(),sequence:0,item:'hammer',at:999});assert.equal(invalid.status,400);assert.equal((await me(a)).player.inventory.hammer.normal,2);check('invalid booster target does not consume inventory');
 await win(a,again.run);assert.equal(a.player.level,2);assert.equal(a.player.coins,550);assert.equal(a.player.hearts,5);check('deterministic action replay settles first reward exactly once');
 for(let id=2;id<=4;id++)await win(a);for(let id=1;id<=4;id++)await win(b);assert.equal(a.player.level,5);assert.equal(b.player.level,5);assert.equal(a.player.hearts,5);check('both real accounts clear tutorials 1–4 without spending hearts on clears');
 const restored=await ok<{player:Player}>(a,'/garden/restore',{key:key(),taskId:'sky-path'});assert.equal(restored.player.stars,3);const repeat=await ok<{player:Player}>(a,'/garden/restore',{key:key(),taskId:'sky-path'});assert.equal(repeat.player.stars,3);check('garden task cannot spend stars twice');
 const created=await ok<{guild:{id:string}}>(a,'/guilds',{key:key(),name:`검증정원${Date.now().toString().slice(-7)}`,mode:'open',minLevel:5,emblem:0});await ok(b,`/guilds/${created.guild.id}/join`,{key:key()});check('two real players create and join a guild');
 const req=await ok<{requestId:string}>(a,'/guild/requests',{key:key(),kind:'heart'});const heartBefore=(await me(b)).player.hearts;const helpKey=key();await Promise.all([ok(b,`/guild/requests/${req.requestId}/help`,{key:helpKey}),ok(b,`/guild/requests/${req.requestId}/help`,{key:helpKey})]);assert.equal((await me(b)).player.hearts,heartBefore);assert.equal((await request(b,`/guild/requests/${req.requestId}/help`,{key:key()})).status,409);const gifts=(await ok<{gifts:Gift[]}>(a,'/gifts')).gifts;assert.equal(gifts.filter(g=>g.kind==='heart').reduce((sum,g)=>sum+g.quantity,0),1);check('heart support sends one gift without spending donor play hearts');
 const failed=await ok<RunResponse>(a,'/runs/start',{key:key(),preBoosters:[]});await ok(a,`/runs/${failed.run.id}/abandon`,{key:key()});assert.equal((await me(a)).player.hearts,4);check('giving up consumes one heart and opens capacity for a gift');
 const received=await ok<{player:Player}>(a,`/gifts/${gifts[0].id}/claim`,{key:key()});assert.equal(received.player.hearts,5);check('gift claim consumes only the delivered gift');
 const bonusKey=key();const bonus=await Promise.all([ok<{player:Player}>(a,'/hearts/free',{key:bonusKey}),ok<{player:Player}>(a,'/hearts/free',{key:bonusKey})]);assert.equal(bonus[0].player.unlimitedUntil,bonus[1].player.unlimitedUntil);const cooldown=await request(a,'/hearts/free',{key:key()});assert.equal(cooldown.status,409);assert.ok(bonus[0].player.freeClaimAt-Date.now()>14_390_000);check('free 30-minute claim is idempotent; cooldown starts at acceptance');
 const unlimited=await ok<RunResponse>(a,'/runs/start',{key:key(),preBoosters:[]});assert.equal(unlimited.run.heartSpent,false);assert.equal(unlimited.player.hearts,5);await ok(a,`/runs/${unlimited.run.id}/abandon`,{key:key()});check('unlimited start does not spend or refund hearts');
 const itemReq=await ok<{requestId:string}>(a,'/guild/requests',{key:key(),kind:'hammer'});await ok(b,`/guild/requests/${itemReq.requestId}/help`,{key:key()});assert.equal((await me(b)).player.inventory.hammer.normal,1);const itemGift=(await ok<{gifts:Gift[]}>(a,'/gifts')).gifts.find(g=>g.kind==='hammer')!;await ok(a,`/gifts/${itemGift.id}/claim`,{key:key()});assert.equal((await me(a)).player.inventory.hammer.normal,3);check('item support atomically transfers real non-bound inventory');
 await ok(a,'/guild/chat',{key:key(),text:'함께 정원을 가꾸어요.'});const view=await ok<{messages:Array<{text:string}>}>(b,'/guild');assert.equal(view.messages.at(-1)?.text,'함께 정원을 가꾸어요.');check('guild chat persists for the second account');
 const old=(await me(a)).player.coins;const dailyKey=key();await Promise.all([ok(a,'/events/daily',{key:dailyKey}),ok(a,'/events/daily',{key:dailyKey})]);assert.equal((await me(a)).player.coins,old+50);assert.equal((await request(a,'/events/daily',{key:key()})).status,409);check('daily reward duplicate and race protection');
 assert.equal((await request(a,'/ads/reward-intents',{key:key(),placement:'heart'})).status,503);assert.equal((await request(a,'/purchases/verify',{provider:'google',productId:'garden.coins.1000',token:'fake'})).status,503);check('unconfigured ads and purchases fail closed without minting currency');
 await ok(b,'/account',{confirmation:'DELETE'},'DELETE');assert.equal((await request(b,'/me')).status,401);check('account deletion revokes the session');
 const loggedOut=await newUser();await ok(loggedOut,'/auth/logout',{});assert.equal((await request(loggedOut,'/me')).status,401);assert.equal((await request(null,'/auth/refresh',{refreshToken:loggedOut.refreshToken})).status,401);check('logout revokes the current access and refresh session');
 await mkdir('output/verification',{recursive:true});await writeFile('output/verification/api-integration.json',JSON.stringify({at:new Date().toISOString(),environment:'local Wrangler + real local D1',checks,passed:checks.length},null,2));
 console.log(`PASS ${checks.length} integration checks`);
}catch(error){await mkdir('output/verification',{recursive:true});await writeFile('output/verification/api-integration.json',JSON.stringify({at:new Date().toISOString(),checks,error:String(error)},null,2));throw error;}
