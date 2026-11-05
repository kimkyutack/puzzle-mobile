import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile,readdir,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
import {unstable_splitSqlQuery} from 'wrangler';
import type {AuthResponse,Envelope,StateResponse,FriendsResponse,FriendProfile,RankingsResponse} from '@garden/contracts';

// Real application Worker over HTTP. Only this test's ephemeral D1 is accessible.
// Private social relationships and score fixtures exercise isolation and authorization.
await mkdir('.wrangler',{recursive:true});await mkdir('output/verification',{recursive:true});
const statePath=resolve(await mkdtemp('.wrangler/friends-http-'));
const build=spawnSync(process.execPath,['node_modules/wrangler/bin/wrangler.js','deploy','--dry-run','--config','apps/api/wrangler.jsonc','--outdir',join(statePath,'bundle')],{encoding:'utf8',env:{...process.env,WRANGLER_LOG_PATH:join(statePath,'build.log'),WRANGLER_SEND_METRICS:'false'}});
assert.equal(build.status,0,build.stderr||build.stdout);
const mf=new Miniflare(convertV4MiniflareOptions({modules:true,scriptPath:join(statePath,'bundle/index.js'),compatibilityDate:'2026-11-02',compatibilityFlags:['nodejs_compat'],port:0,d1Databases:{DB:'friends-private'},r2Buckets:['ASSETS'],durableObjects:{GUILD_ROOMS:{className:'GuildRoom',useSQLite:true}},bindings:{ENVIRONMENT:'development',LOCAL_DEV_TOOLS:'disabled',CLIENT_ORIGINS:'http://localhost:5188',ASSET_VERSION:'test',ASSET_PUBLIC_ORIGIN:'',GOOGLE_CLIENT_IDS:'',APPLE_CLIENT_IDS:'',GOOGLE_PACKAGE_NAME:'com.cloudgarden.match',GOOGLE_IAP_ENVIRONMENT:'Sandbox',APPLE_BUNDLE_ID:'com.cloudgarden.match',ADMOB_HEART_AD_UNIT:'',ADMOB_COIN_AD_UNIT:'',ADMOB_AD_UNITS:'',ADMOB_REWARD_ITEMS:'reward'}}));
const checks:string[]=[],key=()=>crypto.randomUUID(),record=(name:string)=>{checks.push(name);console.log('PASS '+name)};
try{
 const db=await mf.getD1Database('DB');
 for(const file of (await readdir('apps/api/migrations')).filter(n=>n.endsWith('.sql')).sort())await db.batch(unstable_splitSqlQuery(await readFile('apps/api/migrations/'+file,'utf8')).map(q=>db.prepare(q)));
 const origin=await mf.ready;
 async function req<T>(user:AuthResponse|null,path:string,body?:unknown){const res=await fetch(new URL('/api'+path,origin),{method:body===undefined?'GET':'POST',headers:{'Content-Type':'application/json',...(user?{Authorization:'Bearer '+user.accessToken}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});const result=await res.json() as Envelope<T>&{error?:{code:string}};return {status:res.status,...result};}
 async function ok<T>(user:AuthResponse|null,path:string,body?:unknown){const result=await req<T>(user,path,body);assert.equal(result.status,200,path+JSON.stringify(result.error));return result.data;}
 const list=(u:AuthResponse)=>ok<FriendsResponse>(u,'/friends'),me=(u:AuthResponse)=>ok<StateResponse>(u,'/me');
 const send=(a:AuthResponse,b:AuthResponse)=>ok(a,'/friends/requests',{key:key(),userId:b.player.id});
 const accept=(a:AuthResponse,b:AuthResponse)=>ok(a,'/friends/respond',{key:key(),userId:b.player.id,accept:true});
 const users=await Promise.all(Array.from({length:10},()=>ok<AuthResponse>(null,'/auth/guest',{}))),[a,b,c,d,e,f,g,h,i,j]=users;
 assert(a&&b&&c&&d&&e&&f&&g&&h&&i&&j);
 assert.equal((await req(null,'/friends')).status,401);
 assert.equal((await req(a,'/friends/requests',{key:key(),userId:a.player.id})).status,400);
 assert.equal((await req(a,'/friends/requests',{key:key(),userId:'not-an-id'})).status,400);
 assert.equal((await req(a,'/friends/hearts/request',{key:key()})).error?.code,'NO_FRIENDS');
 const profile=(await ok<{profile:FriendProfile}>(a,`/players/${b.player.id}/profile`)).profile;
 assert.deepEqual(Object.keys(profile).sort(),['userId','nickname','level','highestClear','guildName','relation'].sort());
 assert.equal(profile.relation,'none');assert((await list(a)).recommendations.some(p=>p.userId===b.player.id));
 record('authentication, bounded targets, self-add rejection, no-friend request rejection and public profile privacy');
 const sendKey=key();await Promise.all([ok(a,'/friends/requests',{key:sendKey,userId:b.player.id}),ok(a,'/friends/requests',{key:sendKey,userId:b.player.id})]);
 assert.equal((await list(a)).outgoing.length,1);assert.equal((await list(b)).incoming.length,1);assert.equal((await list(a)).friends.length,0);assert(!(await list(a)).recommendations.some(p=>p.userId===b.player.id));
 assert.equal((await req(c,'/friends/respond',{key:key(),userId:a.player.id,accept:true})).status,409);
 assert.equal((await req(a,'/friends/respond',{key:key(),userId:b.player.id,accept:true})).status,409);
 await Promise.all([accept(b,a),accept(b,a)]);assert.equal((await list(a)).friends.length,1);assert.equal((await list(b)).friends.length,1);
 assert.equal((await ok<{profile:FriendProfile}>(a,`/players/${b.player.id}/profile`)).profile.relation,'friend');
 await send(a,c);await ok(c,'/friends/respond',{key:key(),userId:a.player.id,accept:false});assert.equal((await list(a)).outgoing.length,0);
 record('pending invitation direction, consent, concurrent duplicate send/accept, mutual persistence and decline');
 await db.prepare('INSERT INTO ranking_scores VALUES(?,?,?)').bind(a.player.id,5,1).run();await db.prepare('INSERT INTO ranking_scores VALUES(?,?,?)').bind(b.player.id,7,2).run();await db.prepare('INSERT INTO ranking_scores VALUES(?,?,?)').bind(c.player.id,99,3).run();
 await db.prepare("UPDATE players SET data=json_set(data,'$.level',999) WHERE id=?").bind(a.player.id).run();
 let ranks=await ok<RankingsResponse>(a,'/rankings?scope=friends');assert.deepEqual(ranks.entries.map(p=>[p.id,p.score]),[[b.player.id,7],[a.player.id,5]]);assert.equal(ranks.me?.rank,2);assert.equal(ranks.participants,2);
 await db.prepare('UPDATE ranking_scores SET highest_level=7 WHERE user_id=?').bind(a.player.id).run();ranks=await ok(a,'/rankings?scope=friends');assert(ranks.entries.every(p=>p.rank===1&&p.tied));
 record('friend-only authoritative scores exclude strangers and forged progression, include caller, preserve tied ranks');
 const requestKey=key(),requests=await Promise.all([ok<{requestId:string}>(a,'/friends/hearts/request',{key:requestKey}),ok<{requestId:string}>(a,'/friends/hearts/request',{key:requestKey})]);assert.equal(requests[0]!.requestId,requests[1]!.requestId);const rid=requests[0]!.requestId;
 assert.equal((await req(a,'/friends/hearts/request',{key:key()})).error?.code,'REQUEST_COOLDOWN');
 assert.equal((await req(a,`/friends/hearts/${rid}/help`,{key:key()})).status,409);assert.equal((await req(c,`/friends/hearts/${rid}/help`,{key:key()})).status,403);
 const before=(await me(b)).player.hearts,helpKey=key();await Promise.all([ok(b,`/friends/hearts/${rid}/help`,{key:helpKey}),ok(b,`/friends/hearts/${rid}/help`,{key:helpKey})]);
 assert.equal((await me(b)).player.hearts,before);assert.equal((await list(a)).myRequest?.received,1);assert.equal((await list(a)).gifts.length,1);assert.equal((await list(b)).heartRequests.find(r=>r.id===rid)?.helped,true);assert.equal((await req(b,`/friends/hearts/${rid}/help`,{key:key()})).error?.code,'ALREADY_HELPED');
 const gift=(await list(a)).gifts[0]!;assert.equal((await req(b,`/gifts/${gift.id}/claim`,{key:key()})).status,404);assert.equal((await req(a,`/gifts/${gift.id}/claim`,{key:key()})).status,409);
 await db.prepare("UPDATE players SET data=json_set(data,'$.hearts',4,'$.heartAt',?) WHERE id=?").bind(Date.now(),a.player.id).run();const claimKey=key();await Promise.all([ok(a,`/gifts/${gift.id}/claim`,{key:claimKey}),ok(a,`/gifts/${gift.id}/claim`,{key:claimKey})]);assert.equal((await me(a)).player.hearts,5);assert.equal((await list(a)).gifts.length,0);
 record('heart cooldown, authorization, idempotent help and claim, own hearts unchanged, full heart storage and gift ownership');
 for(const u of [c,d,e,f,g]){await send(a,u);await accept(u,a);}
 await Promise.all([c,d,e,f,g].map(u=>req(u,`/friends/hearts/${rid}/help`,{key:key()})));assert.equal((await list(a)).myRequest?.received,5);assert.equal((await db.prepare('SELECT COUNT(*) n FROM friend_heart_help WHERE request_id=?').bind(rid).first<{n:number}>())?.n,5);
 record('concurrent helpers cap each request at five and create exactly one gift per accepted donation');
 await send(h,i);await accept(i,h);const hr=(await ok<{requestId:string}>(h,'/friends/hearts/request',{key:key()})).requestId;
 await db.prepare('UPDATE friend_heart_requests SET expires_at=? WHERE id=?').bind(Date.now()-1,hr).run();assert.equal((await req(i,`/friends/hearts/${hr}/help`,{key:key()})).status,409);
 await db.prepare('UPDATE friend_heart_requests SET expires_at=? WHERE id=?').bind(Date.now()+100000,hr).run();await db.prepare('INSERT INTO blocks VALUES(?,?)').bind(h.player.id,i.player.id).run();assert.equal((await req(i,`/friends/hearts/${hr}/help`,{key:key()})).status,403);assert.equal((await list(h)).friends.length,0);assert.equal((await req(i,`/players/${h.player.id}/profile`)).status,403);assert(!(await ok<RankingsResponse>(h,'/rankings?scope=friends')).entries.some(p=>p.id===i.player.id));
 await db.prepare('DELETE FROM blocks WHERE user_id=?').bind(h.player.id).run();
 await db.prepare("CREATE TRIGGER friend_test_rollback BEFORE INSERT ON friend_heart_help BEGIN SELECT RAISE(ABORT,'private_friend_rollback'); END").run();
 const raw=await db.prepare('SELECT data FROM players WHERE id=?').bind(h.player.id).first();assert.equal((await req(i,`/friends/hearts/${hr}/help`,{key:key()})).status,500);assert.deepEqual(await db.prepare('SELECT data FROM players WHERE id=?').bind(h.player.id).first(),raw);assert.equal((await list(h)).gifts.length,0);assert.equal((await list(h)).myRequest?.received,0);await db.prepare('DROP TRIGGER friend_test_rollback').run();
 record('expired requests and two-way blocks denied; injected late failure rolls back gift, request and both Player versions');
 const today=Math.floor(Date.now()/86400000);for(let n=0;n<10;n++){const id=key(),giftId=key();await db.prepare('INSERT INTO friend_heart_requests VALUES(?,?,1,?,?)').bind(id,h.player.id,Date.now(),Date.now()+100000).run();await db.prepare("INSERT INTO gifts VALUES(?,?,?,?, 'heart',0,0,?,?)").bind(giftId,h.player.id,i.player.id,'private',id,Date.now()).run();await db.prepare('INSERT INTO friend_heart_help VALUES(?,?,?,?,?)').bind(id,i.player.id,h.player.id,today,giftId).run();}
 assert.equal((await req(i,`/friends/hearts/${hr}/help`,{key:key()})).error?.code,'SUPPORT_DAILY_LIMIT');
 await send(h,j);await accept(j,h);await db.prepare("INSERT INTO gifts VALUES(?,?,?,?, 'heart',20,0,?,?)").bind(key(),h.player.id,j.player.id,'private',key(),Date.now()).run();assert.equal((await req(j,`/friends/hearts/${hr}/help`,{key:key()})).error?.code,'SUPPORT_DAILY_LIMIT');
 await db.prepare('DELETE FROM friend_heart_help WHERE recipient_id=?').bind(h.player.id).run();assert.equal((await req(j,`/friends/hearts/${hr}/help`,{key:key()})).error?.code,'MAILBOX_FULL');
 record('per-day sender/recipient limits and shared twenty-heart mailbox enforced on server');
 await writeFile('output/verification/friends-http.json',JSON.stringify({passed:true,scope:'Real Worker HTTP and isolated ephemeral D1; no existing player DB or native state touched',checks},null,2)+'\n');
 console.log(JSON.stringify({passed:true,checks:checks.length}));
 if(process.argv.includes('--ui')){
  const ui=await ok<AuthResponse>(null,'/auth/guest',{}),friend=await ok<AuthResponse>(null,'/auth/guest',{}),incoming=await ok<AuthResponse>(null,'/auth/guest',{}),recommended=await ok<AuthResponse>(null,'/auth/guest',{});
  for(const [u,name,level] of [[ui,'검수 정원사',16],[friend,'함께가꾸는아주긴이름친구',22],[incoming,'새로운 정원 친구',12],[recommended,'추천 정원사',18]] as const)await db.prepare("UPDATE players SET data=json_set(data,'$.nickname',?,'$.level',?,'$.hearts',3,'$.heartAt',?) WHERE id=?").bind(name,level,Date.now(),u.player.id).run();
  await send(ui,friend);await accept(friend,ui);await send(incoming,ui);
  for(const [u,score]of [[ui,15],[friend,21],[incoming,11],[recommended,17]] as const)await db.prepare('INSERT INTO ranking_scores VALUES(?,?,?)').bind(u.player.id,score,Date.now()).run();
  await ok(ui,'/guilds',{key:key(),name:'친구 검수 길드',mode:'open',minLevel:5,emblem:1});const guildId=(await me(ui)).player.guildId;await ok(friend,`/guilds/${guildId}/join`,{key:key()});await ok(friend,'/guild/chat',{key:key(),text:'함께 정원을 가꿔요!'});
  await ok(friend,'/friends/hearts/request',{key:key()});
  const heart=(await ok<{requestId:string}>(ui,'/friends/hearts/request',{key:key()})).requestId;await ok(friend,`/friends/hearts/${heart}/help`,{key:key()});
  process.env.VITE_API_URL=origin.origin+'/api';
  const {createServer}=await import('vite');const vite=await createServer({configFile:resolve('apps/client/vite.config.ts'),server:{port:5188,strictPort:true,host:'127.0.0.1'}});await vite.listen();
  const setup=`<script>localStorage.setItem('cloud-garden-language-v1','ko');localStorage.setItem('cloud-garden-session-v1',${JSON.stringify(JSON.stringify({accessToken:ui.accessToken,refreshToken:ui.refreshToken}))});</script><script type="module">import RefreshRuntime from '/@react-refresh';RefreshRuntime.injectIntoGlobalHook(window);window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>type=>type;window.__vite_plugin_react_preamble_installed__=true;</script>`;
  const file=join(statePath,'ui.html');await writeFile(file,(await readFile('apps/client/index.html','utf8')).replace('<script type="module" src="/src/main.tsx">',setup+'<script type="module" src="/src/main.tsx">'));
  console.log(JSON.stringify({uiUrl:'http://localhost:5188/@fs'+file+'#/friends',scope:'Private in-memory Worker/D1 and dedicated browser origin; four private test accounts; no actual user data or main Vite process used'}));
  await new Promise<void>(resolve=>{process.once('SIGINT',resolve);process.once('SIGTERM',resolve)});await vite.close();
 }
}finally{await mf.dispose();}
