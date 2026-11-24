import {weeklyRoundId} from '../packages/contracts/src/weekly-events';
import {configuredExpeditionRound} from '../packages/content/src/animal-expedition';
import {beforeEach,afterEach,describe,it,expect,vi} from 'vitest';
vi.mock('../apps/api/src/guild-room',()=>({GuildRoom:class{}}));
import {DatabaseSync,type SQLInputValue} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
import worker from '../apps/api/src/index';
import {defaultRuntime} from '../apps/api/src/operations';
import {ENGINE_VERSION,SUPPORTED_ENGINE_VERSIONS,type OffersResponse,type Run,type Player} from '@garden/contracts';
import {newPlayer,type ApiEnv} from '../apps/api/src/db';
import type {RuntimeSettings} from '../packages/contracts/src/operations';
import {ageBandAt} from '../packages/contracts/src/age-access';
import {erasureAccountHash,erasePreviouslyDeletedAccounts} from '../apps/api/src/account-erasure';
import {purgeExpiredRecords,retentionDeadline} from '../apps/api/src/retention';
import {preparePurchase,processPurchaseEvent} from '../apps/api/src/monetization';
import {sendPendingGuardianEmails} from '../apps/api/src/guardian-email';
import {PINBALL_PHYSICS_VERSION,type PinballPhysics} from '../packages/contracts/src/garden-games';
import {launchAcorn,pinballBoard,PINBALL_LAUNCHES} from '../packages/content/src/acorn-pinball';
import {replayWater,rotatePipe,waterBoard} from '../packages/content/src/greenhouse-water';
import {missionPeriod} from '../packages/content/src/missions';
import solutions from '../packages/content/src/campaign-solutions.json';
class Statement{
 constructor(readonly db:DatabaseSync,readonly query:string,readonly args:SQLInputValue[]=[]){}
 bind(...args:SQLInputValue[]){return new Statement(this.db,this.query,args)}
 async first<T>(){return (this.db.prepare(this.query).get(...this.args)??null) as T|null}
 execute(){const results=this.db.prepare(this.query).all(...this.args);return {success:true,results,meta:{changes:0}}}
 async all(){return this.execute()}async run(){return this.execute()}
}
let db:DatabaseSync,env:ApiEnv,session:{cookie:string;csrf:string};const origin='https://ops.example.test',password='Only-for-QA-42!';
async function call(path:string,body?:unknown,method=body===undefined?'GET':'POST',auth=true,extra:Record<string,string>={},waitUntil:(work:Promise<unknown>)=>void=()=>{}){
 const response=await worker.fetch(new Request(origin+path,{method,headers:{'Content-Type':'application/json',Origin:origin,...(auth&&session?{Cookie:session.cookie,'X-Admin-CSRF':session.csrf}:{}),...extra},...(body===undefined?{}:{body:JSON.stringify(body)})}),env,{waitUntil} as unknown as ExecutionContext);
 const value=await response.json() as {data:Record<string,unknown>;error?:{code:string;message:string}};return {response,...value};
}
async function setup(){const result=await call('/api/admin/auth/setup',{email:'owner@example.test',password,token:env.ADMIN_BOOTSTRAP_TOKEN},'POST',false);expect(result.response.status).toBe(201);session={cookie:result.response.headers.get('set-cookie')!.split(';')[0]!,csrf:String(result.data.csrf)};return result;}
function gameUser(id='test-player'){const player=newPlayer(id,Date.now());player.level=5;db.prepare('INSERT INTO players(id,data,version,created_at) VALUES(?,?,?,?)').run(id,JSON.stringify(player),player.version,Date.now());return player;}
beforeEach(()=>{db=new DatabaseSync(':memory:');for(const name of readdirSync('apps/api/migrations').filter(f=>f.endsWith('.sql')).sort())db.exec(readFileSync('apps/api/migrations/'+name,'utf8'));const binding={prepare:(query:string)=>new Statement(db,query),batch:async(statements:Statement[])=>{db.exec('BEGIN');try{const result=statements.map(s=>s.execute());db.exec('COMMIT');return result}catch(error){db.exec('ROLLBACK');throw error}}};env={DB:binding,ENVIRONMENT:'production',AGE_ACCESS_REQUIRED:'false',CLIENT_ORIGINS:'https://game.test',ADMIN_OWNER_EMAILS:'owner@example.test',ADMIN_BOOTSTRAP_TOKEN:crypto.randomUUID()+crypto.randomUUID(),ADMIN_PASSWORD_PEPPER:crypto.randomUUID()+crypto.randomUUID(),ADMIN_ASSETS:{fetch:async()=>new Response('<!doctype html><title>Admin</title>',{headers:{'Content-Type':'text/html'}})}} as unknown as ApiEnv;session=undefined as unknown as typeof session;});afterEach(()=>{vi.restoreAllMocks();db.close()});

it('earns tickets through a campaign clear and validates minigame rewards, placement and retries through the Worker',async()=>{
 let now=Date.parse('2026-11-23T14:58:00Z');vi.spyOn(Date,'now').mockImplementation(()=>now);let roundId=weeklyRoundId('001',now);
 await setup();
 const settings=defaultRuntime();settings.gameEvents['acorn-pinball'].minLevel=1;settings.gameEvents['greenhouse-water'].minLevel=1;
 settings.gameEvents['greenhouse-water'].grandPrize='animal-fox';
 expect((await call('/api/admin/runtime',{key:crypto.randomUUID(),reason:'두 미니게임 회차 테스트',revision:0,data:settings},'PUT')).response.status).toBe(200);
 const guest=await call('/api/auth/guest',{},'POST',false),headers={Authorization:'Bearer '+String(guest.data.accessToken),Origin:'https://game.test'};
 const request=(path:string,data?:Record<string,unknown>)=>call('/api/'+path,data===undefined?undefined:{idempotencyKey:crypto.randomUUID(),...data},undefined,false,headers);
 const started=await request('runs/start',{engineVersion:ENGINE_VERSION,preBoosters:[]});
 const run=started.data.run as Run;
 const reward=await request('runs/'+run.id+'/actions',{sequence:0,actions:solutions['1'].actions,finishOnWin:true});
 const earned=reward.data.player as Player;
 expect(earned.gardenGames?.['acorn-pinball']?.rounds[roundId]?.tickets).toBe(1);
 expect(earned.gardenGames?.['greenhouse-water']).toBeUndefined();
 const prep=(game:'acorn-pinball'|'greenhouse-water',completed:number)=>{
  const stored=JSON.parse(String(db.prepare('SELECT data FROM players WHERE id=?').get(earned.id)?.data)) as Player;
  stored.gardenGames![game]!.rounds[roundId]!.completed=completed;
  db.prepare('UPDATE players SET data=? WHERE id=?').run(JSON.stringify(stored),earned.id);
 };
 const playPinball=async(completed:number,pinballPhysics?:PinballPhysics)=>{
  prep('acorn-pinball',completed);
  const roundRequest={roundId,...(pinballPhysics?{pinballPhysics}:{})};
  const first=await request('minigames/acorn-pinball/start',roundRequest);
  expect(first.response.status).toBe(200);
  const started=(first.data.player as Player).gardenGames!['acorn-pinball']!;
  expect(started.freeDay).toBe(missionPeriod('daily',now).id);
  const round=started.rounds[roundId]!,attempt=round.attempt!;
  expect(attempt.pinballPhysics).toBe(pinballPhysics);
  const repeatedStart=await request('minigames/acorn-pinball/start',{roundId,pinballPhysics:PINBALL_PHYSICS_VERSION});
  expect((repeatedStart.data.player as Player).gardenGames!['acorn-pinball']!.rounds[roundId]).toEqual(round);
  const board=pinballBoard(attempt.stage,attempt.seed,attempt.pinballPhysics),paths=PINBALL_LAUNCHES.map((_,slot)=>launchAcorn(board,slot));
  const proof=board.targets.map(target=>paths.findIndex(trajectory=>trajectory.pocket===target));
  if(pinballPhysics){
   expect((await request('minigames/acorn-pinball/start',{roundId})).error?.code).toBe('UPDATE_REQUIRED');
   expect((await request('minigames/acorn-pinball/finish',{roundId,attemptId:attempt.id,actions:proof})).error?.code).toBe('UPDATE_REQUIRED');
  }
  const invalid=await request('minigames/acorn-pinball/finish',{...roundRequest,attemptId:attempt.id,actions:[24]});
  expect(invalid.response.status).toBe(409);
  const action={...roundRequest,attemptId:attempt.id,actions:proof};
  const before=(first.data.player as Player).coins;
  const [finish,retry]=await Promise.all([request('minigames/acorn-pinball/finish',action),request('minigames/acorn-pinball/finish',action)]);
  const player=finish.data.player as Player;
  expect(finish.response.status).toBe(200);expect(retry.response.status).toBe(200);
  expect(retry.data.result).toEqual(finish.data.result);
  expect(player.coins-before).toBe(completed===4?90:240);
  expect((retry.data.player as Player).coins).toBe(player.coins);
  expect(player.hearts).toBe(earned.hearts);
  return {round,player};
 };
 const midpoint=await playPinball(4);expect(midpoint.round.tickets).toBe(1);expect(midpoint.player.inventory.bomb.bound).toBe(2);
 const final=await playPinball(9,PINBALL_PHYSICS_VERSION);expect(final.round.tickets).toBe(0);
 expect((await request('minigames/acorn-pinball/start',{roundId})).error?.code).toBe('GARDEN_GAME_COMPLETE');
 const newWorld=(await request('garden/world?gardenArt=garden-v63')).data.world as {revision:number;owned:Record<string,{itemId:string}>};
 const grant=`event-acorn-pinball-${roundId}-10`;
 expect(newWorld.owned[`event-acorn-pinball-${roundId}-5`]?.itemId).toBe('garden-gazebo');
 expect(newWorld.owned[grant]?.itemId).toBe('garden-acorn-cottage');
 const legacy=(await request('garden/world?gardenArt=garden-v62')).data.world as typeof newWorld;expect(legacy.owned[grant]?.itemId).toBe('garden-gazebo');
 const place=await call('/api/garden/world/commands?gardenArt=garden-v63',{key:crypto.randomUUID(),type:'place',instanceId:grant,x:12,y:12,rotation:0,expectedRevision:newWorld.revision},'POST',false,headers);
 expect(place.response.status).toBe(200);

 now=Date.parse('2026-11-30T14:58:00Z');roundId=weeklyRoundId('001',now);
 const refreshed=await call('/api/auth/refresh',{refreshToken:guest.data.refreshToken},'POST',false);
 expect(refreshed.response.status).toBe(200);headers.Authorization='Bearer '+String(refreshed.data.accessToken);
 const next=await request('runs/start',{engineVersion:ENGINE_VERSION,preBoosters:[]});
 const nextRun=next.data.run as Run;
 expect((await request('runs/'+nextRun.id+'/actions',{sequence:0,actions:solutions[String(nextRun.level.id) as keyof typeof solutions].actions,finishOnWin:true})).response.status).toBe(200);
 const water=await request('minigames/greenhouse-water/start',{roundId});
 const attempt=(water.data.player as Player).gardenGames!['greenhouse-water']!.rounds[roundId]!.attempt!;
 const board=waterBoard(attempt.stage,attempt.seed);
 const maskByCell={11:10,12:15,7:5,13:10,17:3,18:12};
 const moves:number[]=[];
 for(const [cell,mask]of Object.entries(maskByCell)){
  const at=Number(cell),turns=[0,1,2,3].find(n=>rotatePipe(board.pipes[at]!,n)===mask)!;
  for(let i=0;i<turns&&replayWater(board,moves).status==='playing';i++)moves.push(at);
 }
 expect(replayWater(board,moves).status).toBe('won');
 const done=await request('minigames/greenhouse-water/finish',{roundId,attemptId:attempt.id,actions:moves});
 expect(done.data.result).toMatchObject({won:true,stage:1,reward:{coins:40,items:{'wind-row':1}}});
});
describe('administration boundary',()=>{
 it('publishes game-event schedules and quotas through the authenticated audited runtime endpoint',async()=>{
  vi.spyOn(Date,'now').mockReturnValue(Date.parse('2026-11-16T03:00:00Z'));
  await setup();const data=defaultRuntime();data.gameEvents.animalExpedition.animal='red-panda';data.gameEvents.animalExpedition.roundId='003';data.gameEvents.animalExpedition.dailyLimit=4;data.gameEvents.animalExpedition.minLevel=25;data.gameEvents.flowerlight.durationDays=10;data.gameEvents.treasure.startsAt=Date.now()+86400000;data.features.powerFestival=false;
  const saved=await call('/api/admin/runtime',{key:crypto.randomUUID(),reason:'원정 횟수와 이벤트 일정 조정',revision:0,data},'PUT');expect(saved.response.status).toBe(200);
  const publicState=await call('/api/operations/bootstrap',undefined,'GET',false),settings=publicState.data.settings as RuntimeSettings;expect(settings.gameEvents).toEqual(data.gameEvents);expect(settings.features.powerFestival).toBe(false);
  const guest=await call('/api/auth/guest',{},'POST',false),token=String(guest.data.accessToken),player=guest.data.player as Player;player.level=24;db.prepare('UPDATE players SET data=? WHERE id=?').run(JSON.stringify(player),player.id);
  const gameHeaders={Origin:'https://game.test',Authorization:'Bearer '+token};expect((await call('/api/animal-expedition/start',{key:crypto.randomUUID()},'POST',false,gameHeaders)).error?.code).toBe('EXPEDITION_LOCKED');
  player.level=25;db.prepare('UPDATE players SET data=? WHERE id=?').run(JSON.stringify(player),player.id);const started=await call('/api/animal-expedition/start',{key:crypto.randomUUID()},'POST',false,gameHeaders);expect(started.response.status).toBe(200);
  expect((started.data.player as Player).animalExpedition).toMatchObject({roundId:configuredExpeditionRound(settings).roundId,animal:'red-panda',dailyAttempts:{used:1}});expect((await call('/api/power-festival/start',{key:crypto.randomUUID()},'POST',false,gameHeaders)).error?.code).toBe('FEATURE_PAUSED');expect((await call('/api/minigames/treasure/start',{key:crypto.randomUUID()},'POST',false,gameHeaders)).error?.code).toBe('EVENT_NOT_OPEN');
  expect(db.prepare("SELECT reason FROM admin_audit WHERE action='runtime.update'").get()).toEqual({reason:'원정 횟수와 이벤트 일정 조정'});
  const invalid=structuredClone(data);invalid.gameEvents.animalExpedition.dailyLimit=0;expect((await call('/api/admin/runtime',{key:crypto.randomUUID(),reason:'잘못된 횟수 검증',revision:1,data:invalid},'PUT')).response.status).toBe(400);
  invalid.gameEvents.animalExpedition.dailyLimit=3;invalid.gameEvents.animalExpedition.startsAt=200;invalid.gameEvents.animalExpedition.endsAt=100;expect((await call('/api/admin/runtime',{key:crypto.randomUUID(),reason:'잘못된 일정 검증',revision:1,data:invalid},'PUT')).response.status).toBe(400);
 });
 it('serves the console shell without exposing its data, with restrictive browser headers',async()=>{const response=await worker.fetch(new Request(origin+'/admin/users'),env,{waitUntil:()=>{}} as unknown as ExecutionContext);expect(response.status).toBe(200);expect(response.headers.get('content-security-policy')).toContain("frame-ancestors 'none'");expect(response.headers.get('referrer-policy')).toBe('no-referrer');expect((await call('/api/admin/users',undefined,'GET',false)).response.status).toBe(401);expect((await call('/api/admin/users',undefined,'GET',false,{'x-admin-token':'not-a-session',Authorization:'Bearer game-token'})).response.status).toBe(401);});
 it('allows only the nominated first owner and never reuses the bootstrap after enrollment',async()=>{expect((await call('/api/admin/auth/setup',{email:'intruder@example.test',password,token:env.ADMIN_BOOTSTRAP_TOKEN},'POST',false)).response.status).toBe(403);const first=await setup();expect(first.response.headers.get('set-cookie')).toContain('__Host-garden_admin=');expect(first.response.headers.get('set-cookie')).toContain('HttpOnly');expect(first.response.headers.get('set-cookie')).toContain('Secure');const second=await call('/api/admin/auth/setup',{email:'owner@example.test',password,token:env.ADMIN_BOOTSTRAP_TOKEN},'POST',false);expect(second.response.status).not.toBe(201);expect(db.prepare('SELECT count(*) n FROM admin_accounts').get()).toEqual({n:1});const account=db.prepare('SELECT password_hash,password_salt FROM admin_accounts').get()!;expect(account.password_hash).not.toBe(password);expect(String(account.password_salt).length).toBeGreaterThan(30);});
 it('requires both the same browser origin and session CSRF token for writes',async()=>{await setup();const body={key:crypto.randomUUID(),reason:'테스트 변경',revision:0,data:defaultRuntime()};expect((await call('/api/admin/runtime',body,'PUT',true,{'X-Admin-CSRF':'wrong'})).response.status).toBe(403);expect((await call('/api/admin/runtime',body,'PUT',true,{Origin:'https://evil.test'})).response.status).toBe(403);expect(db.prepare('SELECT count(*) n FROM ops_settings').get()).toEqual({n:0});});
 it('revokes logout sessions and verifies passwords without storing their plaintext',async()=>{await setup();expect((await call('/api/admin/auth/login',{email:'owner@example.test',password:'incorrect'},'POST',false)).response.status).toBe(401);expect((await call('/api/admin/auth/login',{email:'owner@example.test',password},'POST',false)).response.status).toBe(200);expect((await call('/api/admin/auth/logout',{})).response.status).toBe(200);expect((await call('/api/admin/overview')).response.status).toBe(401);});
 it('enforces viewer and support roles on the server even when endpoints are called directly',async()=>{await setup();db.prepare("UPDATE admin_accounts SET role='viewer'").run();const row=await call('/api/admin/runtime',{key:crypto.randomUUID(),reason:'권한 확인',revision:0,data:defaultRuntime()},'PUT');expect(row.response.status).toBe(403);expect((await call('/api/admin/users')).response.status).toBe(200);expect((await call('/api/admin/accounts')).response.status).toBe(403);db.prepare("UPDATE admin_accounts SET role='support'").run();expect((await call('/api/admin/runtime',{key:crypto.randomUUID(),reason:'권한 확인',revision:0,data:defaultRuntime()},'PUT')).response.status).toBe(403);});
});
describe('live operation changes',()=>{
 it('replays edited notices and events without applying them twice or hiding conflicting edits',async()=>{
  await setup();const now=Date.now(),noticeId=crypto.randomUUID(),eventId=crypto.randomUUID();
  const notice={title:'초안',body:'내용',status:'draft',startsAt:now,endsAt:null,pinned:false,popup:false};
  const event={title:'보상',description:'내용',kind:'reward',status:'draft',startsAt:now,endsAt:now+86400000,imageUrl:'',reward:{coins:10,stars:0,hearts:0,items:{}}};
  for(const [resource,id,data] of [['notices',noticeId,notice],['events',eventId,event]] as const){
   expect((await call('/api/admin/'+resource,{key:id,reason:'초안 생성',revision:0,data})).response.status).toBe(200);
   const update={key:crypto.randomUUID(),reason:'게시 전 수정',revision:1,data:{...data,title:'수정 내용'}};
   expect((await call('/api/admin/'+resource+'/'+id,update,'PUT')).response.status).toBe(200);
   expect((await call('/api/admin/'+resource+'/'+id,update,'PUT')).data.replayed).toBe(true);
   expect((await call('/api/admin/'+resource+'/'+id,{...update,key:crypto.randomUUID()},'PUT')).response.status).toBe(409);
  }
 });
 it('rejects unauthorized and executable media before any storage write',async()=>{
  const put=vi.fn();env.ASSETS={put} as unknown as R2Bucket;
  const send=(body:string,headers:Record<string,string>={})=>worker.fetch(new Request(origin+'/api/admin/media',{method:'POST',headers:{Origin:origin,...headers},body}),env,{waitUntil:()=>{}} as unknown as ExecutionContext);
  expect((await send('<svg/>')).status).toBe(401);await setup();
  expect((await send('<svg/>',{Cookie:session.cookie,'X-Admin-CSRF':session.csrf})).status).toBe(400);
  expect((await send('x',{Cookie:session.cookie,'X-Admin-CSRF':session.csrf,'Content-Length':String(6*1024*1024)})).status).toBe(413);
  expect(put).not.toHaveBeenCalled();
 });

 it('writes runtime settings with audit and refuses stale edits',async()=>{await setup();const data=defaultRuntime();data.maintenance.enabled=true;const request={key:crypto.randomUUID(),reason:'긴급 점검',revision:0,data},result=await call('/api/admin/runtime',request,'PUT');expect((await call('/api/admin/runtime',request,'PUT')).response.status).toBe(200);expect((await call('/api/admin/runtime',{...request,reason:'다른 변경'},'PUT')).response.status).toBe(409);expect(result.response.status).toBe(200);expect((await call('/api/admin/runtime')).data.revision).toBe(1);expect((await call('/api/admin/runtime',{key:crypto.randomUUID(),reason:'동시 변경',revision:0,data},'PUT')).response.status).toBe(409);const publicState=await call('/api/operations/bootstrap',undefined,'GET',false);expect(publicState.data.maintenanceActive).toBe(true);expect(db.prepare("SELECT reason FROM admin_audit WHERE action='runtime.update'").get()).toEqual({reason:'긴급 점검'});});
 it('publishes only active notices, retains literal text and prevents duplicate creation on retry',async()=>{await setup();const now=Date.now(),key=crypto.randomUUID(),data={title:'게임 소식',body:'<script>alert(1)</script>',status:'published',startsAt:now-1000,endsAt:now+100000,pinned:true,popup:true},body={key,reason:'공지 게시',revision:0,data};expect((await call('/api/admin/notices',body)).response.status).toBe(200);expect((await call('/api/admin/notices',body)).response.status).toBe(200);await call('/api/admin/notices',{key:crypto.randomUUID(),reason:'예약 작성',revision:0,data:{...data,title:'예약 공지',startsAt:now+10000,endsAt:now+20000}});const snapshot=await call('/api/operations/bootstrap',undefined,'GET',false);expect((snapshot.data.notices as unknown[]).length).toBe(1);expect(db.prepare('SELECT count(*) n FROM ops_notices').get()).toEqual({n:2});});
 it('grants a direct user reward once, with currency ledger and overflow hearts kept in gifts',async()=>{await setup();const player=gameUser(),body={key:crypto.randomUUID(),reason:'문의 보상',reward:{coins:100,stars:2,hearts:3,items:{hammer:2}}};const first=await call('/api/admin/users/'+player.id+'/grant',body);expect(first.response.status).toBe(200);expect((await call('/api/admin/users/'+player.id+'/grant',body)).response.status).toBe(200);const updated=JSON.parse(String(db.prepare('SELECT data FROM players WHERE id=?').get(player.id)!.data));expect(updated.coins).toBe(600);expect(updated.inventory.hammer.bound).toBe(2);expect(db.prepare("SELECT count(*) n FROM ledger WHERE asset='coins' AND delta=100").get()).toEqual({n:1});expect(db.prepare("SELECT quantity FROM gifts WHERE kind='heart'").get()).toEqual({quantity:3});});
 it('allows a reward event once per account and blocks new claims when paused',async()=>{await setup();const player=gameUser(),id=crypto.randomUUID(),data={title:'테스트 이벤트',description:'선물',kind:'reward',status:'published',startsAt:Date.now()-1000,endsAt:Date.now()+100000,imageUrl:'',reward:{coins:25,stars:1,hearts:0,items:{}}};expect((await call('/api/admin/events',{key:id,reason:'보상 이벤트',revision:0,data})).response.status).toBe(200);const {claimOpsEvent}=await import('../apps/api/src/operations');await claimOpsEvent(env,player.id,id,{key:crypto.randomUUID()});await expect(claimOpsEvent(env,player.id,id,{key:crypto.randomUUID()})).rejects.toMatchObject({code:'ALREADY_CLAIMED'});await call('/api/admin/events/'+id,{key:crypto.randomUUID(),reason:'잠시 중지',revision:1,data:{...data,status:'paused'}},'PUT');const other=gameUser('other-player');await expect(claimOpsEvent(env,other.id,id,{key:crypto.randomUUID()})).rejects.toMatchObject({code:'EVENT_ENDED'});});
 it('excludes a paused season while retaining its ownership and claims',async()=>{await setup();db.prepare('DELETE FROM seasons').run();const id=crypto.randomUUID(),data={title:'패스',description:'시즌',kind:'season',status:'published',startsAt:Date.now()-1000,endsAt:Date.now()+100000,imageUrl:'',reward:{coins:0,stars:0,hearts:0,items:{}}};expect((await call('/api/admin/events',{key:id,reason:'패스 시작',revision:0,data})).response.status).toBe(200);const {currentSeason}=await import('../apps/api/src/economy');expect((await currentSeason(env))?.id).toBe(id);await call('/api/admin/events/'+id,{key:crypto.randomUUID(),reason:'패스 점검',revision:1,data:{...data,status:'paused'}},'PUT');expect(await currentSeason(env)).toBeNull();expect(db.prepare('SELECT count(*) n FROM seasons').get()).toEqual({n:1});});
});
describe('support and game enforcement',()=>{
 it('filters guild chat before writing and removes a reported message from the room and send cache',async()=>{
  await setup();
  const broadcast=vi.fn(async()=>true);
  env.GUILD_ROOMS={getByName:()=>({broadcast})} as unknown as ApiEnv['GUILD_ROOMS'];
  const guildId=crypto.randomUUID(),now=Date.now();
  db.prepare('INSERT INTO guilds VALUES(?,?,?,?,?,?,?,?)').run(guildId,'Moderation QA','desc','','open',5,0,now);
  async function member(role:'leader'|'member'){
   const guest=await call('/api/auth/guest',{},'POST',false);
   const player=guest.data.player as Player;
   db.prepare('INSERT INTO guild_members VALUES(?,?,?,0,?)').run(player.id,guildId,role,now);
   return async(path:string,body?:unknown,method=body===undefined?'GET':'POST')=>{
    const tasks:Promise<unknown>[]=[];
    const result=await call('/api'+path,body,method,false,{Origin:'https://game.test',Authorization:'Bearer '+String(guest.data.accessToken)},work=>tasks.push(work));
    await Promise.all(tasks);
    return result;
   };
  }
  const author=await member('leader'),reader=await member('member'),other=await member('member');
  for(const text of ['씨 · \u200b발','Ｆ．Ｕ．Ｃ．Ｋ','くたばれ','너 죽여버릴 거야']){
   const blocked=await author('/guild/chat',{key:crypto.randomUUID(),text});
   expect(blocked.response.status).toBe(400);
   expect(blocked.error?.code).toBe('CHAT_HARMFUL_MESSAGE');
  }
  expect(db.prepare('SELECT count(*) n FROM chat_messages').get()?.n).toBe(0);
  expect(db.prepare("SELECT count(*) n FROM operations WHERE fingerprint LIKE 'guild:chat:%'").get()?.n).toBe(0);
  expect(broadcast).not.toHaveBeenCalled();

  const sent={key:crypto.randomUUID(),text:'시발점부터, 보스를 공격해요. Classic assistance! まだ死ねない。'};
  const message=(await author('/guild/chat',sent)).data.message as {id:string;text:string};
  expect(message.text).toBe(sent.text);
  expect((await reader('/guild')).data.messages).toEqual([message]);
  for(const report of [reader,other]){
   expect((await report('/guild/report',{key:crypto.randomUUID(),messageId:message.id,reason:'길드 메시지 신고'})).response.status).toBe(200);
  }
  const list=await call('/api/admin/reports');
  const reports=list.data.items as Array<{id:string;message:string}>;
  expect(reports.map(report=>report.message)).toEqual([sent.text,sent.text]);
  const id=reports[0]!.id,path='/api/admin/reports/'+id+'/message';
  const action={key:crypto.randomUUID(),reason:'신고 내용 확인 후 삭제'};
  db.prepare("UPDATE admin_accounts SET role='viewer'").run();
  expect((await call(path,action,'DELETE')).error?.code).toBe('ADMIN_FORBIDDEN');
  expect((await reader('/guild')).data.messages).toEqual([message]);
  db.prepare("UPDATE admin_accounts SET role='support'").run();

  broadcast.mockClear();
  const tasks:Promise<unknown>[]=[];
  const deletion=await call(path,action,'DELETE',true,{},work=>tasks.push(work));
  expect(deletion.response.status).toBe(200);
  await Promise.all(tasks);
  expect(broadcast).toHaveBeenCalledExactlyOnceWith(expect.any(String),guildId);
  expect((await reader('/guild')).data.messages).toEqual([]);
  expect((await call('/api/admin/reports')).data.items).toMatchObject(
   reports.map(report=>({id:report.id,message:null,status:'resolved',deleted_at:expect.any(Number)})),
  );
  expect((await call(path,action,'DELETE')).data).toEqual({replayed:true});
  expect((await call(path,{...action,key:crypto.randomUUID()},'DELETE')).data).toEqual({alreadyDeleted:true});
  expect((await call('/api/admin/reports/'+id,{key:crypto.randomUUID(),reason:'상태 변경',note:'',status:'reviewing'},'PUT')).error?.code).toBe('REPORT_MESSAGE_DELETED');
  expect((await other('/guild/report',{key:crypto.randomUUID(),messageId:message.id,reason:'추가 신고'})).error?.code).toBe('MESSAGE_NOT_FOUND');
  expect((await author('/guild/chat',sent)).error?.code).toBe('IDEMPOTENCY_CONFLICT');
  expect(JSON.stringify(db.prepare('SELECT fingerprint,response FROM operations WHERE key=?').get(sent.key))).not.toContain(sent.text);
  expect(db.prepare('SELECT text FROM chat_messages WHERE id=?').get(message.id)?.text).toBe('[삭제된 메시지]');
  expect(db.prepare("SELECT count(*) n FROM admin_audit WHERE action='report.message.delete'").get()?.n).toBe(1);
  expect((await author('/account',{confirmation:'DELETE'},'DELETE')).response.status).toBe(200);
  expect(db.prepare('SELECT message_id FROM deleted_chat_messages WHERE message_id=?').get(message.id)).toBeUndefined();
  expect(db.prepare("SELECT count(*) n FROM admin_audit WHERE action='report.message.delete'").get()?.n).toBe(0);
 });

 it('keeps staff notes private and allows user replies only on their own ticket',async()=>{await setup();const player=gameUser(),other=gameUser('other'),support=await import('../apps/api/src/customer-support');const ticket=await support.createTicket(env,player.id,{key:crypto.randomUUID(),category:'suggestion',title:'새 건의',body:'의견을 보냅니다.'});await call('/api/admin/tickets/'+ticket.id+'/reply',{key:crypto.randomUUID(),reason:'담당자 메모',body:'운영팀 내부 정보',internal:true,status:'pending'});await call('/api/admin/tickets/'+ticket.id+'/reply',{key:crypto.randomUUID(),reason:'사용자 답변',body:'의견 감사합니다.',internal:false,status:'resolved'});const thread=await support.supportThread(env,player.id,ticket.id);expect(thread.messages).toHaveLength(2);expect(JSON.stringify(thread)).not.toContain('내부 정보');await expect(support.supportThread(env,other.id,ticket.id)).rejects.toMatchObject({status:404});await support.replyTicket(env,player.id,ticket.id,{key:crypto.randomUUID(),body:'추가 의견입니다.'});expect((await support.supportThread(env,player.id,ticket.id)).status).toBe('open');});
 it('enforces maintenance, minimum versions and restrictions, while preserving paid settlement and support',async()=>{const {guardOperations}=await import('../apps/api/src/operations'),data:RuntimeSettings=defaultRuntime();data.maintenance.enabled=true;const req=new Request('https://game.test/api/runs/start',{method:'POST'});expect(()=>guardOperations(req,'/runs/start',data)).toThrow();expect(()=>guardOperations(req,'/runs/abc/finish',data)).not.toThrow();expect(()=>guardOperations(req,'/purchases/verify',data)).not.toThrow();expect(()=>guardOperations(req,'/support',data,JSON.stringify({banned:true,until:null,reason:'제한'}))).not.toThrow();data.maintenance.enabled=false;data.versions.ios.minimum='1.06';expect(()=>guardOperations(new Request(req,{headers:{'X-App-Platform':'ios','X-App-Version':'1.05'}}),'/runs/start',data)).toThrow();expect(()=>guardOperations(req,'/runs/start',data,JSON.stringify({banned:true,until:null,reason:'제한'}))).toThrow();expect(()=>guardOperations(req,'/operations/events/test/claim',data,JSON.stringify({banned:true,until:null,reason:'제한'}))).toThrow();});
 it('runs administrator changes through actual player authentication and joins settings in its existing DB snapshot',async()=>{await setup();const guest=await call('/api/auth/guest',{},'POST',false),token=String(guest.data.accessToken);expect(guest.response.status).toBe(200);const info=await call('/api/me',undefined,'GET',false,{Authorization:'Bearer '+token,'X-App-Platform':'ios','X-App-Version':'1.06'});expect(info.response.status).toBe(200);expect(db.prepare('SELECT platform,app_version FROM player_activity').get()).toEqual({platform:'ios',app_version:'1.06'});expect((await call('/api/operations',undefined,'GET',false,{Authorization:'Bearer '+token})).response.status).toBe(200);});
});

describe('server-authorized unlimited starting items',()=>{
 const items=['wind-row','bomb','rainbow'] as const;
 async function begin(id:string,free=false){const {startRun}=await import('../apps/api/src/runs');return startRun(env,id,{idempotencyKey:crypto.randomUUID(),preBoosters:[...items],engineVersion:ENGINE_VERSION,supportedEngineVersions:SUPPORTED_ENGINE_VERSIONS,randomStart:true,freeStartBoosters:free});}
 function stock(id:string,counts:{normal:number;bound:number}){const player=gameUser(id);player.level=31;for(const item of items)player.inventory[item]={...counts};db.prepare('UPDATE players SET data=? WHERE id=?').run(JSON.stringify(player),id);return player;}
 it('starts with all three zero-stock items for free and replays the same request once',async()=>{
  vi.spyOn(Date,'now').mockReturnValue(Date.parse('2026-11-06T03:00:00Z'));const before=stock('free-start',{normal:0,bound:0}),{startRun}=await import('../apps/api/src/runs');const body={idempotencyKey:crypto.randomUUID(),preBoosters:[...items],engineVersion:ENGINE_VERSION,supportedEngineVersions:SUPPORTED_ENGINE_VERSIONS,randomStart:true,freeStartBoosters:true};const first=await startRun(env,before.id,body),again=await startRun(env,before.id,body);expect(first.run.preBoosters).toEqual(items);expect(first.run.startBoosterFreeUntil).toBe(Date.parse('2026-11-06T03:10:00Z'));expect(first.player.inventory).toEqual(before.inventory);expect(again.run.id).toBe(first.run.id);expect(db.prepare('SELECT count(*) n FROM runs').get()).toEqual({n:1});
 });
 it('preserves both normal and bound stocks during the event, while in-game tools still cost inventory',async()=>{
  vi.spyOn(Date,'now').mockReturnValue(Date.parse('2026-11-06T09:04:00Z'));const before=stock('stocked-free',{normal:2,bound:3}),result=await begin(before.id);expect(result.player.inventory).toEqual(before.inventory);const {useBooster}=await import('../apps/api/src/runs');await useBooster(env,before.id,result.run.id,{idempotencyKey:crypto.randomUUID(),item:'sweep-row',at:0,sequence:0});const player=JSON.parse(String(db.prepare('SELECT data FROM players WHERE id=?').get(before.id)!.data)) as Player;expect(player.inventory['sweep-row'].normal).toBe(before.inventory['sweep-row'].normal-1);
 });
 it('never consumes stocked items for a free request that arrives at the expiry boundary',async()=>{
  vi.spyOn(Date,'now').mockReturnValue(Date.parse('2026-11-06T03:10:00Z'));const before=stock('late-free',{normal:2,bound:1});await expect(begin(before.id,true)).rejects.toMatchObject({code:'START_BOOSTER_EVENT_ENDED'});const player=JSON.parse(String(db.prepare('SELECT data FROM players WHERE id=?').get(before.id)!.data)) as Player;expect(player.inventory).toEqual(before.inventory);expect(db.prepare('SELECT count(*) n FROM runs').get()).toEqual({n:0});
 });
 it('uses ordinary stock outside the event and does not change an already active board when it starts',async()=>{
  const clock=vi.spyOn(Date,'now').mockReturnValue(Date.parse('2026-11-06T02:59:00Z')),before=stock('regular-start',{normal:2,bound:1}),first=await begin(before.id);for(const item of items)expect(first.player.inventory[item]).toEqual({normal:2,bound:0});expect(first.run.startBoosterFreeUntil).toBeUndefined();clock.mockReturnValue(Date.parse('2026-11-06T03:01:00Z'));const resumed=await begin(before.id,true);expect(resumed.run.id).toBe(first.run.id);expect(resumed.run.state).toEqual(first.run.state);expect(resumed.run.startBoosterFreeUntil).toBeUndefined();
 });
});

it('returns canonical festival architecture to new clients and a wire-only fallback to installed older clients',async()=>{
 await setup();const guest=await call('/api/auth/guest',{},'POST',false),player=guest.data.player as Player,gameHeaders={Origin:'https://game.test',Authorization:'Bearer '+String(guest.data.accessToken)};
 player.level=20;db.prepare('UPDATE players SET data=? WHERE id=?').run(JSON.stringify(player),player.id);
 await call('/api/flowerlight/start',{key:crypto.randomUUID()},'POST',false,gameHeaders);
 const saved=JSON.parse(String(db.prepare('SELECT data FROM players WHERE id=?').get(player.id)!.data)) as Player;saved.flowerFestival!.petals=2;db.prepare('UPDATE players SET data=? WHERE id=?').run(JSON.stringify(saved),player.id);
 const claimed=await call('/api/flowerlight/restore?gardenArt=garden-v51',{key:crypto.randomUUID(),stage:1},'POST',false,gameHeaders);expect(claimed.response.status).toBe(200);
 const instanceId='flowerlight-invitation-v1:welcome',world=claimed.data.world as {owned:Record<string,{itemId:string}>;placements:Record<string,unknown>};expect(world.owned[instanceId]!.itemId).toBe('garden-flowerlight-arch');expect(world.placements[instanceId]).toBeTruthy();
 const older=await call('/api/garden/world?gardenArt=expedition-v50',undefined,'GET',false,gameHeaders);expect((older.data.world as typeof world).owned[instanceId]!.itemId).toBe('garden-rose-arch');
 const canonical=JSON.parse(String(db.prepare('SELECT data FROM garden_worlds WHERE user_id=?').get(player.id)!.data)) as typeof world;expect(canonical.owned[instanceId]!.itemId).toBe('garden-flowerlight-arch');expect(canonical.placements[instanceId]).toEqual(world.placements[instanceId]);
});

it('limits the tool bundle per Korean calendar month and saves the quoted rewards',async()=>{
 const reset=Date.parse('2027-01-01T00:00:00+09:00');
 const clock=vi.spyOn(Date,'now').mockReturnValue(reset-1000);
 const guest=await call('/api/auth/guest',{},'POST',false),player=guest.data.player as Player;
 const headers={Origin:'https://game.test',Authorization:'Bearer '+String(guest.data.accessToken)};
 player.level=5;
 db.prepare('UPDATE players SET data=? WHERE id=?').run(JSON.stringify(player),player.id);
 const sku='garden.boosters';
 const catalog=()=>call('/api/catalog',undefined,'GET',false,headers);
 const prepare=()=>preparePurchase(env,player.id,{key:crypto.randomUUID(),productId:sku});

 const first=await prepare();
 expect(first.expiresAt).toBe(reset);
 const intentId=first.purchaseIntentId;
 const intent=db.prepare('SELECT season_id,grant_data FROM purchase_intents WHERE id=?').get(intentId)!;
 expect(intent.season_id).toBe('monthly-bundle:2026-12');
 expect(JSON.parse(String(intent.grant_data))).toEqual({coins:2000,items:{hammer:1,'sweep-row':1,rainbow:1},unlimitedSeconds:900});
 await expect(prepare()).rejects.toMatchObject({code:'PURCHASE_PENDING'});
 db.prepare("UPDATE purchase_intents SET status='granted' WHERE id=?").run(intentId);
 db.prepare(`INSERT INTO purchases(provider,transaction_id,user_id,product_id,environment,status,verified_json,created_at,intent_id)
  VALUES('apple','tool-quote',?,?,'Sandbox','finished','{}',?,?)`).run(player.id,sku,reset-1000,intentId);
 expect((await catalog()).data.monthlyBundle).toEqual({productId:sku,purchased:true,resetsAt:reset});
 await expect(prepare()).rejects.toMatchObject({code:'MONTHLY_BUNDLE_ALREADY_PURCHASED'});

 clock.mockReturnValue(reset);
 expect((await catalog()).data.monthlyBundle).toMatchObject({purchased:false});
 db.prepare(`INSERT INTO purchases(provider,transaction_id,user_id,product_id,environment,status,verified_json,created_at)
  VALUES('google','legacy-tool-purchase',?,?,'Sandbox','refunded','{}',?)`).run(player.id,sku,reset);
 await expect(prepare()).rejects.toMatchObject({code:'MONTHLY_BUNDLE_ALREADY_PURCHASED'});
 clock.mockReturnValue(Date.parse('2027-02-01T00:00:00+09:00'));
 await expect(prepare()).resolves.toMatchObject({productId:sku});
});

it('refunds old and new bundle purchases using their own reward amounts',async()=>{
 const now=Date.now();
 for(const old of [true,false]){
  const guest=await call('/api/auth/guest',{},'POST',false),player=guest.data.player as Player;
  const headers={Origin:'https://game.test',Authorization:'Bearer '+String(guest.data.accessToken)};
  player.level=5;
  player.coins=3000;
  player.unlimitedUntil=now+7_200_000;
  player.inventory.hammer.normal=6;
  player.inventory.shuffle.normal=5;
  db.prepare('UPDATE players SET data=? WHERE id=?').run(JSON.stringify(player),player.id);
  const prepared=await preparePurchase(env,player.id,{key:crypto.randomUUID(),productId:'garden.boosters'});
  const intent=prepared.purchaseIntentId,transaction=old?'old-grant':'new-grant';
  if(old)db.prepare('UPDATE purchase_intents SET grant_data=NULL WHERE id=?').run(intent);
  db.prepare("UPDATE purchase_intents SET status='granted' WHERE id=?").run(intent);
  db.prepare(`INSERT INTO purchases(provider,transaction_id,user_id,product_id,environment,status,verified_json,created_at,intent_id)
    VALUES('apple',?,?,'garden.boosters','Production','finished','{}',?,?)`).run(transaction,player.id,now,intent);
  db.prepare("INSERT INTO external_events VALUES('apple',?,?,0,?)").run(transaction,
    JSON.stringify({transactionId:transaction,environment:'Production',revoked:true,refundedAt:now}),now);
  await processPurchaseEvent(env,'apple',transaction);
  const state=(await call('/api/me',undefined,'GET',false,headers)).data.player as Player;
  expect(state.coins).toBe(1000);
  expect(state.inventory.hammer.normal).toBe(old?1:5);
  expect(state.inventory.shuffle.normal).toBe(old?0:5);
  expect(state.unlimitedUntil).toBe(now+(old?3600:6300)*1000);
 }
});

it('publishes the new garden offers, charges the displayed price once, and keeps old clients safe',async()=>{
 const guest=await call('/api/auth/guest',{},'POST',false),player=guest.data.player as Player;
 const headers={Origin:'https://game.test',Authorization:'Bearer '+String(guest.data.accessToken)};
 player.level=119;player.coins=40000;player.boundCoins=0;
 db.prepare('UPDATE players SET data=? WHERE id=?').run(JSON.stringify(player),player.id);
 const legacy=await call('/api/garden/world?gardenArt=garden-v51',undefined,'GET',false,headers);
 const oldPath='/api/garden/world?shopVersion=2&gardenArt=garden-v63';
 const worldPath='/api/garden/world?shopVersion=2&gardenArt=garden-v64';
 const old=await call(oldPath,undefined,'GET',false,headers);
 const current=await call(worldPath,undefined,'GET',false,headers);
 expect(legacy.data).toMatchObject({prices:{'garden-gazebo':700,'garden-path-stone':20}});
 expect(old.data).toMatchObject({shopVersion:2,prices:{'garden-path-stone':50}});
 expect(Object.keys(old.data.prices as object)).toHaveLength(16);
 expect(current.data).toMatchObject({shopVersion:2,prices:{'garden-lotus-pavilion':8000,'garden-aurora-conservatory':10000,'garden-gazebo':6500,'garden-path-stone':50,'garden-apiary':5500,'animal-duckling':900},minimumLevels:{'garden-apiary':10,'garden-gazebo':20,'garden-aurora-conservatory':120}});
 expect(Object.keys(current.data.prices as object)).toHaveLength(32);
 const buy=(body:Record<string,unknown>)=>call('/api/garden/shop/buy?gardenArt=garden-v64',body,'POST',false,headers);
 expect((await buy({key:crypto.randomUUID(),itemId:'garden-gazebo'})).error?.code).toBe('UPDATE_REQUIRED');
 expect((await buy({key:crypto.randomUUID(),itemId:'garden-gazebo',expectedUnitPrice:700})).error?.code).toBe('GARDEN_PRICE_CHANGED');
 const offer={key:crypto.randomUUID(),itemId:'garden-aurora-conservatory',expectedUnitPrice:10000};
 const locked=await buy(offer);
 expect(locked.response.status).toBe(403);
 expect(locked.error?.code).toBe('GARDEN_ITEM_LEVEL_REQUIRED');
 expect((await call('/api/me',undefined,'GET',false,headers)).data.player).toMatchObject({coins:40000});
 player.level=120;
 db.prepare('UPDATE players SET data=? WHERE id=?').run(JSON.stringify(player),player.id);
 const receipt=await buy(offer);
 expect(receipt.response.status).toBe(200);
 expect(receipt.data).toMatchObject({cost:10000,player:{coins:30000}});
 expect((await buy(offer)).data).toEqual(receipt.data);
 expect((await buy({...offer,expectedUnitPrice:4000})).error?.code).toBe('IDEMPOTENCY_CONFLICT');
 const {instanceId,world}=receipt.data as {instanceId:string;world:{revision:number}};
 const placed=await call('/api/garden/world/commands?gardenArt=garden-v62',{key:crypto.randomUUID(),type:'place',instanceId,x:12,y:12,rotation:90,expectedRevision:world.revision},'POST',false,headers);
 expect(placed.response.status).toBe(200);
 const legacyAgain=await call('/api/garden/world?gardenArt=garden-v51',undefined,'GET',false,headers);
 const currentAgain=await call(worldPath,undefined,'GET',false,headers);
 expect(legacyAgain.data.world).toMatchObject({owned:{[instanceId]:{itemId:'garden-gazebo'}},placements:{[instanceId]:{x:12,y:12,rotation:90}}});
 expect(currentAgain.data.world).toMatchObject({owned:{[instanceId]:{itemId:'garden-aurora-conservatory'}}});
 const path=await buy({key:crypto.randomUUID(),itemId:'garden-path-stone',expectedUnitPrice:50,quantity:2});
 expect(path.data).toMatchObject({cost:100,player:{coins:29900}});
 const apiaries=await buy({key:crypto.randomUUID(),itemId:'garden-apiary',expectedUnitPrice:5500,quantity:2});
 expect(apiaries.data).toMatchObject({cost:11000,quantity:2,player:{coins:18900}});
 const [first,second]=apiaries.data.instanceIds as string[];
 expect(first).not.toBe(second);
 const revision=(apiaries.data.world as {revision:number}).revision;
 const apiaryPlaced=await call('/api/garden/world/commands?gardenArt=garden-v64',{key:crypto.randomUUID(),type:'place',instanceId:first,x:17,y:12,rotation:90,expectedRevision:revision},'POST',false,headers);
 expect(apiaryPlaced.response.status).toBe(200);
 expect(apiaryPlaced.data.world).toMatchObject({owned:{[first!]:{itemId:'garden-apiary'}},placements:{[first!]:{x:17,y:12,rotation:90}}});
 const olderWorld=await call(oldPath,undefined,'GET',false,headers);
 expect(olderWorld.data.world).toMatchObject({owned:{[first!]:{itemId:'garden-gate'}},placements:{[first!]:{x:17,y:12,rotation:90}}});
 const canonical=JSON.parse(String(db.prepare('SELECT data FROM garden_worlds WHERE user_id=?').get(player.id)!.data));
 expect(canonical.owned[first!].itemId).toBe('garden-apiary');
});

describe('age admission and guardian consent',()=>{
 const adultBirth='1990-01-01',teenBirth='2010-02-10',childBirth='2020-06-01';
 beforeEach(()=>{vi.spyOn(Date,'now').mockReturnValue(Date.parse('2026-11-13T04:00:00Z'));});
 const game=(path:string,body?:unknown,method=body===undefined?'GET':'POST',accessToken?:unknown,waitUntil?:(work:Promise<unknown>)=>void)=>call('/api'+path,body,method,false,{
   Origin:'https://game.test',...(accessToken?{Authorization:'Bearer '+String(accessToken)}:{})
 },waitUntil);
 const start=async(birthDate:string,accessToken?:unknown)=>(await game('/age/admission',{birthDate},'POST',accessToken)).data;
 const submitGuardian=(token:unknown,accessToken?:unknown,waitUntil?:(work:Promise<unknown>)=>void)=>game('/age/guardian',{
   token,guardianName:'Test Guardian',guardianEmail:'guardian@example.test',contactPermission:true
 },'POST',accessToken,waitUntil);
 const correct=(token:unknown,birthDate:string,accessToken?:unknown)=>
  game('/age/admission',{birthDate,correctionToken:token},'POST',accessToken);
 const review=(id:unknown,action:string,key=crypto.randomUUID())=>call('/api/admin/guardian-consents/'+String(id),{action,key});
 const rows=()=>db.prepare('SELECT * FROM age_admissions ORDER BY created_at').all();
 const playerCount=()=>db.prepare('SELECT count(*) n FROM players').get()?.n;

 it('lets only the owner correct an existing birth date without storing it',async()=>{
  await setup();
  const admission=await start(adultBirth),created=await game('/auth/guest',{ageToken:admission.token});
  const player=created.data.player as Player,access=created.data.accessToken;
  const detail='/api/admin/users/'+player.id,path=detail+'/birth-date';
  const correction={key:crypto.randomUUID(),reason:'계정 정보 정정 요청 확인',birthDate:childBirth,band:'child',expected:{band:'adult',confirmed:true}};
  expect((await call(detail)).data.ageAccess).toEqual({band:'adult',confirmed:true});
  db.prepare("UPDATE admin_accounts SET role='operator'").run();
  expect((await call(detail)).data).not.toHaveProperty('ageAccess');
  expect((await call(path,correction,'PUT')).error?.code).toBe('ADMIN_FORBIDDEN');
  db.prepare("UPDATE admin_accounts SET role='owner'").run();
  expect((await call(path,{...correction,birthDate:'2020-02-30'},'PUT')).error?.code).toBe('INVALID_BIRTH_DATE');
  expect((await call(path,{...correction,band:'teen'},'PUT')).error?.code).toBe('AGE_BAND_CHANGED');
  expect((await call(path,{...correction,reason:childBirth},'PUT')).error?.code).toBe('INVALID_REASON');
  for(let i=0;i<2;i++)expect((await call(path,correction,'PUT')).data.ageAccess).toEqual({band:'child',confirmed:false});
  expect((await call(path,{...correction,key:crypto.randomUUID()},'PUT')).error?.code).toBe('AGE_ACCESS_CHANGED');
  expect((await call(detail)).data.ageAccess).toEqual({band:'child',confirmed:false});
  expect((await game('/age/account',undefined,'GET',access)).data).toEqual({band:'child',confirmed:false});
  expect((await game('/me',undefined,'GET',access)).error?.code).toBe('AGE_ACCESS_REQUIRED');
  expect((await game('/age/admission',{birthDate:adultBirth},'POST',access)).error?.code).toBe('GUARDIAN_REQUIRED');
  const childRequest=await start(childBirth,access);
  expect((await correct(childRequest.token,adultBirth,access)).error?.code).toBe('GUARDIAN_REQUIRED');
  expect((await game('/age/status',{token:admission.token})).data.state).toBe('expired');
  expect(db.prepare("SELECT count(*) n FROM admin_audit WHERE action='user.birth-date'").get()?.n).toBe(1);
  for(const table of ['admin_audit','operations','account_age_access']){
   expect(JSON.stringify(db.prepare('SELECT * FROM '+table).all())).not.toContain(childBirth);
  }
 });

 it('keeps existing guardian approval when a correction stays in the child band',async()=>{
  await setup();
  const child=await start(childBirth);
  await submitGuardian(child.token);
  const id=rows()[0]!.id;
  await review(id,'sent');await review(id,'approve');
  const created=await game('/auth/guest',{ageToken:child.token}),player=created.data.player as Player;
  const path='/api/admin/users/'+player.id+'/birth-date';
  const current=()=>db.prepare('SELECT band,verified_at,consent_version,guardian_request_id FROM account_age_access WHERE user_id=?').get(player.id);
  const before=current();
  const correction={key:crypto.randomUUID(),reason:'정보 정정 요청 확인',birthDate:'2020-07-01',band:'child',expected:{band:'child',confirmed:true}};
  expect((await call(path,correction,'PUT')).data.ageAccess).toEqual({band:'child',confirmed:true});
  expect(current()).toEqual(before);
  expect((await game('/ads/reward-intents',{placement:'heart'},'POST',created.data.accessToken)).error?.code).toBe('AGE_ADS_UNAVAILABLE');
  const teen=await call(path,{...correction,key:crypto.randomUUID(),birthDate:teenBirth,band:'teen'},'PUT');
  expect(teen.data.ageAccess).toEqual({band:'teen',confirmed:true});
  expect(current()).toMatchObject({band:'teen',guardian_request_id:null,consent_version:null});
  expect((await game('/me',undefined,'GET',created.data.accessToken)).data.player).toMatchObject({id:player.id});
  expect((await game('/ads/reward-intents',{placement:'heart'},'POST',created.data.accessToken)).error?.code).toBe('AGE_ADS_UNAVAILABLE');
 });

 it('automatically sends one consent email for concurrent and repeated requests, before a guardian reply is recorded',async()=>{
  const send=vi.fn(async (_message:EmailMessage|EmailMessageBuilder)=>({messageId:'guardian-message-id'}));
  env.GUARDIAN_EMAIL={send};
  await setup();
  const child=await start(childBirth),queued:Promise<unknown>[]=[];
  const submit=()=>submitGuardian(child.token,undefined,work=>{queued.push(work);});
  const responses=await Promise.all([submit(),submit()]);
  expect(responses.map(r=>r.data)).toEqual(Array(2).fill({band:'child',state:'waiting'}));
  await Promise.all(queued);
  const id=String(rows()[0]!.id);
  expect(send).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({
   from:{email:'consent@hiddenstage.app',name:'구름정원'},
   to:'guardian@example.test',replyTo:'hiddenstagedev@gmail.com',
   subject:expect.stringContaining(id),text:expect.stringContaining('동의서 버전: guardian-email-v1'),
  }));
  expect(JSON.stringify(send.mock.calls)).not.toContain(String(child.token));
  expect((await call('/api/admin/guardian-consents')).data.items).toMatchObject([{id,mail_status:'sent',sent_at:Date.now()}]);
  expect((await game('/age/status',{token:child.token})).data).toEqual({band:'child',state:'waiting'});
  expect((await submit()).response.status).toBe(200);
  await sendPendingGuardianEmails(env);
  expect(send).toHaveBeenCalledTimes(1);
  expect((await review(id,'approve')).response.status).toBe(200);
  expect((await game('/age/status',{token:child.token})).data).toEqual({band:'child',state:'approved'});
 });

 it('retries a provider rate limit and leaves an unacknowledged send for review without resending',async()=>{
  const send=vi.fn(async (_message:EmailMessage|EmailMessageBuilder)=>({messageId:'guardian-message-id'}));
  send.mockRejectedValueOnce(Object.assign(new Error('Provider limit'),{code:'E_RATE_LIMIT_EXCEEDED'}));
  env.GUARDIAN_EMAIL={send};
  await setup();
  const now=Date.now(),child=await start(childBirth),queued:Promise<unknown>[]=[];
  const submit=(token:unknown)=>submitGuardian(token,undefined,work=>{queued.push(work);});
  expect((await submit(child.token)).response.status).toBe(200);
  await Promise.all(queued);
  const id=String(rows()[0]!.id);
  expect(rows()[0]).toMatchObject({mail_status:'queued',mail_attempts:1,sent_at:null});
  expect((await review(id,'sent')).error?.code).toBe('GUARDIAN_EMAIL_IN_PROGRESS');
  await sendPendingGuardianEmails(env);
  expect(send).toHaveBeenCalledTimes(1);
  vi.mocked(Date.now).mockReturnValue(now+5*60_000);
  await sendPendingGuardianEmails(env);
  expect(rows()[0]).toMatchObject({mail_status:'sent',mail_attempts:2,sent_at:Date.now()});
  send.mockRejectedValueOnce(new Error('Connection lost'));
  const second=await start(childBirth);
  expect((await submit(second.token)).response.status).toBe(200);
  await Promise.all(queued);
  expect(rows()[1]).toMatchObject({mail_status:'unknown',mail_attempts:1,sent_at:null});
  vi.mocked(Date.now).mockReturnValue(now+20*60_000);
  await sendPendingGuardianEmails(env);
  expect(send).toHaveBeenCalledTimes(3);
  expect((await review(rows()[1]!.id,'approve')).error?.code).toBe('GUARDIAN_EMAIL_REQUIRED');
 });

 it('uses the calendar birthday in Korea and validates the entered date',()=>{
  expect(ageBandAt('2012-11-13',Date.parse('2026-11-12T14:59:59Z'))).toBe('child');
  expect(ageBandAt('2012-11-13',Date.parse('2026-11-12T15:00:00Z'))).toBe('teen');
  expect(ageBandAt('2007-11-13',Date.parse('2026-11-12T15:00:00Z'))).toBe('adult');
  expect(ageBandAt('2012-02-30',Date.parse('2026-11-13T00:00:00Z'))).toBeNull();
  expect(ageBandAt('2026-11-14',Date.parse('2026-11-13T00:00:00Z'))).toBeNull();
 });

 it('creates a child account once after a recorded guardian reply and blocks ads and social routes',async()=>{
  delete env.AGE_ACCESS_REQUIRED;
  await setup();
  expect((await game('/auth/guest',{})).error?.code).toBe('AGE_ACCESS_REQUIRED');
  const child=await start(childBirth);
  expect(child).toMatchObject({band:'child',state:'contact'});
  expect((await game('/auth/guest',{ageToken:child.token})).error?.code).toBe('GUARDIAN_REQUIRED');
  expect(playerCount()).toBe(0);
  expect((await submitGuardian(child.token)).data).toEqual({band:'child',state:'waiting'});
  expect((await submitGuardian(child.token)).data).toEqual({band:'child',state:'waiting'});
  const id=rows()[0]!.id;
  expect(JSON.stringify(rows())).not.toContain(childBirth);
  expect((await call('/api/admin/guardian-consents',undefined,'GET',false)).response.status).toBe(401);
  expect((await review(id,'approve')).error?.code).toBe('GUARDIAN_EMAIL_REQUIRED');
  db.prepare("UPDATE admin_accounts SET role='viewer'").run();
  expect((await call('/api/admin/guardian-consents')).response.status).toBe(403);
  db.prepare("UPDATE admin_accounts SET role='support'").run();
  expect((await call('/api/admin/guardian-consents')).data.items).toMatchObject([{guardian_email:'guardian@example.test'}]);
  const sentKey=crypto.randomUUID();
  expect((await review(id,'sent',sentKey)).response.status).toBe(200);
  expect((await review(id,'sent',sentKey)).response.status).toBe(200);
  expect((await review(id,'approve')).response.status).toBe(200);
  expect(rows()[0]).toMatchObject({guardian_email:null,guardian_name:null,consent_version:'guardian-email-v1'});
  const [created,retry]=await Promise.all([game('/auth/guest',{ageToken:child.token}),game('/auth/guest',{ageToken:child.token})]);
  const player=created.data.player as Player,access=created.data.accessToken;
  expect(created.response.status).toBe(200);
  expect(retry.data.accessToken).toBe(access);
  expect((retry.data.player as Player).id).toBe(player.id);
  expect(playerCount()).toBe(1);
  expect((await game('/age/account',undefined,'GET',access)).data).toEqual({band:'child',confirmed:true});
  expect((await game('/me',undefined,'GET',access)).response.status).toBe(200);
  expect((await game('/garden/world',undefined,'GET',access)).response.status).toBe(200);
  expect((await game('/ads/reward-intents',{placement:'heart'},'POST',access)).error?.code).toBe('AGE_ADS_UNAVAILABLE');
  for(const path of ['/friends','/guild','/rankings','/offers','/support'])expect((await game(path,undefined,'GET',access)).error?.code).toBe('CHILD_FEATURE_RESTRICTED');
  expect((await game('/auth/challenge',{provider:'google'},'POST',access)).error?.code).toBe('CHILD_FEATURE_RESTRICTED');
  expect((await game('/purchases/prepare',{},'POST',access)).error?.code).toBe('CHILD_FEATURE_RESTRICTED');
  const adult=await start(adultBirth),other=await game('/auth/guest',{ageToken:adult.token});
  expect((await game('/players/'+player.id+'/profile',undefined,'GET',other.data.accessToken)).response.status).toBe(404);
  expect((await game('/garden/visits/'+player.id,undefined,'GET',other.data.accessToken)).response.status).toBe(404);
  expect((await call('/api/admin/guardian-consents/withdraw',{requestId:id,key:crypto.randomUUID()})).response.status).toBe(200);
  expect((await game('/me',undefined,'GET',access)).error?.code).toBe('AGE_ACCESS_REQUIRED');
  expect((await game('/age/admission',{birthDate:adultBirth},'POST',access)).error?.code).toBe('GUARDIAN_REQUIRED');
  const refreshed=await game('/auth/refresh',{refreshToken:created.data.refreshToken});
  expect(refreshed.data).not.toHaveProperty('player');
  expect((await game('/account',{confirm:'DELETE'},'DELETE',refreshed.data.accessToken)).response.status).toBe(200);
  expect(db.prepare('SELECT count(*) n FROM account_age_access WHERE user_id=?').get(player.id)?.n).toBe(0);
 });

 it('preserves existing progress and scopes approvals to the original account',async()=>{
  const first=await game('/auth/guest',{}),second=await game('/auth/guest',{});
  const player=first.data.player as Player;
  db.prepare("UPDATE players SET data=json_set(data,'$.level',27,'$.coins',3800) WHERE id=?").run(player.id);
  env.AGE_ACCESS_REQUIRED='true';
  expect((await game('/me',undefined,'GET',first.data.accessToken)).error?.code).toBe('AGE_ACCESS_REQUIRED');
  const age=await start(teenBirth,first.data.accessToken);
  expect(age.band).toBe('teen');
  expect((await game('/age/complete',{token:age.token},'POST',second.data.accessToken)).response.status).toBe(404);
  expect((await game('/auth/guest',{ageToken:age.token})).response.status).toBe(404);
  expect((await game('/age/complete',{token:age.token},'POST',first.data.accessToken)).data).toEqual({band:'teen'});
  expect((await game('/me',undefined,'GET',first.data.accessToken)).data.player).toMatchObject({id:player.id,level:27,coins:3800});
  expect((await game('/ads/reward-intents',{placement:'heart'},'POST',first.data.accessToken)).error?.code).toBe('AGE_ADS_UNAVAILABLE');
  const child=await start(childBirth,second.data.accessToken);
  expect(child.band).toBe('child');
  expect((await game('/age/admission',{birthDate:adultBirth},'POST',second.data.accessToken)).error?.code).toBe('GUARDIAN_REQUIRED');
  expect(playerCount()).toBe(2);
 });

 it('corrects an unanswered birthday on the saved account and closes the obsolete consent request',async()=>{
  await setup();
  const saved=await game('/auth/guest',{}),other=await game('/auth/guest',{});
  const player=saved.data.player as Player,access=saved.data.accessToken;
  db.prepare("UPDATE players SET data=json_set(data,'$.level',27,'$.coins',3800) WHERE id=?").run(player.id);
  env.AGE_ACCESS_REQUIRED='true';
  const child=await start(childBirth,access);
  await submitGuardian(child.token,access);
  const id=rows()[0]!.id;
  expect((await correct(child.token,teenBirth,other.data.accessToken)).response.status).toBe(404);
  expect((await correct(child.token,'2020-02-30',access)).error?.code).toBe('INVALID_BIRTH_DATE');
  expect((await correct(child.token,'2020-07-01',access)).data).toEqual({...child,state:'waiting'});
  expect((await game('/me',undefined,'GET',access)).error?.code).toBe('AGE_ACCESS_REQUIRED');

  const results=await Promise.all([correct(child.token,teenBirth,access),correct(child.token,teenBirth,access)]);
  expect(results.map(result=>result.data)).toEqual(Array(2).fill({token:child.token,band:'teen',state:'approved'}));
  expect((await game('/age/complete',{token:child.token},'POST',access)).data).toEqual({band:'teen'});
  expect((await game('/age/account',undefined,'GET',access)).data).toEqual({band:'teen',confirmed:true});
  expect((await game('/me',undefined,'GET',access)).data.player).toMatchObject({id:player.id,level:27,coins:3800});
  expect((await game('/ads/reward-intents',{placement:'heart'},'POST',access)).error?.code).toBe('AGE_ADS_UNAVAILABLE');
  expect((await review(id,'approve')).error?.code).toBe('GUARDIAN_REQUEST_CLOSED');
  expect(rows()).toMatchObject([{id,guardian_name:null,guardian_email:null,band:'teen'}]);
  expect(JSON.stringify(rows())).not.toContain(teenBirth);
  expect(playerCount()).toBe(2);
 });

 it('re-enters a guest birthday before submitting guardian details',async()=>{
  env.AGE_ACCESS_REQUIRED='true';
  const child=await start(childBirth);
  expect((await correct(child.token,adultBirth)).data).toEqual({token:child.token,band:'adult',state:'approved'});
  expect((await submitGuardian(child.token)).error?.code).toBe('GUARDIAN_REQUEST_CLOSED');
  const created=await game('/auth/guest',{ageToken:child.token});
  expect(created.response.status).toBe(200);
  expect((await game('/age/account',undefined,'GET',created.data.accessToken)).data).toEqual({band:'adult',confirmed:true});
  expect(playerCount()).toBe(1);
 });

 it('serializes birthday correction and a guardian decision on the same pending account',async()=>{
  await setup();
  const saved=await game('/auth/guest',{}),access=saved.data.accessToken;
  env.AGE_ACCESS_REQUIRED='true';
  const child=await start(childBirth,access);
  await submitGuardian(child.token,access);
  const id=rows()[0]!.id;
  await review(id,'sent');
  const [corrected,declined]=await Promise.all([correct(child.token,adultBirth,access),review(id,'decline')]);
  expect(Number(corrected.response.ok)+Number(declined.response.ok)).toBe(1);
  if(corrected.response.ok){
   expect(rows()[0]).toMatchObject({state:'approved',band:'adult',decided_at:null});
   expect((await game('/age/account',undefined,'GET',access)).data).toEqual({band:'adult',confirmed:true});
  }else{
   expect(rows()[0]).toMatchObject({state:'declined',band:'child'});
   expect((await game('/age/account',undefined,'GET',access)).data).toEqual({band:'child',confirmed:false});
   const replacement=await game('/age/restart',{token:child.token},'POST',access);
   expect((await correct(replacement.data.token,adultBirth,access)).error?.code).toBe('GUARDIAN_REQUIRED');
  }
 });

 it('allows a declined or expired request to restart without changing its child classification',async()=>{
  env.AGE_ACCESS_REQUIRED='true';
  await setup();
  const child=await start(childBirth);
  await submitGuardian(child.token);
  const id=rows()[0]!.id;
  await review(id,'sent');await review(id,'decline');
  const replacement=await game('/age/restart',{token:child.token});
  expect(replacement.data).toMatchObject({band:'child',state:'contact'});
  expect((await game('/auth/guest',{ageToken:child.token})).error?.code).toBe('GUARDIAN_REQUIRED');
  db.prepare("UPDATE age_admissions SET expires_at=0 WHERE state='contact'").run();
  expect((await game('/age/status',{token:replacement.data.token})).data.state).toBe('expired');
  expect((await game('/age/restart',{token:replacement.data.token})).data).toMatchObject({band:'child',state:'contact'});
  expect(playerCount()).toBe(0);
 });
});

describe('monthly offer chain rewards',()=>{
 it('requires the earlier purchase, grants each gift once, and starts a new chain each month',async()=>{
  const now=Date.UTC(2026,10,30,23,58);
  vi.spyOn(Date,'now').mockReturnValue(now);
  const guest=await call('/api/auth/guest',{},'POST',false),player=guest.data.player as Player;
  db.prepare("UPDATE players SET data=json_set(data,'$.level',5) WHERE id=?").run(player.id);
  const headers={Authorization:'Bearer '+String(guest.data.accessToken),Origin:'https://game.test'};
  const available=async()=> (await call('/api/offers',undefined,'GET',false,headers)).data as unknown as OffersResponse;
  const claim=(rewardId:string,periodId:string)=>call('/api/offers/chain-rewards/claim',{rewardId,periodId},'POST',false,headers);
  const first=await available(),periodId=first.chainRewards![0]!.periodId;
  const purchased=(step:number,status:'pending'|'finished'|'refunded')=>{
   const product='garden.offer.chain.'+step,intent='chain-test-'+step;
   db.prepare(`INSERT INTO purchase_intents(id,user_id,product_id,season_id,status,created_at,expires_at)
    VALUES(?,?,?,?,'granted',?,?)`).run(intent,player.id,product,periodId,now,now+900_000);
   db.prepare(`INSERT INTO purchases(provider,transaction_id,user_id,product_id,environment,status,verified_json,created_at,intent_id)
    VALUES('google',?,?,?,'Sandbox',?,'{}',?,?)`).run(intent,player.id,product,status,now,intent);
  };
  expect(first.chainRewards!.map(step=>step.status)).toEqual(['locked','locked','locked']);
  purchased(1,'pending');
  expect((await claim('after-1',periodId)).error?.code).toBe('OFFER_UNAVAILABLE');
  db.prepare("UPDATE purchases SET status='finished' WHERE transaction_id='chain-test-1'").run();
  expect((await available()).chainRewards!.map(step=>step.status)).toEqual(['available','locked','locked']);

  const claims=await Promise.all([claim('after-1',periodId),claim('after-1',periodId)]);
  expect(claims.map(result=>result.response.status)).toEqual([200,200]);
  expect(claims[0]!.data).toEqual(claims[1]!.data);
  expect((await available()).chainRewards!.map(step=>step.status)).toEqual(['claimed','locked','locked']);
  expect((await call('/api/me',undefined,'GET',false,headers)).data.player).toMatchObject({coins:player.coins+100});

  purchased(2,'refunded');
  expect((await claim('after-2',periodId)).error?.code).toBe('OFFER_UNAVAILABLE');
  db.prepare("UPDATE purchases SET status='finished' WHERE transaction_id='chain-test-2'").run();
  expect((await claim('after-2',periodId)).response.status).toBe(200);
  const after=(await call('/api/me',undefined,'GET',false,headers)).data.player as Player;
  expect(after.inventory.bomb).toEqual({normal:player.inventory.bomb.normal,bound:player.inventory.bomb.bound+1});
  expect((await claim('after-3',periodId)).error?.code).toBe('OFFER_UNAVAILABLE');

  vi.mocked(Date.now).mockReturnValue(Date.UTC(2026,11,1));
  expect((await claim('after-3',periodId)).error?.code).toBe('OFFER_PERIOD_MISMATCH');
  const renewed=await available();
  expect(renewed.chainRewards!.map(step=>step.status)).toEqual(['locked','locked','locked']);
  expect(renewed.chainRewards![0]!.periodId).not.toBe(periodId);
  expect(renewed.offers.find(offer=>offer.product.id==='garden.offer.chain.1')?.status).toBe('available');
 });
});

describe('account erasure and statutory retention',()=>{
 const now=Date.parse('2026-11-13T04:00:00Z');
 beforeEach(()=>{vi.spyOn(Date,'now').mockReturnValue(now);});
 const authenticate=(token:unknown)=>({Authorization:'Bearer '+String(token),Origin:'https://game.test'});
 async function guestPlayer(){
  const guest=await call('/api/auth/guest',{},'POST',false);
  return {player:guest.data.player as Player,headers:authenticate(guest.data.accessToken)};
 }
 function recordPurchase(userId:string,token:string,environment:string,status:string,at:number){
  db.prepare('INSERT INTO purchases(provider,transaction_id,user_id,product_id,environment,status,verified_json,created_at) VALUES(?,?,?,?,?,?,?,?)')
    .run('google',token,userId,'garden.coins.1000',environment,status,JSON.stringify({userId,purchasedAt:at,orderId:'GPA.1234-5678',acknowledgement:{token}}),at);
 }
 async function ticket(userId:string,headers:Record<string,string>,category:string,body:string){
  const result=await call('/api/support',{key:crypto.randomUUID(),title:'Customer request',body,category},'POST',false,headers);
  expect(result.response.status).toBe(200);
  return String(result.data.id);
 }
 it('erases the player graph, retains only completed production purchases and confirmed dispute summaries, and handles a later refund',async()=>{
  await setup();
  const {player,headers}=await guestPlayer(),other=(await guestPlayer()).player;
  const id=player.id;
  const normalTicket=await ticket(id,headers,'purchase','payment how-to question with private email');
  const disputeTicket=await ticket(id,headers,'other','real dispute with phone and full chat');
  expect((await call('/api/admin/tickets/'+disputeTicket+'/dispute',{key:crypto.randomUUID(),reason:'Confirmed consumer dispute',summary:'Supply delay. Refund requested.'},'PUT')).response.status).toBe(200);
  await call('/api/admin/tickets/'+disputeTicket+'/reply',{key:crypto.randomUUID(),reason:'Response',body:'private notes with contact',internal:true,status:'resolved'});
  const old=Date.parse('2020-10-30T00:00:00Z');
  recordPurchase(id,'production-token-secret','Production','finished',now-86_400_000);
  recordPurchase(id,'already-expired-token','Production','finished',old);
  recordPurchase(id,'sandbox-token','Sandbox','finished',now);
  recordPurchase(id,'pending-token','Production','pending',now);
  recordPurchase(other.id,'unrelated-token','Production','finished',now);
  const guildId=crypto.randomUUID(),requestId=crypto.randomUUID(),giftId=crypto.randomUUID(),messageId=crypto.randomUUID(),reportId=crypto.randomUUID();
  db.prepare('INSERT INTO guilds VALUES(?,?,?,?,?,?,?,?)').run(guildId,'QA guild','desc','','open',5,0,now);
  db.prepare("INSERT INTO guild_members VALUES(?,?,'leader',0,?)").run(id,guildId,now);
  db.prepare("INSERT INTO guild_members VALUES(?,?,'member',0,?)").run(other.id,guildId,now+1);
  db.prepare("INSERT INTO chat_messages VALUES(?,?,?,?,?,?)").run(messageId,guildId,id,'private display name','private message',now);
  db.prepare("INSERT INTO reports VALUES(?,?,?,?,?)").run(reportId,other.id,messageId,'private report',now);
  db.prepare("INSERT INTO ops_reports VALUES(?,'reviewing','internal note',?,'tester')").run(reportId,now);
  db.prepare("INSERT INTO operations VALUES(?,?,?,?,?)").run(other.id,'report-cache','guild:report:'+messageId,'{"reported":true}',now);
  db.prepare("INSERT INTO outbox(id,topic,payload,created_at) VALUES(?,?,?,?)").run('guild-progress',guildId,JSON.stringify({type:'progress',userId:id}),now);
  db.prepare("INSERT INTO support_requests VALUES(?,?,?,'heart',1,5,?,?,0)").run(requestId,guildId,other.id,now,now+60_000);
  db.prepare("INSERT INTO gifts VALUES(?,?,?,?,'heart',1,0,?,?)").run(giftId,other.id,id,'private display name',requestId+':'+id,now);
  db.prepare("INSERT INTO donations VALUES(?,?,?,'heart',?,?)").run(requestId,id,other.id,Math.floor(now/86_400_000),giftId);
  db.prepare("INSERT INTO operations VALUES(?,?,?,?,?)").run(other.id,'claim-cache','gift:claim:'+giftId,JSON.stringify({gifts:[{id:giftId,senderName:'private display name',quantity:1}]}),now);
  db.prepare("INSERT INTO auth_links VALUES('apple',?,?,?)").run('private-apple-subject',id,now);
  db.prepare("INSERT INTO apple_authorizations VALUES(?,?,?,?)").run('private-apple-subject',id,'encrypted-revoke-only',now);
  db.prepare("INSERT INTO external_events VALUES('apple-identity','identity-old',?,0,?)").run(JSON.stringify({subject:'private-apple-subject'}),now);
  const result=await call('/api/account',{confirmation:'DELETE'},'DELETE',false,headers);
  expect(result.data).toEqual({deleted:true,identityRevocation:'pending'});
  expect((await call('/api/me',undefined,'GET',false,headers)).response.status).toBe(401);
  expect(db.prepare('SELECT id FROM players WHERE id=?').get(id)).toBeUndefined();
  expect(db.prepare('SELECT id FROM players WHERE id=?').get(other.id)).toBeDefined();
  for(const table of ['sessions','ledger','purchases','operations','cs_tickets','auth_links','player_activity']){
   expect(db.prepare('SELECT 1 FROM '+table+' WHERE user_id=?').get(id)).toBeUndefined();
  }
  expect(db.prepare('SELECT count(*) n FROM cs_messages').get()?.n).toBe(0);
  expect(db.prepare('SELECT count(*) n FROM reports').get()?.n).toBe(0);
  expect(db.prepare("SELECT 1 FROM operations WHERE key='report-cache'").get()).toBeUndefined();
  expect(db.prepare("SELECT payload FROM outbox WHERE id='guild-progress'").get()?.payload).toBe('{}');
  expect(db.prepare('SELECT count(*) n FROM external_events').get()?.n).toBe(0);
  expect(db.prepare('SELECT role FROM guild_members WHERE user_id=?').get(other.id)?.role).toBe('leader');
  expect(db.prepare('SELECT sender_id,sender_name,quantity FROM gifts WHERE id=?').get(giftId)).toEqual({sender_id:null,sender_name:'정원사',quantity:1});
  expect(db.prepare("SELECT response FROM operations WHERE key='claim-cache'").get()?.response).not.toContain('private display name');
  const retained=db.prepare('SELECT * FROM retained_purchase_records').all();
  expect(retained).toHaveLength(1);
  expect(retained[0]).toMatchObject({order_reference:'GPA.1234-5678',product_id:'garden.coins.1000',expires_at:retentionDeadline(now-86_400_000,5)});
  expect(JSON.stringify(retained)).not.toContain('production-token-secret');
  expect(JSON.stringify(retained)).not.toContain(id);
  expect(db.prepare('SELECT id,summary,expires_at FROM retained_consumer_disputes').all()).toEqual([
   {id:disputeTicket,summary:'Supply delay. Refund requested.',expires_at:retentionDeadline(now,3)}]);
  expect((await call('/api/admin/tickets/'+normalTicket)).response.status).toBe(404);
  expect((await call('/api/admin/tickets/'+disputeTicket)).response.status).toBe(404);
  const archive='/api/admin/privacy/retained-records';
  expect((await call(archive,{reference:'GPA.1234-5678'})).data.purchases).toHaveLength(1);
  expect((await call(archive,{reference:'GPA.1234'})).data.purchases).toEqual([]);
  expect((await call(archive,{reference:disputeTicket})).data.disputes).toHaveLength(1);
  expect(db.prepare("SELECT expires_at FROM privacy_access_records WHERE action='POST /admin/privacy/retained-records' LIMIT 1").get()?.expires_at)
    .toBe(retentionDeadline(now,1));
  db.prepare("UPDATE admin_accounts SET role='support'").run();
  expect((await call(archive,{reference:disputeTicket})).response.status).toBe(403);
  db.prepare("UPDATE admin_accounts SET role='owner'").run();
  expect(db.prepare("SELECT payload FROM outbox WHERE topic='$apple-revoke'").get()?.payload).toBe('{"sealedToken":"encrypted-revoke-only"}');
  env.GOOGLE_IAP_ENVIRONMENT='Production';
  const refundAt=now+86400000;
  db.prepare("INSERT INTO external_events VALUES('google','refund-1',?,0,?)")
    .run(JSON.stringify({voidedPurchaseNotification:{purchaseToken:'production-token-secret'}}),refundAt);
  await processPurchaseEvent(env,'google','refund-1');
  expect(db.prepare('SELECT refunded_at,expires_at FROM retained_purchase_records').get())
    .toEqual({refunded_at:refundAt,expires_at:retentionDeadline(refundAt,5)});
  expect(db.prepare("SELECT payload FROM external_events WHERE event_id='refund-1'").get()?.payload).toBe('{}');
  await purgeExpiredRecords(env,retentionDeadline(now,3));
  expect(db.prepare('SELECT count(*) n FROM retained_consumer_disputes').get()?.n).toBe(0);
  expect(db.prepare('SELECT count(*) n FROM retained_purchase_records').get()?.n).toBe(1);
  await purgeExpiredRecords(env,retentionDeadline(refundAt,5));
  expect(db.prepare('SELECT count(*) n FROM retained_purchase_records').get()?.n).toBe(0);
  expect(db.prepare('PRAGMA foreign_key_check').all()).toEqual([]);
 });

 it('records a verified refund queued before deletion without keeping its raw Apple payload',async()=>{
  const {player,headers}=await guestPlayer();
  const paidAt=now-2*86_400_000,refundAt=now-86_400_000;
  db.prepare('INSERT INTO purchases(provider,transaction_id,user_id,product_id,environment,status,verified_json,created_at) VALUES(?,?,?,?,?,?,?,?)')
    .run('apple','10000012345',player.id,'garden.coins.1000','Production','finished',JSON.stringify({state:'purchased',purchasedAt:paidAt}),paidAt);
  db.prepare("INSERT INTO external_events VALUES('apple','pending-refund',?,0,?)")
    .run(JSON.stringify({transactionId:'10000012345',environment:'Production',revoked:true,refundedAt:refundAt,signedTransactionInfo:'private-provider-payload'}),now);
  expect((await call('/api/account',{confirmation:'DELETE'},'DELETE',false,headers)).response.status).toBe(200);
  expect(db.prepare("SELECT 1 FROM external_events WHERE event_id='pending-refund'").get()).toBeUndefined();
  expect(db.prepare('SELECT purchased_at,supplied_at,refunded_at,expires_at FROM retained_purchase_records').get()).toEqual({
   purchased_at:paidAt,supplied_at:paidAt,refunded_at:refundAt,expires_at:retentionDeadline(refundAt,5)
  });
 });

 it('removes legacy soft-deleted accounts and reapplies receipts after a restore',async()=>{
  await setup();
  const legacy=await guestPlayer(),other=await guestPlayer();
  db.prepare('UPDATE players SET deleted_at=? WHERE id=?').run(now-1,legacy.player.id);
  await erasePreviouslyDeletedAccounts(env);
  expect(db.prepare('SELECT 1 FROM players WHERE id=?').get(legacy.player.id)).toBeUndefined();
  const hash=await erasureAccountHash(other.player.id);
  expect((await call('/api/admin/privacy/erasure-receipts',{items:[{account_hash:hash,erased_at:now,expires_at:now+30*86400000}]})).response.status).toBe(409);
  const runtime=defaultRuntime();runtime.maintenance.enabled=true;
  expect((await call('/api/admin/runtime',{key:crypto.randomUUID(),reason:'restore test',revision:0,data:runtime},'PUT')).response.status).toBe(200);
  expect((await call('/api/admin/privacy/erasure-receipts',{items:[{account_hash:hash,erased_at:now,expires_at:now+30*86400000}]})).data.received).toBe(1);
  expect((await call('/api/admin/privacy/replay-erasures',{})).data.erased).toBe(1);
  expect(db.prepare('SELECT count(*) n FROM players').get()?.n).toBe(0);
 });

 it('completes erasure for older Apple-linked accounts without a revocation credential',async()=>{
  const {player,headers}=await guestPlayer();
  db.prepare("INSERT INTO auth_links VALUES('apple',?,?,?)").run('legacy-apple-subject',player.id,now);
  expect((await call('/api/account',{confirmation:'DELETE'},'DELETE',false,headers)).data).toEqual({deleted:true,identityRevocation:'manual'});
  expect(db.prepare('SELECT count(*) n FROM players').get()?.n).toBe(0);
 });

 it('uses calendar anniversaries across leap years',()=>{
  expect(new Date(retentionDeadline(Date.parse('2024-02-29T08:30:00Z'),3)).toISOString()).toBe('2027-02-28T08:30:00.000Z');
  expect(new Date(retentionDeadline(Date.parse('2024-02-28T16:30:00Z'),3)).toISOString()).toBe('2027-02-27T16:30:00.000Z');
 });
});

it('quotes botanical decor only to capable apps and purchases, retries and reloads canonical plants',async()=>{
 const guest=await call('/api/auth/guest',{},'POST',false),player=guest.data.player as Player;
 const headers={Origin:'https://game.test',Authorization:'Bearer '+String(guest.data.accessToken)};
 player.level=20;player.coins=10000;player.boundCoins=0;
 db.prepare('UPDATE players SET data=? WHERE id=?').run(JSON.stringify(player),player.id);
 const currentPath='/api/garden/world?shopVersion=2&gardenArt=garden-v78',oldPath='/api/garden/world?shopVersion=2&gardenArt=garden-v64';
 const offers=await call(currentPath,undefined,'GET',false,headers),oldOffers=await call(oldPath,undefined,'GET',false,headers);
 expect(Object.keys(offers.data.prices as object)).toHaveLength(39);
 expect((oldOffers.data.prices as Record<string,number>)['garden-cherry-tree']).toBeUndefined();
 expect(offers.data.prices).toMatchObject({'garden-cherry-tree':2400,'garden-pink-flower-bed':180,'garden-yellow-pergola':1800});
 const body={key:crypto.randomUUID(),itemId:'garden-cherry-tree',quantity:2,expectedUnitPrice:2400};
 const purchased=await call('/api/garden/shop/buy?gardenArt=garden-v78',body,'POST',false,headers);
 expect(purchased.response.status).toBe(200);expect(purchased.data).toMatchObject({cost:4800,quantity:2,player:{coins:5200}});
 expect((await call('/api/garden/shop/buy?gardenArt=garden-v78',body,'POST',false,headers)).data).toEqual(purchased.data);
 const receipt=purchased.data as {instanceId:string;instanceIds:string[];world:{revision:number}};
 expect(receipt.instanceIds).toHaveLength(2);
 const placed=await call('/api/garden/world/commands?gardenArt=garden-v78',{key:crypto.randomUUID(),type:'place',instanceId:receipt.instanceId,x:12,y:12,rotation:90,expectedRevision:receipt.world.revision},'POST',false,headers);
 expect(placed.response.status).toBe(200);
 const fresh=await call(currentPath,undefined,'GET',false,headers),legacy=await call(oldPath,undefined,'GET',false,headers);
 const world=(fresh.data as any).world,oldWorld=(legacy.data as any).world;
 expect(world.owned[receipt.instanceId].itemId).toBe('garden-cherry-tree');
 expect(world.placements[receipt.instanceId]).toMatchObject({x:12,y:12,rotation:90});
 expect(oldWorld.owned[receipt.instanceId].itemId).toBe('garden-tree');
 expect(oldWorld.placements).toEqual(world.placements);
 const wrong=await call('/api/garden/shop/buy?gardenArt=garden-v78',{key:crypto.randomUUID(),itemId:'garden-pink-flower-bed',expectedUnitPrice:1},'POST',false,headers);
 expect(wrong.error?.code).toBe('GARDEN_PRICE_CHANGED');
 expect((await call('/api/me',undefined,'GET',false,headers)).data.player).toMatchObject({coins:5200});
});
