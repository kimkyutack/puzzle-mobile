import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import type {Action,AuthResponse,DailyRescueResult,Envelope,Player,Run,StoryState} from '@garden/contracts';
import {ENGINE_VERSION,SCULPTED_ENGINE_VERSION} from '@garden/contracts';
import {RESTORATIONS,bridgeDailyWindow,getLevel} from '@garden/content';
import {createGame,replay,stateHash} from '@garden/core';
import {gardenExpansionOptions,gardenLandCells,type GardenWorldState} from '../packages/garden-world/src';
import deployment from '../config/deployment.json';
import rescueProof from '../tests/fixtures/daily-rescue-proof.json';

// Only fresh disposable guests, public API calls and certified puzzle solutions.
// No installed sessions, direct production DB writes, purchases or seeded balances.
const base=deployment.apiUrl,users:AuthResponse[]=[],checks:string[]=[],calls:Array<Record<string,unknown>>=[];
const key=()=>crypto.randomUUID(),record=(name:string)=>{checks.push(name);console.log('PASS '+name);};
const campaignProofs=JSON.parse(await readFile('packages/content/src/campaign-solutions.json','utf8')) as Record<string,{actions:Action[]}>;
const legacyProofs=JSON.parse(await readFile('packages/content/src/legacy-solutions-v12.json','utf8')) as Record<string,{actions:Action[]}>;
let passed=false,failure:string|undefined,cleaned=0;
async function call<T>(user:AuthResponse|null,path:string,body?:unknown,method=body===undefined?'GET':'POST'):Promise<T>{
 const at=performance.now(),response=await fetch(base+path,{method,signal:AbortSignal.timeout(30000),headers:{'Content-Type':'application/json',Origin:'capacitor://localhost',...(user?{Authorization:'Bearer '+user.accessToken}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});
 const result=await response.json() as Envelope<T>&{error?:{code:string;message:string}};
 calls.push({path,method,status:response.status,ms:Math.round(performance.now()-at),...(result.error?{code:result.error.code}:{})});
 if(!response.ok||result.error)throw Object.assign(new Error(path+': '+(result.error?.message||'HTTP '+response.status)),{code:result.error?.code});
 return result.data;
}
async function guest(){const user=await call<AuthResponse>(null,'/auth/guest',{});users.push(user);return user;}
async function clear(user:AuthResponse,run:Run,actions:Action[]){
 const expected=replay(run.level,actions);assert.equal(expected.state.status,'won');
 const solved=await call<{run:Run}>(user,'/runs/'+run.id+'/actions',{key:key(),sequence:run.sequence,actions});
 assert.equal(stateHash(solved.run.state),stateHash(expected.state));
 const body={key:key()},finished=await call<{player:Player}>(user,'/runs/'+run.id+'/finish',body);
 assert.equal(finished.player.hearts,5);
 assert.deepEqual(await call(user,'/runs/'+run.id+'/finish',body),finished);
 return finished.player;
}
try{
 let old:{user:AuthResponse;run:Run}|undefined;
 if(process.argv.includes('--across-deploy')){
  assert.equal((await call<{engineVersion:string}>(null,'/health')).engineVersion,SCULPTED_ENGINE_VERSION);
  const user=await guest(),started=await call<{run:Run}>(user,'/runs/start',{key:key(),engineVersion:SCULPTED_ENGINE_VERSION,preBoosters:[]});
  old={user,run:started.run};
  console.log('PREPARED: a legacy 1.2.0 run is saved in production. Press Enter after deploying the new Worker.');
  await new Promise<void>(resolve=>{process.stdin.resume();process.stdin.once('data',()=>{process.stdin.pause();resolve();});});
 }
 assert.equal((await call<{ok:boolean;engineVersion:string}>(null,'/health')).engineVersion,ENGINE_VERSION);
 record('Production advertises the new engine '+ENGINE_VERSION);
 if(old){
  const loaded=await call<{player:Player;activeRun:Run|null}>(old.user,'/me');assert.deepEqual(loaded.activeRun,old.run);
  const resumed=await call<{run:Run}>(old.user,'/runs/start',{key:key(),engineVersion:SCULPTED_ENGINE_VERSION,preBoosters:[]});assert.deepEqual(resumed.run,old.run);
  await clear(old.user,resumed.run,legacyProofs['1']!.actions);
  record('A legacy run saved before deployment resumes and clears afterward with identical state and no heart loss');
 }
 const user=await guest();
 const catalog=await call<{restorations:Array<{id:string}>}>(user,'/catalog');assert.deepEqual(catalog.restorations.map(t=>t.id),RESTORATIONS.map(t=>t.id));assert.equal(catalog.restorations.length,63);
 let player=user.player;
 for(let id=1;id<=20;id++){
  const body={key:key(),engineVersion:ENGINE_VERSION,preBoosters:[]},started=await call<{run:Run;player:Player}>(user,'/runs/start',body);
  assert.equal(started.run.level.id,id);assert.deepEqual(started.run.level,getLevel(id,ENGINE_VERSION));
  assert.equal(stateHash(started.run.state),stateHash(createGame(started.run.level)));assert.equal(started.player.hearts,5);
  assert.deepEqual(await call(user,'/runs/start',body),started);
  player=await clear(user,started.run,campaignProofs[String(id)]!.actions);
  if(id%5===0)console.log('Verified new-engine clears through level '+id);
 }
 assert.equal(player.level,21);assert.equal(player.inventory['world-bomb'].bound,2);
 record('Twenty new-engine puzzles match local boards and certified replays; start/finish retries and ten-clear milestone rewards are exact');
 for(const task of RESTORATIONS.slice(0,3)){
  const before=player.stars,body={key:key(),taskId:task.id};
  const restored=await call<{world:GardenWorldState;player:Player}>(user,'/garden/restore',body);player=restored.player;
  assert.equal(player.stars,before-task.cost);assert(restored.world.owned['restored-'+task.id]);
  assert.deepEqual(await call(user,'/garden/restore',body),restored);
  assert.deepEqual((await call<{world:GardenWorldState}>(user,'/garden/world')).world,restored.world);
 }
 const story=await call<StoryState>(user,'/story');assert(story.unlocked.length>=4);
 const seen=await call<StoryState>(user,'/story/seen',{sceneIds:story.unlocked});assert.deepEqual(seen.seen,story.unlocked);
 record('The 63-job catalog, atomic restoration response and story acknowledgement work against the production database');
 const initial=await call<{world:GardenWorldState;land:{cost:number;tiles:number}}>(user,'/garden/world');assert.deepEqual(initial.land,{cost:1000,tiles:20});
 const plot=gardenExpansionOptions(initial.world)[0]!,before=player.coins+player.boundCoins,body={key:key(),plotId:plot.id,expectedRevision:initial.world.revision};
 const expanded=await call<{world:GardenWorldState;player:Player;cellsAdded:number}>(user,'/garden/world/expand',body);player=expanded.player;
 assert.equal(player.coins+player.boundCoins,before-1000);assert.equal(expanded.cellsAdded,20);assert.equal(gardenLandCells(expanded.world).size,gardenLandCells(initial.world).size+20);
 assert.deepEqual(await call(user,'/garden/world/expand',body),expanded);
 const bought=await call<{world:GardenWorldState;instanceId:string}>(user,'/garden/shop/buy',{key:key(),itemId:'garden-path-stone'});
 const placed=await call<{world:GardenWorldState}>(user,'/garden/world/commands',{key:key(),type:'place',instanceId:bought.instanceId,x:plot.x,y:plot.y,rotation:270,expectedRevision:bought.world.revision});
 assert.deepEqual((await call<{world:GardenWorldState}>(user,'/garden/world')).world,placed.world);
 record('The fixed 1000-coin twenty-cell expansion and rotated decoration placement remain saved and idempotent');
 const dailyBody={periodId:bridgeDailyWindow(Date.now()).periodId,actions:rescueProof};
 const rescued=await call<DailyRescueResult>(user,'/story/episodes/bridge-v1/complete',dailyBody);assert.equal(rescued.dailyRescue.claimed,true);
 assert.deepEqual(await call(user,'/story/episodes/bridge-v1/complete',dailyBody),rescued);
 const attendance=await call<{player:Player;attendance?:unknown}>(user,'/events/daily',{key:key()});assert.equal(attendance.player.hearts,5);
 const after=await call<{player:Player;activeRun:Run|null}>(user,'/me');assert.equal(after.player.level,21);assert.equal(after.player.hearts,5);assert.equal(after.activeRun,null);
 record('Daily rescue retries grant one reward, attendance claims succeed, and successful play preserves all five hearts');
 passed=true;
}catch(error){failure=error instanceof Error?error.message:String(error);}finally{
 for(const user of users)try{await call(user,'/account',{confirmation:'DELETE'},'DELETE');cleaned++;}catch(error){failure??='Disposable guest cleanup failed: '+String(error);}
 const report={at:new Date().toISOString(),base,passed:passed&&!failure&&cleaned===users.length,createdGuests:users.length,cleanedGuests:cleaned,checks,calls,...(failure?{failure}:{})};
 await mkdir('output/verification/release-104-5',{recursive:true});await writeFile('output/verification/release-104-5/production.json',JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({passed:report.passed,cleanedGuests:cleaned,checks,...(failure?{failure}:{})}));
}
if(failure)throw new Error(failure);
