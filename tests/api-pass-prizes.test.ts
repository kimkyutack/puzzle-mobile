import {DatabaseSync,type SQLInputValue} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
import {beforeEach,afterEach,describe,it,expect,vi} from 'vitest';
import {newPlayer,readPlayer,type ApiEnv} from '../apps/api/src/db';
import {events,passClaim,passClaimAll} from '../apps/api/src/economy';
import {passPrize} from '../packages/contracts/src/pass-rewards';
class Statement{
 constructor(readonly db:DatabaseSync,readonly query:string,readonly args:SQLInputValue[]=[]){ }
 bind(...args:SQLInputValue[]){return new Statement(this.db,this.query,args)}
 async first<T>(){return(this.db.prepare(this.query).get(...this.args)??null)as T|null}
 execute(){return{success:true,results:this.db.prepare(this.query).all(...this.args),meta:{changes:0}}}
 async all(){return this.execute()}async run(){return this.execute()}
}
const user='pass-v122',season='pass-v122-season',now=Date.parse('2026-11-24T03:00:00Z');let db:DatabaseSync,env:ApiEnv;
beforeEach(()=>{
 vi.spyOn(Date,'now').mockReturnValue(now);db=new DatabaseSync(':memory:');for(const file of readdirSync('apps/api/migrations').filter(f=>f.endsWith('.sql')).sort())db.exec(readFileSync('apps/api/migrations/'+file,'utf8'));
 env={DB:{prepare:(query:string)=>new Statement(db,query),batch:async(statements:Statement[])=>{db.exec('BEGIN');try{const result=statements.map(s=>s.execute());db.exec('COMMIT');return result}catch(error){db.exec('ROLLBACK');throw error}}}}as unknown as ApiEnv;
 const player=newPlayer(user,now);player.level=100;db.prepare('INSERT INTO players(id,data,version,created_at) VALUES(?,?,?,?)').run(user,JSON.stringify(player),player.version,now);
 db.prepare('INSERT INTO seasons VALUES(?,?,?)').run(season,now-5000,now+86400000);
 db.prepare('INSERT INTO season_owners VALUES(?,?,?)').run(user,season,'qa-paid');
 for(let i=1;i<=30;i++){const run='pass-run-'+i;db.prepare("INSERT INTO runs VALUES(?,?,?,'won',0,?,?)").run(run,user,'{}',now+10000,run);db.prepare('INSERT INTO level_rewards VALUES(?,?,?,50,1,?)').run(user,i,run,now-1000)}
});
afterEach(()=>{db.close();vi.restoreAllMocks()});
describe('authoritative single-prize pass payout',()=>{
 it('grants all seven placeable decorations in one atomic claim-all without overwriting earlier grants',async()=>{
  const before=await readPlayer(env.DB,user,now),result=await passClaimAll(env,user,{key:'all-pass-prizes'});
  expect(result.claimed).toHaveLength(60);expect(result.player.coins-before.coins).toBe(3000);
  const world=JSON.parse((db.prepare('SELECT data FROM garden_worlds WHERE user_id=?').get(user)as{data:string}).data);
  const decorations=Object.values(world.owned).filter((item:any)=>item.id.startsWith('pass:'));expect(decorations).toHaveLength(7);
  for(let tier=1;tier<=30;tier++)for(const track of ['free','premium']as const){const prize=passPrize(tier,track);if(prize.kind==='decoration')expect(world.owned[`pass:${season}:${tier}:${track}`].itemId).toBe(prize.itemId)}
  expect(result.player.inventory.hammer.normal-before.inventory.hammer.normal).toBe(7);
  const second=await passClaimAll(env,user,{key:'pass-again'});expect(second.reason).toBe('NOTHING_TO_CLAIM');expect(second.player.coins).toBe(result.player.coins);
  const retry=await passClaimAll(env,user,{key:'all-pass-prizes'});expect(retry.claimed).toHaveLength(60);expect((await readPlayer(env.DB,user,now)).coins).toBe(result.player.coins);
 });
 it('shows and pays the same prize for each track and keeps independently claimed decorations',async()=>{
  const view=await events(env,user);expect(view.pass.tiers[5].premium.reward).toEqual(passPrize(6,'premium'));expect(view.pass.tiers[9].free.reward.kind).toBe('decoration');
  const bench=await passClaim(env,user,{key:'bench-claim',tier:6,track:'premium'});expect(bench.world?.owned[`pass:${season}:6:premium`].itemId).toBe('garden-bench');await passClaim(env,user,{key:'lamp-claim',tier:12,track:'premium'});
  const world=JSON.parse((db.prepare('SELECT data FROM garden_worlds WHERE user_id=?').get(user)as{data:string}).data);
  expect(world.owned[`pass:${season}:6:premium`].itemId).toBe('garden-bench');expect(world.owned[`pass:${season}:12:premium`].itemId).toBe('garden-lamp');
  await expect(passClaim(env,user,{key:'duplicate',tier:6,track:'premium'})).rejects.toThrow();
  const after=await events(env,user);expect(after.pass.tiers[5].premium.reward).toEqual(passPrize(6,'premium'));expect(after.pass.tiers[5].premiumClaimed).toBe(true);
 });
 it('preserves legacy claims and never grants new rewards retroactively',async()=>{
  db.prepare('INSERT INTO reward_claims VALUES(?,?,?,?)').run(user,'pass:free',season+':10',now-500);
  for(const tier of [15,30])db.prepare('INSERT INTO reward_claims VALUES(?,?,?,?)').run(user,'pass:premium',season+':'+tier,now-500);
  const view=await events(env,user);expect(view.pass.tiers[14].premium.decoration?.id).toBe('season-gardener');expect(view.pass.tiers[14].premium.hammer).toBe(1);expect(view.pass.tiers[29].premium.guildGift?.item).toBe('hammer');expect(view.pass.tiers[9].free.reward).toEqual({kind:'coins',quantity:25});expect(view.pass.tiers[9].freeClaimed).toBe(true);
  const result=await passClaimAll(env,user,{key:'after-legacy'});expect(result.claimed).toHaveLength(57);
  const world=JSON.parse((db.prepare('SELECT data FROM garden_worlds WHERE user_id=?').get(user)as{data:string}).data);expect(world.owned[`pass:${season}:10:free`]).toBeUndefined();
 });
});
