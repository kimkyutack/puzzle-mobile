import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile,readdir,writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
import {unstable_splitSqlQuery} from 'wrangler';
import {ENGINE_VERSION,SUPPORTED_ENGINE_VERSIONS,type Action,type AuthResponse,type Envelope,type LevelPreview,type Player,type Run,type StateResponse} from '@garden/contracts';
import {createGame,replay,stateHash} from '@garden/core';
import {createRunGateway} from '../apps/client/src/run-gateway';
import campaignProofs from '../packages/content/src/campaign-solutions.json';
import legacyProofs from '../packages/content/src/legacy-solutions-v12.json';
import gardenProofs from '../packages/content/src/garden-stage-proofs-v3.json';
import {GARDEN_STAGE_VARIANTS} from '../packages/content/src/garden-stage-candidates';
import {solve} from './level-validation/validate';

// An isolated Worker/D1 only. No installed accounts or remote services are used.
await mkdir('.wrangler',{recursive:true});await mkdir('output/verification/engine-content',{recursive:true});
const dir=resolve(await mkdtemp('.wrangler/engine-content-')),checks:string[]=[],key=()=>crypto.randomUUID();
const built=spawnSync(process.execPath,['node_modules/wrangler/bin/wrangler.js','deploy','--dry-run','--config','apps/api/wrangler.jsonc','--outdir',join(dir,'bundle')],{encoding:'utf8',env:{...process.env,WRANGLER_LOG_PATH:join(dir,'build.log'),WRANGLER_SEND_METRICS:'false'}});assert.equal(built.status,0,built.stderr||built.stdout);
const mf=new Miniflare(convertV4MiniflareOptions({modules:true,modulesRoot:join(dir,'bundle'),scriptPath:join(dir,'bundle/index.js'),compatibilityDate:'2026-11-02',compatibilityFlags:['nodejs_compat'],port:0,d1Databases:{DB:'engine-content-private'},r2Buckets:['ASSETS'],durableObjects:{GUILD_ROOMS:{className:'GuildRoom',useSQLite:true}},bindings:{ENVIRONMENT:'development',LOCAL_DEV_TOOLS:'disabled',CLIENT_ORIGINS:'capacitor://localhost',ASSET_VERSION:'test',ASSET_PUBLIC_ORIGIN:'',GOOGLE_CLIENT_IDS:'',APPLE_CLIENT_IDS:'',ADMOB_AD_UNITS:''}}));
try{
 const db=await mf.getD1Database('DB');for(const file of (await readdir('apps/api/migrations')).filter(f=>f.endsWith('.sql')).sort())await db.batch(unstable_splitSqlQuery(await readFile('apps/api/migrations/'+file,'utf8')).map(q=>db.prepare(q)));
 const origin=await mf.ready;let user:AuthResponse|undefined;
 async function req<T>(path:string,body?:unknown,anonymous=false){
  const response=await mf.dispatchFetch(new URL('/api'+path,origin).href,{method:body===undefined?'GET':'POST',headers:{'Content-Type':'application/json',Origin:'capacitor://localhost',...(!anonymous&&user?{Authorization:'Bearer '+user.accessToken}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});
  return {status:response.status,...await response.json() as Envelope<T>&{error?:{code:string}}};
 }
 async function ok<T>(path:string,body?:unknown){const result=await req<T>(path,body);assert.equal(result.status,200,path+' '+JSON.stringify(result.error));return result.data;}
 const record=(message:string)=>{checks.push(message);console.log('PASS '+message);};
 assert.equal((await req('/levels/next?engineVersion=1.3.0')).status,401);
 user=await ok<AuthResponse>('/auth/guest',{});
 const health=await ok<{engineVersion:string;latestEngineVersion:string;supportedEngineVersions:string[];levelSchemaVersion:number}>('/health');
 assert.equal(health.engineVersion,'1.3.0');assert.equal(health.levelSchemaVersion,1);assert.deepEqual(health.supportedEngineVersions,[...SUPPORTED_ENGINE_VERSIONS]);
 record('The legacy health field remains stable and newer clients receive a separate rules compatibility list');
 const before=await ok<StateResponse>('/me'),preview=await ok<LevelPreview>('/levels/next?engineVersion=1.3.0');
 assert.equal(preview.schemaVersion,1);assert.match(preview.levelHash!,/^[0-9a-f]{64}$/);assert.deepEqual(await ok('/me'),before);
 assert.equal(await db.prepare('SELECT count(*) n FROM runs WHERE user_id=?').bind(user.player.id).first('n'),0);
 record('Preview requires authentication and does not start a run or change hearts, inventory, currency or revision');
 const transport=async<T>(path:string,body?:unknown):Promise<T>=>{
  if(path==='/health')return {...health,engineVersion:'9.0.0',latestEngineVersion:'9.0.0',supportedEngineVersions:['9.0.0',...health.supportedEngineVersions]} as T;
  const response=await req<T>(path,body);if(response.error)throw Object.assign(new Error(response.error.code),{code:response.error.code});return response.data;
 };
 const gateway=createRunGateway(transport,['1.3.0','1.2.0','1.1.0','1.0.0']);assert.equal(await gateway.resolveEngine(),'1.3.0');assert.deepEqual(await gateway.preview(1),preview);
 let started=await gateway.start({idempotencyKey:key(),preBoosters:[],levelId:1});assert.equal(stateHash(started.run.state),stateHash(createGame(preview.level)));
 async function clear(run:Run,actions:Action[]){
  const heartsBefore=(await ok<StateResponse>('/me')).player.hearts,expected=replay(run.level,actions);assert.equal(expected.state.status,'won');
  const actual=await ok<{run:Run}>('/runs/'+run.id+'/actions',{key:key(),sequence:0,actions});assert.equal(stateHash(actual.run.state),stateHash(expected.state));
  const finish={key:key()},result=await ok<{player:Player}>('/runs/'+run.id+'/finish',finish);assert.deepEqual(await ok('/runs/'+run.id+'/finish',finish),result);assert.equal(result.player.hearts,heartsBefore);return result.player;
 }
 let player=await clear(started.run,campaignProofs['1'].actions as Action[]);
 record('A future server advertisement negotiates known rules and the downloaded board replays and settles identically');
 const prior=await ok<StateResponse>('/me'),invalid=await req('/runs/start',{key:key(),engineVersion:'1.3.0',supportedEngineVersions:SUPPORTED_ENGINE_VERSIONS,levelHash:'0'.repeat(64),preBoosters:['rainbow']});
 assert.equal(invalid.error?.code,'CONTENT_CHANGED');assert.deepEqual(await ok('/me'),prior);
 assert.equal(await db.prepare("SELECT count(*) n FROM runs WHERE user_id=? AND status='active'").bind(user.player.id).first('n'),0);
 record('A changed preview is rejected before booster consumption, heart changes or run creation');
 const saved=await ok<{run:Run}>('/runs/start',{key:key(),engineVersion:'1.2.0',preBoosters:[]});
 started=await gateway.start({idempotencyKey:key(),preBoosters:[],levelId:2});assert.deepEqual(started.run,saved.run);
 player=await clear(started.run,legacyProofs['2'].actions as Action[]);
 record('Negotiating a newer compatible version preserves an already active older run and its deterministic rules');
 await db.prepare('UPDATE players SET data=? WHERE id=?').bind(JSON.stringify({...player,level:10001}),user.player.id).run();
 const older=createRunGateway(transport,['1.2.0']),remote=await older.preview(10001);assert.equal(remote.level.id,10001);assert.equal(remote.level.engineVersion,'1.2.0');
 started=await older.start({idempotencyKey:key(),preBoosters:[],levelId:10001,randomStart:false});assert.deepEqual(started.run.level,remote.level);
 const sourceId=141+((10001-201)%60);player=await clear(started.run,(legacyProofs as Record<string,{actions:Action[]}>)[sourceId]!.actions);assert.equal(player.level,10002);
 record('An older client downloads and clears a compatible map beyond the currently bundled 10000-stage catalog');
 assert.equal((await req('/runs/start',{key:key(),supportedEngineVersions:['9.0.0']})).error?.code,'UPDATE_REQUIRED');
 record('Only a genuine lack of common simulation rules requires an app update');
 for(const id of [1,2,10,20,30,40]){
  await db.prepare('UPDATE players SET data=? WHERE id=?').bind(JSON.stringify({...player,level:id}),user.player.id).run();
  const preview=await ok<LevelPreview>('/levels/next?engineVersion='+ENGINE_VERSION);
  const fresh=await ok<{run:Run}>('/runs/start',{key:key(),engineVersion:ENGINE_VERSION,supportedEngineVersions:SUPPORTED_ENGINE_VERSIONS,preBoosters:[],levelHash:preview.levelHash});
  assert.deepEqual(fresh.run.level,preview.level);assert.equal(stateHash(fresh.run.state),stateHash(createGame(preview.level)));
  const stage=preview.level.gardenStage,variant=Math.floor((id-10)/20)%GARDEN_STAGE_VARIANTS;
  let actions=stage?gardenProofs.find(p=>p.kind===stage.kind&&p.variant===variant)!.actions as Action[]:(campaignProofs as Record<string,{actions:Action[]}>)[id]!.actions;
  let result=replay(preview.level,actions);if(!result.accepted||result.state.status!=='won'){let solved=solve(preview.level);if(solved.status!=='won')solved=solve(preview.level,'special');actions=solved.actions;}
  player=await clear(fresh.run,actions);
 }
 record('Latest downloaded rules start and settle six ordinary, water and animal boards with identical local replay and five preserved hearts');
 // Two fresh starts randomize; acknowledgement retry and the active-run path do not.
 await db.prepare('UPDATE players SET data=? WHERE id=?').bind(JSON.stringify({...player,level:31}),user.player.id).run();
 const randomPreview=await ok<LevelPreview>('/levels/next?engineVersion='+ENGINE_VERSION),body={key:key(),randomStart:true,engineVersion:ENGINE_VERSION,levelHash:randomPreview.levelHash,preBoosters:[]};
 const first=await ok<{run:Run;player:Player}>('/runs/start',body);assert.notEqual(first.run.level.seed,randomPreview.level.seed);
 assert.equal(stateHash(first.run.state),stateHash(createGame(first.run.level)));assert.deepEqual(await ok('/runs/start',body),first);
 assert.deepEqual((await ok<{run:Run}>('/runs/start',{...body,key:key()})).run,first.run);
 assert.deepEqual((await ok<StateResponse>('/me')).activeRun,first.run);
 const abandoned=await ok<{player:Player}>('/runs/'+first.run.id+'/abandon',{key:key()});assert.equal(abandoned.player.hearts,first.player.hearts-1);
 const second=await ok<{run:Run}>('/runs/start',{...body,key:key()});assert.notEqual(second.run.level.seed,first.run.level.seed);assert.notDeepEqual(second.run.level.initial,first.run.level.initial);
 assert.equal(stateHash(second.run.state),stateHash(createGame(second.run.level)));
 await ok('/runs/'+second.run.id+'/abandon',{key:key()});
 record('Fresh attempts receive new tile layouts; idempotent retry and active resume retain exact state, seed and inventory');
 // The reported level 60 and branching water 50 expose all connected floors.
 player=(await ok<StateResponse>('/me')).player;
 for(const id of [50,60]){
  await db.prepare('UPDATE players SET data=? WHERE id=?').bind(JSON.stringify({...player,level:id}),user.player.id).run();
  const start=await ok<{run:Run}>('/runs/start',{key:key(),engineVersion:ENGINE_VERSION,preBoosters:[]}),stage=start.run.level.gardenStage!;
  const actions=gardenProofs.find(p=>p.kind===stage.kind&&p.variant===Math.floor((id-10)/20)%GARDEN_STAGE_VARIANTS)!.actions as Action[];
  player=await clear(start.run,actions);
 }
 record('The reported animal level 60 and branching water level 50 clear via identical actual Worker replay');

 await writeFile('output/verification/engine-content/http.json',JSON.stringify({at:new Date().toISOString(),passed:true,scope:'Actual local Worker and isolated temporary D1',checks},null,2)+'\n');
}finally{await mf.dispose();}
