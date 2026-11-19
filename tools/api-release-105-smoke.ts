import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile,unlink} from 'node:fs/promises';
import {ENGINE_VERSION,SUPPORTED_ENGINE_VERSIONS,type Action,type AuthResponse,type Envelope,type LevelPreview,type Player,type Run} from '@garden/contracts';
import {createGame,replay,stateHash} from '@garden/core';
import {GARDEN_STAGE_VARIANTS} from '../packages/content/src/garden-stage-candidates';
import gardenProofs from '../packages/content/src/garden-stage-proofs-v2.json';
import campaignProofs from '../packages/content/src/campaign-solutions.json';
import deployment from '../config/deployment.json';
import {solve} from './level-validation/validate';

// Disposable QA guests only. No installed sessions, balance seeding, direct DB
// writes or paid purchases. The private checkpoint is never included in reports.
const checkpoint='.wrangler/retry-garden-v33-smoke-session.json',out='output/verification/retry-garden-v33';
const calls:Array<Record<string,unknown>>=[],checks:string[]=[],users:AuthResponse[]=[];
const key=()=>crypto.randomUUID(),record=(name:string)=>{checks.push(name);console.log('PASS '+name);};
async function call<T>(user:AuthResponse|null,path:string,body?:unknown,method=body===undefined?'GET':'POST'):Promise<T>{
 const at=performance.now(),res=await fetch(deployment.apiUrl+path,{method,signal:AbortSignal.timeout(30000),headers:{'Content-Type':'application/json',Origin:'capacitor://localhost',...(user?{Authorization:'Bearer '+user.accessToken}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});
 const envelope=await res.json() as Envelope<T>&{error?:{code:string;message:string}};
 calls.push({path,method,status:res.status,ms:Math.round(performance.now()-at),...(envelope.error?{code:envelope.error.code}:{})});
 if(!res.ok||envelope.error)throw Error(path+': '+(envelope.error?.code??res.status));return envelope.data;
}
async function guest(){const user=await call<AuthResponse>(null,'/auth/guest',{});users.push(user);return user;}
async function clear(user:AuthResponse,run:Run,actions:Action[]){
 const expected=replay(run.level,actions);assert.equal(expected.accepted,true);assert.equal(expected.state.status,'won');
 const solved=await call<{run:Run}>(user,`/runs/${run.id}/actions`,{key:key(),sequence:run.sequence,actions});assert.equal(stateHash(solved.run.state),stateHash(expected.state));
 const body={key:key()},finished=await call<{player:Player}>(user,`/runs/${run.id}/finish`,body);assert.equal(finished.player.hearts,5);
 assert.deepEqual(await call(user,`/runs/${run.id}/finish`,body),finished);return finished.player;
}
await mkdir(out,{recursive:true});await mkdir('.wrangler',{recursive:true});
if(process.argv.includes('--prepare')){
 const health=await call<{engineVersion:string}>(null,'/health');assert.equal(health.engineVersion,'1.3.0');
 const user=await guest(),started=await call<{run:Run}>(user,'/runs/start',{key:key(),engineVersion:'1.6.0',preBoosters:[]});
 await writeFile(checkpoint,JSON.stringify({user,run:started.run}),{mode:0o600});
 await writeFile(out+'/legacy-before.json',JSON.stringify({at:new Date().toISOString(),engineVersion:started.run.level.engineVersion,stateHash:stateHash(started.run.state),saved:true},null,2)+'\n');
 console.log('Prepared a disposable legacy run for deployment continuity. Credentials remain private.');
}else{
 let passed=false,failure:string|undefined,cleaned=0;
 try{
  const old=JSON.parse(await readFile(checkpoint,'utf8')) as {user:AuthResponse;run:Run};users.push(old.user);
  const health=await call<{engineVersion:string;latestEngineVersion:string;supportedEngineVersions:string[]}>(null,'/health');
  assert.equal(health.engineVersion,'1.3.0');assert.equal(health.latestEngineVersion,ENGINE_VERSION);assert.deepEqual(health.supportedEngineVersions,[...SUPPORTED_ENGINE_VERSIONS]);
  record('Production retains legacy health semantics and advertises all supported rules separately');
  const loaded=await call<{activeRun:Run|null}>(old.user,'/me');assert.deepEqual(loaded.activeRun,old.run);
  const resumed=await call<{run:Run}>(old.user,'/runs/start',{key:key(),engineVersion:'1.6.0',preBoosters:[]});assert.deepEqual(resumed.run,old.run);
  await clear(old.user,resumed.run,(campaignProofs as Record<string,{actions:Action[]}>)[String(old.run.level.id)]!.actions);
  record('A pre-deployment 1.6 run resumes with identical state and clears without heart loss');
  const user=await guest();let player=user.player;
  const catalog=await call<{restorations:unknown[]}>(user,'/catalog');assert.equal(catalog.restorations.length,63);
  for(let id=1;id<=20;id++){
   const preview=await call<LevelPreview>(user,'/levels/next?engineVersion='+ENGINE_VERSION);assert.equal(preview.level.id,id);
   const body={key:key(),engineVersion:ENGINE_VERSION,supportedEngineVersions:SUPPORTED_ENGINE_VERSIONS,levelHash:preview.levelHash,preBoosters:[]};
   const started=await call<{run:Run;player:Player}>(user,'/runs/start',body);assert.deepEqual(started.run.level,preview.level);assert.equal(started.player.hearts,5);
   assert.equal(stateHash(started.run.state),stateHash(createGame(preview.level)));assert.deepEqual(await call(user,'/runs/start',body),started);
   const stage=preview.level.gardenStage,variant=Math.floor((id-10)/20)%GARDEN_STAGE_VARIANTS;
   let actions=stage?gardenProofs.find(p=>p.kind===stage.kind&&p.variant===variant)!.actions as Action[]:(campaignProofs as Record<string,{actions:Action[]}>)[String(id)]!.actions;
   const result=replay(preview.level,actions);if(!result.accepted||result.state.status!=='won'){let proof=solve(preview.level);if(proof.status!=='won')proof=solve(preview.level,'special');actions=proof.actions;}
   player=await clear(user,started.run,actions);
   if(id===5){const start={key:key()},festival=await call(user,'/power-festival/start',start);assert.deepEqual(await call(user,'/power-festival/start',start),festival);}
   if(id%5===0)console.log('Verified latest production rules through level '+id);
  }
  assert.equal(player.level,21);assert.equal(player.inventory['world-bomb'].bound,2);
  const state=await call<{activeRun:Run|null;player:Player}>(user,'/me');assert.equal(state.activeRun,null);assert.equal(state.player.hearts,5);
  const world=await call<{land:{cost:number;tiles:number}}>(user,'/garden/world');assert.deepEqual(world.land,{cost:1000,tiles:20});
  await call(user,'/story');await call(user,'/progression');await call(user,'/events');
  record('Twenty downloaded production puzzles including water and animal stages replay identically; start/finish retries and ten-clear rewards are exact');
  record('Garden land pricing, story, events, progression and idempotent festival activation respond correctly');
  const preview=await call<LevelPreview>(user,'/levels/next?engineVersion='+ENGINE_VERSION),randomBody={key:key(),randomStart:true,engineVersion:ENGINE_VERSION,levelHash:preview.levelHash,preBoosters:[]};
  const first=await call<{run:Run;player:Player}>(user,'/runs/start',randomBody);assert.notEqual(first.run.level.seed,preview.level.seed);assert.equal(stateHash(first.run.state),stateHash(createGame(first.run.level)));
  assert.deepEqual(await call(user,'/runs/start',randomBody),first);
  assert.deepEqual((await call<{run:Run}>(user,'/runs/start',{...randomBody,key:key()})).run,first.run);
  assert.deepEqual((await call<{activeRun:Run}>(user,'/me')).activeRun,first.run);
  const abandoned=await call<{player:Player}>(user,'/runs/'+first.run.id+'/abandon',{key:key()});assert.equal(abandoned.player.hearts,4);
  const second=await call<{run:Run}>(user,'/runs/start',{...randomBody,key:key()});assert.notEqual(first.run.level.seed,second.run.level.seed);assert.notDeepEqual(first.run.level.initial,second.run.level.initial);assert.equal(stateHash(second.run.state),stateHash(createGame(second.run.level)));
  record('Production fresh attempts vary their layouts; idempotent start retry and active resume retain exact state, while abandoning charges one heart');passed=true;
 }catch(error){failure=error instanceof Error?error.message:String(error);}
 finally{
  for(const user of users)try{await call(user,'/account',{confirmation:'DELETE'},'DELETE');cleaned++;}catch(error){failure??='Disposable QA guest cleanup failed: '+String(error);}
  if(cleaned===users.length)await unlink(checkpoint).catch(()=>{});
  const report={at:new Date().toISOString(),base:deployment.apiUrl,passed:passed&&!failure&&cleaned===users.length,createdGuests:users.length,cleanedGuests:cleaned,checks,calls,...(failure?{failure}:{})};
  await writeFile(out+'/production.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({passed:report.passed,cleanedGuests:cleaned,checks,...(failure?{failure}:{})}));
 }
 if(failure)throw Error(failure);
}
