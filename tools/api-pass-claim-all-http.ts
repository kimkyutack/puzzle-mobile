import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile,readdir,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
import {unstable_splitSqlQuery} from 'wrangler';
import {ENGINE_VERSION} from '@garden/contracts';
import type {Action,AuthResponse,Envelope,PassClaimAllResponse,Player,Run,StateResponse} from '@garden/contracts';
import solutions from '../packages/content/src/solutions.json';

// Real application Worker over HTTP. Only this test's ephemeral D1 is accessible.
// Premium ownership and a rollback fault are private test fixtures, never store proof.
await mkdir('.wrangler',{recursive:true});await mkdir('output/verification',{recursive:true});
const statePath=resolve(await mkdtemp('.wrangler/pass-claim-all-http-'));
const build=spawnSync(process.execPath,['node_modules/wrangler/bin/wrangler.js','deploy','--dry-run','--config','apps/api/wrangler.jsonc','--outdir',join(statePath,'bundle')],{encoding:'utf8',env:{...process.env,WRANGLER_LOG_PATH:join(statePath,'build.log'),WRANGLER_SEND_METRICS:'false'}});
assert.equal(build.status,0,build.stderr||build.stdout);
const mf=new Miniflare(convertV4MiniflareOptions({modules:true,scriptPath:join(statePath,'bundle/index.js'),compatibilityDate:'2026-11-02',compatibilityFlags:['nodejs_compat'],port:0,d1Databases:{DB:'pass-claim-all-private'},r2Buckets:['ASSETS'],durableObjects:{GUILD_ROOMS:{className:'GuildRoom',useSQLite:true}},bindings:{ENVIRONMENT:'development',LOCAL_DEV_TOOLS:'disabled',CLIENT_ORIGINS:'',ASSET_VERSION:'test',ASSET_PUBLIC_ORIGIN:'',GOOGLE_CLIENT_IDS:'',APPLE_CLIENT_IDS:'',GOOGLE_PACKAGE_NAME:'com.cloudgarden.match',GOOGLE_IAP_ENVIRONMENT:'Sandbox',APPLE_BUNDLE_ID:'com.cloudgarden.match',ADMOB_HEART_AD_UNIT:'',ADMOB_COIN_AD_UNIT:'',ADMOB_AD_UNITS:'',ADMOB_REWARD_ITEMS:'reward'}}));
const checks:string[]=[];const record=(name:string)=>{checks.push(name);console.log('PASS '+name);};const key=()=>crypto.randomUUID();
try{
 const db=await mf.getD1Database('DB');
 for(const file of (await readdir('apps/api/migrations')).filter(name=>name.endsWith('.sql')).sort())await db.batch(unstable_splitSqlQuery(await readFile('apps/api/migrations/'+file,'utf8')).map(query=>db.prepare(query)));
 const now=Date.now();await db.prepare('UPDATE seasons SET starts_at=?,ends_at=?').bind(now-1000,now+28*86_400_000).run();
 const season=await db.prepare('SELECT id FROM seasons LIMIT 1').first<{id:string}>();assert(season);
 const origin=await mf.ready;
 async function request<T>(user:AuthResponse|null,path:string,body?:unknown){
  const response=await fetch(new URL('/api'+path,origin),{method:body===undefined?'GET':'POST',headers:{'Content-Type':'application/json',...(user?{Authorization:'Bearer '+user.accessToken}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});
  const result=await response.json() as Envelope<T>&{error?:{code:string;message:string}};return {status:response.status,data:result.data,error:result.error};
 }
 async function ok<T>(user:AuthResponse|null,path:string,body?:unknown){const result=await request<T>(user,path,body);assert.equal(result.status,200,`${path}: ${JSON.stringify(result.error)}`);return result.data;}
 const me=async(user:AuthResponse)=>(await ok<StateResponse>(user,'/me')).player;
 async function durable(user:AuthResponse){return {player:await db.prepare('SELECT data,version FROM players WHERE id=?').bind(user.player.id).first(),claims:(await db.prepare('SELECT * FROM reward_claims WHERE user_id=? ORDER BY kind,source_id').bind(user.player.id).all()).results,ledger:(await db.prepare('SELECT * FROM ledger WHERE user_id=? ORDER BY id').bind(user.player.id).all()).results};}
 async function clear(user:AuthResponse,count:number){
  for(let i=0;i<count;i++){
   const {run}=await ok<{run:Run}>(user,'/runs/start',{key:key(),engineVersion:ENGINE_VERSION});
   const result=await ok<{run:Run}>(user,`/runs/${run.id}/actions`,{key:key(),sequence:0,actions:(solutions as Record<string,{actions:Action[]}>)[run.level.id]!.actions});assert.equal(result.run.state.status,'won');await ok(user,`/runs/${run.id}/finish`,{key:key()});
   if(run.level.id===4)await ok(user,'/hearts/free',{key:key()});
  }
 }
 assert.equal((await request(null,'/pass/claim-all',{key:key()})).status,401);
 const empty=await ok<AuthResponse>(null,'/auth/guest',{}),free=await ok<AuthResponse>(null,'/auth/guest',{}),paid=await ok<AuthResponse>(null,'/auth/guest',{}),race=await ok<AuthResponse>(null,'/auth/guest',{});
 const initial=await durable(empty);
 assert.equal((await request(empty,'/pass/claim-all',{})).error?.code,'INVALID_IDEMPOTENCY_KEY');
 for(const input of [{key:key(),tier:30},{key:key(),track:'premium'},{key:key(),points:9999},{key:key(),seasonId:'forged'}])assert.equal((await request(empty,'/pass/claim-all',input)).status,400);
 const emptyKey=key(),nothing=await ok<PassClaimAllResponse>(empty,'/pass/claim-all',{key:emptyKey});assert.deepEqual(nothing.claimed,[]);assert.equal(nothing.reason,'NOTHING_TO_CLAIM');assert.deepEqual(await durable(empty),initial);assert.deepEqual(await ok(empty,'/pass/claim-all',{key:emptyKey}),nothing);
 assert.equal((await request(empty,'/events/daily',{key:emptyKey})).error?.code,'IDEMPOTENCY_CONFLICT');
 record('authenticated bounded input and empty idempotent receipt preserve raw Player/version, claims and ledger');
 await db.prepare("UPDATE players SET data=json_set(data,'$.passPoints',9990) WHERE id=?").bind(empty.player.id).run();const forged=await durable(empty);assert.equal((await ok<PassClaimAllResponse>(empty,'/pass/claim-all',{key:key()})).claimed.length,0);assert.deepEqual(await durable(empty),forged);
 record('saved client-like passPoints cannot replace authoritative season clear records');
 await clear(free,4);await ok(free,'/pass/claim',{key:key(),tier:2,track:'free'});const freeBefore=await me(free);
 const freeResult=await ok<PassClaimAllResponse>(free,'/pass/claim-all',{key:key()});assert.deepEqual(freeResult.claimed,[{tier:1,track:'free'},{tier:3,track:'free'},{tier:4,track:'free'}]);assert.equal(freeResult.player.coins,freeBefore.coins+75);assert.equal(freeResult.player.version,freeBefore.version+1);assert.deepEqual(freeResult.player.inventory,freeBefore.inventory);
 assert.equal((await db.prepare("SELECT count(*) n FROM reward_claims WHERE user_id=? AND kind='pass:premium'").bind(free.player.id).first<{n:number}>())?.n,0);const freeDone=await durable(free);assert.equal((await ok<PassClaimAllResponse>(free,'/pass/claim-all',{key:key()})).reason,'NOTHING_TO_CLAIM');assert.deepEqual(await durable(free),freeDone);
 record('free account receives only earned unclaimed free tiers once; locked and premium tiers remain unclaimed');
 await clear(paid,30);await db.prepare('INSERT INTO season_owners VALUES(?,?,?)').bind(paid.player.id,season.id,'private-test-paid-owner:'+key()).run();
 await ok(paid,'/pass/claim',{key:key(),tier:5,track:'premium'});const paidBefore=await me(paid),paidDurable=await durable(paid),bulkKey=key();
 await db.prepare(`CREATE TRIGGER pass_test_rollback BEFORE INSERT ON reward_claims WHEN NEW.user_id='${paid.player.id}' AND NEW.kind='pass:premium' AND NEW.source_id='${season.id}:15' BEGIN SELECT RAISE(ABORT,'private_pass_test_rollback'); END`).run();
 assert.equal((await request(paid,'/pass/claim-all',{key:bulkKey})).status,500);assert.deepEqual(await durable(paid),paidDurable);await db.prepare('DROP TRIGGER pass_test_rollback').run();
 record('injected late claim failure rolls back every preceding reward, special ledger entry, Player update and operation');
 const bulk=await Promise.all([ok<PassClaimAllResponse>(paid,'/pass/claim-all',{key:bulkKey}),ok<PassClaimAllResponse>(paid,'/pass/claim-all',{key:bulkKey}),ok<PassClaimAllResponse>(paid,'/pass/claim-all',{key:key()})]);assert.deepEqual(bulk[0],bulk[1]);const paidAfter=await me(paid);
 assert.equal(bulk[0].claimed.length,59);assert.equal(paidAfter.coins,paidBefore.coins+30*25+29*75);assert.equal(paidAfter.inventory.hammer.normal,paidBefore.inventory.hammer.normal+5);assert.equal(paidAfter.version,paidBefore.version+1);
 assert.equal((await db.prepare("SELECT count(*) n FROM reward_claims WHERE user_id=? AND kind IN ('pass:free','pass:premium')").bind(paid.player.id).first<{n:number}>())?.n,60);
 for(const asset of ['profile:season-gardener','pass:guild-gift-voucher'])assert.equal((await db.prepare('SELECT count(*) n FROM ledger WHERE user_id=? AND asset=? AND delta=1').bind(paid.player.id,asset).first<{n:number}>())?.n,1);
 const decorations=await ok<{decorations:unknown[]}>(paid,'/profile/decorations');assert.equal(decorations.decorations.length,1);
 const ev=await ok<{pass:{guildGifts:{seasonId:string;sent:boolean}[]}}>(paid,'/events');assert.deepEqual(ev.pass.guildGifts.map(gift=>({seasonId:gift.seasonId,sent:gift.sent})),[{seasonId:season.id,sent:false}]);
 const paidDone=await durable(paid);assert.equal((await ok<PassClaimAllResponse>(paid,'/pass/claim-all',{key:key()})).claimed.length,0);assert.deepEqual(await durable(paid),paidDone);
 record('real 30-clear premium progress, same/different-key races and lost-response retries grant all60 unique rewards, tier15 emblem and tier30 voucher exactly once');
 await clear(race,5);const raceBefore=await me(race);const [single,all]=await Promise.all([request(race,'/pass/claim',{key:key(),tier:1,track:'free'}),request<PassClaimAllResponse>(race,'/pass/claim-all',{key:key()})]);assert([200,409].includes(single.status));assert.equal(all.status,200);const raceAfter=await me(race);assert.equal(raceAfter.coins,raceBefore.coins+125);assert.equal((await db.prepare("SELECT count(*) n FROM reward_claims WHERE user_id=? AND kind='pass:free'").bind(race.player.id).first<{n:number}>())?.n,5);
 record('individual claim and bulk claim racing share the same receipt authority and cannot duplicate a tier');
 await db.prepare('DELETE FROM season_owners WHERE user_id=?').bind(paid.player.id).run();assert.equal((await ok<{decorations:unknown[]}>(paid,'/profile/decorations')).decorations.length,0);const revoked=await durable(paid);assert.equal((await ok<PassClaimAllResponse>(paid,'/pass/claim-all',{key:key()})).claimed.length,0);assert.deepEqual(await durable(paid),revoked);
 record('revoked premium entitlement cannot be restored or paid again by bulk collection');
 await db.prepare('UPDATE seasons SET starts_at=?,ends_at=?').bind(now-2000,now-1000).run();const expired=await durable(free),noSeason=await ok<PassClaimAllResponse>(free,'/pass/claim-all',{key:key()});assert.equal(noSeason.seasonId,null);assert.equal(noSeason.reason,'NOTHING_TO_CLAIM');assert.deepEqual(await durable(free),expired);
 record('ended season produces an explicit empty receipt without changing Player/version or any asset ledger');
 await writeFile('output/verification/api-pass-claim-all-http.json',JSON.stringify({at:new Date().toISOString(),environment:'Actual application Worker over TCP HTTP and isolated ephemeral workerd D1; no shared/local-user database access',passProgress:'39 actual shared-engine validated clears via HTTP',premiumEntitlement:'Private isolated D1 owner fixture; not a verified store purchase',checks,passed:checks.length,fullPremiumRewardClaims:60,existingLocalD1Accessed:false},null,2));
}finally{await mf.dispose();}
