import assert from 'node:assert/strict';
import {readFile,writeFile,unlink,mkdir} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {ENGINE_VERSION,SUPPORTED_ENGINE_VERSIONS,type AuthResponse,type Envelope,type Player,type Run,type LevelPreview,type Action} from '@garden/contracts';
import {createGame,replay,stateHash} from '@garden/core';
import {publishedLevel} from '../apps/api/src/level-content';
import {progressionLayout,PROGRESSIVE_CONTENT_VERSION} from '../packages/content/src/progressive';
import proofsJson from '../packages/content/src/progressive-proofs.json';
import {solve} from './level-validation/validate';
import deployment from '../config/deployment.json';

// Exactly one freshly created disposable QA guest. No installed user sessions,
// currency seeding, real purchases or changes to any existing player's data.
const out='output/verification/progression-v37',checkpoint='.wrangler/progression-v37-qa.json';
assert.equal(deployment.apiUrl,'https://puzzle-mobile.ddr1323.workers.dev/api');
const calls:Array<Record<string,unknown>>=[],checks:string[]=[];
type Session={purpose:'progression-v37-disposable-qa';createdAt:string;user:AuthResponse;run:Run};
let user:AuthResponse|undefined;
async function request<T>(path:string,body?:unknown,method=body===undefined?'GET':'POST'){
 const start=performance.now(),response=await fetch(deployment.apiUrl+path,{method,signal:AbortSignal.timeout(30000),headers:{'Content-Type':'application/json',Origin:'capacitor://localhost',...(user?{Authorization:'Bearer '+user.accessToken}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});
 const packet=await response.json() as Envelope<T>&{error?:{code:string}};
 calls.push({path,status:response.status,ms:Math.round(performance.now()-start),...(packet.error?{code:packet.error.code}:{})});
 if(!response.ok||packet.error)throw Error(path+': '+(packet.error?.code??response.status));return packet.data;
}
const key=()=>crypto.randomUUID(),pass=(name:string)=>{checks.push(name);console.log('PASS '+name);};
async function setGuestLevel(id:number){
 assert(user);assert.match(user.player.id,/^[0-9a-f-]{36}$/i);
 const current=await request<{player:Player;activeRun:Run|null}>('/me');assert.equal(current.activeRun,null);
 // Guard identity and the exact current level. This can affect only this new QA guest.
 const sql=`UPDATE players SET data=json_set(data,'$.level',${id}) WHERE id='${user.player.id}' AND json_extract(data,'$.id')='${user.player.id}' AND json_extract(data,'$.level')=${current.player.level};`;
 const result=spawnSync('node_modules/.bin/wrangler',['d1','execute','puzzle-mobile-db','--config','wrangler.jsonc','--remote','--command',sql,'--json'],{encoding:'utf8',maxBuffer:4_000_000,env:{...process.env,WRANGLER_SEND_METRICS:'false',WRANGLER_LOG_PATH:out+'/wrangler-logs'}});
 if(result.status!==0)throw Error('Disposable QA level update failed: '+result.status);
 const json=result.stdout.match(/\[\s*\{[\s\S]*\]\s*$/)?.[0];assert(json,'D1 returned no result array');
 const replies=JSON.parse(json);assert.equal(replies.reduce((n:number,r:{meta?:{changes?:number}})=>n+(r.meta?.changes??0),0),1);
 assert.equal((await request<{player:Player}>('/me')).player.level,id);
}
async function clear(run:Run,actions:Action[]){
 const expected=replay(run.level,actions);assert.equal(expected.accepted,true);assert.equal(expected.state.status,'won');
 const applied=await request<{run:Run}>(`/runs/${run.id}/actions`,{key:key(),sequence:run.sequence,actions});assert.equal(stateHash(applied.run.state),stateHash(expected.state));
 const finish={key:key()},completed=await request<{player:Player;run:Run}>(`/runs/${run.id}/finish`,finish);assert.equal(completed.player.hearts,5);
 assert.deepEqual(await request(`/runs/${run.id}/finish`,finish),completed);
 return completed;
}
await mkdir(out,{recursive:true});await mkdir('.wrangler',{recursive:true});
if(process.argv.includes('--prepare')){
 const health=await request<{latestEngineVersion:string;supportedEngineVersions:string[]}>('/health');
 const pending=await readFile(checkpoint,'utf8').then(JSON.parse).catch(()=>null) as Partial<Session>|null;
 if(pending){assert.equal(pending.purpose,'progression-v37-disposable-qa');assert(Date.now()-Date.parse(pending.createdAt!)<86400000);assert(pending.user);user=pending.user;}
 else user=await request<AuthResponse>('/auth/guest',{});
 const engine=health.supportedEngineVersions.includes(ENGINE_VERSION)?ENGINE_VERSION:health.latestEngineVersion;
 // Persist credentials privately before making the fixture so an interrupted
 // preparation can still clean up only this newly created account.
 await writeFile(checkpoint,JSON.stringify({purpose:'progression-v37-disposable-qa',createdAt:new Date().toISOString(),user}),{mode:0o600});
 await setGuestLevel(31);
 const preview=await request<LevelPreview>('/levels/next?engineVersion='+engine),started=await request<{run:Run}>('/runs/start',{key:key(),engineVersion:engine,levelHash:preview.levelHash,preBoosters:[]});
 const session:Session={purpose:'progression-v37-disposable-qa',createdAt:new Date().toISOString(),user,run:started.run};await writeFile(checkpoint,JSON.stringify(session),{mode:0o600});
 await writeFile(out+'/before-deployment.json',JSON.stringify({engine,version:started.run.level.version,moves:started.run.level.moves,stateHash:stateHash(started.run.state),saved:true},null,2));
 console.log('Prepared one disposable pre-deployment run; credentials remain private.');
}else{
 const session=JSON.parse(await readFile(checkpoint,'utf8')) as Session;assert.equal(session.purpose,'progression-v37-disposable-qa');assert(Date.now()-Date.parse(session.createdAt)<86400000);user=session.user;
 let passed=false,cleaned=false,failure:string|undefined;
 try{
  const health=await request<{latestEngineVersion:string;supportedEngineVersions:string[]}>('/health');assert.equal(health.latestEngineVersion,ENGINE_VERSION);assert.deepEqual(health.supportedEngineVersions,[...SUPPORTED_ENGINE_VERSIONS]);
  assert.deepEqual((await request<{activeRun:Run}>('/me')).activeRun,session.run);
  assert.deepEqual((await request<{run:Run}>('/runs/start',{key:key(),engineVersion:ENGINE_VERSION,supportedEngineVersions:SUPPORTED_ENGINE_VERSIONS,preBoosters:[]})).run,session.run);
  const solution=solve(session.run.level);assert.equal(solution.status,'won');await clear(session.run,solution.actions);pass('Pre-deployment run resumes unchanged and clears with identical local/server replay');
  const proofs=proofsJson as Record<string,{actions:Action[]}>;
  for(const id of [31,104,204,404,708]){
   await setGuestLevel(id);const preview=await request<LevelPreview>('/levels/next?engineVersion='+ENGINE_VERSION);
   assert.equal(preview.contentVersion,PROGRESSIVE_CONTENT_VERSION);assert.deepEqual(preview.level,publishedLevel(id,ENGINE_VERSION));
   const body={key:key(),engineVersion:ENGINE_VERSION,supportedEngineVersions:SUPPORTED_ENGINE_VERSIONS,preBoosters:[],levelHash:preview.levelHash},started=await request<{run:Run}>('/runs/start',body);
   assert.deepEqual(started.run.level,preview.level);assert.equal(stateHash(started.run.state),stateHash(createGame(preview.level)));assert.deepEqual(await request('/runs/start',body),started);
   const profile=progressionLayout(id,preview.level.campaign!.beat),proof=proofs[id<=100?'early/'+id:profile!.key]!;await clear(started.run,proof.actions);
   pass('Production level '+id+' downloads, starts and clears; start/finish retries are exact');
  }
  await setGuestLevel(31);const retained=await request<LevelPreview>('/levels/next?engineVersion=1.7.0');assert.deepEqual(retained.level,publishedLevel(31,'1.7.0'));assert.notEqual(retained.level.version,PROGRESSIVE_CONTENT_VERSION);pass('Older 1.7 clients retain their published map data');passed=true;
 }catch(error){failure=error instanceof Error?error.message:String(error);}
 finally{
  try{await request('/account',{confirmation:'DELETE'},'DELETE');cleaned=true;await unlink(checkpoint);}catch(error){failure??='QA guest cleanup: '+String(error);}
  await unlink(out+'/disposable-guest-level.sql').catch(()=>{});
  const report={at:new Date().toISOString(),base:deployment.apiUrl,passed:passed&&cleaned&&!failure,disposableGuestCleaned:cleaned,scope:'Production Worker; exact guarded level fixture on one freshly created QA guest',checks,calls,...(failure?{failure}:{})};
  await writeFile(out+'/production.json',JSON.stringify(report,null,2));console.log(JSON.stringify({passed:report.passed,cleaned,checks,...(failure?{failure}:{})}));
 }
 if(failure)throw Error(failure);
}
