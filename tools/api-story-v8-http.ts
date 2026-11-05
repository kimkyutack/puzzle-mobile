import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile,readdir,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {unstable_dev,type Unstable_DevWorker} from 'wrangler';
import type {Action,AuthResponse,Envelope,Player,Run,StateResponse,StoryState} from '@garden/contracts';
import {STORY_SCENES} from '@garden/content';
import solutions from '../packages/content/src/solutions.json';

const checks:string[]=[];
const record=(name:string)=>{checks.push(name);console.log('PASS '+name);};
const id=()=>crypto.randomUUID();
await mkdir('.wrangler',{recursive:true});await mkdir('output/verification',{recursive:true});
const statePath=resolve(await mkdtemp('.wrangler/story-v8-http-'));
let worker:Unstable_DevWorker|undefined,deletedUserId='';
const migration=spawnSync(process.execPath,['node_modules/wrangler/bin/wrangler.js','d1','migrations','apply','cloud-garden','--local','--config','apps/api/wrangler.jsonc','--persist-to',statePath],{encoding:'utf8',env:{...process.env,WRANGLER_LOG_PATH:statePath+'/migration.log'}});
assert.equal(migration.status,0,migration.stderr||migration.stdout);
async function boot(){await worker?.stop();worker=await unstable_dev('apps/api/src/index.ts',{config:'apps/api/wrangler.jsonc',local:true,persist:true,persistTo:statePath,port:8794,inspectorPort:0,inspect:false,logLevel:'error',experimental:{disableExperimentalWarning:true,disableDevRegistry:true,watch:false}});}
async function request<T>(user:AuthResponse|null,path:string,body?:unknown,method=body===undefined?'GET':'POST'){
 const response=await fetch(`http://127.0.0.1:${worker!.port}/api`+path,{method,headers:{'Content-Type':'application/json',...(user?{Authorization:'Bearer '+user.accessToken}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});
 const result=await response.json() as Envelope<T>&{error?:{code:string;message:string}};
 return {status:response.status,data:result.data,error:result.error};
}
async function ok<T>(user:AuthResponse|null,path:string,body?:unknown,method?:string){const result=await request<T>(user,path,body,method);assert.equal(result.status,200,`${path} ${JSON.stringify(result.error)}`);return result.data;}
const me=(user:AuthResponse)=>ok<StateResponse>(user,'/me');
const story=(user:AuthResponse)=>ok<StoryState>(user,'/story');
async function clear(user:AuthResponse){
 const {run}=await ok<{run:Run}>(user,'/runs/start',{key:id()});
 const win=await ok<{run:Run}>(user,`/runs/${run.id}/actions`,{key:id(),sequence:0,actions:(solutions as Record<string,{actions:Action[]}>)[run.level.id]!.actions});
 assert.equal(win.run.state.status,'won');await ok(user,`/runs/${run.id}/finish`,{key:id()});
}
async function findFiles(path:string):Promise<string[]>{const found:string[]=[];for(const entry of await readdir(path,{withFileTypes:true})){const name=join(path,entry.name);if(entry.isDirectory())found.push(...await findFiles(name));else if(name.endsWith('.sqlite'))found.push(name);}return found;}
try{
 await boot();
 for(const [path,body] of [['/story',undefined],['/story/seen',{sceneIds:['letters-prologue']}],['/garden/style',{taskId:'sky-planter',style:'festival'}]] as const)assert.equal((await request(null,path,body)).status,401);
 const a=await ok<AuthResponse>(null,'/auth/guest',{}),b=await ok<AuthResponse>(null,'/auth/guest',{});deletedUserId=a.player.id;
 const initial=(await me(a)).player;assert.deepEqual(await story(a),{contentVersion:'cloud-letters-1',unlocked:[],seen:[],styles:{}});assert.deepEqual((await me(a)).player,initial);
 record('authenticated read-only state projects an untouched legacy/new account without economic writes');
 assert.equal((await request(a,'/story/seen',{sceneIds:['letters-prologue']})).error?.code,'STORY_LOCKED');
 assert.equal((await request(a,'/story/seen',{sceneIds:['forged-scene']})).status,404);
 for(const body of [{sceneIds:[]},{sceneIds:Array(20).fill('letters-prologue')},{sceneIds:['letters-prologue'],stars:999}])assert.equal((await request(a,'/story/seen',body)).status,400);
 assert.equal((await request(a,'/garden/style',{taskId:'sky-planter',style:'festival'})).error?.code,'RESTORATION_REQUIRED');
 for(const body of [{taskId:'sky-path',style:'festival'},{taskId:'../bench',style:'festival'},{taskId:'sky-planter',style:'free-coins'},{taskId:'sky-planter',style:'festival',cost:-1}])assert.equal((await request(a,'/garden/style',body)).status,400);
 assert.deepEqual((await me(a)).player,initial);record('locked scenes, unknown IDs, excess input and uncompleted/non-cosmetic slots cannot be forged');
 await clear(a);assert.deepEqual((await story(a)).unlocked,['letters-prologue']);
 await clear(a);await ok(a,'/garden/restore',{key:id(),taskId:'sky-path'});await ok(a,'/garden/restore',{key:id(),taskId:'sky-planter'});
 const baseline=(await me(a)).player,unlocked=(await story(a)).unlocked;assert.deepEqual(unlocked,['letters-prologue','letters-sky-path','letters-sky-planter']);
 record('normal engine-validated clears and ordered star-priced restorations unlock their exact authored scenes');
 await Promise.all(unlocked.map(sceneId=>ok<StoryState>(a,'/story/seen',{sceneIds:[sceneId]})));
 assert.deepEqual((await story(a)).seen,unlocked);
 await Promise.all([ok(a,'/story/seen',{sceneIds:unlocked}),ok(a,'/story/seen',{sceneIds:unlocked})]);assert.deepEqual((await story(a)).seen,unlocked);
 assert.deepEqual((await me(a)).player,baseline);record('concurrent scene acknowledgements merge as a deterministic union and duplicate retries remain idempotent');
 await ok<StoryState>(a,'/garden/style',{taskId:'sky-planter',style:'festival'});assert.equal((await story(a)).styles['sky-planter'],'festival');
 await Promise.all([ok(a,'/garden/style',{taskId:'sky-planter',style:'festival'}),ok(a,'/garden/style',{taskId:'sky-planter',style:'festival'})]);
 await ok(a,'/garden/style',{taskId:'sky-planter',style:'classic'});assert.equal((await story(a)).styles['sky-planter'],'classic');await ok(a,'/garden/style',{taskId:'sky-planter',style:'festival'});
 assert.deepEqual((await me(a)).player,baseline);record('completed-slot appearance changes and retries preserve the full Player, version, inventory and currencies');
 assert.deepEqual((await story(b)).seen,[]);assert.deepEqual((await story(b)).styles,{});assert.equal((await request(b,'/story/seen',{sceneIds:['letters-sky-planter']})).status,409);assert.equal((await request(b,'/garden/style',{taskId:'sky-planter',style:'festival'})).status,409);
 record('story and style records are account-scoped and do not unlock another guest');
 const beforeRestart=await story(a);await boot();assert.deepEqual(await story(a),beforeRestart);assert.deepEqual((await me(a)).player,baseline);record('real persisted D1 preserves story/style state across Worker restart with unchanged economic Player');
 await ok(a,'/account',{confirmation:'DELETE'},'DELETE');assert.equal((await request(a,'/story')).status,401);record('soft-deleted account is denied subsequent story access');
 await worker!.stop();worker=undefined;
 const files=await findFiles(statePath);let database='';
 for(const file of files){const probe=spawnSync('python3',['-c','import sqlite3,sys; c=sqlite3.connect("file:"+sys.argv[1]+"?mode=ro",uri=True); print(c.execute("SELECT count(*) FROM sqlite_master WHERE type=\'table\' AND name=\'players\'").fetchone()[0])',file],{encoding:'utf8'});if(probe.stdout.trim()==='1'){database=file;break;}}
 assert(database,'isolated player database not found');
 const audit=spawnSync('python3',['-c','import sqlite3,json,sys; c=sqlite3.connect("file:"+sys.argv[1]+"?mode=ro",uri=True); u=sys.argv[2]; print(json.dumps({"story":c.execute("SELECT count(*) FROM story_seen WHERE user_id=?",(u,)).fetchone()[0],"styles":c.execute("SELECT count(*) FROM garden_styles WHERE user_id=?",(u,)).fetchone()[0],"ledger":c.execute("SELECT count(*) FROM ledger WHERE user_id=? AND (reason LIKE \'story:%\' OR reason LIKE \'garden:style%\')",(u,)).fetchone()[0]}))',database,deletedUserId],{encoding:'utf8'});
 assert.equal(audit.status,0,audit.stderr);const auditResult=JSON.parse(audit.stdout) as {story:number;styles:number;ledger:number};assert.deepEqual(auditResult,{story:0,styles:0,ledger:0});
 record('D1 confirms account-deletion cleanup of both presentation tables and zero story/style ledger entries');
 await writeFile('output/verification/api-story-v8-http.json',JSON.stringify({at:new Date().toISOString(),environment:'Actual local Wrangler/workerd HTTP + isolated persisted D1; new guests, approved wins and ordinary restoration transactions',contentScenes:STORY_SCENES.length,checks,passed:checks.length,economicPlayerPreserved:true,deletionAudit:auditResult},null,2));
}finally{await worker?.stop();}
