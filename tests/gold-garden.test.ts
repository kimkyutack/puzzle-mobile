import {DatabaseSync,type SQLInputValue} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
import {afterEach,beforeEach,describe,expect,it} from 'vitest';
import type {Action} from '@garden/contracts';
import {actionWithFrames,applyAction,createGame,isSpecial,legalActions,validateLevel} from '@garden/core';
import {APPROVED_LEVEL_COUNT} from '@garden/content';
import {GOLD_GARDEN_INTERVAL,GOLD_GARDEN_MOVES,GOLD_GARDEN_VERSION,LEGACY_GOLD_GARDEN_VERSION,REFILL_GOLD_GARDEN_VERSION,goldGardenCoins,goldGardenLevel,type GoldGardenVersion} from '../packages/content/src/gold-garden';
import {finishGoldGarden,goldGardenStatus} from '../apps/api/src/gold-garden';
import {newPlayer,readPlayer,type ApiEnv} from '../apps/api/src/db';
import {goldGardenCacheKey,isRefillGoldGardenVersion,loadGoldGarden,pendingGoldGardenMilestone,restoreGoldGarden} from '../apps/client/src/gold-garden-progress';
import {tileOrigins} from '../apps/client/src/tile-origins';
import {impactOverlays} from '../apps/client/src/impact-overlays';
import {effectTiming} from '../apps/client/src/visual-timing';

class Statement{
 constructor(readonly db:DatabaseSync,readonly query:string,readonly args:SQLInputValue[]=[]){}
 bind(...args:SQLInputValue[]){return new Statement(this.db,this.query,args);}
 async first(){return this.db.prepare(this.query).get(...this.args)??null;}
 execute(){return {success:true,results:this.db.prepare(this.query).all(...this.args)};}
 async all(){return this.execute();}
}

const user='gold-garden-test',now=Date.now();
let db:DatabaseSync,env:ApiEnv;
beforeEach(()=>{
 db=new DatabaseSync(':memory:');
 for(const file of readdirSync('apps/api/migrations').filter(name=>name.endsWith('.sql')).sort()){
  db.exec(readFileSync('apps/api/migrations/'+file,'utf8'));
 }
 env={DB:{prepare:(query:string)=>new Statement(db,query),async batch(items:Statement[]){
  db.exec('BEGIN');
  try{const results=items.map(item=>item.execute());db.exec('COMMIT');return results;}
  catch(error){db.exec('ROLLBACK');throw error;}
 }}} as unknown as ApiEnv;
 const player={...newPlayer(user,now),level:204,hearts:0,heartAt:now,winStreak:6};
 db.prepare('INSERT INTO players(id,data,version,created_at) VALUES(?,?,?,?)').run(user,JSON.stringify(player),player.version,now);
});
afterEach(()=>db.close());

function cleared(level:number){
 const run='reward-run-'+level;
 db.prepare('INSERT INTO runs VALUES(?,?,?,?,?,?,?)').run(run,user,'{}','won',0,now+100_000,'test-level-'+level);
 db.prepare('INSERT INTO level_rewards VALUES(?,?,?,?,?,?)').run(user,level,run,30,1,now);
}

function trace(milestone:number,greedy=false){
 let state=createGame(goldGardenLevel(milestone,LEGACY_GOLD_GARDEN_VERSION)),rng=milestone;
 const actions:Action[]=[];
 while(state.status==='playing'){
  const choices=legalActions(state);
  rng=(Math.imul(rng,1664525)+1013904223)>>>0;
  const choice=greedy?choices.map(action=>{
   const result=applyAction(state,action);
   const score=(result.state.status==='won'?100_000:0)+goldGardenCoins(result.state)*5+
    result.state.cells.filter(cell=>isSpecial(cell.tile)).length*8+
    result.events.filter(event=>event.type==='remove').length*.3;
   return {action,result,score};
  }).filter(item=>item.result.state.status!=='error').sort((a,b)=>b.score-a.score)[0]:
   {action:choices[rng%choices.length]!,result:applyAction(state,choices[rng%choices.length]!)};
  actions.push(choice!.action);
  state=choice!.result.state;
 }
 return {state,actions};
}

describe('Legacy Golden Garden',()=>{
 it('validates all milestone openings with exactly twenty gold cells and twenty moves',()=>{
  for(let milestone=GOLD_GARDEN_INTERVAL;milestone<=APPROVED_LEVEL_COUNT;milestone+=GOLD_GARDEN_INTERVAL){
   const level=goldGardenLevel(milestone,LEGACY_GOLD_GARDEN_VERSION);
   expect(validateLevel(level)).toEqual([]);
   expect(level.obstacles).toHaveLength(20);
   expect(createGame(level).moves).toBe(GOLD_GARDEN_MOVES);
  }
 });
 it('unlocks each account milestone only when a normal clear is recorded',async()=>{
  const player={...await readPlayer(env.DB,user),level:101};
  db.prepare('UPDATE players SET data=? WHERE id=?').run(JSON.stringify(player),user);
  cleared(99);cleared(100);cleared(101);
  expect(await goldGardenStatus(env,user)).toEqual({milestones:[100],version:REFILL_GOLD_GARDEN_VERSION});
  expect(await goldGardenStatus(env,user,String(GOLD_GARDEN_VERSION))).toEqual({milestones:[100],version:GOLD_GARDEN_VERSION});
  const {actions}=trace(200);
  await expect(finishGoldGarden(env,user,{milestone:200,actions})).rejects.toMatchObject({code:'GOLD_GARDEN_LOCKED'});
  player.level=201;db.prepare('UPDATE players SET data=? WHERE id=?').run(JSON.stringify(player),user);
  cleared(200);
  expect(await goldGardenStatus(env,user)).toEqual({milestones:[200],version:REFILL_GOLD_GARDEN_VERSION});
 });
 it('pays partial collection on exhaustion once, including concurrent claims and a lost response',async()=>{
  cleared(100);const {state,actions}=trace(100);
  expect(state.status).toBe('lost');expect(state.moves).toBe(0);
  const coins=goldGardenCoins(state);expect(coins).toBeGreaterThan(0);expect(coins).toBeLessThan(200);
  const payload={milestone:100,actions};
  const [first,second]=await Promise.all([finishGoldGarden(env,user,payload),finishGoldGarden(env,user,payload)]);
  expect(first).toEqual(second);expect(first.coins).toBe(coins);
  expect(first.player).toMatchObject({coins:500+coins,hearts:0,level:204,winStreak:6,stars:0});
  expect((await goldGardenStatus(env,user)).milestones).toEqual([]);
  db.prepare("DELETE FROM operations WHERE user_id=? AND key='gold-garden:100'").run(user);
  const replay=await finishGoldGarden(env,user,payload);
  expect(replay.coins).toBeNull();
  expect((await readPlayer(env.DB,user)).coins).toBe(500+coins);
  expect(db.prepare("SELECT count(*) AS n FROM ledger WHERE reason='gold-garden:claim:100'").get()).toEqual({n:1});
 });
 it('accepts an early full collection and rejects fabricated totals, boosters and incomplete traces',async()=>{
  cleared(100);const {state,actions}=trace(100,true);
  expect(state.status).toBe('won');expect(state.moves).toBeGreaterThan(0);
  await expect(finishGoldGarden(env,user,{milestone:100,actions:actions.slice(0,1)})).rejects.toMatchObject({code:'GOLD_GARDEN_INCOMPLETE'});
  await expect(finishGoldGarden(env,user,{milestone:100,actions,coins:999})).rejects.toThrow();
  await expect(finishGoldGarden(env,user,{milestone:100,actions:[{type:'booster',item:'world-bomb'}]})).rejects.toThrow();
  const result=await finishGoldGarden(env,user,{milestone:100,actions});
  expect(result.coins).toBe(200);
 });
 it('restores the same board with its earned coins and ignores malformed local moves',()=>{
  const {state,actions}=trace(200);
  expect(restoreGoldGarden(200,JSON.stringify(actions),LEGACY_GOLD_GARDEN_VERSION)).toEqual({state,actions});
  expect(restoreGoldGarden(200,'[{"type":"swap","to":24,"from":"23"}]',LEGACY_GOLD_GARDEN_VERSION).actions).toEqual([]);
 });
});

function playPowerRound(milestone:number,version:GoldGardenVersion=GOLD_GARDEN_VERSION){
 let state=createGame(goldGardenLevel(milestone,version)),collected=0;
 const coinSlots=Object.keys(state.obstacles).length,powerSlots=state.cells.filter(cell=>isSpecial(cell.tile)).length;
 const actions:Action[]=[];
 for(let move=0;move<GOLD_GARDEN_MOVES;move++){
  const action:Action=move===0?{type:'swap',from:4,to:13}:{type:'tap',at:move%2===0?4:76};
  const result=applyAction(state,action);
  expect(result.accepted).toBe(true);
  const hits=result.events.filter(event=>event.type==='hit'&&event.kind==='crate'&&event.obstacleAfter===null);
  expect(new Set(hits.map(hit=>hit.obstacleId)).size).toBe(hits.length);
  collected+=hits.length;
  state=result.state;
  expect(goldGardenCoins(state)).toBe(collected);
  expect(state.moves).toBe(GOLD_GARDEN_MOVES-move-1);
  if(state.moves){
   expect(state.status).toBe('playing');
   expect(Object.values(state.obstacles)).toHaveLength(coinSlots);
   expect(state.cells.filter(cell=>isSpecial(cell.tile))).toHaveLength(powerSlots);
  }
  expect(state.cells.some(cell=>cell.tile?.kind==='normal')).toBe(false);
  actions.push(action);
 }
 return {state,actions,collected};
}

describe('Golden Garden with refillable coins',()=>{
 it('returns to stage 544 after the current bonus, even when old bonuses remain unclaimed',async()=>{
  const player={...await readPlayer(env.DB,user),level:544};
  db.prepare('UPDATE players SET data=? WHERE id=?').run(JSON.stringify(player),user);
  for(const milestone of [100,200,300,400,500])cleared(milestone);
  const before=await goldGardenStatus(env,user,String(GOLD_GARDEN_VERSION));
  expect(before.milestones).toEqual([500]);
  expect(pendingGoldGardenMilestone(player.level,before.milestones)).toBe(500);
  const {actions,collected}=playPowerRound(500),payload={milestone:500,version:GOLD_GARDEN_VERSION,actions};
  const paid=await finishGoldGarden(env,user,payload);
  expect(paid.player).toMatchObject({level:544,coins:500+collected});
  const reloaded=await goldGardenStatus(env,user,String(GOLD_GARDEN_VERSION));
  expect(reloaded.milestones).toEqual([]);
  expect(db.prepare('SELECT count(*) AS n FROM level_rewards WHERE user_id=?').get(user)).toEqual({n:5});
  expect(pendingGoldGardenMilestone(paid.player.level,reloaded.milestones)).toBeUndefined();
  await finishGoldGarden(env,user,payload);
  expect((await readPlayer(env.DB,user)).coins).toBe(500+collected);
  const next={...await readPlayer(env.DB,user),level:601};
  db.prepare('UPDATE players SET data=? WHERE id=?').run(JSON.stringify(next),user);cleared(600);
  const nextStatus=await goldGardenStatus(env,user,String(GOLD_GARDEN_VERSION));
  expect(nextStatus.milestones).toEqual([600]);
  expect(pendingGoldGardenMilestone(601,nextStatus.milestones)).toBe(600);
 });
 it('only replaces the campaign button with an eligible bonus from the current hundred-level band',()=>{
  expect(pendingGoldGardenMilestone(100,[100])).toBeUndefined();
  expect(pendingGoldGardenMilestone(101,[100])).toBe(100);
  expect(pendingGoldGardenMilestone(200,[100])).toBe(100);
  expect(pendingGoldGardenMilestone(201,[100])).toBeUndefined();
  expect(pendingGoldGardenMilestone(544,[400,300,200,100])).toBeUndefined();
  expect(pendingGoldGardenMilestone(544,[500,400],400)).toBeUndefined();
  expect(pendingGoldGardenMilestone(544,[500,400],500)).toBe(500);
  expect(pendingGoldGardenMilestone(601,[500,600,400])).toBe(600);
  expect(pendingGoldGardenMilestone(544,[])).toBeUndefined();
 });
 it('starts with the previous layout and expands the coin lanes at 500, 1000 and 2000',()=>{
  const counts=[[100,40,8],[400,40,8],[500,48,8],[900,48,8],[1000,54,9],[1900,54,9],[2000,72,9],[APPROVED_LEVEL_COUNT,72,9]] as const;
  for(const [milestone,coins,powers] of counts){
   const level=goldGardenLevel(milestone);
   expect(level.obstacles).toHaveLength(coins);
   expect(level.shape.filter(Boolean)).toHaveLength(coins+powers);
  }
  const previous=goldGardenLevel(100,REFILL_GOLD_GARDEN_VERSION);
  expect(goldGardenLevel(100)).toEqual({...previous,version:`gold-garden-v${GOLD_GARDEN_VERSION}`});
  expect(goldGardenLevel(2000,REFILL_GOLD_GARDEN_VERSION).obstacles).toHaveLength(40);
 });
 it('fills only the sides with coins and the center with usable powers at every milestone',()=>{
  for(let milestone=GOLD_GARDEN_INTERVAL;milestone<=APPROVED_LEVEL_COUNT;milestone+=GOLD_GARDEN_INTERVAL){
   const level=goldGardenLevel(milestone),state=createGame(level);
   expect(validateLevel(level)).toEqual([]);
   expect(state.moves).toBe(GOLD_GARDEN_MOVES);
   expect(goldGardenCoins(state)).toBe(0);
   for(const [at,cell] of state.cells.entries()){
    if(!cell.exists){expect(cell.tile).toBeNull();expect(cell.obstacleId).toBeUndefined();continue;}
    if(at%state.width===4){expect(isSpecial(cell.tile)).toBe(true);expect(cell.obstacleId).toBeUndefined();}
    else{expect(cell.obstacleId).toBeDefined();expect(cell.tile).toBeNull();}
   }
  }
 });
 it.each([500,1000,2000])('refills the wider board for all moves at milestone %d',milestone=>{
  const {state,actions,collected}=playPowerRound(milestone);
  expect(actions).toHaveLength(GOLD_GARDEN_MOVES);
  expect(state.status).toBe('won');
  expect(collected).toBeGreaterThan(goldGardenLevel(milestone).obstacles.length);
 });
 it('drops replacement powers from the center inlets and uses all twenty moves',()=>{
  const start=createGame(goldGardenLevel(100));
  const result=actionWithFrames(start,{type:'swap',from:4,to:13});
  expect(result.frames.at(-1)?.state).toEqual(result.state);
  const births=[...tileOrigins(start,result.state,result.events).values()];
  expect(births.length).toBeGreaterThan(0);
  expect(births.every(birth=>birth.mode==='supply'&&birth.destination%start.width===4)).toBe(true);
  const {state,actions,collected}=playPowerRound(100);
  expect(actions).toHaveLength(GOLD_GARDEN_MOVES);
  expect(state.status).toBe('won');
  expect(collected).toBeGreaterThan(40);
  expect(applyAction(state,{type:'tap',at:4}).accepted).toBe(false);
 });
 it('drops surviving and newly supplied gold coins in the same column after a hit',()=>{
  const start=createGame(goldGardenLevel(2000));
  const action={type:'tap',at:4} as const;
  const result=actionWithFrames(start,action);
  const timing=effectTiming(result.events,result.state,action);
  const steps=impactOverlays(start,result.state,result.events,timing);
  const hits=result.events.filter(event=>event.type==='hit'&&event.kind==='crate'&&event.obstacleAfter===null);
  const refills=Object.values(result.state.obstacles).filter(coin=>!start.obstacles[coin.id]);
  expect(refills.length).toBe(hits.length);
  expect(refills.length).toBeGreaterThan(0);
  for(const coin of refills){
   const drop=steps.find(step=>step.kind==='obstacle'&&step.id===coin.id);
   expect(drop).toMatchObject({delay:timing.settleAt,kind:'obstacle',value:coin});
   expect(drop?.kind).toBe('obstacle');
   const from=drop?.kind==='obstacle'?drop.fallFrom:undefined;
   expect(from).toBeDefined();
   expect(from).toBeLessThan(coin.anchor);
   expect((coin.anchor-from!)%start.width).toBe(0);
  }
  expect(steps.some(step=>step.kind==='obstacle'&&step.fallFrom!==undefined&&!!start.obstacles[step.id])).toBe(true);
 });
 it('grants one coin per hit once, shares the claim with the legacy version, and rejects early or fabricated results',async()=>{
  cleared(100);
  const {actions,collected}=playPowerRound(100);
  const payload={milestone:100,version:GOLD_GARDEN_VERSION,actions};
  await expect(finishGoldGarden(env,user,{...payload,actions:actions.slice(0,-1)})).rejects.toMatchObject({code:'GOLD_GARDEN_INCOMPLETE'});
  await expect(finishGoldGarden(env,user,{...payload,coins:999})).rejects.toThrow();
  const [first,retry]=await Promise.all([finishGoldGarden(env,user,payload),finishGoldGarden(env,user,payload)]);
  expect(first).toEqual(retry);
  expect(first.coins).toBe(collected);
  expect(first.player).toMatchObject({coins:500+collected,hearts:0,level:204,winStreak:6,stars:0});
  expect((await goldGardenStatus(env,user)).milestones).toEqual([]);
  const oldPayload={milestone:100,actions:trace(100,true).actions};
  await finishGoldGarden(env,user,oldPayload);
  expect((await readPlayer(env.DB,user)).coins).toBe(500+collected);
 });
 it('settles a previously started version 2 round using its original layout',async()=>{
  const player={...await readPlayer(env.DB,user),level:2001};
  db.prepare('UPDATE players SET data=? WHERE id=?').run(JSON.stringify(player),user);
  cleared(2000);
  const previous=playPowerRound(2000,REFILL_GOLD_GARDEN_VERSION);
  const result=await finishGoldGarden(env,user,{milestone:2000,version:REFILL_GOLD_GARDEN_VERSION,actions:previous.actions});
  expect(result.coins).toBe(previous.collected);
  expect(result.player.coins).toBe(500+previous.collected);
  expect((await goldGardenStatus(env,user,String(GOLD_GARDEN_VERSION))).milestones).toEqual([]);
 });
 it('resumes saved power rounds and opens a new power board when only a classic round is stored',()=>{
  const {actions}=playPowerRound(100),partial=actions.slice(0,3);
  const current=loadGoldGarden(100,GOLD_GARDEN_VERSION,version=>version===GOLD_GARDEN_VERSION?JSON.stringify(partial):null);
  expect(current.version).toBe(GOLD_GARDEN_VERSION);
  expect(current.actions).toEqual(partial);
  expect(current.state.moves).toBe(17);
  const oldRefill=playPowerRound(2000,REFILL_GOLD_GARDEN_VERSION).actions.slice(0,3);
  const refill=loadGoldGarden(2000,GOLD_GARDEN_VERSION,version=>version===REFILL_GOLD_GARDEN_VERSION?JSON.stringify(oldRefill):null);
  expect(refill.version).toBe(REFILL_GOLD_GARDEN_VERSION);
  expect(refill.actions).toEqual(oldRefill);
  expect(refill.state.goldGarden?.coinCells).toHaveLength(40);
  expect(refill.state.moves).toBe(17);
  expect(goldGardenCacheKey('player',100,LEGACY_GOLD_GARDEN_VERSION)).toBe('garden-gold-v1-player-100');
  const previous=trace(100).actions.slice(0,3);
  const saved=new Map<GoldGardenVersion,string>([[LEGACY_GOLD_GARDEN_VERSION,JSON.stringify(previous)]]);
  const currentWithLegacySave=loadGoldGarden(100,GOLD_GARDEN_VERSION,version=>saved.get(version)??null);
  expect(currentWithLegacySave.version).toBe(GOLD_GARDEN_VERSION);
  expect(currentWithLegacySave.actions).toEqual([]);
  expect(currentWithLegacySave.state.moves).toBe(GOLD_GARDEN_MOVES);
  expect(currentWithLegacySave.state.goldGarden?.coinCells).toHaveLength(40);
  expect(currentWithLegacySave.state.cells.some(cell=>cell.tile?.kind==='normal')).toBe(false);
 });
 it('requires the Worker to advertise coin refill support',()=>{
  expect(isRefillGoldGardenVersion(undefined)).toBe(false);
  expect(isRefillGoldGardenVersion(LEGACY_GOLD_GARDEN_VERSION)).toBe(false);
  expect(isRefillGoldGardenVersion(REFILL_GOLD_GARDEN_VERSION)).toBe(true);
  expect(isRefillGoldGardenVersion(GOLD_GARDEN_VERSION)).toBe(true);
 });
});
