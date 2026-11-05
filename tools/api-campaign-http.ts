import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile,readdir,writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
import {unstable_splitSqlQuery} from 'wrangler';
import {ENGINE_VERSION,LEGACY_ENGINE_VERSION,PREVIOUS_ENGINE_VERSION,SCULPTED_ENGINE_VERSION,type Action,type AuthResponse,type Player,type Run} from '@garden/contracts';
import {APPROVED_LEVEL_COUNT,getLevel} from '@garden/content';
import {createGame,replay,stateHash} from '@garden/core';
import catalogue from '../packages/content/src/bulk-catalogue.json';
import bulkProofs from '../packages/content/src/bulk-proofs.json';
import campaignProofs from '../packages/content/src/campaign-solutions.json';

// This tool exclusively uses an isolated, temporary Worker and D1 database.
await mkdir('.wrangler',{recursive:true});
const dir=resolve(await mkdtemp('.wrangler/campaign-http-')),checks:string[]=[];
const built=spawnSync(process.execPath,['node_modules/wrangler/bin/wrangler.js','deploy','--dry-run','--config','apps/api/wrangler.jsonc','--outdir',join(dir,'bundle')],{encoding:'utf8',env:{...process.env,WRANGLER_LOG_PATH:join(dir,'build.log'),WRANGLER_SEND_METRICS:'false'}});
assert.equal(built.status,0,built.stderr||built.stdout);
const mf=new Miniflare(convertV4MiniflareOptions({modules:true,modulesRoot:join(dir,'bundle'),scriptPath:join(dir,'bundle/index.js'),compatibilityDate:'2026-11-02',compatibilityFlags:['nodejs_compat'],port:0,d1Databases:{DB:'campaign-private'},r2Buckets:['ASSETS'],durableObjects:{GUILD_ROOMS:{className:'GuildRoom',useSQLite:true}},bindings:{ENVIRONMENT:'development',LOCAL_DEV_TOOLS:'disabled',CLIENT_ORIGINS:'capacitor://localhost',ASSET_VERSION:'test',ASSET_PUBLIC_ORIGIN:'',GOOGLE_CLIENT_IDS:'',APPLE_CLIENT_IDS:'',ADMOB_AD_UNITS:''}}));
try{
 const db=await mf.getD1Database('DB');
 for(const name of (await readdir('apps/api/migrations')).filter(n=>n.endsWith('.sql')).sort())await db.batch(unstable_splitSqlQuery(await readFile('apps/api/migrations/'+name,'utf8')).map(q=>db.prepare(q)));
 const origin=await mf.ready,key=()=>crypto.randomUUID();let user:AuthResponse|undefined;
 async function request<T>(path:string,body?:unknown){const response=await mf.dispatchFetch(new URL('/api'+path,origin).href,{method:body===undefined?'GET':'POST',headers:{'Content-Type':'application/json',Origin:'capacitor://localhost',...(user?{Authorization:'Bearer '+user.accessToken}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});return {status:response.status,...await response.json() as {data:T;error?:{code:string}}};}
 async function ok<T>(path:string,body?:unknown){const response=await request<T>(path,body);assert.equal(response.status,200,path+' '+JSON.stringify(response.error));return response.data;}
 user=await ok<AuthResponse>('/auth/guest',{});let player=user.player;
 async function seed(level:number){await db.prepare('UPDATE players SET data=? WHERE id=?').bind(JSON.stringify({...player,level,hearts:5,heartAt:0}),user!.player.id).run();}
 const ids=[1,13,17,20,201,211,221,231,251,271,294,301,998,1000,1001,5998,9998,APPROVED_LEVEL_COUNT];
 for(const id of ids){
  await seed(id);
  const body={key:key(),engineVersion:ENGINE_VERSION,preBoosters:[]},started=await ok<{run:Run;player:Player}>('/runs/start',body);
  assert.deepEqual(started.run.level,getLevel(id));assert.equal(stateHash(started.run.state),stateHash(createGame(started.run.level)));assert.equal(started.player.hearts,5);
  assert.deepEqual(await ok('/runs/start',body),started);
  const actions=(id<=300?(campaignProofs as Record<string,{actions:Action[]}>)[id]!.actions:bulkProofs.templates[catalogue.entries[id-301]![0]!]!.actions) as Action[];
  const expected=replay(started.run.level,actions);assert.equal(expected.state.status,'won');
  const actual=await ok<{run:Run}>('/runs/'+started.run.id+'/actions',{key:key(),sequence:0,actions});assert.equal(stateHash(actual.run.state),stateHash(expected.state));
  const finishBody={key:key()},finished=await ok<{player:Player}>('/runs/'+started.run.id+'/finish',finishBody);player=finished.player;
  assert.equal(player.level,id+1);assert.equal(player.hearts,5);assert.deepEqual(await ok('/runs/'+started.run.id+'/finish',finishBody),finished);
  checks.push('New-engine start, replay and idempotent reward: level '+id);console.log('PASS level '+id);
 }
 for(const engineVersion of [LEGACY_ENGINE_VERSION,PREVIOUS_ENGINE_VERSION,SCULPTED_ENGINE_VERSION]){
  await seed(1);const {run}=await ok<{run:Run}>('/runs/start',{key:key(),engineVersion,preBoosters:[]});assert.equal(run.state.engineVersion,engineVersion);assert.deepEqual(run.level,getLevel(1,engineVersion));
  player=(await ok<{player:Player}>('/runs/'+run.id+'/abandon',{key:key()})).player;
  checks.push('Legacy client '+engineVersion+' receives its own compatible content');
 }
 await seed(APPROVED_LEVEL_COUNT+1);const before=(await ok<{player:Player}>('/me')).player;
 const unavailable=await request('/runs/start',{key:key(),engineVersion:ENGINE_VERSION,preBoosters:[]});assert.equal(unavailable.error?.code,'CONTENT_NOT_READY');assert.deepEqual((await ok<{player:Player}>('/me')).player,before);
 checks.push('Unpublished levels do not change hearts, inventory or player revision');
 const report={at:new Date().toISOString(),passed:true,scope:'Actual Worker HTTP, isolated temporary D1 only',checks};
 await mkdir('output/verification/release-104-5',{recursive:true});await writeFile('output/verification/release-104-5/campaign-http.json',JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({passed:true,checks:checks.length}));
}finally{await mf.dispose();}
