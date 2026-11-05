import assert from 'node:assert/strict';
import {mkdir,readdir,readFile,writeFile} from 'node:fs/promises';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
import {unstable_splitSqlQuery} from 'wrangler';
import {ENGINE_VERSION} from '@garden/contracts';
import {newPlayer,mutate,readPlayer,readState,sql,uid,type ApiEnv} from '../apps/api/src/db';
import {guest,authenticate} from '../apps/api/src/auth';
import {startRun,runActions,closeRun} from '../apps/api/src/runs';
import {requestTiming} from '../apps/api/src/request-timing';
import solutions from '../packages/content/src/solutions.json';

const mf=new Miniflare(convertV4MiniflareOptions({modules:true,script:"export default{fetch(){return new Response('isolated')}}",compatibilityDate:'2026-11-02',d1Databases:{DB:'latency-regressions'}}));
const checks:string[]=[],counts:Record<string,number>={};
const record=(name:string)=>{checks.push(name);console.log('PASS '+name);};
try{
 const db=await mf.getD1Database('DB');
 for(const file of (await readdir('apps/api/migrations')).filter(f=>f.endsWith('.sql')).sort())await db.batch(unstable_splitSqlQuery(await readFile('apps/api/migrations/'+file,'utf8')).map(query=>db.prepare(query)));
 const env:ApiEnv={DB:db,get ASSETS():never{throw Error('No assets in this test');},get GUILD_ROOMS():never{throw Error('No DO transport in this test');},ENVIRONMENT:'development',LOCAL_DEV_TOOLS:'disabled',CLIENT_ORIGINS:'',ASSET_VERSION:'test',ASSET_PUBLIC_ORIGIN:'',GOOGLE_CLIENT_IDS:'',APPLE_CLIENT_IDS:'',GOOGLE_PACKAGE_NAME:'com.cloudgarden.match',GOOGLE_IAP_ENVIRONMENT:'Sandbox',ADMOB_AD_UNITS:'',ADMOB_REWARD_ITEMS:'reward',APPLE_BUNDLE_ID:'com.cloudgarden.match',ADMOB_HEART_AD_UNIT:'',ADMOB_COIN_AD_UNIT:''};
 const now=Date.now();await sql(db,'UPDATE seasons SET starts_at=?,ends_at=?',now-1000,now+86400000).run();
 const user=await guest(env),p=newPlayer(uid(),now);p.hearts=3;p.heartAt=now-3600001;p.passPoints=999;
 await sql(db,'INSERT INTO players(id,data,version,created_at) VALUES(?,?,1,?)',p.id,JSON.stringify(p),now).run();
 let timing=requestTiming(db),scoped=Object.assign(Object.create(env),{DB:timing.db});
 const recovered=await readPlayer(scoped.DB,p.id,now);assert.equal(recovered.hearts,4);assert.equal(recovered.passPoints,0);assert.equal(timing.snapshot().dbCalls,1);counts.player=1;
 record('one D1 round trip preserves natural hearts and derives season points from approved rewards');
 const operation=uid();await Promise.all([mutate(env,p.id,operation,'test:race',tx=>{tx.player.coins+=7;return {player:tx.player};}),mutate(env,p.id,operation,'test:race',tx=>{tx.player.coins+=7;return {player:tx.player};})]);
 assert.equal((await readPlayer(db,p.id)).coins,507);
 const ledger=await sql(db,'SELECT asset,sum(delta) delta FROM ledger WHERE user_id=? GROUP BY asset',p.id).all<{asset:string;delta:number}>();
 assert.equal(ledger.results.find(r=>r.asset==='coins')?.delta,7);assert.equal(ledger.results.find(r=>r.asset==='hearts')?.delta,1);
 record('duplicate race commits once and ledger uses pre-recovery persisted balances');
 timing=requestTiming(db);scoped=Object.assign(Object.create(env),{DB:timing.db});const authRequest=new Request('http://test/api/me',{headers:{Authorization:'Bearer '+user.accessToken}});
 await authenticate(authRequest,scoped,{maximum:2,seconds:3600});assert.equal(timing.snapshot().dbCalls,1);
 await authenticate(authRequest,env,{maximum:2,seconds:3600});await assert.rejects(()=>authenticate(authRequest,env,{maximum:2,seconds:3600}),e=>e instanceof Error&&e.message.includes('요청'));
 await sql(db,'UPDATE sessions SET revoked=1 WHERE user_id=?',user.player.id).run();
 const before=(await sql(db,'SELECT sum(hits) n FROM rate_limits').first<{n:number}>())!.n;
 await assert.rejects(()=>authenticate(authRequest,env,{maximum:2,seconds:3600}));assert.equal((await sql(db,'SELECT sum(hits) n FROM rate_limits').first<{n:number}>())!.n,before);
 record('authentication and rate counter share one batch, retaining 429 limits and immediate revocation');
 for(let level=1;level<=10;level++){
  timing=requestTiming(db);scoped=Object.assign(Object.create(env),{DB:timing.db});
  const started=await startRun(scoped,p.id,{key:uid(),engineVersion:ENGINE_VERSION,preBoosters:[]});assert.equal(started.run.level.id,level);assert.equal(timing.snapshot().dbCalls,3);counts.start=3;
  if(level===1){await assert.rejects(()=>closeRun(env,p.id,started.run.id,{key:uid(),win:true,coins:9999}));const stateTimer=requestTiming(db),state=await readState(stateTimer.db,p.id);assert.equal(state.activeRun?.id,started.run.id);assert.equal(stateTimer.snapshot().dbCalls,1);counts.state=1;}
  timing=requestTiming(db);scoped=Object.assign(Object.create(env),{DB:timing.db});
  const saved=await runActions(scoped,p.id,started.run.id,{key:uid(),sequence:0,actions:solutions[String(level) as keyof typeof solutions].actions});assert.equal(saved.run.state.status,'won');assert.equal(timing.snapshot().dbCalls,3);counts.actions=3;
  const finishKey='finish-'+started.run.id;timing=requestTiming(db);scoped=Object.assign(Object.create(env),{DB:timing.db});
  const closed=await closeRun(scoped,p.id,started.run.id,{key:finishKey});assert.equal(closed.run.status,'won');assert.equal(closed.player.hearts,4);assert.equal(timing.snapshot().dbCalls,3);counts.finish=3;
  const duplicate=await closeRun(env,p.id,started.run.id,{key:finishKey});assert.deepEqual(duplicate,closed);
  const anotherKey=await closeRun(env,p.id,started.run.id,{key:uid()});assert.equal(anotherKey.player.coins,closed.player.coins);
 }
 const rewards=await sql(db,'SELECT count(*) n FROM level_rewards WHERE user_id=?',p.id).first<{n:number}>();assert.equal(rewards?.n,10);
 const current=await readPlayer(db,p.id);assert.equal(current.passPoints,100);assert.equal(current.inventory['world-bomb'].bound,1);
 record('ten real clears: start/actions/finish each use three D1 round trips before auth; duplicate finishes preserve one reward and one milestone');
 await sql(db,'UPDATE seasons SET ends_at=?',now-1).run();assert.equal((await readPlayer(db,p.id)).passPoints,0);
 record('expired seasons cannot retain points or reuse stale season state');
 await mkdir('output/verification',{recursive:true});await writeFile('output/verification/api-latency-local-checks.json',JSON.stringify({at:new Date().toISOString(),environment:'ephemeral workerd + real D1; all migrations; no installed account',checks,counts},null,2));
}finally{await mf.dispose();}
