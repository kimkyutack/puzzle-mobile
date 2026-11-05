import assert from 'node:assert/strict';
import {mkdtemp,readFile,readdir,writeFile,mkdir} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
import {unstable_splitSqlQuery} from 'wrangler';
import type {AuthResponse} from '@garden/contracts';
await mkdir('.wrangler',{recursive:true});
const dir=resolve(await mkdtemp('.wrangler/start-special-v25-'));
const build=spawnSync(process.execPath,['node_modules/wrangler/bin/wrangler.js','deploy','--dry-run','--config','output/garden-directions-worker-v24/wrangler.jsonc','--outdir',join(dir,'bundle')],{encoding:'utf8',env:{...process.env,WRANGLER_LOG_PATH:join(dir,'build.log'),WRANGLER_SEND_METRICS:'false'}});assert.equal(build.status,0,build.stderr);
const mf=new Miniflare(convertV4MiniflareOptions({modules:true,scriptPath:join(dir,'bundle/index.js'),compatibilityDate:'2026-11-02',compatibilityFlags:['nodejs_compat'],port:0,d1Databases:{DB:'v25-isolated'},r2Buckets:['ASSETS'],durableObjects:{GUILD_ROOMS:{className:'GuildRoom',useSQLite:true}},bindings:{ENVIRONMENT:'development',LOCAL_DEV_TOOLS:'disabled',CLIENT_ORIGINS:'http://localhost:5194',ASSET_VERSION:'test',ASSET_PUBLIC_ORIGIN:'',GOOGLE_CLIENT_IDS:'',APPLE_CLIENT_IDS:'',ADMOB_AD_UNITS:''}}));
try{
 const db=await mf.getD1Database('DB');for(const file of (await readdir('apps/api/migrations')).filter(n=>n.endsWith('.sql')).sort())await db.batch(unstable_splitSqlQuery(await readFile('apps/api/migrations/'+file,'utf8')).map(q=>db.prepare(q)));
 const origin=await mf.ready,res=await fetch(new URL('/api/auth/guest',origin),{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'}),{data:ui}=await res.json() as {data:AuthResponse};assert.equal(res.status,200);
 await db.prepare('UPDATE players SET data=? WHERE id=?').bind(JSON.stringify({...ui.player,level:20,tutorials:['rainbow','wind-row','wind-column','bomb','crate'],nickname:'플레이 검수'}),ui.player.id).run();
 process.env.VITE_API_URL=origin.origin+'/api';const {createServer}=await import('vite');const vite=await createServer({configFile:resolve('apps/client/vite.config.ts'),server:{port:5194,strictPort:true,host:'127.0.0.1'}});await vite.listen();
 const setup=`<script>localStorage.setItem('cloud-garden-language-v1',JSON.stringify({language:'ko',pending:false}));localStorage.setItem('cloud-garden-session-v1',${JSON.stringify(JSON.stringify({accessToken:ui.accessToken,refreshToken:ui.refreshToken}))});</script><script type="module">import RefreshRuntime from '/@react-refresh';RefreshRuntime.injectIntoGlobalHook(window);window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>type=>type;window.__vite_plugin_react_preamble_installed__=true;</script>`;
 const file=join(dir,'ui.html');await writeFile(file,(await readFile('apps/client/index.html','utf8')).replace('<script type="module" src="/src/main.tsx">',setup+'<script type="module" src="/src/main.tsx">'));
 console.log(JSON.stringify({uiUrl:'http://localhost:5194/@fs'+file+'#/home',effectsUrl:'http://localhost:5194/@fs'+resolve('tools/special-v25-fixture.html'),scope:'Actual client with deployed 1.2.0 Worker source in temporary D1; separate no-API effect board'}));
 await new Promise<void>(done=>{process.once('SIGINT',done);process.once('SIGTERM',done)});await vite.close();
}finally{await mf.dispose();}
