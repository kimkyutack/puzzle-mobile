import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile,readdir,writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
import {unstable_splitSqlQuery} from 'wrangler';
import {applyAction,legalActions,stateHash} from '@garden/core';
import {ENGINE_VERSION,type Action,type AuthResponse,type Envelope,type Player,type Run,type ProgressionResponse,type TreasureAttempt,type TreasurePair} from '@garden/contracts';
import {MISSIONS,missionPeriod} from '@garden/content';
import solutions from '../packages/content/src/solutions.json';

// The production Worker bundle and all real migrations, with a disposable private D1 only.
await mkdir('.wrangler',{recursive:true});await mkdir('output/verification',{recursive:true});
const statePath=resolve(await mkdtemp('.wrangler/progression-v14-'));
const build=spawnSync(process.execPath,['node_modules/wrangler/bin/wrangler.js','deploy','--dry-run','--config','wrangler.jsonc','--outdir',join(statePath,'bundle')],{encoding:'utf8',env:{...process.env,WRANGLER_LOG_PATH:join(statePath,'build.log'),WRANGLER_SEND_METRICS:'false'}});
assert.equal(build.status,0,build.stderr||build.stdout);
const config=JSON.parse(await readFile('wrangler.jsonc','utf8'));
const mf=new Miniflare(convertV4MiniflareOptions({modules:true,scriptPath:join(statePath,'bundle/index.js'),compatibilityDate:'2026-11-02',compatibilityFlags:['nodejs_compat'],port:0,d1Databases:{DB:'progression-v14-private'},r2Buckets:['ASSETS'],durableObjects:{GUILD_ROOMS:{className:'GuildRoom',useSQLite:true}},bindings:{...config.vars,CLIENT_ORIGINS:'capacitor://localhost'}}));
const checks:string[]=[],key=()=>crypto.randomUUID();
const record=(name:string)=>{checks.push(name);console.log('PASS '+name);};
try{
 const db=await mf.getD1Database('DB');for(const file of (await readdir('apps/api/migrations')).filter(name=>name.endsWith('.sql')).sort())await db.batch(unstable_splitSqlQuery(await readFile('apps/api/migrations/'+file,'utf8')).map(query=>db.prepare(query)));
 const origin=await mf.ready;
 async function call<T>(user:AuthResponse|null,path:string,body?:unknown,method=body===undefined?'GET':'POST'){const response=await fetch(new URL('/api'+path,origin),{method,headers:{'Content-Type':'application/json',...(user?{Authorization:'Bearer '+user.accessToken}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});return {status:response.status,json:await response.json() as Envelope<T>&{error?:{code:string}}};}
 async function ok<T>(user:AuthResponse|null,path:string,body?:unknown,method?:string){const r=await call<T>(user,path,body,method);assert.equal(r.status,200,path+': '+JSON.stringify(r.json.error));return r.json.data;}
 const guest=()=>ok<AuthResponse>(null,'/auth/guest',{}),progress=(user:AuthResponse)=>ok<ProgressionResponse>(user,'/progression');
 const me=async(user:AuthResponse)=>(await ok<{player:Player}>(user,'/me')).player;
 const inventoryTotal=(p:Player)=>Object.values(p.inventory).reduce((n,v)=>n+v.normal+v.bound,0);
 const user=await guest();let status=await progress(user);assert.equal(status.daily.missions.length,7);assert.equal(status.weekly.missions.length,10);assert.equal(status.notifications.missions,0);assert.equal(status.notifications.events,1);assert.equal(status.notifications.minigame,1);assert.equal(status.player.inventory['world-bomb'].normal+status.player.inventory['world-bomb'].bound,0);record('new users receive seven daily and ten weekly missions, truthful badges, and no free milestone bomb');
 const fakeBefore=await me(user),fake=await ok<{claimed:string[]}>(user,'/missions/claim',{key:key(),period:'daily',periodId:status.daily.id,ids:['d-clear'],progress:999,reward:{coins:99999}});assert.deepEqual(fake.claimed,[]);assert.equal((await me(user)).coins,fakeBefore.coins);record('client-provided progress and reward fields cannot forge mission rewards');
 for(let i=0;i<10;i++){
  const {run}=await ok<{run:Run}>(user,'/runs/start',{key:key(),engineVersion:ENGINE_VERSION,preBoosters:[]});
  const command={key:key(),sequence:0,actions:solutions[String(run.level.id) as keyof typeof solutions].actions};await ok(user,`/runs/${run.id}/actions`,command);
  const final=await ok<{run:Run;player:Player}>(user,`/runs/${run.id}/finish`,{key:key()});assert.equal(final.player.hearts,5);assert.equal(final.player.inventory['world-bomb'].bound,i===9?1:0);
  if(i===9){assert.equal(final.run.reward?.items?.['world-bomb'],1);await ok(user,`/runs/${run.id}/finish`,{key:key()});}
 }
 status=await progress(user);assert.equal(status.milestone.clears,10);assert.equal(status.milestone.awarded,1);assert.equal(status.milestone.progress,0);assert.equal(status.milestone.owned,1);assert(status.notifications.missions>0);assert(status.notifications.pass>0);record('ten distinct real clears grant exactly one full-map bomb while repeated settlement grants none');
 const d=missionPeriod('daily',Date.now());assert.equal((await db.prepare('SELECT value FROM activity_counters WHERE user_id=? AND period=? AND metric=?').bind(user.player.id,d.id,'clears').first<{value:number}>())?.value,10);record('server-replayed actions and unique wins populate authoritative mission metrics');
 const beforeClaim=await me(user),claimBody={period:'daily',periodId:status.daily.id,ids:['d-clear']};await Promise.all([ok(user,'/missions/claim',{...claimBody,key:key()}),ok(user,'/missions/claim',{...claimBody,key:key()})]);assert.equal((await me(user)).coins,beforeClaim.coins+50);assert.equal((await db.prepare('SELECT count(*) n FROM mission_claims WHERE user_id=? AND period=? AND mission_id=?').bind(user.player.id,d.id,'d-clear').first<{n:number}>())?.n,1);record('racing mission claims pay exactly once');
 const available=(await progress(user)).daily.missions.filter(m=>m.claimable).length,allBody={key:key(),period:'daily',periodId:d.id};const all=await ok<{claimed:string[]}>(user,'/missions/claim',allBody);assert.equal(all.claimed.length,available);const allBefore=await me(user);await ok(user,'/missions/claim',allBody);assert.deepEqual((await me(user)).inventory,allBefore.inventory);assert.equal((await progress(user)).daily.missions.filter(m=>m.claimable).length,0);record('claim-all collects only eligible missions and clears their red dots');
 assert.equal((await call(user,'/missions/claim',{key:key(),period:'daily',periodId:'d:2000-01-01'})).status,409);record('stale daily windows cannot claim current or previous-period rewards');
 const other=await guest();let miniWins=0;
 for(let i=0;i<3;i++){
  const startKey=key(),started=await ok<{player:Player;attempt:TreasureAttempt}>(user,'/minigames/treasure/start',{key:startKey}),attempt=started.attempt;
  assert.equal((await ok<{attempt:TreasureAttempt}>(user,'/minigames/treasure/start',{key:key()})).attempt.id,attempt.id);
  const pairs:TreasurePair[]=[...new Set(attempt.deck)].map(color=>{const indices=attempt.deck.flatMap((value,index)=>value===color?[index]:[]);return{first:indices[0]!,second:indices[1]!};});
  assert.equal((await call(user,`/minigames/treasure/${attempt.id}/finish`,{key:key(),pairs:pairs.slice(0,3)})).status,409);
  assert.equal((await call(other,`/minigames/treasure/${attempt.id}/finish`,{key:key(),pairs})).status,404);
  const before=await me(user),finishBody={key:'treasure-finish-'+attempt.id,pairs},finish=await ok<{player:Player;attempt:TreasureAttempt}>(user,`/minigames/treasure/${attempt.id}/finish`,finishBody);
  assert.equal(finish.attempt.status,'won');assert.equal(finish.player.coins,before.coins+25);assert.equal(inventoryTotal(finish.player),inventoryTotal(before)+1);assert.equal(finish.player.hearts,5);await ok(user,`/minigames/treasure/${attempt.id}/finish`,finishBody);await ok(user,`/minigames/treasure/${attempt.id}/finish`,{...finishBody,key:key()});assert.equal(inventoryTotal(await me(user)),inventoryTotal(before)+1);miniWins++;
 }
 status=await progress(user);assert.equal(miniWins,3);assert.equal(status.minigame.remaining,0);assert.equal(status.notifications.minigame,0);assert.equal((await call(user,'/minigames/treasure/start',{key:key()})).status,409);assert(status.daily.missions.find(m=>m.id==='d-mini')?.claimable);record('three local card games grant real items once each, consume no hearts, and enforce the server daily limit');
 const failed=await ok<{attempt:TreasureAttempt}>(other,'/minigames/treasure/start',{key:key()}),wrong=failed.attempt.deck.findIndex(color=>color!==failed.attempt.deck[0]),beforeFail=await me(other);const loss=await ok<{player:Player;attempt:TreasureAttempt}>(other,`/minigames/treasure/${failed.attempt.id}/finish`,{key:key(),pairs:Array.from({length:12},()=>({first:0,second:wrong}))});assert.equal(loss.attempt.status,'lost');assert.equal(loss.player.coins,beforeFail.coins);assert.equal(inventoryTotal(loss.player),inventoryTotal(beforeFail));assert.equal(loss.player.hearts,5);record('failed card attempts award no item and never take a heart');
 const w=missionPeriod('weekly',Date.now());for(const mission of MISSIONS.filter(m=>m.period==='weekly'))await db.prepare('INSERT INTO activity_counters VALUES(?,?,?,?) ON CONFLICT(user_id,period,metric) DO UPDATE SET value=excluded.value').bind(user.player.id,w.id,mission.metric,mission.target).run();const weekly=await progress(user);assert.equal(weekly.weekly.missions.filter(m=>m.claimable).length,10);await ok(user,'/missions/claim',{key:key(),period:'weekly',periodId:w.id});assert.equal((await progress(user)).weekly.missions.filter(m=>m.claimable).length,0);record('all ten weekly reward types can be earned and claimed independently of daily missions');
 const legacy=await me(user);legacy.inventory['world-bomb']={normal:0,bound:0};await db.batch([db.prepare('UPDATE players SET data=? WHERE id=?').bind(JSON.stringify(legacy),user.player.id),db.prepare('DELETE FROM clear_milestones WHERE user_id=?').bind(user.player.id)]);assert.equal((await progress(user)).milestone.owned,1);assert.equal((await progress(user)).milestone.owned,1);assert.equal((await call(user,'/shop/buy',{key:key(),item:'world-bomb'})).json.error?.code,'EARN_ONLY_ITEM');record('historical verified wins catch up milestone bombs once, and the bomb cannot be bought for zero coins');
 for(const version of ['1.0.0','1.1.0',ENGINE_VERSION]){const oldUser=await guest();const {run}=await ok<{run:Run}>(oldUser,'/runs/start',{key:key(),engineVersion:version,preBoosters:[]});assert.equal(run.state.engineVersion,version);}record('old 1.0 and 1.1 clients receive frozen compatible boards alongside new 1.2 boards');
 await ok(user,'/account',{confirmation:'DELETE'},'DELETE');for(const table of ['activity_counters','activity_days','mission_claims','clear_milestones','treasure_attempts'])assert.equal((await db.prepare(`SELECT count(*) n FROM ${table} WHERE user_id=?`).bind(user.player.id).first<{n:number}>())?.n,0);record('account deletion removes all new private activity and minigame records');
 await writeFile('output/verification/progression-v14-http.json',JSON.stringify({at:new Date().toISOString(),checks,productionDataRead:false},null,2));
}finally{await mf.dispose();}
