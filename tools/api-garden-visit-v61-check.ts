import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile,readdir,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
import {unstable_splitSqlQuery} from 'wrangler';
import type {AuthResponse,Envelope} from '@garden/contracts';
import {RESTORATIONS} from '@garden/content';
import type {GardenVisitResponse,GardenWorldState} from '../packages/garden-world/src';
await mkdir('.wrangler',{recursive:true});await mkdir('output/verification/garden-visit-v61',{recursive:true});
const statePath=resolve(await mkdtemp('.wrangler/garden-visit-http-'));
const build=spawnSync(process.execPath,['node_modules/wrangler/bin/wrangler.js','deploy','--dry-run','--config','apps/api/wrangler.jsonc','--outdir',join(statePath,'bundle')],{encoding:'utf8',env:{...process.env,WRANGLER_LOG_PATH:join(statePath,'build.log'),WRANGLER_SEND_METRICS:'false'}});
assert.equal(build.status,0,build.stderr||build.stdout);
const mf=new Miniflare(convertV4MiniflareOptions({modules:true,scriptPath:join(statePath,'bundle/index.js'),compatibilityDate:'2026-11-02',compatibilityFlags:['nodejs_compat'],port:0,d1Databases:{DB:'garden-visit-private'},r2Buckets:['ASSETS'],durableObjects:{GUILD_ROOMS:{className:'GuildRoom',useSQLite:true}},bindings:{ENVIRONMENT:'development',LOCAL_DEV_TOOLS:'disabled',CLIENT_ORIGINS:'http://localhost:5193',ASSET_VERSION:'test',ASSET_PUBLIC_ORIGIN:'',GOOGLE_CLIENT_IDS:'',APPLE_CLIENT_IDS:'',GOOGLE_PACKAGE_NAME:'com.cloudgarden.match',GOOGLE_IAP_ENVIRONMENT:'Sandbox',APPLE_BUNDLE_ID:'com.cloudgarden.match'}}));
const checks:string[]=[],key=()=>crypto.randomUUID(),record=(name:string)=>{checks.push(name);console.log('PASS '+name);};
try{
 const db=await mf.getD1Database('DB');
 for(const file of (await readdir('apps/api/migrations')).filter(n=>n.endsWith('.sql')).sort())await db.batch(unstable_splitSqlQuery(await readFile('apps/api/migrations/'+file,'utf8')).map(q=>db.prepare(q)));
 const origin=await mf.ready;
 async function req<T>(user:AuthResponse|null,path:string,body?:unknown){const res=await fetch(new URL('/api'+path,origin),{method:body===undefined?'GET':'POST',headers:{'Content-Type':'application/json',...(user?{Authorization:'Bearer '+user.accessToken}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});return {status:res.status,...await res.json() as Envelope<T>&{error?:{code:string}}};}
 async function ok<T>(user:AuthResponse|null,path:string,body?:unknown){const r=await req<T>(user,path,body);assert.equal(r.status,200,path+JSON.stringify(r.error));return r.data;}
 const owner=await ok<AuthResponse>(null,'/auth/guest',{}),visitor=await ok<AuthResponse>(null,'/auth/guest',{});
 const seeded={...owner.player,nickname:'방문 대상',level:33,coins:9000,stars:999,restored:RESTORATIONS.slice(0,15).map(t=>t.id)};
 await db.prepare('UPDATE players SET data=? WHERE id=?').bind(JSON.stringify(seeded),owner.player.id).run();
 const visitPath='/garden/visits/'+owner.player.id+'?gardenArt=garden-v51';
 assert.equal((await req(null,visitPath)).status,401);
 assert.equal((await req(visitor,'/garden/visits/not-an-id')).status,400);
 assert.equal((await req(visitor,'/garden/visits/'+key())).status,404);record('requires authentication and rejects invalid or nonexistent targets');
 const initial=await ok<GardenVisitResponse>(visitor,visitPath);
 assert.equal(initial.owner.userId,owner.player.id);assert.equal(initial.owner.nickname,seeded.nickname);assert.equal(initial.owner.level,33);assert(Object.keys(initial.world.placements).length>0);
 assert.equal(await db.prepare('SELECT count(*) n FROM garden_worlds WHERE user_id=?').bind(owner.player.id).first<number>('n'),0);record('strangers can visit earned restorations without creating or modifying the owner garden');
 const shop=await ok<{shopVersion?:2;prices:Record<string,number>}>(owner,'/garden/world?shopVersion=2&gardenArt=garden-v62');
 const purchased=await ok<{world:GardenWorldState;instanceId:string}>(owner,'/garden/shop/buy',{key:key(),itemId:'garden-bench',...(shop.shopVersion===2?{expectedUnitPrice:shop.prices['garden-bench']}: {})});
 const before=await db.prepare('SELECT p.data player,g.data garden FROM players p JOIN garden_worlds g ON g.user_id=p.id WHERE p.id=?').bind(owner.player.id).first();
 const view=await ok<GardenVisitResponse>(visitor,visitPath);
 assert.deepEqual(Object.keys(view).sort(),['owner','world']);assert.deepEqual(Object.keys(view.owner).sort(),['level','nickname','userId']);
 assert(!view.world.owned[purchased.instanceId]);assert.deepEqual(view.world.grants,{});assert.deepEqual(view.world.operations,{});
 assert(Object.keys(view.world.placements).every(id=>!!view.world.owned[id]));
 assert.deepEqual(Object.keys(view.world).sort(),['ownerId','mapId','revision','unlockedRegions','owned','placements','grants','operations'].sort());record('visit excludes unplaced inventory, currencies, private history and player settings');
 assert.equal((await req(visitor,visitPath,{key:key(),type:'store'})).status,404);
 const target=Object.keys(view.world.placements)[0]!;
 const attempt=await req(visitor,'/garden/world/commands',{key:key(),type:'store',instanceId:target,expectedRevision:0});assert.equal(attempt.error?.code,'NOT_OWNED');
 assert.deepEqual(await db.prepare('SELECT p.data player,g.data garden FROM players p JOIN garden_worlds g ON g.user_id=p.id WHERE p.id=?').bind(owner.player.id).first(),before);record('visit accepts no writes; copied target IDs cannot edit the owner layout or balance');
 const self=await ok<GardenVisitResponse>(visitor,'/garden/visits/'+visitor.player.id);assert.deepEqual(self.world.placements,{});record('new gardens are viewable without fabricated objects');
 for(const [a,b]of [[owner.player.id,visitor.player.id],[visitor.player.id,owner.player.id]]){
  await db.prepare('INSERT INTO blocks VALUES(?,?)').bind(a,b).run();assert.equal((await req(visitor,visitPath)).status,403);
  await db.prepare('DELETE FROM blocks WHERE user_id=? AND blocked_id=?').bind(a,b).run();
 }record('either direction of blocking prevents visits, matching public profile access');
 await db.prepare('UPDATE players SET deleted_at=? WHERE id=?').bind(Date.now(),owner.player.id).run();assert.equal((await req(visitor,visitPath)).status,404);record('deleted accounts are not visitable');
 await writeFile('output/verification/garden-visit-v61/api-checks.json',JSON.stringify({passed:true,checks,scope:'Isolated Worker HTTP and D1; no production accounts or writes'},null,2)+'\n');
}finally{await mf.dispose();}
