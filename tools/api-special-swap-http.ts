import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile,readdir,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
import {unstable_splitSqlQuery} from 'wrangler';
import {applyAction,stateHash} from '@garden/core';
import {ENGINE_VERSION,type AuthResponse,type Run,type Special} from '@garden/contracts';
import {specialSwapBoard,SPECIAL_SWAP_ACTION} from './fixtures/special-swap';
await mkdir('.wrangler',{recursive:true});await mkdir('output/verification',{recursive:true});
const statePath=resolve(await mkdtemp('.wrangler/special-swap-http-'));
const build=spawnSync(process.execPath,['node_modules/wrangler/bin/wrangler.js','deploy','--dry-run','--config','apps/api/wrangler.jsonc','--outdir',join(statePath,'bundle')],{encoding:'utf8',env:{...process.env,WRANGLER_LOG_PATH:join(statePath,'build.log'),WRANGLER_SEND_METRICS:'false'}});
assert.equal(build.status,0,build.stderr||build.stdout);
const mf=new Miniflare(convertV4MiniflareOptions({modules:true,scriptPath:join(statePath,'bundle/index.js'),compatibilityDate:'2026-11-02',compatibilityFlags:['nodejs_compat'],port:0,d1Databases:{DB:'special-swap-private'},r2Buckets:['ASSETS'],durableObjects:{GUILD_ROOMS:{className:'GuildRoom',useSQLite:true}},bindings:{ENVIRONMENT:'development',LOCAL_DEV_TOOLS:'disabled',CLIENT_ORIGINS:'http://localhost:5194',ASSET_VERSION:'test',ASSET_PUBLIC_ORIGIN:'',GOOGLE_CLIENT_IDS:'',APPLE_CLIENT_IDS:'',GOOGLE_PACKAGE_NAME:'com.cloudgarden.match',GOOGLE_IAP_ENVIRONMENT:'Sandbox',APPLE_BUNDLE_ID:'com.cloudgarden.match',ADMOB_HEART_AD_UNIT:'',ADMOB_COIN_AD_UNIT:'',ADMOB_AD_UNITS:'',ADMOB_REWARD_ITEMS:'reward'}}));
const checks:string[]=[],key=()=>crypto.randomUUID(),record=(name:string)=>{checks.push(name);console.log('PASS '+name)};
try{
 const db=await mf.getD1Database('DB');
 for(const file of (await readdir('apps/api/migrations')).filter(n=>n.endsWith('.sql')).sort())await db.batch(unstable_splitSqlQuery(await readFile('apps/api/migrations/'+file,'utf8')).map(q=>db.prepare(q)));
 const origin=await mf.ready;
 async function req(user:AuthResponse,path:string,body?:unknown){const res=await fetch(new URL('/api'+path,origin),{method:body===undefined?'GET':'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+user.accessToken},...(body===undefined?{}:{body:JSON.stringify(body)})});const result=await res.json() as {data:any;error?:unknown};assert.equal(res.status,200,path+JSON.stringify(result.error));return result.data;}
 async function fixture(kind:Special,win=false){
  const guest=await fetch(new URL('/api/auth/guest',origin),{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});assert.equal(guest.status,200);const user=(await guest.json() as {data:AuthResponse}).data;
  const started=await req(user,'/runs/start',{key:key(),engineVersion:ENGINE_VERSION}),run=started.run as Run;
  run.state=specialSwapBoard(kind);if(win)run.state.goals=[{kind:'drop',count:4,remaining:4}];run.level={...run.level,width:7,height:7,colors:[...run.state.colors],shape:Array(49).fill(true),goals:structuredClone(run.state.goals),obstacles:[],initial:run.state.cells.map(c=>c.tile),moves:20,seed:14121,tutorial:undefined};
  await db.prepare('UPDATE runs SET data=? WHERE id=?').bind(JSON.stringify(run),run.id).run();
  return {user,run,player:started.player};
 }
 for(const kind of ['wind-row','wind-column','bomb','glider','rainbow'] as const)for(const reverse of [false,true]){
  const {user,run,player}=await fixture(kind),action=reverse?{type:'swap',from:17,to:24} as const:SPECIAL_SWAP_ACTION,expected=applyAction(run.state,action),body={key:key(),sequence:0,actions:[action]};
  const actual=await req(user,'/runs/'+run.id+'/actions',body);
  assert.equal(stateHash(actual.run.state),stateHash(expected.state));assert.deepEqual(actual.events,expected.events);assert.equal(actual.run.sequence,1);assert.equal(actual.run.state.moves,19);
  const gravity=actual.events.findIndex((e:any)=>e.type==='fall'||e.type==='spawn'&&e.kind==='normal'),phase=actual.events.slice(0,gravity);
  assert(phase.some((e:any)=>e.type==='spawn'&&e.kind==='glider'&&e.cells[0]===24));for(const i of [25,31,32])assert(phase.some((e:any)=>e.type==='remove'&&e.kind==='drop'&&e.cells.includes(i)));
  assert.equal(phase.filter((e:any)=>e.type==='special'&&e.kind===kind&&e.cells[0]===17).length,1);
  const duplicate=await req(user,'/runs/'+run.id+'/actions',body);assert.equal(stateHash(duplicate.run.state),stateHash(actual.run.state));assert.equal(duplicate.run.sequence,1);
  const after=await req(user,'/me');for(const field of ['coins','boundCoins','stars','hearts','inventory','restored','level'])assert.deepEqual(after.player[field],player[field],field);
  assert.equal(stateHash(after.activeRun.state),stateHash(actual.run.state));record(kind+' '+(reverse?'normal-first':'special-first')+': client/server agree; match+power; one move; idempotent; persisted; balances unchanged');
 }
 await writeFile('output/verification/special-swap-http.json',JSON.stringify({passed:checks.length,checks,scope:'Real Worker and isolated D1 only; no actual player account/run changes'},null,2));
 if(process.argv.includes('--ui')){
  const {user,run}=await fixture('wind-row',true);
  process.env.VITE_API_URL=origin.origin+'/api';const {createServer}=await import('vite');const vite=await createServer({configFile:resolve('apps/client/vite.config.ts'),server:{port:5194,strictPort:true,host:'127.0.0.1'}});await vite.listen();
  const html=`<!doctype html><html lang="ko"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><title>아이템 교환 매치 검수</title></head><body data-run-id="${run.id}"><div id="root"></div><script type="module">import RefreshRuntime from '/@react-refresh';RefreshRuntime.injectIntoGlobalHook(window);window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>type=>type;window.__vite_plugin_react_preamble_installed__=true;sessionStorage.setItem('special-swap-test-access',${JSON.stringify(user.accessToken)});import('/@fs${resolve('tools/fixtures/special-swap-ui.tsx')}');</script></body></html>`;
  const file=join(statePath,'ui.html');await writeFile(file,html);console.log(JSON.stringify({uiUrl:'http://localhost:5194/@fs'+file,scope:'Actual Board + actual action API against disposable isolated run'}));
  await new Promise<void>(resolve=>{process.once('SIGINT',resolve);process.once('SIGTERM',resolve)});await vite.close();
 }
}finally{await mf.dispose();}
