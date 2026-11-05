import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile,readdir,writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
import {unstable_splitSqlQuery} from 'wrangler';
import type {AuthResponse,Player} from '@garden/contracts';
await mkdir('.wrangler',{recursive:true});await mkdir('output/verification',{recursive:true});
const path=resolve(await mkdtemp('.wrangler/attendance-v15-'));
const build=spawnSync(process.execPath,['node_modules/wrangler/bin/wrangler.js','deploy','--dry-run','--config','wrangler.jsonc','--outdir',join(path,'bundle')],{encoding:'utf8',env:{...process.env,WRANGLER_LOG_PATH:join(path,'build.log'),WRANGLER_SEND_METRICS:'false'}});assert.equal(build.status,0,build.stderr||build.stdout);
const config=JSON.parse(await readFile('wrangler.jsonc','utf8'));
const mf=new Miniflare(convertV4MiniflareOptions({modules:true,scriptPath:join(path,'bundle/index.js'),compatibilityDate:'2026-11-02',compatibilityFlags:['nodejs_compat'],port:0,d1Databases:{DB:'attendance-v15-private'},r2Buckets:['ASSETS'],durableObjects:{GUILD_ROOMS:{className:'GuildRoom',useSQLite:true}},bindings:{...config.vars,CLIENT_ORIGINS:'capacitor://localhost'}}));
const checks:string[]=[];
try{
 const db=await mf.getD1Database('DB');for(const file of (await readdir('apps/api/migrations')).filter(f=>f.endsWith('.sql')).sort())await db.batch(unstable_splitSqlQuery(await readFile('apps/api/migrations/'+file,'utf8')).map(q=>db.prepare(q)));
 const origin=await mf.ready;
 async function call(user:AuthResponse|null,url:string,body?:unknown){const response=await fetch(new URL('/api'+url,origin),{method:body===undefined?'GET':'POST',headers:{'Content-Type':'application/json',...(user?{Authorization:'Bearer '+user.accessToken}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});return {status:response.status,json:await response.json() as {data:any;error?:unknown}};}
 async function ok(user:AuthResponse|null,url:string,body?:unknown){const r=await call(user,url,body);assert.equal(r.status,200,JSON.stringify(r.json.error));return r.json.data;}
 const user=await ok(null,'/auth/guest',{}) as AuthResponse,today=Math.floor(Date.now()/86400000);
 const status=await ok(user,'/events');assert.deepEqual(status.attendance,{total:0,claimedDays:0,cycleDay:1,bonusItem:'hammer',bonusQuantity:1});assert(status.daily.available);checks.push('new guest starts with day one and a real claimable daily reward');
 for(let i=1;i<=6;i++)await db.prepare('INSERT INTO reward_claims VALUES(?,?,?,?)').bind(user.player.id,'daily',String(today-i*2),(today-i*2)*86400000).run();
 const before=(await ok(user,'/me')).player as Player,claim={key:crypto.randomUUID()};const result=await ok(user,'/events/daily',claim);assert.equal(result.player.coins,before.coins+50);assert.equal(result.player.inventory.hammer.bound,before.inventory.hammer.bound+1);assert.deepEqual(result.attendanceReward,{coins:50,hammer:1});checks.push('seventh non-consecutive check-in grants 50 coins and one bound hammer');
 await ok(user,'/events/daily',claim);assert.equal((await call(user,'/events/daily',{key:crypto.randomUUID()})).status,409);const after=(await ok(user,'/me')).player as Player;assert.equal(after.coins,result.player.coins);assert.deepEqual(after.inventory,result.player.inventory);checks.push('duplicate and retried claims never pay twice');
 const done=await ok(user,'/events');assert(!done.daily.available);assert.equal(done.attendance.claimedDays,7);assert.equal(done.attendance.cycleDay,7);checks.push('events exposes the completed seven-day cycle and clears claimability');
 const other=await ok(null,'/auth/guest',{}) as AuthResponse;const race=await Promise.all([call(other,'/events/daily',{key:crypto.randomUUID()}),call(other,'/events/daily',{key:crypto.randomUUID()})]);assert.equal(race.filter(r=>r.status===200).length,1);const actual=(await ok(other,'/me')).player as Player;assert.equal(actual.coins,other.player.coins+50);checks.push('concurrent check-ins settle once against real D1 transactions');
 await writeFile('output/verification/attendance-v15-http.json',JSON.stringify({checks,productionDataRead:false},null,2));for(const check of checks)console.log('PASS '+check);
}finally{await mf.dispose();}
