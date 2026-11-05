import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile,readdir,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
import {unstable_splitSqlQuery} from 'wrangler';
import {ENGINE_VERSION,type AuthResponse,type DailyRescueResult,type StoryState,type StateResponse,type Run} from '@garden/contracts';
import {bridgeDailyWindow,bridgeLevel} from '@garden/content';
import {replay} from '@garden/core';
import proof from '../tests/fixtures/daily-rescue-proof.json';
import type {Action} from '@garden/contracts';

const dir=resolve(await mkdtemp('/tmp/daily-rescue-http-')),out='output/verification/daily-rescue',checks:string[]=[];
await mkdir(out,{recursive:true});
const built=spawnSync(process.execPath,['node_modules/wrangler/bin/wrangler.js','deploy','--dry-run','--config','apps/api/wrangler.jsonc','--outdir',join(dir,'bundle')],{encoding:'utf8',env:{...process.env,WRANGLER_LOG_PATH:join(dir,'build.log'),WRANGLER_SEND_METRICS:'false'}});assert.equal(built.status,0,built.stderr);
const mf=new Miniflare(convertV4MiniflareOptions({modules:true,modulesRoot:join(dir,'bundle'),scriptPath:join(dir,'bundle/index.js'),compatibilityDate:'2026-11-02',compatibilityFlags:['nodejs_compat'],port:0,d1Databases:{DB:'daily-rescue-private'},r2Buckets:['ASSETS'],durableObjects:{GUILD_ROOMS:{className:'GuildRoom',useSQLite:true}},bindings:{ENVIRONMENT:'development',LOCAL_DEV_TOOLS:'disabled',CLIENT_ORIGINS:'http://localhost:5197',ASSET_VERSION:'test',ASSET_PUBLIC_ORIGIN:'',GOOGLE_CLIENT_IDS:'',APPLE_CLIENT_IDS:'',ADMOB_AD_UNITS:''}}));
try{
 const db=await mf.getD1Database('DB');for(const file of (await readdir('apps/api/migrations')).filter(n=>n.endsWith('.sql')).sort())await db.batch(unstable_splitSqlQuery(await readFile('apps/api/migrations/'+file,'utf8')).map(q=>db.prepare(q)));
 const origin=await mf.ready;
 async function req<T>(user:AuthResponse|null,path:string,body?:unknown){const res=await fetch(new URL('/api'+path,origin),{method:body===undefined?'GET':'POST',headers:{'Content-Type':'application/json',...(user?{Authorization:'Bearer '+user.accessToken}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});return {status:res.status,...await res.json() as {data:T;error?:{code:string}}};}
 async function ok<T>(user:AuthResponse|null,path:string,body?:unknown){const r=await req<T>(user,path,body);assert.equal(r.status,200,path+' '+JSON.stringify(r.error));return r.data;}
 const mark=(name:string)=>{checks.push(name);console.log('PASS '+name);};
 const a=await ok<AuthResponse>(null,'/auth/guest',{}),b=await ok<AuthResponse>(null,'/auth/guest',{}),daily=bridgeDailyWindow(Date.now()),body={periodId:daily.periodId,actions:proof};
 assert.equal(replay(bridgeLevel(),proof as Action[]).state.status,'won');
 assert.equal((await req(null,'/story/episodes/bridge-v1/complete',body)).status,401);assert.equal((await req(b,'/story/episodes/bridge-v1/complete',body)).error?.code,'EPISODE_LOCKED');mark('authentication and seven-clear unlock remain required');
 await db.prepare('UPDATE players SET data=? WHERE id=?').bind(JSON.stringify({...a.player,level:8}),a.player.id).run();
 const normal=await ok<{run:Run}>(a,'/runs/start',{key:crypto.randomUUID(),engineVersion:ENGINE_VERSION,preBoosters:[]});
 const pa=(await ok<StateResponse>(a,'/me')).player;await db.prepare('UPDATE players SET data=? WHERE id=?').bind(JSON.stringify({...pa,hearts:0,heartAt:Date.now()}),a.player.id).run();
 const baseline=await ok<StateResponse>(a,'/me');
 for(const bad of [{periodId:daily.periodId,actions:[]},{periodId:daily.periodId,actions:[{type:'booster',item:'hammer',at:43}]},{...body,quantity:99},{periodId:daily.periodId,actions:[{type:'swap',from:0,to:48}]}])assert.notEqual((await req(a,'/story/episodes/bridge-v1/complete',bad)).status,200);
 assert.equal((await req(a,'/story/episodes/bridge-v1/complete',{...body,periodId:bridgeDailyWindow(Date.now()-86_400_000).periodId})).error?.code,'RESCUE_DAY_CHANGED');
 assert.deepEqual(await ok<StateResponse>(a,'/me'),baseline);mark('incomplete/booster/forged rewards and stale days are rejected without changing resources');
 const legacy=await ok<StoryState>(a,'/story/episodes/bridge-v1/complete',{actions:proof});assert.deepEqual(legacy.completedEpisodes,['bridge-v1']);assert.equal(legacy.dailyRescue?.claimed,false);assert.deepEqual(await ok<StateResponse>(a,'/me'),baseline);mark('old completed story remains separate from a fresh unclaimed daily game');
 const beforeReward=baseline.player.inventory[daily.reward.item].bound;
 const results=await Promise.all([ok<DailyRescueResult>(a,'/story/episodes/bridge-v1/complete',body),ok<DailyRescueResult>(a,'/story/episodes/bridge-v1/complete',body)]);assert.deepEqual(results[0],results[1]);
 const after=await ok<StateResponse>(a,'/me');assert.equal(after.player.inventory[daily.reward.item].bound,beforeReward+1);assert.equal(after.player.version,baseline.player.version+1);
 const expected=structuredClone(baseline);expected.player.inventory[daily.reward.item].bound++;expected.player.version++;assert.deepEqual(after,expected);assert.equal(after.activeRun?.id,normal.run.id);mark('concurrent wins grant exactly one bound item with no heart, level, coin or active-run change');
 for(let i=0;i<3;i++)await ok(a,'/story/episodes/bridge-v1/complete',body);assert.deepEqual(await ok<StateResponse>(a,'/me'),after);
 assert.equal(await db.prepare("SELECT count(*) n FROM reward_claims WHERE user_id=? AND kind='rescue-daily'").bind(a.player.id).first('n'),1);
 assert.equal(await db.prepare("SELECT count(*) n FROM ledger WHERE user_id=? AND reason LIKE 'rescue:daily:%'").bind(a.player.id).first('n'),1);
 assert.equal(await db.prepare('SELECT count(*) n FROM inventory_lots WHERE user_id=?').bind(a.player.id).first('n'),1);mark('request retries preserve a single claim, ledger record and inventory lot');
 await db.prepare('DELETE FROM operations WHERE user_id=? AND key=?').bind(a.player.id,'rescue-daily:'+daily.periodId).run();await ok(a,'/story/episodes/bridge-v1/complete',body);assert.deepEqual(await ok<StateResponse>(a,'/me'),after);mark('durable daily claim prevents re-awarding even after operation receipt cleanup');
 await db.prepare('UPDATE players SET data=? WHERE id=?').bind(JSON.stringify({...b.player,level:8}),b.player.id).run();
 await db.prepare("INSERT INTO reward_claims VALUES(?,'rescue-daily',?,?)").bind(b.player.id,bridgeDailyWindow(Date.now()-86_400_000).periodId,Date.now()-86_400_000).run();
 const today=await ok<StoryState>(b,'/story');assert.equal(today.dailyRescue?.claimed,false);await ok(b,'/story/episodes/bridge-v1/complete',body);assert.equal((await ok<StoryState>(b,'/story')).dailyRescue?.claimed,true);mark('previous-day claims and other accounts do not consume today’s entitlement');
 await writeFile(join(out,'http.json'),JSON.stringify({at:new Date().toISOString(),passed:true,checks,scope:'Real Worker and temporary D1 only. No production or installed account used.'},null,2));
 if(process.argv.includes('--ui')){
  const ui=await ok<AuthResponse>(null,'/auth/guest',{});await db.prepare('UPDATE players SET data=? WHERE id=?').bind(JSON.stringify({...ui.player,level:8,nickname:'일일 구조 검수',settings:{...ui.player.settings,reducedMotion:true}}),ui.player.id).run();
  process.env.VITE_API_URL=origin.origin+'/api';const {createServer}=await import('vite'),vite=await createServer({configFile:resolve('apps/client/vite.config.ts'),server:{port:5197,host:'127.0.0.1',strictPort:true,fs:{allow:[process.cwd(),dir]}}});await vite.listen();
  const setup=`<script>localStorage.setItem('cloud-garden-language-v1',JSON.stringify({language:'ko',pending:false}));localStorage.setItem('cloud-garden-session-v1',${JSON.stringify(JSON.stringify({accessToken:ui.accessToken,refreshToken:ui.refreshToken}))});</script><script type="module">import RefreshRuntime from '/@react-refresh';RefreshRuntime.injectIntoGlobalHook(window);window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>type=>type;window.__vite_plugin_react_preamble_installed__=true;</script>`;
  const html=join(dir,'ui.html');await writeFile(html,(await readFile('apps/client/index.html','utf8')).replace('<script type="module" src="/src/main.tsx">',setup+'<script type="module" src="/src/main.tsx">'));console.log(JSON.stringify({uiUrl:'http://localhost:5197/@fs'+html+'#/home'}));
  await new Promise<void>(done=>{process.once('SIGINT',done);process.once('SIGTERM',done)});await vite.close();
 }
}finally{await mf.dispose();}
