import {DatabaseSync,type SQLInputValue} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
import {beforeEach,afterEach,describe,it,expect,vi} from 'vitest';
import type {Action,Run} from '@garden/contracts';
import {ENGINE_VERSION,GREENHOUSE_ENGINE_VERSION,POWER_RAINBOW_ENGINE_VERSION,POWER_RAINBOW_LEVEL} from '@garden/contracts';
import {getLevel} from '@garden/content';
import {createGame} from '@garden/core';
import {newPlayer,readPlayer,readRun,type ApiEnv} from '../apps/api/src/db';
import {runActions,closeRun,continueRun,startRun} from '../apps/api/src/runs';
import {buyItem,catalog} from '../apps/api/src/economy';
import {nextLevel} from '../apps/api/src/level-content';
import solutions from '../packages/content/src/campaign-solutions.json';
class Statement {
 constructor(readonly db:DatabaseSync,readonly query:string,readonly args:SQLInputValue[]=[]){ }
 bind(...args:SQLInputValue[]){return new Statement(this.db,this.query,args)}
 async first<T>(){return (this.db.prepare(this.query).get(...this.args)??null) as T|null}
 execute(){return {success:true,results:this.db.prepare(this.query).all(...this.args),meta:{changes:0}}}
 async all(){return this.execute()}async run(){return this.execute()}
}
let db:DatabaseSync,env:ApiEnv;const user='completion-v51',now=Date.parse('2026-11-09T07:00:00Z');
beforeEach(()=>{vi.spyOn(Date,'now').mockReturnValue(now);db=new DatabaseSync(':memory:');for(const f of readdirSync('apps/api/migrations').filter(f=>f.endsWith('.sql')).sort())db.exec(readFileSync('apps/api/migrations/'+f,'utf8'));env={DB:{prepare:(q:string)=>new Statement(db,q),batch:async(s:Statement[])=>{db.exec('BEGIN');try{const r=s.map(x=>x.execute());db.exec('COMMIT');return r}catch(e){db.exec('ROLLBACK');throw e}}}} as unknown as ApiEnv;
 const player=newPlayer(user,now);player.flowerFestival={id:'flowerlight-invitation-v1',startedAt:now-1000,endsAt:now+86400000,petals:0,restoredStages:0};db.prepare('INSERT INTO players(id,data,version,created_at) VALUES(?,?,?,?)').run(user,JSON.stringify(player),player.version,now);
});
afterEach(()=>{db.close();vi.restoreAllMocks()});
function seed(){const level=getLevel(1),run:Run={id:'atomic-clear-run',userId:user,level,state:createGame(level),sequence:0,status:'active',startedAt:now,expiresAt:now+86400000,preBoosters:[],heartSpent:false,heartCharge:'failure',continues:0};db.prepare('INSERT INTO runs VALUES(?,?,?,?,?,?,?)').run(run.id,user,JSON.stringify(run),'active',0,run.expiresAt,'create-clear-key');return run;}
const actions=solutions['1'].actions as Action[];
describe('single-request authoritative victory and independent previews',()=>{
 it('saves actions, closes the run and grants coins, star and festival petal in one transaction',async()=>{
  const run=seed(),result=await runActions(env,user,run.id,{key:'atomic-clear-key',sequence:0,actions,finishOnWin:true});
  expect(result.run.status).toBe('won');expect(result.run.reward).toMatchObject({coins:30,stars:1,flowerPetals:1});expect(result.player.level).toBe(2);expect(result.player.coins).toBe(530);expect(result.player.hearts).toBe(5);expect(result.player.flowerFestival!.petals).toBe(1);
  expect((await readRun(env.DB,run.id,user)).status).toBe('won');expect(db.prepare('SELECT count(*) n FROM level_rewards').get()?.n).toBe(1);
  const retry=await runActions(env,user,run.id,{key:'atomic-clear-key',sequence:0,actions,finishOnWin:true});expect(retry).toEqual(result);
  const closed=await closeRun(env,user,run.id,{key:'legacy-finish-after-atomic'});expect(closed.player.coins).toBe(530);expect(closed.player.flowerFestival!.petals).toBe(1);
 });
 it('commits one reward when two distinct winning requests race',async()=>{
  const run=seed(),results=await Promise.allSettled(['atomic-race-one','atomic-race-two'].map(key=>runActions(env,user,run.id,{key,sequence:0,actions,finishOnWin:true})));expect(results.filter(r=>r.status==='fulfilled')).toHaveLength(1);expect((await readPlayer(env.DB,user)).coins).toBe(530);expect((await readPlayer(env.DB,user)).flowerFestival!.petals).toBe(1);expect(db.prepare('SELECT count(*) n FROM level_rewards').get()?.n).toBe(1);
 });
 it('keeps legacy actions without opt-in compatible and never trusts a claimed win',async()=>{
  const run=seed();await expect(runActions(env,user,run.id,{key:'forged-win-key',sequence:0,actions:[{type:'tap',at:0}],finishOnWin:true,status:'won',reward:{coins:99999}})).rejects.toMatchObject({code:'INVALID_ACTION'});
  const result=await runActions(env,user,run.id,{key:'legacy-clear-key',sequence:0,actions});expect(result.run.status).toBe('active');expect(result.run.reward).toBeUndefined();expect(result.player.coins).toBe(500);expect((await closeRun(env,user,run.id,{key:'legacy-finish-key'})).player.coins).toBe(530);
 });
 it('rolls back actions and all rewards if the reward write fails',async()=>{
  const run=seed();db.exec("CREATE TRIGGER reject_reward BEFORE INSERT ON level_rewards BEGIN SELECT RAISE(ABORT,'test reward failure'); END");await expect(runActions(env,user,run.id,{key:'atomic-rollback-key',sequence:0,actions,finishOnWin:true})).rejects.toThrow('test reward failure');expect((await readRun(env.DB,run.id,user)).sequence).toBe(0);expect((await readPlayer(env.DB,user)).coins).toBe(500);expect(db.prepare('SELECT count(*) n FROM run_actions').get()?.n).toBe(0);
 });
 it('allows the next map preview before clear without granting progress or allowing stage skips',async()=>{
  const before=await readPlayer(env.DB,user),preview=await nextLevel(env,user,ENGINE_VERSION,'2');expect(preview.level.id).toBe(2);expect(preview.levelHash).toHaveLength(64);expect(await readPlayer(env.DB,user)).toEqual(before);await expect(nextLevel(env,user,ENGINE_VERSION,'3')).rejects.toMatchObject({code:'LEVEL_PREVIEW_LOCKED'});await expect(nextLevel(env,user,ENGINE_VERSION,'-1')).rejects.toThrow();
 });
});

describe('one free start booster trial',()=>{
 function trialPlayer(stock=0){
  const player=newPlayer(user,now);
  player.level=14;
  player.inventory['wind-row']={normal:stock,bound:0};
  db.prepare('UPDATE players SET data=? WHERE id=?').run(JSON.stringify(player),user);
  return player;
 }

 it('previews without spending, shares one grant across concurrent starts, and rejects a stale free selection after the trial',async()=>{
  const before=trialPlayer(1),preview=await nextLevel(env,user,ENGINE_VERSION);
  expect(preview.level.startBoosterGuide).toMatchObject({item:'wind-row',trial:true});
  expect(await readPlayer(env.DB,user)).toMatchObject({inventory:before.inventory});
  const options={engineVersion:ENGINE_VERSION,randomStart:true,levelHash:preview.levelHash,preBoosters:['wind-row'],useFreeStartTrial:true};
  const [first,second]=await Promise.all(['trial-first-request','trial-racing-request'].map(key=>startRun(env,user,{...options,key})));
  expect(first.run.id).toBe(second.run.id);
  expect(first.player.usedStartBoosterTrial).toBe(true);
  expect(first.player.inventory['wind-row']).toEqual({normal:1,bound:0});
  expect(first.run.state.cells[preview.level.startBoosterGuide!.cell]!.tile?.kind).toBe('wind-row');
  const closed=await closeRun(env,user,first.run.id,{key:'trial-abandon-request'},true);
  expect(closed.player.usedStartBoosterTrial).toBe(true);
  await expect(startRun(env,user,{...options,key:'trial-stale-request'})).rejects.toMatchObject({code:'START_BOOSTER_TRIAL_USED'});
  expect((await readPlayer(env.DB,user)).inventory['wind-row'].normal).toBe(1);
  const next=await startRun(env,user,{...options,key:'trial-paid-retry',useFreeStartTrial:false});
  expect(next.player.inventory['wind-row'].normal).toBe(0);
 });

 it('allows a free rocket with zero stock and rolls back when another selected item cannot be paid for',async()=>{
  const player=trialPlayer();
  player.inventory.bomb={normal:0,bound:0};
  db.prepare('UPDATE players SET data=? WHERE id=?').run(JSON.stringify(player),user);
  const body={engineVersion:ENGINE_VERSION,preBoosters:['wind-row','bomb'],useFreeStartTrial:true};
  await expect(startRun(env,user,{...body,key:'trial-insufficient-bomb'})).rejects.toMatchObject({code:'ITEMS_EMPTY'});
  expect((await readPlayer(env.DB,user)).usedStartBoosterTrial).toBeUndefined();
  const plain=await startRun(env,user,{engineVersion:ENGINE_VERSION,key:'trial-decline-request'});
  expect(plain.player.usedStartBoosterTrial).toBeUndefined();
  await closeRun(env,user,plain.run.id,{key:'trial-close-plain'},true);
  const free=await startRun(env,user,{...body,key:'trial-zero-stock',preBoosters:['wind-row']});
  expect(free.player.usedStartBoosterTrial).toBe(true);
  expect(free.player.inventory['wind-row'].normal).toBe(0);
 });
});

describe('power disco ball streak and clear rewards',()=>{
 function setStreak(streak:number){
  const row=db.prepare('SELECT data FROM players WHERE id=?').get(user)!;
  const player=JSON.parse(String(row.data));
  db.prepare('UPDATE players SET data=? WHERE id=?').run(JSON.stringify({...player,winStreak:streak,level:Math.max(player.level,POWER_RAINBOW_LEVEL)}),user);
 }
 it('does not count wins or power the lantern before level 200',async()=>{
  const row=db.prepare('SELECT data FROM players WHERE id=?').get(user)!;
  db.prepare('UPDATE players SET data=? WHERE id=?').run(JSON.stringify({...JSON.parse(String(row.data)),winStreak:9,level:POWER_RAINBOW_LEVEL-50}),user);
  const run=seed();
  const cleared=await runActions(env,user,run.id,{key:'early-clear-key',sequence:0,actions,finishOnWin:true});
  expect(cleared.player.winStreak).toBe(9);
  expect(cleared.run.reward?.powerRainbowUnlocked).toBeUndefined();
  const next=await startRun(env,user,{key:'early-start-key',engineVersion:POWER_RAINBOW_ENGINE_VERSION});
  expect(next.run.state.powerRainbow).toBeUndefined();
 });
 it('unlocks on the tenth win, holds through an accepted continue, and resets on a final loss',async()=>{
  setStreak(9);
  const tenth=seed();
  expect(tenth.state.powerRainbow).toBeUndefined();
  const granted=await runActions(env,user,tenth.id,{key:'tenth-clear-key',sequence:0,actions,finishOnWin:true});
  expect(granted.player.winStreak).toBe(10);
  expect(granted.run.reward).toEqual({coins:30,stars:1,flowerPetals:1,powerRainbowUnlocked:true,startGiftStage:1});
  expect(granted.player.inventory['world-bomb'].bound).toBe(0);
  expect((await closeRun(env,user,tenth.id,{key:'tenth-retry-key'})).player.winStreak).toBe(10);
  const next=await startRun(env,user,{key:'first-powered-key',engineVersion:POWER_RAINBOW_ENGINE_VERSION,preBoosters:['rainbow']});
  expect(next.run.level.powerRainbow).toBe(true);
  expect(next.run.state.powerRainbow).toBe(true);
  expect(next.run.state.cells.some(cell=>cell.tile?.kind==='rainbow')).toBe(true);
  const loss={...next.run,state:{...next.run.state,status:'lost' as const,moves:0}};
  db.prepare('UPDATE runs SET data=? WHERE id=?').run(JSON.stringify(loss),loss.id);
  const continued=await continueRun(env,user,loss.id,{key:'preserve-power-key',sequence:loss.sequence,expectedCost:500});
  expect(continued.player.coins).toBe(30);
  expect(continued.player.winStreak).toBe(10);
  expect(continued.run.state.powerRainbow).toBe(true);
  expect(continued.run.state.moves).toBe(5);
  const lostAgain={...continued.run,state:{...continued.run.state,status:'lost' as const,moves:0}};
  db.prepare('UPDATE runs SET data=? WHERE id=?').run(JSON.stringify(lostAgain),loss.id);
  const ended=await closeRun(env,user,loss.id,{key:'confirm-losing-key'});
  expect(ended.player.winStreak).toBe(0);
  expect(ended.player.hearts).toBe(4);
  const fresh=await startRun(env,user,{key:'reset-powered-key',engineVersion:POWER_RAINBOW_ENGINE_VERSION});
  expect(fresh.run.state.powerRainbow).toBeUndefined();
 });
 it('keeps older clients on ordinary disco balls and resets after a voluntary end',async()=>{
  setStreak(10);
  const {run}=await startRun(env,user,{key:'legacy-disco-key',engineVersion:GREENHOUSE_ENGINE_VERSION});
  expect(run.state.powerRainbow).toBeUndefined();
  const abandoned=await closeRun(env,user,run.id,{key:'voluntary-end-key'},true);
  expect(abandoned.player.winStreak).toBe(0);
 });
 it('resets an expired attempt before creating a replacement',async()=>{
  setStreak(10);
  const existing=seed(),expired={...existing,expiresAt:now-1};
  db.prepare('UPDATE runs SET data=?,expires_at=? WHERE id=?').run(JSON.stringify(expired),expired.expiresAt,expired.id);
  const result=await startRun(env,user,{key:'after-expiry-key',engineVersion:POWER_RAINBOW_ENGINE_VERSION});
  expect(result.player.winStreak).toBe(0);
  expect(result.run.state.powerRainbow).toBeUndefined();
 });
});

describe('shop and continue pricing',()=>{
 function fund(coins:number,boundCoins=0){
  const player=newPlayer(user,now);
  db.prepare('UPDATE players SET data=? WHERE id=?').run(JSON.stringify({...player,level:5,coins,boundCoins}),user);
 }
 function markLost(run:Run){
  const lost={...run,state:{...run.state,status:'lost' as const,moves:0}};
  db.prepare('UPDATE runs SET data=? WHERE id=?').run(JSON.stringify(lost),lost.id);
  return lost;
 }
 it('quotes and charges 500, 1000, and 1500 once each for the same attempt',async()=>{
  fund(3000);
  let run=markLost(seed());
  await expect(continueRun(env,user,run.id,{key:'legacy-underquote',sequence:0})).rejects.toMatchObject({code:'CONTINUE_PRICE_CHANGED'});
  expect((await readPlayer(env.DB,user)).coins).toBe(3000);
  for(const [index,cost]of [500,1000,1500].entries()){
   const input={key:'continue-price-'+index,sequence:run.sequence,expectedCost:cost};
   const paid=await continueRun(env,user,run.id,input);
   expect(paid.cost).toBe(cost);
   expect(paid.run.continues).toBe(index+1);
   expect(paid.run.state.moves).toBe(5);
   expect(await continueRun(env,user,run.id,input)).toEqual(paid);
   run=markLost(paid.run);
  }
  expect((await readPlayer(env.DB,user)).coins).toBe(0);
  await expect(continueRun(env,user,run.id,{key:'continue-price-four',sequence:run.sequence,expectedCost:2000})).rejects.toMatchObject({code:'CONTINUE_LIMIT'});
 });
 it('sells one world bomb for the catalog price and rejects stale or unaffordable quotes',async()=>{
  fund(2200);
  const {prices}=await catalog(env);
  expect(prices['world-bomb']).toBe(2200);
  await expect(buyItem(env,user,{key:'world-bomb-old-price',item:'world-bomb',expectedCost:1500})).rejects.toMatchObject({code:'SHOP_PRICE_CHANGED'});
  expect((await readPlayer(env.DB,user)).coins).toBe(2200);
  const input={key:'world-bomb-full',item:'world-bomb',expectedCost:2200};
  const bought=await buyItem(env,user,input);
  expect({coins:bought.player.coins,normal:bought.player.inventory['world-bomb'].normal,cost:bought.cost}).toEqual({coins:0,normal:1,cost:2200});
  expect(await buyItem(env,user,input)).toEqual(bought);
  expect(await buyItem(env,user,{...input,quantity:1})).toEqual(bought);
  await expect(buyItem(env,user,{...input,key:'world-bomb-empty'})).rejects.toMatchObject({code:'COINS_EMPTY'});
 });
 it('charges a multi-item quote once and grants the corresponding bound and normal items',async()=>{
  fund(850,300);
  const before=await readPlayer(env.DB,user);
  const input={key:'three-hammers',item:'hammer',quantity:3,expectedCost:750};
  await expect(buyItem(env,user,{...input,expectedCost:250})).rejects.toMatchObject({code:'SHOP_PRICE_CHANGED'});
  for(const quantity of [0,1.5,101])await expect(buyItem(env,user,{...input,quantity})).rejects.toThrow();
  expect(await readPlayer(env.DB,user)).toEqual(before);

  const [purchase,retry]=await Promise.all([buyItem(env,user,input),buyItem(env,user,input)]);
  expect(purchase).toMatchObject({quantity:3,cost:750,bound:true,player:{coins:400,boundCoins:0}});
  expect(purchase.player.inventory.hammer).toEqual({normal:before.inventory.hammer.normal+1,bound:before.inventory.hammer.bound+2});
  expect(retry).toEqual(purchase);
  expect(db.prepare('SELECT bound,quantity FROM inventory_lots WHERE source_id=? ORDER BY bound').all(input.key)).toEqual([
   {bound:0,quantity:1},{bound:1,quantity:2},
  ]);
  await expect(buyItem(env,user,{...input,quantity:2})).rejects.toMatchObject({code:'IDEMPOTENCY_CONFLICT'});
  await expect(buyItem(env,user,{...input,key:'three-unaffordable-hammers'})).rejects.toMatchObject({code:'COINS_EMPTY'});
  expect(await readPlayer(env.DB,user)).toEqual(purchase.player);
 });
});
