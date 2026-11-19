import {DatabaseSync,type SQLInputValue} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
import {beforeEach,afterEach,describe,it,expect,vi} from 'vitest';
import type {Player,TreasureAttempt} from '@garden/contracts';
import {day,newPlayer,readPlayer,type ApiEnv} from '../apps/api/src/db';
import {progression} from '../apps/api/src/activity';
import {daily,events} from '../apps/api/src/economy';
import {missionPeriod} from '../packages/content/src/missions';
import {emptyPowerUses} from '../packages/content/src/power-festival';
import {FLOWERLIGHT_ID} from '../packages/content/src/flowerlight';

class Statement{
 constructor(readonly db:DatabaseSync,readonly query:string,readonly args:SQLInputValue[]=[]){ }
 bind(...args:SQLInputValue[]){return new Statement(this.db,this.query,args)}
 async first<T>(){return (this.db.prepare(this.query).get(...this.args)??null) as T|null}
 execute(){return {success:true,results:this.db.prepare(this.query).all(...this.args),meta:{changes:0}}}
 async all(){return this.execute()}async run(){return this.execute()}
}
const now=Date.parse('2026-11-09T04:00:00Z'),user='attention-api-qa';let db:DatabaseSync,env:ApiEnv,player:Player;
beforeEach(()=>{
 vi.spyOn(Date,'now').mockReturnValue(now);db=new DatabaseSync(':memory:');for(const file of readdirSync('apps/api/migrations').filter(name=>name.endsWith('.sql')).sort())db.exec(readFileSync('apps/api/migrations/'+file,'utf8'));
 env={DB:{prepare:(query:string)=>new Statement(db,query),batch:async(statements:Statement[])=>{db.exec('BEGIN');try{const results=statements.map(s=>s.execute());db.exec('COMMIT');return results}catch(error){db.exec('ROLLBACK');throw error}}}} as unknown as ApiEnv;
 player=newPlayer(user,now);player.level=84;db.prepare('INSERT INTO players(id,data,version,created_at) VALUES(?,?,?,?)').run(user,JSON.stringify(player),player.version,now);
});
afterEach(()=>{db.close();vi.restoreAllMocks()});
function save(){db.prepare('UPDATE players SET data=?,version=? WHERE id=?').run(JSON.stringify(player),player.version,user)}
function attempt(index:number,status:TreasureAttempt['status']){const id='attempt-'+index,day=missionPeriod('daily',now);const value={id,day:day.id,status,startedAt:now,expiresAt:day.endsAt,deck:[],maxTurns:12};db.prepare('INSERT INTO treasure_attempts VALUES(?,?,?,?,?,?)').run(id,user,day.id,JSON.stringify(value),status,now+index);}
describe('authoritative progression attention with production SQL and migrations',()=>{
 it('shows and pays 200 coins once per attendance day and gives the seventh-day hammer',async()=>{
  for(let offset=1;offset<=6;offset++){
   db.prepare('INSERT INTO reward_claims VALUES(?,?,?,?)').run(user,'daily',String(day(now)-offset),now-offset*86_400_000);
  }
  expect((await events(env,user)).daily).toMatchObject({coins:200,available:true});
  const payload={key:'attendance-seventh-day'};
  const seventh=await daily(env,user,payload);
  expect(seventh.attendanceReward).toEqual({coins:200,hammer:1});
  expect(seventh.player.coins).toBe(player.coins+200);
  expect(seventh.player.inventory.hammer.bound).toBe(player.inventory.hammer.bound+1);
  expect(await daily(env,user,payload)).toEqual(seventh);
  await expect(daily(env,user,{key:'attendance-same-day'})).rejects.toMatchObject({code:'ALREADY_CLAIMED'});
  expect((await readPlayer(env.DB,user)).coins).toBe(player.coins+200);
  expect((await events(env,user)).daily).toMatchObject({coins:200,available:false});
  vi.mocked(Date.now).mockReturnValue(now+86_400_000);
  const next=await daily(env,user,{key:'attendance-next-day'});
  expect(next.attendanceReward).toEqual({coins:200,hammer:0});
  expect(next.player.coins).toBe(player.coins+400);
 });
 it('keeps treasure available after one attempt and through the unfinished last attempt',async()=>{
  attempt(1,'lost');let result=await progression(env,user);expect(result.minigame.remaining).toBe(2);expect(result.notifications.minigame).toBe(1);
  attempt(2,'won');attempt(3,'playing');result=await progression(env,user);expect(result.minigame.remaining).toBe(0);expect(result.notifications.minigame).toBe(1);
  db.prepare("UPDATE treasure_attempts SET status='lost' WHERE id='attempt-3'").run();result=await progression(env,user);expect(result.notifications.minigame).toBe(0);
 });
 it('keeps partially completed expeditions marked and clears completed or expired content without rewards',async()=>{
  player.animalExpedition={roundId:'panda:001',animal:'panda',completedStages:2,completedAttempts:[]};player.flowerFestival={id:FLOWERLIGHT_ID,startedAt:now-86400000,endsAt:now-1,petals:0,restoredStages:0};player.powerFestival={id:'ended',day:missionPeriod('daily',now).id,startedAt:now-3600000,endsAt:now-1,counts:emptyPowerUses(),claimedStages:0};save();let result=await progression(env,user);expect(result.notifications).toMatchObject({expedition:1,flowerlight:0,festival:0});
  player.animalExpedition.completedStages=10;save();result=await progression(env,user);expect(result.notifications.expedition).toBe(0);
 });
 it('provides gift categories so a locally replenished full heart cannot leave a false gift dot',async()=>{
  for(const [id,kind]of [['heart-only','heart'],['tool','hammer']])db.prepare('INSERT INTO gifts VALUES(?,?,NULL,?,?,1,1,?,?)').run(id!,user,'친구',kind!,id!,now);
  let result=await progression(env,user);expect(result.giftCounts).toEqual({hearts:1,items:1});expect(result.notifications.gifts).toBe(1);
  db.prepare("UPDATE gifts SET quantity=0 WHERE id='tool'").run();result=await progression(env,user);expect(result.notifications.gifts).toBe(0);expect(result.giftCounts).toEqual({hearts:1,items:0});
 });
 it('returns the same earned claim state used by event and pass menus without mixing attendance with season goals',async()=>{
  for(let index=1;index<=10;index++){const id='cleared-'+index;db.prepare('INSERT INTO runs VALUES(?,?,?,\'won\',0,?,?)').run(id,user,'{}',now+10000,id);db.prepare('INSERT INTO level_rewards VALUES(?,?,?,50,1,?)').run(user,index,id,now-1000);}
  let result=await progression(env,user);expect(result.eventRewards?.personal).toMatchObject({progress:10,claimed:false});expect(result.notifications.events).toBe(2);expect(result.notifications.pass).toBe(10);
  const season=result.eventRewards!.season!.id;db.prepare('INSERT INTO reward_claims VALUES(?,?,?,?)').run(user,'personal',season,now);for(let tier=1;tier<=10;tier++)db.prepare('INSERT INTO reward_claims VALUES(?,?,?,?)').run(user,'pass:free',season+':'+tier,now);
  result=await progression(env,user);expect(result.eventRewards?.personal.claimed).toBe(true);expect(result.notifications.events).toBe(1);expect(result.notifications.pass).toBe(0);expect(result.eventRewards?.daily.available).toBe(true);
 });
 it('does not count hidden incoming requests from a blocked or deleted player',async()=>{
  const other=newPlayer('request-sender',now);db.prepare('INSERT INTO players(id,data,version,created_at) VALUES(?,?,?,?)').run(other.id,JSON.stringify(other),other.version,now);
  const [low,high]=[user,other.id].sort();db.prepare("INSERT INTO friendships(user_low,user_high,status,requested_by,created_at) VALUES(?,?,'pending',?,?)").run(low!,high!,other.id,now);
  expect((await progression(env,user)).notifications.friends).toBe(1);
  db.prepare('INSERT INTO blocks VALUES(?,?)').run(user,other.id);expect((await progression(env,user)).notifications.friends).toBe(0);
  db.prepare('DELETE FROM blocks').run();db.prepare('UPDATE players SET deleted_at=? WHERE id=?').run(now,other.id);expect((await progression(env,user)).notifications.friends).toBe(0);
 });
 it('only marks guild approvals when the player can manage the guild and a member slot is available',async()=>{
  const guild='attention-guild';db.prepare('INSERT INTO guilds VALUES(?,?,?,?,?,?,?,?)').run(guild,'알림 검증 길드','','','approval',5,0,now);player.guildId=guild;save();
  for(let index=0;index<31;index++){const id=index===0?user:'guild-player-'+index;if(index>0){const p=newPlayer(id,now);db.prepare('INSERT INTO players(id,data,version,created_at) VALUES(?,?,?,?)').run(id,JSON.stringify(p),p.version,now);}if(index<30)db.prepare('INSERT INTO guild_members VALUES(?,?,?,0,?)').run(id,guild,index===0?'leader':'member',now);else db.prepare('INSERT INTO guild_applications VALUES(?,?,?)').run(guild,id,now);}
  expect((await progression(env,user)).notifications.guild).toBe(0);
  db.prepare("DELETE FROM guild_members WHERE user_id='guild-player-29'").run();expect((await progression(env,user)).notifications.guild).toBe(1);
  db.prepare("UPDATE guild_members SET role='member' WHERE user_id=?").run(user);expect((await progression(env,user)).notifications.guild).toBe(0);
 });
});
