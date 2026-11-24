import {DatabaseSync,type SQLInputValue} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
import {beforeEach,afterEach,describe,it,expect,vi} from 'vitest';
import {ENGINE_VERSION,type Run} from '@garden/contracts';
import {startGiftStage} from '../packages/contracts/src/start-gift';
import {getLevel} from '@garden/content';
import {createGame,stateHash,applyAction} from '@garden/core';
import {newPlayer,readPlayer,readRun,type ApiEnv} from '../apps/api/src/db';
import {startRun,closeRun,continueRun,runActions} from '../apps/api/src/runs';
class Statement {
 constructor(readonly db:DatabaseSync,readonly query:string,readonly args:SQLInputValue[]=[]){ }
 bind(...args:SQLInputValue[]){return new Statement(this.db,this.query,args);}
 async first<T>(){return (this.db.prepare(this.query).get(...this.args)??null)as T|null;}
 execute(){return{success:true,results:this.db.prepare(this.query).all(...this.args),meta:{changes:0}};}
 async all(){return this.execute();}async run(){return this.execute();}
}
let db:DatabaseSync,env:ApiEnv;const user='start-gift-qa',now=Date.parse('2026-11-20T07:00:00Z');
beforeEach(()=>{vi.spyOn(Date,'now').mockReturnValue(now);db=new DatabaseSync(':memory:');for(const f of readdirSync('apps/api/migrations').filter(f=>f.endsWith('.sql')).sort())db.exec(readFileSync('apps/api/migrations/'+f,'utf8'));
 env={DB:{prepare:(q:string)=>new Statement(db,q),batch:async(s:Statement[])=>{db.exec('BEGIN');try{const r=s.map(x=>x.execute());db.exec('COMMIT');return r;}catch(e){db.exec('ROLLBACK');throw e;}}}}as unknown as ApiEnv;
 const p=newPlayer(user,now);p.level=32;p.coins=10000;db.prepare('INSERT INTO players(id,data,version,created_at) VALUES(?,?,?,?)').run(user,JSON.stringify(p),p.version,now);
});
afterEach(()=>{db.close();vi.restoreAllMocks();});
function setPlayer(change:Record<string,unknown>){const row=db.prepare('SELECT data FROM players WHERE id=?').get(user)as{data:string},p={...JSON.parse(row.data),...change};db.prepare('UPDATE players SET data=? WHERE id=?').run(JSON.stringify(p),user);return p;}
async function setStatus(id:string,status:'won'|'lost'|'error'){const run=await readRun(env.DB,id,user);run.state.status=status;if(status==='won')run.state.goals=run.state.goals.map(g=>({...g,remaining:0}));db.prepare('UPDATE runs SET data=? WHERE id=?').run(JSON.stringify(run),id);return run;}
const start=(key:string,preBoosters:string[]=[])=>startRun(env,user,{key:'gift-start-'+key,engineVersion:ENGINE_VERSION,preBoosters,randomStart:true});

describe('authoritative starting gift lifecycle',()=>{
 it('advances only on a committed unique win, caps at 3 and never takes tools for the gift',async()=>{
  let last:Run|undefined;
  for(let win=1;win<=4;win++){
   const before=await readPlayer(env.DB,user),r=await start('start-'+win);last=r.run;
   expect(r.run.startGift?.stage??0).toBe(Math.min(3,win-1));expect(r.player.inventory).toEqual(before.inventory);
   await setStatus(r.run.id,'won');const finished=await closeRun(env,user,r.run.id,{key:'gift-finish-'+win});
   expect(finished.player.startGiftStreak).toBe(Math.min(3,win));expect(finished.run.reward?.startGiftStage).toBe(Math.min(3,win));
   const repeated=await closeRun(env,user,r.run.id,{key:'gift-finish-repeat-'+win});expect(repeated.player.startGiftStreak).toBe(Math.min(3,win));
  }
  expect(last?.startGift?.placements).toHaveLength(4);expect((await readPlayer(env.DB,user)).winStreak??0).toBe(0);
 });
 it('charges only explicitly selected tools, preserves them on resume, and ignores claimed gift fields',async()=>{
  setPlayer({startGiftStreak:3});const before=await readPlayer(env.DB,user),r=await start('paid-and-gift',['wind-row','bomb','rainbow']);
  expect(r.run.startGift?.placements).toHaveLength(4);
  for(const item of ['wind-row','bomb','rainbow']as const)expect(r.player.inventory[item].normal).toBe(before.inventory[item].normal-1);
  expect(stateHash(r.run.state)).toBe(stateHash(createGame(r.run.level,r.run.preBoosters)));
  const resumed=await start('resume',['wind-row']);expect(resumed.run).toEqual(r.run);expect(resumed.player.inventory).toEqual(r.player.inventory);
  await closeRun(env,user,r.run.id,{key:'gift-abandon'},true);
  const forged=await startRun(env,user,{key:'gift-forged',engineVersion:ENGINE_VERSION,preBoosters:[],startGiftStreak:3,startGift:{stage:3}});expect(forged.run.startGift).toBeUndefined();expect(startGiftStage(forged.player)).toBe(0);
 });
 it('keeps the gift while the player continues a lost board, resets it only on finalized loss',async()=>{
  setPlayer({startGiftStreak:3});const r=await start('continue-test');await setStatus(r.run.id,'lost');
  const continued=await continueRun(env,user,r.run.id,{key:'gift-continue',sequence:0,expectedCost:500});expect(continued.player.startGiftStreak).toBe(3);
  await setStatus(r.run.id,'lost');const lost=await closeRun(env,user,r.run.id,{key:'gift-loss'});expect(lost.player.startGiftStreak).toBe(0);expect(lost.player.hearts).toBe(4);
 });
 it('resets expired or abandoned attempts but preserves gifts for technical errors',async()=>{
  setPlayer({startGiftStreak:3});const r=await start('expires');const expired={...r.run,expiresAt:now-1};db.prepare('UPDATE runs SET data=?,expires_at=? WHERE id=?').run(JSON.stringify(expired),now-1,r.run.id);
  const next=await start('after-expiry');expect(next.player.startGiftStreak).toBe(0);expect(next.run.startGift).toBeUndefined();
  await closeRun(env,user,next.run.id,{key:'gift-abandon-next'},true);setPlayer({startGiftStreak:2});const technical=await start('technical');await setStatus(technical.run.id,'error');const closed=await closeRun(env,user,technical.run.id,{key:'gift-close-error'},true);expect(closed.player.startGiftStreak).toBe(2);
 });
 it('carries known legacy wins forward and keeps the 10-win lantern separate',async()=>{
  const p=setPlayer({level:200,winStreak:9});delete p.startGiftStreak;db.prepare('UPDATE players SET data=? WHERE id=?').run(JSON.stringify(p),user);
  expect((await readPlayer(env.DB,user)).startGiftStreak).toBe(3);const r=await start('legacy');expect(r.run.startGift?.placements).toHaveLength(4);expect(r.run.state.powerRainbow).toBeUndefined();await setStatus(r.run.id,'won');const won=await closeRun(env,user,r.run.id,{key:'gift-legacy-win'});expect(won.player.winStreak).toBe(10);expect(won.run.reward?.powerRainbowUnlocked).toBe(true);const next=await start('powered');expect(next.run.state.powerRainbow).toBe(true);expect(next.run.startGift?.stage).toBe(3);
 });
 it('does not count wins before level 32',async()=>{
  setPlayer({level:31});const r=await start('locked');await setStatus(r.run.id,'won');const won=await closeRun(env,user,r.run.id,{key:'gift-locked-win'});expect(won.player.level).toBe(32);expect(won.player.startGiftStreak).toBe(0);expect(won.run.reward?.startGiftStage).toBeUndefined();
 });
 it('replays a gifted power activation identically without consuming inventory or awarding it twice',async()=>{
  setPlayer({level:35,startGiftStreak:3});const r=await start('activate-gift'),slot=r.run.startGift!.placements.find(p=>p.kind==='glider')!,action={type:'tap',at:slot.at}as const;
  const local=applyAction(r.run.state,action);expect(local.accepted).toBe(true);
  const body={key:'gift-activation-key',sequence:0,actions:[action]},saved=await runActions(env,user,r.run.id,body);
  expect(stateHash(saved.run.state)).toBe(stateHash(local.state));expect(saved.player.inventory).toEqual(r.player.inventory);expect(saved.run.sequence).toBe(1);expect(saved.player.startGiftStreak).toBe(3);
  const repeated=await runActions(env,user,r.run.id,body);expect(repeated).toEqual(saved);
 });

});
