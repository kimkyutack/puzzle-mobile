import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile,readdir,writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
import {unstable_splitSqlQuery} from 'wrangler';
import type {AuthResponse,Player,StoryState} from '@garden/contracts';
import {RESTORATIONS,STORY_SCENES} from '@garden/content';
import {validateGardenPlacement,type GardenWorldState} from '../packages/garden-world/src';
await mkdir('.wrangler',{recursive:true});await mkdir('output/verification/story-v30',{recursive:true});
const statePath=resolve(await mkdtemp('.wrangler/story-v30-'));
const bundle=spawnSync(process.execPath,['node_modules/wrangler/bin/wrangler.js','deploy','--dry-run','--config','apps/api/wrangler.jsonc','--outdir',join(statePath,'bundle')],{encoding:'utf8',env:{...process.env,WRANGLER_LOG_PATH:join(statePath,'build.log'),WRANGLER_SEND_METRICS:'false'}});assert.equal(bundle.status,0,bundle.stderr||bundle.stdout);
const mf=new Miniflare(convertV4MiniflareOptions({modules:true,scriptPath:join(statePath,'bundle/index.js'),compatibilityDate:'2026-11-02',compatibilityFlags:['nodejs_compat'],port:0,d1Databases:{DB:'story-v30-isolated'},r2Buckets:['ASSETS'],durableObjects:{GUILD_ROOMS:{className:'GuildRoom',useSQLite:true}},bindings:{ENVIRONMENT:'development',LOCAL_DEV_TOOLS:'disabled',CLIENT_ORIGINS:'http://localhost:5198',ASSET_VERSION:'test',ASSET_PUBLIC_ORIGIN:'',GOOGLE_CLIENT_IDS:'',APPLE_CLIENT_IDS:'',ADMOB_AD_UNITS:''}}));
const checks:string[]=[],record=(name:string)=>{checks.push(name);console.log('PASS '+name)},key=()=>crypto.randomUUID();
type Restored={player:Player;world:GardenWorldState;areaComplete:boolean;areaReward:number};
try{
 const db=await mf.getD1Database('DB');for(const file of(await readdir('apps/api/migrations')).filter(f=>f.endsWith('.sql')).sort())await db.batch(unstable_splitSqlQuery(await readFile('apps/api/migrations/'+file,'utf8')).map(query=>db.prepare(query)));
 const origin=await mf.ready;
 async function req<T>(user:AuthResponse|null,path:string,body?:unknown){const response=await fetch(new URL('/api'+path,origin),{method:body===undefined?'GET':'POST',headers:{'Content-Type':'application/json',...(user?{Authorization:'Bearer '+user.accessToken}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});return {status:response.status,...await response.json() as {data:T;error?:{code:string}}};}
 async function ok<T>(user:AuthResponse|null,path:string,body?:unknown){const result=await req<T>(user,path,body);assert.equal(result.status,200,path+JSON.stringify(result.error));return result.data;}
 async function seed(count:number,stars=200){const user=await ok<AuthResponse>(null,'/auth/guest',{}),player={...user.player,level:38,coins:3280,stars,restored:RESTORATIONS.slice(0,count).map(t=>t.id)};await db.prepare('UPDATE players SET data=? WHERE id=?').bind(JSON.stringify(player),player.id).run();return {...user,player};}
 const user=await seed(18),other=await seed(18,0),before=(await ok<{player:Player}>(user,'/me')).player,initial=(await ok<{world:GardenWorldState}>(user,'/garden/world')).world;
 assert.deepEqual(before.restored,RESTORATIONS.slice(0,18).map(t=>t.id));assert.equal((await ok<StoryState>(user,'/story')).contentVersion,'cloud-letters-2');
 assert.equal((await req(null,'/garden/restore',{key:key(),taskId:RESTORATIONS[18]!.id})).status,401);
 assert.equal((await req(other,'/garden/restore',{key:key(),taskId:RESTORATIONS[18]!.id})).error?.code,'STARS_EMPTY');
 assert.equal((await req(user,'/garden/restore',{key:key(),taskId:RESTORATIONS[19]!.id})).error?.code,'RESTORATION_ORDER');
 assert.deepEqual((await ok<{player:Player}>(user,'/me')).player,before);record('existing eighteen completions survive untouched; unauthorized, out-of-order and insufficient-star requests leave progress unchanged');
 const firstBody={key:key(),taskId:RESTORATIONS[18]!.id},first=await ok<Restored>(user,'/garden/restore',firstBody);
 assert.equal(first.player.stars,199);assert(first.world.placements['restored-postal-arrival']);assert.deepEqual(await ok(user,'/garden/restore',firstBody),first);
 const saved=await db.prepare('SELECT data FROM garden_worlds WHERE user_id=?').bind(user.player.id).first<string>('data');assert(saved);assert.deepEqual(JSON.parse(saved),first.world);
 assert.equal(await db.prepare("SELECT SUM(delta) amount FROM ledger WHERE user_id=? AND asset='stars' AND source_id=?").bind(user.player.id,firstBody.key).first<number>('amount'),-1);record('restoration returns the committed world and player in one response; retry has exactly one star debit and one stable facility');
 let latest=first;
 for(const task of RESTORATIONS.slice(19)){latest=await ok<Restored>(user,'/garden/restore',{key:key(),taskId:task.id});for(const placement of Object.values(latest.world.placements))validateGardenPlacement(latest.world,placement);}
 assert.equal(latest.player.stars,41);assert.equal(latest.player.restored.length,63);assert.equal(latest.player.coins,before.coins+300);assert.equal(Object.keys(latest.world.placements).length,112);
 for(const old of Object.values(initial.placements))assert.deepEqual(latest.world.placements[old.instanceId],old);
 assert.deepEqual((await ok<{world:GardenWorldState}>(user,'/garden/world')).world,latest.world);record('all forty-five new jobs continue in order, save valid visible facilities, preserve every legacy placement and grant only three completion bonuses');
 const opened=await ok<StoryState>(user,'/story');assert.deepEqual(opened.unlocked,STORY_SCENES.map(s=>s.id));
 for(let i=0;i<opened.unlocked.length;i+=19)await ok<StoryState>(user,'/story/seen',{sceneIds:opened.unlocked.slice(i,i+19)});
 assert.deepEqual((await ok<StoryState>(user,'/story')).seen,opened.unlocked);assert.deepEqual((await ok<{player:Player}>(user,'/me')).player,latest.player);record('all sixty-four scenes acknowledge in compatible batches without currency or Player changes');
 const race=await seed(18),raced=await Promise.all([0,1].map(()=>ok<Restored>(race,'/garden/restore',{key:key(),taskId:RESTORATIONS[18]!.id})));assert.equal((await ok<{player:Player}>(race,'/me')).player.stars,199);assert(raced.every(r=>r.world.owned['restored-postal-arrival']));record('concurrent restoration requests cannot duplicate a charge or an earned object');
 const layout=await seed(18),old=(await ok<{world:GardenWorldState}>(layout,'/garden/world')).world,bench='restored-sky-bench';
 const placed=await ok<{world:GardenWorldState}>(layout,'/garden/world/commands',{key:key(),type:'move',instanceId:bench,x:20,y:20,rotation:180,expectedRevision:old.revision});
 const restored=await ok<Restored>(layout,'/garden/restore',{key:key(),taskId:RESTORATIONS[18]!.id});assert.deepEqual(restored.world.placements[bench],placed.world.placements[bench]);record('a moved and rotated old facility remains unchanged when the next story job is restored');
 await writeFile('output/verification/story-v30/http.json',JSON.stringify({at:new Date().toISOString(),passed:true,scope:'Actual Worker HTTP and isolated temporary D1; no production or existing player data',checks,restorations:63,scenes:64,newStarCost:159},null,2));
 if(process.argv.includes('--ui')){
  const fixtures={old:await seed(18),office:await seed(28),pond:await seed(39),station:await seed(54),complete:await seed(63),failure:await seed(18)};
  process.env.VITE_API_URL='/api';
  const {createServer}=await import('vite');let restoreRequests=0,seenRequests=0,worldRequests=0;
  const vite=await createServer({configFile:resolve('apps/client/vite.config.ts'),plugins:[{name:'story-v30-local-qa',configureServer(server){server.middlewares.use(async(req,res,next)=>{
   if(req.url?.startsWith('/__story-v30/')){const which=req.url.split('/')[2] as keyof typeof fixtures,user=fixtures[which];if(!user){res.statusCode=404;res.end();return;}
    const setup=`<script>if(localStorage.getItem('story-qa-user')!==${JSON.stringify(user.player.id)}){localStorage.clear();localStorage.setItem('story-qa-user',${JSON.stringify(user.player.id)});localStorage.setItem('cloud-garden-language-v1',JSON.stringify({language:'ko',pending:false}));localStorage.setItem('cloud-garden-session-v1',${JSON.stringify(JSON.stringify({accessToken:user.accessToken,refreshToken:user.refreshToken}))});}</script><style>html,body,#root{height:844px!important;width:390px!important;margin:0 auto!important}.game-shell{--safe-top:47px!important;--safe-bottom:34px!important;height:844px!important;min-height:0!important}.game-shell .live-garden{height:844px}</style><script type="module">import RefreshRuntime from '/@react-refresh';RefreshRuntime.injectIntoGlobalHook(window);window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>type=>type;window.__vite_plugin_react_preamble_installed__=true;</script>`;
    const html=(await readFile('apps/client/index.html','utf8')).replace('<script type="module" src="/src/main.tsx">',setup+'<script type="module" src="/src/main.tsx">');res.setHeader('Content-Type','text/html');res.end(await server.transformIndexHtml(req.url,html));return;
   }
   if(!req.url?.startsWith('/api/')){next();return;}
   const chunks:Buffer[]=[];for await(const chunk of req)chunks.push(Buffer.from(chunk));const body=Buffer.concat(chunks),headers:Record<string,string>={};for(const [name,value]of Object.entries(req.headers))if(value&&name!=='host'&&name!=='content-length')headers[name]=Array.isArray(value)?value.join(','):value;
   if(req.url.startsWith('/api/garden/restore')&&headers.authorization==='Bearer '+fixtures.failure.accessToken)await db.prepare("UPDATE players SET data=json_set(data,'$.stars',0) WHERE id=?").bind(fixtures.failure.player.id).run();
   const response=await mf.dispatchFetch(new URL(req.url,origin).href,{method:req.method,headers,...(body.length?{body}: {})});
   if(req.url.startsWith('/api/garden/restore')){restoreRequests++;await new Promise(r=>setTimeout(r,3000));}
   if(req.url.startsWith('/api/story/seen')){seenRequests++;await new Promise(r=>setTimeout(r,8000));}
   if(req.url==='/api/garden/world')worldRequests++;
   await writeFile('output/verification/story-v30/ui-requests.json',JSON.stringify({restoreRequests,seenRequests,worldRequests},null,2));
   res.statusCode=response.status;response.headers.forEach((value,name)=>res.setHeader(name,value));res.setHeader('X-Story-QA-Counts',JSON.stringify({restoreRequests,seenRequests,worldRequests}));res.end(Buffer.from(await response.arrayBuffer()));
  });}}],server:{port:5198,strictPort:true,host:'127.0.0.1',hmr:false,watch:{ignored:['**/*']}}});
  await vite.listen();console.log('Story QA: http://localhost:5198/__story-v30/old#/home (restore response +3s, seen response +8s)');
  await new Promise<void>(done=>{process.once('SIGINT',done);process.once('SIGTERM',done)});await vite.close();
 }
}finally{await mf.dispose();}
