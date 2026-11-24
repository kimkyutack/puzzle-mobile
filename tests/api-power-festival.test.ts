import {DatabaseSync,type SQLInputValue} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
import {afterEach,beforeEach,describe,it,expect,vi} from 'vitest';
import {newPlayer,readPlayer,type ApiEnv} from '../apps/api/src/db';
import {events,eventClaim} from '../apps/api/src/economy';
import {startPowerFestival,claimPowerFestival} from '../apps/api/src/power-festival';
import {closeRun,runActions} from '../apps/api/src/runs';
import {updateHiddenPowerMission} from '../apps/api/src/hidden-power-missions';
import {createGame,applyAction} from '@garden/core';
import {getLevel} from '@garden/content';
import type {Run} from '@garden/contracts';
import {POWER_FESTIVAL_STAGES,POWER_FESTIVAL_DURATION,addPowerUses,emptyPowerUses,powerUses} from '../packages/content/src/power-festival';
import {HIDDEN_MISSION_DURATION,hiddenMissionStage} from '../packages/content/src/hidden-power-missions';

/** Execute production SQL against SQLite, including atomic batches and constraint failures.
 * This verifies transaction logic; it does not emulate Cloudflare network latency.
 */
class Statement {
 constructor(readonly db:DatabaseSync,readonly query:string,readonly args:SQLInputValue[]=[]){ }
 bind(...args:SQLInputValue[]){return new Statement(this.db,this.query,args)}
 async first<T>(){return (this.db.prepare(this.query).get(...this.args)??null) as T|null}
 execute(){const results=this.db.prepare(this.query).all(...this.args);return {success:true,results,meta:{changes:0}}}
 async all(){return this.execute()}
 async run(){return this.execute()}
}
let db:DatabaseSync,env:ApiEnv;
const user='power-festival-qa',now=Date.parse('2026-11-05T08:00:00Z');
beforeEach(()=>{
 vi.spyOn(Date,'now').mockReturnValue(now);db=new DatabaseSync(':memory:');
 for(const file of readdirSync('apps/api/migrations').filter(f=>f.endsWith('.sql')).sort())db.exec(readFileSync('apps/api/migrations/'+file,'utf8'));
 const binding={prepare:(query:string)=>new Statement(db,query),batch:async(statements:Statement[])=>{db.exec('BEGIN');try{const result=statements.map(s=>s.execute());db.exec('COMMIT');return result}catch(error){db.exec('ROLLBACK');throw error}}};
 env={DB:binding} as unknown as ApiEnv;const player=newPlayer(user,now);player.level=5;
 db.prepare('INSERT INTO players(id,data,version,created_at) VALUES(?,?,?,?)').run(user,JSON.stringify(player),player.version,now);
});
afterEach(()=>{db.close();vi.restoreAllMocks()});
function store(player:Awaited<ReturnType<typeof readPlayer>>){db.prepare('UPDATE players SET data=?,version=? WHERE id=?').run(JSON.stringify(player),player.version,user)}
async function seedRun(id='festival-run',levelId=31){
 const level=getLevel(levelId),state=createGame(level);state.cells[0]!.tile={id:500,kind:'wind-row'};state.nextTileId=501;
 const run:Run={id,userId:user,level,state,sequence:0,status:'active',startedAt:now,expiresAt:now+86400000,preBoosters:[],heartSpent:false,heartCharge:'failure',continues:0};
 db.prepare('INSERT INTO runs VALUES(?,?,?,?,?,?,?)').run(run.id,user,JSON.stringify(run),'active',0,run.expiresAt,id+'-key');return run;
}
describe('power festival transactions with the real API functions',()=>{
 it('starts free for thirty minutes, persists across reads and does not reset an active timer',async()=>{
  const result=await startPowerFestival(env,user,{key:'festival-start-key'}),event=result.player.powerFestival!;
  expect(event.endsAt-event.startedAt).toBe(POWER_FESTIVAL_DURATION);expect(result.player.hearts).toBe(5);expect(result.player.coins).toBe(500);
  expect((await startPowerFestival(env,user,{key:'festival-start-key'})).player.powerFestival).toEqual(event);
  expect((await startPowerFestival(env,user,{key:'another-start-key'})).player.powerFestival).toEqual(event);expect((await readPlayer(env.DB,user)).powerFestival).toEqual(event);
 });
 it('records replayed uses once, rejects a forged count and grants an earned reward once even with concurrent keys',async()=>{
  const p=(await startPowerFestival(env,user,{key:'festival-start-key'})).player;p.powerFestival!.counts={...POWER_FESTIVAL_STAGES[0]!.targets,rocket:5};store(p);
  const run=await seedRun(),action={type:'tap',at:0} as const,body={idempotencyKey:'festival-action-key',sequence:0,actions:[action],counts:{rainbow:999,rocket:999}};
  const expected=powerUses(applyAction(run.state,action).events),response=await runActions(env,user,run.id,body);
  expect(response.run.powerUses).toEqual(expected);expect(response.player.powerFestival!.counts).toEqual(addPowerUses(p.powerFestival!.counts,expected));
  await runActions(env,user,run.id,body);expect((await readPlayer(env.DB,user)).powerFestival!.counts).toEqual(response.player.powerFestival!.counts);
  const claim={eventId:p.powerFestival!.id,stage:1},results=await Promise.all([claimPowerFestival(env,user,{...claim,key:'first-claim-key'}),claimPowerFestival(env,user,{...claim,key:'second-claim-key'})]);
  expect(results.filter(r=>r.granted)).toHaveLength(1);const saved=await readPlayer(env.DB,user);expect(saved.coins).toBe(600);expect(saved.inventory.hammer.bound).toBe(0);expect(saved.powerFestival!.claimedStages).toBe(1);
  expect(db.prepare("SELECT count(*) n FROM ledger WHERE user_id=? AND reason LIKE 'power-festival:claim:%'").get(user)?.n).toBe(1);
 });
 it('rejects early and out-of-order claims without changing any balance',async()=>{
  const p=(await startPowerFestival(env,user,{key:'festival-start-key'})).player;
  await expect(claimPowerFestival(env,user,{key:'early-claim-key',eventId:p.powerFestival!.id,stage:1,counts:POWER_FESTIVAL_STAGES[0]!.targets})).rejects.toMatchObject({code:'FESTIVAL_NOT_READY'});
  await expect(claimPowerFestival(env,user,{key:'late-stage-key',eventId:p.powerFestival!.id,stage:3})).rejects.toMatchObject({code:'FESTIVAL_STAGE_ORDER'});expect((await readPlayer(env.DB,user)).coins).toBe(500);
 });
 it('freezes counts at expiry but keeps earned prizes claimable and prevents discarding them on the next day',async()=>{
  const p=(await startPowerFestival(env,user,{key:'festival-start-key'})).player;p.powerFestival!.counts={...POWER_FESTIVAL_STAGES[0]!.targets};store(p);
  vi.mocked(Date.now).mockReturnValue(now+POWER_FESTIVAL_DURATION);
  const run=await seedRun();const result=await runActions(env,user,run.id,{idempotencyKey:'expired-action-key',sequence:0,actions:[{type:'tap',at:0}]});expect(result.player.powerFestival!.counts).toEqual(p.powerFestival!.counts);
  vi.mocked(Date.now).mockReturnValue(now+86400000);await expect(startPowerFestival(env,user,{key:'next-day-start-key'})).rejects.toMatchObject({code:'FESTIVAL_UNCLAIMED'});
  await claimPowerFestival(env,user,{key:'expired-prize-key',eventId:p.powerFestival!.id,stage:1});const next=await startPowerFestival(env,user,{key:'next-day-start-key'});expect(next.player.powerFestival!.id).not.toBe(p.powerFestival!.id);
 });
 it('awards the selected coin, hammer and rainbow stage rewards in order, and limits starts to one per day',async()=>{
  const p=(await startPowerFestival(env,user,{key:'festival-start-key'})).player;p.powerFestival!.counts=POWER_FESTIVAL_STAGES.reduce((sum,stage)=>addPowerUses(sum,stage.targets),emptyPowerUses());store(p);
  for(let stage=1;stage<=5;stage++)await claimPowerFestival(env,user,{key:'stage-reward-'+stage,eventId:p.powerFestival!.id,stage});
  const final=await readPlayer(env.DB,user);expect(final.inventory.hammer.bound).toBe(1);expect(final.inventory.rainbow.bound).toBe(2);expect(final.inventory['world-bomb'].bound).toBe(0);expect(final.coins).toBe(1500);expect(final.powerFestival!.claimedStages).toBe(5);
  await expect(startPowerFestival(env,user,{key:'same-day-start-key'})).rejects.toMatchObject({code:'FESTIVAL_ALREADY_PLAYED'});
 });
});
describe('hidden power missions',()=>{
 it('discovers a milestone on clear and keeps the original deadline on retry',async()=>{
  const request={action:'start',milestone:67};
  await expect(updateHiddenPowerMission(env,user,{...request,key:'undiscovered-start'})).rejects.toMatchObject({code:'HIDDEN_MISSION_CHANGED'});
  const player=await readPlayer(env.DB,user);player.level=67;store(player);
  const run=await seedRun('hidden-clear',67);run.state.status='won';
  db.prepare('UPDATE runs SET data=? WHERE id=?').run(JSON.stringify(run),run.id);
  const clear=await closeRun(env,user,run.id,{key:'hidden-level-clear'});
  expect(clear.player.hiddenPowerMission).toEqual({milestone:67,kind:'rocket',uses:0,claimedStages:0});
  const started=await updateHiddenPowerMission(env,user,{...request,key:'hidden-start-key'});
  expect(started.player.hiddenPowerMission?.endsAt).toBe(now+HIDDEN_MISSION_DURATION);
  vi.mocked(Date.now).mockReturnValue(now+5000);
  const retry=await updateHiddenPowerMission(env,user,{...request,key:'hidden-retry-key'});
  expect(retry.player.hiddenPowerMission).toEqual(started.player.hiddenPowerMission);
 });
 it('counts confirmed uses once, freezes at expiry and claims earned rewards once',async()=>{
  const player=await readPlayer(env.DB,user);
  player.hiddenPowerMission={milestone:67,kind:'rocket',endsAt:now+HIDDEN_MISSION_DURATION,uses:5,claimedStages:0};
  store(player);
  const run=await seedRun(),action={type:'tap',at:0} as const;
  const body={idempotencyKey:'hidden-action-key',sequence:0,actions:[action]};
  const expected=powerUses(applyAction(run.state,action).events).rocket;
  expect(expected).toBeGreaterThan(0);
  const result=await runActions(env,user,run.id,body);
  await runActions(env,user,run.id,body);
  expect((await readPlayer(env.DB,user)).hiddenPowerMission?.uses).toBe(5+expected);
  const stage=hiddenMissionStage(result.player.hiddenPowerMission!)!;
  expect(stage.ready).toBe(true);
  await closeRun(env,user,run.id,{key:'hidden-run-close'},true);
  vi.mocked(Date.now).mockReturnValue(now+HIDDEN_MISSION_DURATION);
  const expired=await seedRun('hidden-expired-run');
  const frozen=await runActions(env,user,expired.id,{...body,idempotencyKey:'expired-hidden-action'});
  expect(frozen.player.hiddenPowerMission?.uses).toBe(5+expected);
  const claim={action:'claim',milestone:67,stage:1};
  await Promise.all([
   updateHiddenPowerMission(env,user,{...claim,key:'hidden-claim-one'}),
   updateHiddenPowerMission(env,user,{...claim,key:'hidden-claim-two'}),
  ]);
  const saved=await readPlayer(env.DB,user);
  expect(saved.hiddenPowerMission?.claimedStages).toBe(1);
  expect(saved.coins).toBe(player.coins+stage.reward.coins);
  expect(saved.inventory['wind-row'].bound).toBe(player.inventory['wind-row'].bound+1);
 });
});

// Selected season card amounts must match authoritative grants, including non-coin rewards.
describe('season scene reward contracts',()=>{
 async function seasonClears(count:number,guild=false){
  db.prepare('DELETE FROM seasons').run();db.prepare('INSERT INTO seasons VALUES(?,?,?)').run('scene-season',now-1000,now+86400000);
  if(guild){db.prepare('INSERT INTO guilds(id,name,description,mode,min_level,emblem,created_at) VALUES(?,?,?,?,?,?,?)').run('scene-guild','Scene garden','','open',5,0,now-1000);db.prepare('INSERT INTO guild_members(user_id,guild_id,role,joined_at) VALUES(?,?,?,?)').run(user,'scene-guild','leader',now-1000);const member=await readPlayer(env.DB,user);member.guildId='scene-guild';store(member);}
  for(let i=1;i<=count;i++){const run=await seedRun('season-clear-'+i,i);db.prepare("UPDATE runs SET status='won' WHERE id=?").run(run.id);db.prepare('INSERT INTO level_rewards(user_id,level_id,run_id,coins,stars,created_at) VALUES(?,?,?,?,?,?)').run(user,i,run.id,0,0,now);}
 }
 it('publishes and grants the 200-coin personal card exactly once',async()=>{
  await seasonClears(10);const displayed=(await events(env,user)).personal;
  expect(displayed.reward).toEqual({coins:200,stars:0,items:{}});expect(displayed.coins).toBe(200);
  const claim={key:'scene-personal-claim',kind:'personal'},result=await eventClaim(env,user,claim);
  expect(result.player.coins).toBe(700);expect(result.reward).toEqual(displayed.reward);
  await eventClaim(env,user,claim);await expect(eventClaim(env,user,{...claim,key:'scene-personal-repeat'})).rejects.toMatchObject({code:'EVENT_NOT_READY'});
  expect((await readPlayer(env.DB,user)).coins).toBe(700);
 });
 it('grants the guild card as two rockets and three restoration stars, without coins or duplicate grants',async()=>{
  await seasonClears(30,true);const displayed=(await events(env,user)).guild;
  expect(displayed.reward).toEqual({coins:0,stars:3,items:{'wind-row':2}});
  const before=await readPlayer(env.DB,user),results=await Promise.allSettled([eventClaim(env,user,{kind:'guild',key:'scene-guild-a'}),eventClaim(env,user,{kind:'guild',key:'scene-guild-b'})]);
  expect(results.filter(result=>result.status==='fulfilled'),JSON.stringify(results.map(result=>result.status==='rejected'?{reason:String(result.reason),code:result.reason?.code}:result.status))).toHaveLength(1);
  const after=await readPlayer(env.DB,user);expect(after.coins).toBe(before.coins);expect(after.stars).toBe(before.stars+3);expect(after.inventory['wind-row'].bound).toBe(before.inventory['wind-row'].bound+2);
  expect((await events(env,user)).guild.claimed).toBe(true);
 });
 it('rejects incomplete, non-member and expired claims without changing balances',async()=>{
  await seasonClears(9);await expect(eventClaim(env,user,{kind:'personal',key:'scene-early'})).rejects.toMatchObject({code:'EVENT_NOT_READY'});await expect(eventClaim(env,user,{kind:'guild',key:'scene-no-guild'})).rejects.toMatchObject({code:'EVENT_NOT_READY'});
  vi.mocked(Date.now).mockReturnValue(now+86400001);await expect(eventClaim(env,user,{kind:'personal',key:'scene-expired'})).rejects.toMatchObject({code:'SEASON_ENDED'});expect((await readPlayer(env.DB,user)).coins).toBe(500);
 });
});
