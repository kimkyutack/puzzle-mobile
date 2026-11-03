import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile,readdir,writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
import {unstable_splitSqlQuery} from 'wrangler';
import {applyAction,legalActions,stateHash} from '@garden/core';
import {ENGINE_VERSION,type Action,type AuthResponse,type Envelope,type Player,type Run} from '@garden/contracts';
import solutions from '../packages/content/src/solutions.json';

// The production Worker bundle and all real migrations, with a disposable private D1 only.
await mkdir('.wrangler',{recursive:true});await mkdir('output/verification',{recursive:true});
const statePath=resolve(await mkdtemp('.wrangler/local-play-v13-'));
const build=spawnSync(process.execPath,['node_modules/wrangler/bin/wrangler.js','deploy','--dry-run','--config','wrangler.jsonc','--outdir',join(statePath,'bundle')],{encoding:'utf8',env:{...process.env,WRANGLER_LOG_PATH:join(statePath,'build.log'),WRANGLER_SEND_METRICS:'false'}});
assert.equal(build.status,0,build.stderr||build.stdout);
const config=JSON.parse(await readFile('wrangler.jsonc','utf8'));
const mf=new Miniflare(convertV4MiniflareOptions({modules:true,scriptPath:join(statePath,'bundle/index.js'),compatibilityDate:'2026-11-02',compatibilityFlags:['nodejs_compat'],port:0,d1Databases:{DB:'local-play-v13-private'},r2Buckets:['ASSETS'],durableObjects:{GUILD_ROOMS:{className:'GuildRoom',useSQLite:true}},bindings:{...config.vars,CLIENT_ORIGINS:'capacitor://localhost'}}));
const checks:string[]=[],key=()=>crypto.randomUUID();
const record=(name:string)=>{checks.push(name);console.log('PASS '+name);};
try{
 const db=await mf.getD1Database('DB');
 for(const file of (await readdir('apps/api/migrations')).filter(name=>name.endsWith('.sql')).sort())await db.batch(unstable_splitSqlQuery(await readFile('apps/api/migrations/'+file,'utf8')).map(query=>db.prepare(query)));
 const origin=await mf.ready;
 async function call<T>(user:AuthResponse|null,path:string,body?:unknown){const response=await fetch(new URL('/api'+path,origin),{method:body===undefined?'GET':'POST',headers:{'Content-Type':'application/json',...(user?{Authorization:'Bearer '+user.accessToken}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});return {status:response.status,json:await response.json() as Envelope<T>&{error?:{code:string}}};}
 async function ok<T>(user:AuthResponse|null,path:string,body?:unknown){const r=await call<T>(user,path,body);assert.equal(r.status,200,path+': '+JSON.stringify(r.json.error));return r.json.data;}
 const guest=()=>ok<AuthResponse>(null,'/auth/guest',{});
 const me=async(user:AuthResponse)=>(await ok<{player:Player}>(user,'/me')).player;
 async function patch(user:AuthResponse,fields:Partial<Player>){const player={...await me(user),...fields};await db.prepare('UPDATE players SET data=? WHERE id=?').bind(JSON.stringify(player),player.id).run();}
 const start=async(user:AuthResponse)=>(await ok<{player:Player;run:Run}>(user,'/runs/start',{key:key(),engineVersion:ENGINE_VERSION,preBoosters:[]})).run;
 const target=(state:Run['state'])=>state.cells.findIndex(c=>c.exists&&c.tile?.kind==='normal'&&!c.obstacleId);
 {
  const user=await guest();await patch(user,{level:10});const run=await start(user),before=await me(user);let state=run.state;const actions:Action[]=[];
  const add=(action:Action)=>{const result=applyAction(state,action);assert.equal(result.accepted,true);assert.notEqual(result.state.status,'error');state=result.state;actions.push(action);};
  add(legalActions(state)[0]!);add({type:'booster',item:'hammer',at:target(state)});add({type:'booster',item:'sweep-border'});
  const command={key:key(),sequence:0,actions};const result=await ok<{run:Run;player:Player}>(user,`/runs/${run.id}/actions`,command);
  assert.equal(stateHash(result.run.state),stateHash(state));assert.equal(result.run.sequence,3);assert.equal(result.player.inventory.hammer.normal,before.inventory.hammer.normal-1);assert.equal(result.player.inventory['sweep-border'].normal,before.inventory['sweep-border'].normal-1);assert.equal(result.player.hearts,5);assert.equal(result.run.state.moves,run.state.moves-1);record('mixed local moves and consumables replay to the identical authoritative board');
  const duplicate=await ok<{run:Run;player:Player}>(user,`/runs/${run.id}/actions`,command);assert.deepEqual(duplicate,result);
  assert.equal((await call(user,`/runs/${run.id}/actions`,{...command,key:key()})).status,409);assert.deepEqual((await me(user)).inventory,result.player.inventory);record('ambiguous-response retries and old sequences cannot double-spend inventory');
 }
 {
  const user=await guest(),p=await me(user);p.inventory.hammer={normal:0,bound:0};await patch(user,{level:10,inventory:p.inventory});const run=await start(user),first=legalActions(run.state)[0]!,next=applyAction(run.state,first).state;
  const command={key:key(),sequence:0,actions:[first,{type:'booster',item:'hammer',at:target(next)}]};const rejected=await call(user,`/runs/${run.id}/actions`,command);assert.equal(rejected.status,409);assert.equal(rejected.json.error?.code,'ITEMS_EMPTY');const saved=await ok<{run:Run}>(user,`/runs/${run.id}`);assert.equal(saved.run.sequence,0);assert.equal(stateHash(saved.run.state),stateHash(run.state));record('unowned predicted items reject the entire batch without committing its normal-move prefix');
  assert.equal((await call(user,`/runs/${run.id}/actions`,{key:key(),sequence:0,actions:[{type:'continue',moves:5}]})).status,400);record('extra moves cannot be forged in the local action log');
 }
 {
  const user=await guest(),p=await me(user);p.inventory.hammer={normal:1,bound:1};await patch(user,{level:10,inventory:p.inventory});const run=await start(user),command={key:key(),sequence:0,actions:[{type:'booster',item:'hammer',at:target(run.state)}]};
  const [a,b]=await Promise.all([ok<{player:Player}>(user,`/runs/${run.id}/actions`,command),ok<{player:Player}>(user,`/runs/${run.id}/actions`,command)]);assert.deepEqual(a,b);assert.deepEqual(a.player.inventory.hammer,{normal:1,bound:0});record('concurrent duplicate item logs consume one bound item first');
 }
 {
  const user=await guest(),p=await me(user);delete (p.inventory as Partial<Player['inventory']>)['sweep-border'];await patch(user,{level:5,inventory:p.inventory});assert.deepEqual((await me(user)).inventory['sweep-border'],{normal:0,bound:0});
  const bought=await ok<{player:Player}>(user,'/shop/buy',{key:key(),item:'sweep-border'});assert.equal(bought.player.coins,150);assert.equal(bought.player.inventory['sweep-border'].normal,1);const run=await start(user);const used=await ok<{run:Run;player:Player}>(user,`/runs/${run.id}/booster`,{key:key(),sequence:0,item:'sweep-border'});assert.equal(used.player.inventory['sweep-border'].normal,0);assert.equal(stateHash(used.run.state),stateHash(applyAction(run.state,{type:'booster',item:'sweep-border'}).state));record('existing accounts can buy the new item; the original booster endpoint remains compatible');
 }
 await writeFile('output/verification/local-play-v13-http.json',JSON.stringify({at:new Date().toISOString(),checks,productionDataRead:false},null,2));
}finally{await mf.dispose();}
