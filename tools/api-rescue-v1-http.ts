import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {unstable_dev} from 'wrangler';
import type {Action,AuthResponse,Envelope,Player,Run,StateResponse,StoryState} from '@garden/contracts';
import {ENGINE_VERSION} from '@garden/contracts';
import {bridgeLevel} from '@garden/content';
import {replay,stateHash,createGame} from '@garden/core';
import {solve} from './level-validation/validate';
const dir=await mkdtemp(join(tmpdir(),'garden-rescue-http-')),checks:string[]=[];
const migration=spawnSync(process.execPath,['node_modules/wrangler/bin/wrangler.js','d1','migrations','apply','cloud-garden','--local','--config','apps/api/wrangler.jsonc','--persist-to',dir],{encoding:'utf8',env:{...process.env,WRANGLER_LOG_PATH:dir+'/migrate.log'}});
assert.equal(migration.status,0,migration.stderr||migration.stdout);
const worker=await unstable_dev('apps/api/src/index.ts',{config:'apps/api/wrangler.jsonc',local:true,persist:true,persistTo:dir,port:8796,inspectorPort:0,inspect:false,logLevel:'error',experimental:{disableExperimentalWarning:true,disableDevRegistry:true,watch:false}});
async function req<T>(user:AuthResponse|null,path:string,body?:unknown){const response=await fetch(`http://127.0.0.1:${worker.port}/api`+path,{method:body===undefined?'GET':'POST',headers:{'Content-Type':'application/json',...(user?{Authorization:'Bearer '+user.accessToken}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});return {status:response.status,...await response.json() as Envelope<T>&{error?:{code:string}}};}
async function ok<T>(user:AuthResponse|null,path:string,body?:unknown){const r=await req<T>(user,path,body);assert.equal(r.status,200,JSON.stringify({path,error:r.error}));return r.data;}
const mark=(name:string)=>{checks.push(name);console.log('PASS '+name);};
try{
 const a=await ok<AuthResponse>(null,'/auth/guest',{}),b=await ok<AuthResponse>(null,'/auth/guest',{});
 const proof=solve(bridgeLevel());assert.equal(proof.status,'won');const win=replay(bridgeLevel(),proof.actions);assert.equal(win.state.status,'won');
 assert.equal((await req(null,'/story/episodes/bridge-v1/complete',{actions:proof.actions})).status,401);
 assert.equal((await req(b,'/story/episodes/bridge-v1/complete',{actions:proof.actions})).error?.code,'EPISODE_LOCKED');mark('auth and seven-clear unlock enforced before completion');
 const logs=JSON.parse(await readFile('packages/content/src/solutions.json','utf8')) as Record<string,{actions:Action[]}>;
 for(let i=1;i<=7;i++){if(i===5)await ok(a,'/hearts/free',{key:crypto.randomUUID()});const {run}=await ok<{run:Run}>(a,'/runs/start',{key:crypto.randomUUID(),engineVersion:ENGINE_VERSION});assert.equal(run.state.engineVersion,'1.1.0');const result=await ok<{run:Run}>(a,`/runs/${run.id}/actions`,{key:crypto.randomUUID(),sequence:0,actions:logs[i]!.actions});assert.equal(result.run.state.status,'won');await ok(a,`/runs/${run.id}/finish`,{key:crypto.randomUUID()});}
 const {run}=await ok<{run:Run}>(a,'/runs/start',{key:crypto.randomUUID(),engineVersion:ENGINE_VERSION});assert.equal(run.level.id,8);
 const baseline=await ok<StateResponse>(a,'/me');
 for(const body of [{actions:[]},{actions:[{type:'booster',item:'hammer',at:43}]},{actions:proof.actions,coins:999},{actions:[{type:'swap',from:0,to:48}]}])assert.notEqual((await req(a,'/story/episodes/bridge-v1/complete',body)).status,200);
 assert.equal((await req(a,'/story/seen',{sceneIds:['rescue:bridge-v1']})).status,404);assert.deepEqual(await ok<StateResponse>(a,'/me'),baseline);mark('forged, incomplete, paid-booster and ordinary-seen shortcuts rejected without economic changes');
 const results=await Promise.all([ok<StoryState>(a,'/story/episodes/bridge-v1/complete',{actions:proof.actions}),ok<StoryState>(a,'/story/episodes/bridge-v1/complete',{actions:proof.actions})]);for(const r of results)assert.deepEqual(r.completedEpisodes,['bridge-v1']);assert.deepEqual(await ok<StateResponse>(a,'/me'),baseline);assert.equal((await ok<StoryState>(b,'/story')).completedEpisodes,undefined);mark('duplicate/concurrent valid replays persist completion per account; Player and live normal run unchanged');
 assert.equal((await req(a,'/runs/start',{key:crypto.randomUUID()})).error?.code,'UPDATE_REQUIRED');assert.deepEqual(await ok<StateResponse>(a,'/me'),baseline);mark('old clients cannot accidentally resume a new engine run or spend another heart');
 const old=await ok<{run:Run}>(b,'/runs/start',{key:crypto.randomUUID()});assert.equal(old.run.state.engineVersion,'1.0.0');mark('clients without new-engine negotiation continue on archived v1 content');
 await writeFile('output/rescue-v1/api-http.json',JSON.stringify({scope:'Actual isolated workerd/D1 HTTP, temporary persisted DB, no existing user sessions or DB touched',checks,bridgeProof:proof,normalRunPreserved:stateHash(baseline.activeRun!.state),passed:true},null,2));
 if(process.argv.includes('--serve')){console.log('QA_API_READY http://127.0.0.1:'+worker.port);await new Promise(resolve=>process.stdin.once('data',resolve));}
}finally{await worker.stop();}
