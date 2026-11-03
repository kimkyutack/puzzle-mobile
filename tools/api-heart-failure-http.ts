import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile,readdir,writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
import {unstable_splitSqlQuery} from 'wrangler';
import {applyAction,legalActions} from '@garden/core';
import {ENGINE_VERSION,type Action,type AuthResponse,type Envelope,type Player,type Run} from '@garden/contracts';
import solutions from '../packages/content/src/solutions.json';

// The production Worker bundle and all real migrations, with a disposable private D1 only.
await mkdir('.wrangler',{recursive:true});await mkdir('output/verification',{recursive:true});
const statePath=resolve(await mkdtemp('.wrangler/heart-failure-'));
const build=spawnSync(process.execPath,['node_modules/wrangler/bin/wrangler.js','deploy','--dry-run','--config','wrangler.jsonc','--outdir',join(statePath,'bundle')],{encoding:'utf8',env:{...process.env,WRANGLER_LOG_PATH:join(statePath,'build.log'),WRANGLER_SEND_METRICS:'false'}});
assert.equal(build.status,0,build.stderr||build.stdout);
const config=JSON.parse(await readFile('wrangler.jsonc','utf8'));
const mf=new Miniflare(convertV4MiniflareOptions({modules:true,scriptPath:join(statePath,'bundle/index.js'),compatibilityDate:'2026-11-02',compatibilityFlags:['nodejs_compat'],port:0,d1Databases:{DB:'heart-failure-private'},r2Buckets:['ASSETS'],durableObjects:{GUILD_ROOMS:{className:'GuildRoom',useSQLite:true}},bindings:{...config.vars,CLIENT_ORIGINS:'capacitor://localhost'}}));
const checks:string[]=[],key=()=>crypto.randomUUID();
const record=(name:string)=>{checks.push(name);console.log('PASS '+name);};
try{
 const db=await mf.getD1Database('DB');
 for(const file of (await readdir('apps/api/migrations')).filter(name=>name.endsWith('.sql')).sort())await db.batch(unstable_splitSqlQuery(await readFile('apps/api/migrations/'+file,'utf8')).map(query=>db.prepare(query)));
 const origin=await mf.ready;
 async function request<T>(user:AuthResponse|null,path:string,body?:unknown){const response=await fetch(new URL('/api'+path,origin),{method:body===undefined?'GET':'POST',headers:{'Content-Type':'application/json',...(user?{Authorization:'Bearer '+user.accessToken}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});return {status:response.status,json:await response.json() as Envelope<T>&{error?:{code:string}}};}
 async function ok<T>(user:AuthResponse|null,path:string,body?:unknown){const result=await request<T>(user,path,body);assert.equal(result.status,200,path+': '+JSON.stringify(result.json.error));return result.json.data;}
 const guest=()=>ok<AuthResponse>(null,'/auth/guest',{});
 const me=async(user:AuthResponse)=>(await ok<{player:Player}>(user,'/me')).player;
 async function patch(user:AuthResponse,fields:Partial<Player>){const player={...await me(user),...fields};await db.prepare('UPDATE players SET data=? WHERE id=?').bind(JSON.stringify(player),player.id).run();}
 const start=(user:AuthResponse,k=key())=>ok<{player:Player;run:Run}>(user,'/runs/start',{key:k,engineVersion:ENGINE_VERSION,preBoosters:[]});
 const end=(user:AuthResponse,run:Run,abandon=false,k=key())=>ok<{player:Player;run:Run}>(user,`/runs/${run.id}/${abandon?'abandon':'finish'}`,{key:k});
 const ledger=async(user:AuthResponse)=>(await db.prepare("SELECT delta,reason FROM ledger WHERE user_id=? AND asset='hearts' AND reason<>'guest:create'").bind(user.player.id).all()).results as Array<{delta:number;reason:string}>;
 async function win(user:AuthResponse,run:Run){return (await ok<{run:Run}>(user,`/runs/${run.id}/actions`,{key:key(),sequence:run.sequence,actions:solutions[String(run.level.id) as keyof typeof solutions].actions})).run;}
 async function lose(user:AuthResponse,run:Run){
  let plan:Action[]|undefined;
  for(let variation=0;variation<8&&!plan;variation++){
   let state=run.state;const actions:Action[]=[];
   while(state.status==='playing'&&actions.length<100){
    const choices=legalActions(state).map(action=>({action,result:applyAction(state,action)})).sort((a,b)=>b.result.state.goals.reduce((n,g)=>n+g.remaining,0)-a.result.state.goals.reduce((n,g)=>n+g.remaining,0)||a.result.events.length-b.result.events.length);
    assert(choices.length);const choice=choices[variation%Math.min(3,choices.length)]!;actions.push(choice.action);state=choice.result.state;
   }
   if(state.status==='lost')plan=actions;
  }
  assert(plan,'Expected a legal losing path');
  const result=await ok<{run:Run}>(user,`/runs/${run.id}/actions`,{key:key(),sequence:run.sequence,actions:plan});assert.equal(result.run.state.status,'lost');return result.run;
 }

 const clearUser=await guest(),startKey=key();
 const initial=await Promise.all([start(clearUser,startKey),start(clearUser,startKey)]);assert.equal(initial[0]!.run.id,initial[1]!.run.id);assert.equal(initial[0]!.player.hearts,5);assert.equal(initial[0]!.player.heartAt,0);assert.equal(initial[0]!.run.heartSpent,false);assert.equal(initial[0]!.run.heartCharge,'failure');assert.equal((await start(clearUser)).run.id,initial[0]!.run.id);assert.equal((await ledger(clearUser)).length,0);record('start, duplicate start and resume preserve all five hearts and the recovery clock');
 let current=initial[0]!.run;
 for(let i=0;i<6;i++){if(i)current=(await start(clearUser)).run;current=await win(clearUser,current);const closed=await end(clearUser,current);assert.equal(closed.player.hearts,5);assert.equal(closed.player.heartAt,0);assert.equal(closed.run.status,'won');}
 assert.equal((await ledger(clearUser)).length,0);record('six real approved clears never consume a heart or create a heart debit');

 const failed=await guest();await patch(failed,{level:10});const failedStart=await start(failed);const lost=await lose(failed,failedStart.run);assert.equal((await me(failed)).hearts,5);assert.equal((await ledger(failed)).length,0);
 const closeKey=key();await Promise.all([end(failed,lost,false,closeKey),end(failed,lost,false,closeKey)]);await end(failed,lost,false);await end(failed,lost,true);
 const afterFailure=await me(failed);assert.equal(afterFailure.hearts,4);assert(afterFailure.heartAt>=failedStart.run.startedAt);assert.deepEqual((await ledger(failed)).map(row=>row.delta),[-1]);record('running out of moves waits for final failure; duplicate settlement consumes exactly one heart at failure time');

 const continued=await guest();await patch(continued,{level:10});let continuing=(await start(continued)).run;continuing=await lose(continued,continuing);
 const continueKey=key(),continuedBody={key:continueKey,sequence:continuing.sequence};const added=await Promise.all([ok<{run:Run}>(continued,`/runs/${continuing.id}/continue`,continuedBody),ok<{run:Run}>(continued,`/runs/${continuing.id}/continue`,continuedBody)]);assert.equal(added[0]!.run.state.moves,5);assert.equal((await me(continued)).hearts,5);assert.equal((await ledger(continued)).length,0);
 await end(continued,added[0]!.run,true);assert.equal((await me(continued)).hearts,4);assert.equal((await ledger(continued)).length,1);record('paid +5 continuation and retries preserve hearts; giving up the attempt consumes one');

 const quit=await guest(),quitting=(await start(quit)).run;await Promise.all([end(quit,quitting,true),end(quit,quitting,true)]);assert.equal((await me(quit)).hearts,4);assert.equal((await ledger(quit)).length,1);record('explicit mid-puzzle give-up charges once under concurrent requests');

 const unlimited=await guest();await patch(unlimited,{hearts:0,heartAt:Date.now(),unlimitedUntil:Date.now()+60_000});const protectedRun=(await start(unlimited)).run;assert.equal(protectedRun.heartCharge,'protected');await patch(unlimited,{unlimitedUntil:0});await end(unlimited,protectedRun,true);assert.equal((await me(unlimited)).hearts,0);assert.equal((await ledger(unlimited)).length,0);record('an attempt started during unlimited time remains protected even after it expires');

 const empty=await guest();await patch(empty,{hearts:0,heartAt:Date.now()});assert.equal((await request(empty,'/runs/start',{key:key(),engineVersion:ENGINE_VERSION})).status,409);assert.equal((await ledger(empty)).length,0);record('zero hearts blocks a fresh unprotected attempt without a debit');

 const legacy=await guest(),old=(await start(legacy)).run;delete old.heartCharge;old.heartSpent=true;await patch(legacy,{hearts:4,heartAt:Date.now()-60_000});await db.prepare('UPDATE runs SET data=? WHERE id=?').bind(JSON.stringify(old),old.id).run();const oldWon=await win(legacy,old);await Promise.all([end(legacy,oldWon),end(legacy,oldWon)]);assert.equal((await me(legacy)).hearts,5);assert.equal((await me(legacy)).heartAt,0);assert.deepEqual((await ledger(legacy)).map(row=>row.delta),[1]);record('an already-open legacy prepaid attempt returns its heart exactly once when cleared');
 const oldFailure=await guest(),prepaid=(await start(oldFailure)).run;delete prepaid.heartCharge;prepaid.heartSpent=true;await patch(oldFailure,{hearts:4,heartAt:Date.now()});await db.prepare('UPDATE runs SET data=? WHERE id=?').bind(JSON.stringify(prepaid),prepaid.id).run();await end(oldFailure,prepaid,true);assert.equal((await me(oldFailure)).hearts,4);assert.equal((await ledger(oldFailure)).length,0);record('legacy prepaid failure never pays twice');

 const wonExit=await guest(),won=await win(wonExit,(await start(wonExit)).run);const wonClosed=await end(wonExit,won,true);assert.equal(wonClosed.run.status,'won');assert.equal(wonClosed.player.hearts,5);record('a server-verified clear remains a clear even if an older client sends the exit endpoint');
 await writeFile('output/verification/heart-failure-http.json',JSON.stringify({at:new Date().toISOString(),environment:'production Worker bundle over HTTP with isolated private D1',checks,passed:checks.length,localUserDataRead:false},null,2));
}finally{await mf.dispose();}
