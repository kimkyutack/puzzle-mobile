import {weeklyRoundId,weeklyEvent} from '../packages/contracts/src/weekly-events';
import {startGardenGame,finishGardenGame} from '../apps/api/src/garden-games';
import {gardenGameStatus} from '../packages/content/src/garden-games';
import {profile} from '../apps/api/src/auth';
import {withAppearance} from '../apps/api/src/profile-appearance';
import {publicProfile} from '../apps/api/src/friends';
import {buyDecoration} from '../apps/api/src/garden-world';
import {DatabaseSync,type SQLInputValue} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
import {beforeEach,afterEach,describe,it,expect,vi} from 'vitest';
import type {Action,Run,LevelDefinition} from '@garden/contracts';
import {FLOW_GRAVITY_ENGINE_VERSION,SEED_DELIVERY_ENGINE_VERSION} from '@garden/contracts';
import {createGame,replay,validateLevel} from '@garden/core';
import {getLevel} from '@garden/content';
import {newPlayer,readPlayer,type ApiEnv} from '../apps/api/src/db';
import {startFlowerlight,restoreFlowerlight,startAnimalExpedition,finishAnimalExpedition,compatibleExpeditionPlayer} from '../apps/api/src/content-events';
import {closeRun} from '../apps/api/src/runs';
import {FLOWERLIGHT_DURATION,FLOWERLIGHT_STAGES,flowerlightClaimable} from '../packages/content/src/flowerlight';
import {animalExpeditionLevel} from '../packages/content/src/animal-expedition';
import {ANIMAL_EXPEDITION_STAGES,ANIMAL_EXPEDITION_DOG_GRANT_ID,expeditionDailyStatus,expeditionRounds,expeditionRound,expeditionGrantId,configuredExpeditionRound,EXPEDITION_ANIMALS} from '../packages/content/src/animal-expedition';
import legacyExpedition from './fixtures/animal-expedition-v1.json';
import {restoreExpedition} from '../apps/client/src/expedition-progress';
import {parseRuntime,guardOperations} from '../apps/api/src/operations';
import {defaultOperationsRuntime} from '../packages/contracts/src/operations';
import {compatibleGardenArt} from '../apps/api/src/garden-art-compat';
import {gardenArtRequest} from '../apps/client/src/garden-art-request';
import {createGardenWorld,applyTrustedDecorationGrant} from '../packages/garden-world/src';
import proofs from '../packages/content/src/animal-expedition-proofs.json';

class Statement {
 constructor(readonly db:DatabaseSync,readonly query:string,readonly args:SQLInputValue[]=[]){ }
 bind(...args:SQLInputValue[]){return new Statement(this.db,this.query,args)}
 async first<T>(){return (this.db.prepare(this.query).get(...this.args)??null) as T|null}
 execute(){return {success:true,results:this.db.prepare(this.query).all(...this.args),meta:{changes:0}}}
 async all(){return this.execute()}async run(){return this.execute()}
}
let db:DatabaseSync,env:ApiEnv;
const user='7dd72380-6632-4164-8a81-28f48dd21f11',now=Date.parse('2026-11-16T03:00:00Z');
beforeEach(()=>{
 vi.spyOn(Date,'now').mockReturnValue(now);db=new DatabaseSync(':memory:');
 for(const file of readdirSync('apps/api/migrations').filter(f=>f.endsWith('.sql')).sort())db.exec(readFileSync('apps/api/migrations/'+file,'utf8'));
 env={DB:{prepare:(q:string)=>new Statement(db,q),batch:async(statements:Statement[])=>{db.exec('BEGIN');try{const result=statements.map(s=>s.execute());db.exec('COMMIT');return result}catch(error){db.exec('ROLLBACK');throw error}}}} as unknown as ApiEnv;
 const player=newPlayer(user,now);player.level=20;db.prepare('INSERT INTO players(id,data,version,created_at) VALUES(?,?,?,?)').run(user,JSON.stringify(player),player.version,now);
});
afterEach(()=>{db.close();vi.restoreAllMocks()});
function store(player:Awaited<ReturnType<typeof readPlayer>>){db.prepare('UPDATE players SET data=?,version=? WHERE id=?').run(JSON.stringify(player),player.version,user)}
function winningActions(stage:number,variant=0):Action[]{return proofs.find(p=>p.stage===stage&&p.variant===variant)!.actions as Action[]}
async function wonRun(id:number,startedAt:number){
 const level=getLevel(id),state=createGame(level);state.status='won';state.goals.forEach(g=>g.remaining=0);
 const run:Run={id:'clear-'+id,userId:user,level,state,sequence:0,status:'active',startedAt,expiresAt:Date.now()+86400000,preBoosters:[],heartSpent:false,heartCharge:'failure',continues:0};
 db.prepare('INSERT INTO runs VALUES(?,?,?,?,?,?,?)').run(run.id,user,JSON.stringify(run),'active',0,run.expiresAt,'run-key-'+id);return run;
}
describe('flowerlight festival authoritative progression',()=>{
 it('gates at level 10, gives a personal seven-day window, and never resets on a second key',async()=>{
  const player=await readPlayer(env.DB,user);player.level=9;store(player);await expect(startFlowerlight(env,user,{key:'locked-festival'})).rejects.toMatchObject({code:'FLOWERLIGHT_LOCKED'});
  player.level=10;store(player);const first=await startFlowerlight(env,user,{key:'start-festival'});expect(first.player.flowerFestival!.endsAt-now).toBe(FLOWERLIGHT_DURATION);
  vi.mocked(Date.now).mockReturnValue(now+10000);expect((await startFlowerlight(env,user,{key:'start-again-key'})).player.flowerFestival).toEqual(first.player.flowerFestival);
 });
 it('counts only newly rewarded clears started during the event, with no extra DB write per move',async()=>{
  await startFlowerlight(env,user,{key:'start-festival'});
  const earlier=await wonRun(1,now-1);await closeRun(env,user,earlier.id,{key:'earlier-finish'});expect((await readPlayer(env.DB,user)).flowerFestival!.petals).toBe(0);
  const eligible=await wonRun(2,now);const result=await closeRun(env,user,eligible.id,{key:'new-finish-key'});expect(result.run.reward?.flowerPetals).toBe(1);
  await closeRun(env,user,eligible.id,{key:'another-finish'});expect((await readPlayer(env.DB,user)).flowerFestival!.petals).toBe(1);
  vi.mocked(Date.now).mockReturnValue(now+FLOWERLIGHT_DURATION);const expired=await wonRun(3,now+FLOWERLIGHT_DURATION-1000);await closeRun(env,user,expired.id,{key:'expired-finish'});expect((await readPlayer(env.DB,user)).flowerFestival!.petals).toBe(1);
 });
 it('rejects forged petals and stage skips, keeps earned rewards after expiry, and grants the permanent fountain exactly once',async()=>{
  const player=(await startFlowerlight(env,user,{key:'start-festival'})).player;
  await expect(restoreFlowerlight(env,user,{key:'forged-flowers',stage:1,petals:999})).rejects.toMatchObject({code:'FLOWERLIGHT_NOT_READY'});
  player.flowerFestival!.petals=20;store(player);expect(flowerlightClaimable(player.flowerFestival)).toBe(5);
  await expect(restoreFlowerlight(env,user,{key:'skip-to-final',stage:5})).rejects.toMatchObject({code:'FLOWERLIGHT_STAGE_ORDER'});
  vi.mocked(Date.now).mockReturnValue(now+FLOWERLIGHT_DURATION+1);
  for(let stage=1;stage<5;stage++)await restoreFlowerlight(env,user,{key:'restore-stage-'+stage,stage});
  const results=await Promise.all([restoreFlowerlight(env,user,{key:'restore-final-one',stage:5}),restoreFlowerlight(env,user,{key:'restore-final-two',stage:5})]);
  expect(results.filter(r=>r.granted)).toHaveLength(1);const final=await readPlayer(env.DB,user);expect(final.coins).toBe(500+FLOWERLIGHT_STAGES.reduce((n,s)=>n+s.reward.coins,0));expect(final.hearts).toBe(5);expect(final.flowerFestival!.restoredStages).toBe(5);
  const world=JSON.parse((db.prepare('SELECT data FROM garden_worlds WHERE user_id=?').get(user) as {data:string}).data);expect(world.owned['flowerlight-invitation-v1']).toMatchObject({itemId:'garden-flowerlight-fountain',source:'event'});expect(world.placements['flowerlight-invitation-v1']).toBeTruthy();
 });
 it('rolls back reward and progress if the garden save fails',async()=>{
  const player=(await startFlowerlight(env,user,{key:'start-festival'})).player;player.flowerFestival!.petals=20;player.flowerFestival!.restoredStages=4;store(player);
  db.exec("CREATE TRIGGER block_event_garden BEFORE INSERT ON garden_worlds BEGIN SELECT RAISE(ABORT,'garden save failed'); END");
  await expect(restoreFlowerlight(env,user,{key:'failing-reward',stage:5})).rejects.toThrow('garden save failed');expect((await readPlayer(env.DB,user)).flowerFestival!.restoredStages).toBe(4);expect((await readPlayer(env.DB,user)).coins).toBe(500);
 });
});
describe('level-20 animal expedition',()=>{
 it('shows a same-size legacy fountain to old apps while retaining the canonical event grant for new apps',()=>{
  const world=applyTrustedDecorationGrant(createGardenWorld(user),{ownerId:user,grantId:'flowerlight-invitation-v1',itemId:'garden-flowerlight-fountain',source:'event',variant:'classic',instanceIds:['flowerlight-invitation-v1']});
  const data={world,player:newPlayer(user,now)},legacy=compatibleGardenArt(data,false) as typeof data;
  expect(legacy.world.owned['flowerlight-invitation-v1']!.itemId).toBe('garden-fountain');expect(legacy.world.revision).toBe(world.revision);expect(world.owned['flowerlight-invitation-v1']!.itemId).toBe('garden-flowerlight-fountain');expect(compatibleGardenArt(data,true)).toBe(data);
  expect(gardenArtRequest('/garden/world?shopVersion=2')).toBe('/garden/world?shopVersion=2&gardenArt=garden-v117');expect(gardenArtRequest('/garden/world/commands')).toBe('/garden/world/commands?gardenArt=garden-v117');expect(gardenArtRequest('/flowerlight/restore')).toBe('/flowerlight/restore?gardenArt=garden-v117');expect(gardenArtRequest('/levels/next?engineVersion=1.10.0')).toBe('/levels/next?engineVersion=1.10.0');
 });
 it('enforces the unlock on the server, resumes the same attempt, and replaces it only on an explicit matching restart',async()=>{
  const player=await readPlayer(env.DB,user);player.level=19;store(player);await expect(startAnimalExpedition(env,user,{key:'locked-expedition'})).rejects.toMatchObject({code:'EXPEDITION_LOCKED'});
  player.level=20;store(player);const first=(await startAnimalExpedition(env,user,{key:'start-expedition'})).player.animalExpedition!.attempt!;
  expect((await startAnimalExpedition(env,user,{key:'resume-expedition'})).player.animalExpedition!.attempt!.id).toBe(first.id);
  await expect(startAnimalExpedition(env,user,{key:'bad-restart-key',restart:true,attemptId:'wrong-id'})).rejects.toMatchObject({code:'EXPEDITION_CHANGED'});
  const retry=(await startAnimalExpedition(env,user,{key:'good-restart-key',restart:true,attemptId:first.id})).player;expect(retry.animalExpedition!.attempt!.id).not.toBe(first.id);expect(retry.hearts).toBe(5);expect(retry.coins).toBe(500);
  expect(retry.animalExpedition!.attempt!.level.seed).not.toBe(first.level.seed);expect(retry.animalExpedition!.attempt!.variant).toBe(1);
  await expect(finishAnimalExpedition(env,user,{key:'stale-win-proof',attemptId:first.id,actions:winningActions(1)})).rejects.toMatchObject({code:'EXPEDITION_CHANGED'});
 });
 it('rejects forged wins and paid-tool injection without spending anything',async()=>{
  const player=(await startAnimalExpedition(env,user,{key:'start-expedition'})).player,attempt=player.animalExpedition!.attempt!;
  await expect(finishAnimalExpedition(env,user,{key:'fake-win-attempt',attemptId:attempt.id,actions:[{type:'tap',at:0}],status:'won'})).rejects.toMatchObject({code:'EXPEDITION_NOT_COMPLETE'});
  await expect(async()=>finishAnimalExpedition(env,user,{key:'injected-tool-key',attemptId:attempt.id,actions:[{type:'booster',item:'world-bomb'}]})).rejects.toThrow();expect(await readPlayer(env.DB,user)).toEqual(player);
 });
 it('continues a saved v1 course and grants its actual reward before the next v2 course',async()=>{
  const player=await readPlayer(env.DB,user),attempt={id:'retained-v1-course',stage:3,variant:0,startedAt:now-1000,level:legacyExpedition.level as unknown as LevelDefinition};player.animalExpedition={completedStages:2,completedAttempts:['old-1','old-2'],attempt};store(player);
  const resumed=(await startAnimalExpedition(env,user,{key:'resume-legacy-route'})).player.animalExpedition!.attempt!;expect(resumed).toEqual(attempt);
  const result=await finishAnimalExpedition(env,user,{key:'collect-legacy-route',attemptId:attempt.id,actions:legacyExpedition.actions as Action[]});expect(result.player.coins).toBe(player.coins+100);expect(result.player.inventory.bomb.bound).toBe(player.inventory.bomb.bound+1);expect(result.reward).toEqual(ANIMAL_EXPEDITION_STAGES[2]!.reward);
  const next=(await startAnimalExpedition(env,user,{key:'begin-rebalanced-course'})).player.animalExpedition!.attempt!;expect(next.stage).toBe(4);expect(next.level.version).toBe('woodland-friends-v2');
 });
 it('opens the second course on the original expedition engine and keeps saved newer attempts playable',async()=>{
  const first=(await startAnimalExpedition(env,user,{key:'compatible-first-course'})).player.animalExpedition!.attempt!;
  await finishAnimalExpedition(env,user,{key:'compatible-first-clear',attemptId:first.id,actions:winningActions(1)});
  const second=await startAnimalExpedition(env,user,{key:'compatible-second-course'});
  const attempt=second.player.animalExpedition!.attempt!;
  expect(attempt.stage).toBe(2);
  expect(attempt.level.engineVersion).toBe(FLOW_GRAVITY_ENGINE_VERSION);
  const newer={...attempt,level:{...attempt.level,engineVersion:SEED_DELIVERY_ENGINE_VERSION}};
  second.player.animalExpedition!.attempt=newer;
  store(second.player);
  expect(compatibleExpeditionPlayer(second,SEED_DELIVERY_ENGINE_VERSION)).toBe(second);
  const legacy=compatibleExpeditionPlayer(second,null) as typeof second;
  expect(legacy.player.animalExpedition!.attempt).toEqual(attempt);
  expect((await readPlayer(env.DB,user)).animalExpedition!.attempt).toEqual(newer);
  const actions=winningActions(2);
  expect(restoreExpedition(legacy.player.animalExpedition!.attempt!,JSON.stringify(actions.slice(0,1))).actions).toHaveLength(1);
  const completed=await finishAnimalExpedition(env,user,{key:'compatible-second-clear',attemptId:attempt.id,actions});
  expect(completed.player.animalExpedition!.completedStages).toBe(2);
 });
 it('has five distinct solvable routes, restores partial local progress, and gives each stage and rabbit only once',async()=>{
  const original=await readPlayer(env.DB,user),shapes=new Set<string>();
  for(let stage=1;stage<=ANIMAL_EXPEDITION_STAGES.length;stage++){
   vi.mocked(Date.now).mockReturnValue(now+Math.floor((stage-1)/3)*86400000);
   const response=await startAnimalExpedition(env,user,{key:'expedition-start-'+stage}),attempt=response.player.animalExpedition!.attempt!,actions=winningActions(stage);expect(attempt.stage).toBe(stage);expect(validateLevel(attempt.level)).toEqual([]);
   shapes.add(JSON.stringify(attempt.level.gardenStage));expect(replay(attempt.level,actions).state.status).toBe('won');
   const restored=restoreExpedition(attempt,JSON.stringify(actions.slice(0,1)));expect(restored.actions).toHaveLength(1);expect(restored.state.turn).toBe(1);
   expect(restoreExpedition(attempt,'[{"type":"booster","item":"world-bomb"}]').actions).toEqual([]);
   const result=await finishAnimalExpedition(env,user,{key:'expedition-win-'+stage,attemptId:attempt.id,actions}),reward=ANIMAL_EXPEDITION_STAGES[stage-1]!.reward;expect(result.player.animalExpedition!.completedStages).toBe(stage);expect(result.player.level).toBe(20);expect(result.player.hearts).toBe(5);expect(result).toMatchObject({reward});expect(result.player.coins).toBe(response.player.coins+reward.coins);for(const [item,count] of Object.entries(reward.items))expect(result.player.inventory[item as keyof typeof result.player.inventory].bound).toBe(response.player.inventory[item as keyof typeof response.player.inventory].bound+count!);
   expect((await finishAnimalExpedition(env,user,{key:'duplicate-proof-'+stage,attemptId:attempt.id,actions})).granted).toBe(false);
  }
  expect(shapes.size).toBe(10);const final=await readPlayer(env.DB,user);expect(final.inventory.hammer.normal).toBe(original.inventory.hammer.normal);expect(final.animalExpedition!.completedAttempts).toHaveLength(10);
  const world=JSON.parse((db.prepare('SELECT data FROM garden_worlds WHERE user_id=?').get(user) as {data:string}).data);expect(world.owned[('expedition-friend:panda:'+weeklyRoundId('001',Date.now()))]).toMatchObject({itemId:'animal-panda',source:'event'});
  await expect(startAnimalExpedition(env,user,{key:'after-all-complete'})).rejects.toMatchObject({code:'EXPEDITION_COMPLETE'});
 });
 it('retains old operations settings and lets operators pause each new activity independently',()=>{
  const old=defaultOperationsRuntime();delete (old.features as Partial<typeof old.features>).flowerlight;delete (old.features as Partial<typeof old.features>).animalExpedition;
  const settings=parseRuntime(JSON.stringify(old));expect(settings.features.flowerlight).toBe(true);expect(settings.features.animalExpedition).toBe(true);settings.features.animalExpedition=false;
  expect(()=>guardOperations(new Request('https://game.test/animal-expedition/start',{method:'POST'}),'/animal-expedition/start',settings,null)).toThrow();expect(()=>guardOperations(new Request('https://game.test/flowerlight/start',{method:'POST'}),'/flowerlight/start',settings,null)).not.toThrow();
 });
 it('certifies all thirty authored retry layouts without inventory tools or forced shuffles',()=>{
  expect(proofs).toHaveLength(30);
  for(const proof of proofs){const level=animalExpeditionLevel(proof.stage,proof.variant),result=replay(level,proof.actions as Action[]);expect(validateLevel(level)).toEqual([]);expect(level.seed).toBe(proof.seed);expect(result.accepted).toBe(true);expect(result.state.status).toBe('won');expect(result.events.some(event=>event.type==='shuffle')).toBe(false);expect(proof.actions.every(action=>action.type==='swap'||action.type==='tap')).toBe(true);}
 });
 it('adds real route and obstacle progression instead of making every course a three-move four-color board',()=>{
  const levels=Array.from({length:10},(_,i)=>animalExpeditionLevel(i+1));
  expect(levels.map(level=>level.gardenStage!.gates.length)).toEqual([6,8,11,14,18,20,22,24,25,28]);expect(levels.map(level=>level.colors.length)).toEqual([5,5,6,6,6,6,6,6,6,6]);
  expect(levels.map(level=>level.obstacles.length)).toEqual([0,0,6,9,12,10,12,14,13,14]);expect(levels[4]!.obstacles.every(obstacle=>obstacle.hp===2&&!levelOverlap(obstacle.footprint,levels[4]!.gardenStage!.channels))).toBe(true);
  for(const proof of proofs)expect(proof.actions.length).toBeGreaterThanOrEqual([5,8,9,12,15,15,16,17,18,19][proof.stage-1]!);
 });
});
describe('expedition daily admission and operations controls',()=>{
 it('charges starts and retries exactly once, resumes for free and rejects the fourth new attempt',async()=>{
  const first=await startAnimalExpedition(env,user,{key:'quota-first-start'}),id=first.player.animalExpedition!.attempt!.id;
  expect(first.player.animalExpedition!.dailyAttempts?.used).toBe(1);
  await startAnimalExpedition(env,user,{key:'quota-first-start'});
  await startAnimalExpedition(env,user,{key:'quota-free-resume'});
  const second=await startAnimalExpedition(env,user,{key:'quota-second-start',restart:true,attemptId:id});
  const third=await startAnimalExpedition(env,user,{key:'quota-third-start',restart:true,attemptId:second.player.animalExpedition!.attempt!.id});
  expect(third.player.animalExpedition!.dailyAttempts?.used).toBe(3);
  await expect(startAnimalExpedition(env,user,{key:'quota-fourth-start',restart:true,attemptId:third.player.animalExpedition!.attempt!.id})).rejects.toMatchObject({code:'EXPEDITION_DAILY_LIMIT'});
  const resumed=await startAnimalExpedition(env,user,{key:'quota-last-free-resume'});expect(resumed.player.animalExpedition!.attempt!.id).toBe(third.player.animalExpedition!.attempt!.id);expect(resumed.player.animalExpedition!.dailyAttempts?.used).toBe(3);
  expect((await readPlayer(env.DB,user)).hearts).toBe(5);
 });
 it('counts concurrent retries once and rejects a second retry of the replaced attempt',async()=>{
  const first=await startAnimalExpedition(env,user,{key:'quota-racing-start'}),id=first.player.animalExpedition!.attempt!.id;
  const results=await Promise.allSettled(['quota-racing-retry-a','quota-racing-retry-b'].map(key=>startAnimalExpedition(env,user,{key,restart:true,attemptId:id})));
  expect(results.filter(result=>result.status==='fulfilled')).toHaveLength(1);expect(results.filter(result=>result.status==='rejected')).toHaveLength(1);expect((await readPlayer(env.DB,user)).animalExpedition!.dailyAttempts?.used).toBe(2);
 });
 it('uses midnight in Korea and keeps a stored puzzle when a new day starts',async()=>{
  const midnight=Date.parse('2026-11-16T15:00:00Z');vi.mocked(Date.now).mockReturnValue(midnight-1);
  const first=await startAnimalExpedition(env,user,{key:'quota-before-midnight'}),id=first.player.animalExpedition!.attempt!.id;
  expect(first.player.animalExpedition!.dailyAttempts).toEqual({day:'d:2026-11-16',used:1});
  vi.mocked(Date.now).mockReturnValue(midnight);
  const resumed=await startAnimalExpedition(env,user,{key:'quota-midnight-resume'});expect(resumed.player.animalExpedition!.attempt!.id).toBe(id);expect(expeditionDailyStatus(resumed.player.animalExpedition,midnight).remaining).toBe(3);
  const retry=await startAnimalExpedition(env,user,{key:'quota-after-midnight',restart:true,attemptId:id});expect(retry.player.animalExpedition!.dailyAttempts).toEqual({day:'d:2026-11-17',used:1});
 });
 it('continues old five-stage progress without removing its rabbit and grants the dog only at ten',async()=>{
  const player=await readPlayer(env.DB,user);player.animalExpedition={completedStages:5,completedAttempts:['old-a','old-b','old-c','old-d','old-e']};store(player);
  const world=applyTrustedDecorationGrant(createGardenWorld(user),{ownerId:user,grantId:'woodland-friends-v1',itemId:'animal-rabbit',variant:'classic',source:'event',instanceIds:['old-rabbit']});db.prepare('INSERT INTO garden_worlds(user_id,revision,data,updated_at) VALUES(?,?,?,?)').run(user,world.revision,JSON.stringify(world),now);
  const result=await startAnimalExpedition(env,user,{key:'continue-sixth-stage'});expect(result.player.animalExpedition!.attempt!.stage).toBe(6);expect(result.player.animalExpedition!.completedStages).toBe(5);
  const kept=JSON.parse((db.prepare('SELECT data FROM garden_worlds WHERE user_id=?').get(user) as {data:string}).data);expect(kept.owned['old-rabbit'].itemId).toBe('animal-rabbit');expect(kept.grants[ANIMAL_EXPEDITION_DOG_GRANT_ID]).toBeUndefined();
 });
 it('keeps a spent quota when an operator changes the limit and applies configurable unlocks',async()=>{
  const settings=defaultOperationsRuntime();settings.gameEvents.animalExpedition.minLevel=25;
  await expect(startAnimalExpedition(env,user,{key:'operator-unlock-check'},settings)).rejects.toMatchObject({code:'EXPEDITION_LOCKED'});
  settings.gameEvents.animalExpedition.minLevel=20;settings.gameEvents.animalExpedition.dailyLimit=1;
  const first=await startAnimalExpedition(env,user,{key:'operator-limit-first'},settings),id=first.player.animalExpedition!.attempt!.id;
  settings.gameEvents.animalExpedition.minLevel=25;expect((await startAnimalExpedition(env,user,{key:'operator-keeps-resume'},settings)).player.animalExpedition!.attempt!.id).toBe(id);settings.gameEvents.animalExpedition.minLevel=20;
  await expect(startAnimalExpedition(env,user,{key:'operator-limit-second',restart:true,attemptId:id},settings)).rejects.toMatchObject({code:'EXPEDITION_DAILY_LIMIT'});
  settings.gameEvents.animalExpedition.dailyLimit=4;const retry=await startAnimalExpedition(env,user,{key:'operator-limit-increase',restart:true,attemptId:id},settings);expect(retry.player.animalExpedition!.dailyAttempts?.used).toBe(2);
 });
 it('only closes new admission at a scheduled end and preserves earned reward claims',async()=>{
  const settings=defaultOperationsRuntime();settings.gameEvents.animalExpedition.endsAt=now;settings.gameEvents.flowerlight.startsAt=now+1000;settings.gameEvents.flowerlight.endsAt=now+86400000;
  await expect(startAnimalExpedition(env,user,{key:'scheduled-closed-start'},settings)).rejects.toMatchObject({code:'EVENT_NOT_OPEN'});
  await expect(startFlowerlight(env,user,{key:'scheduled-future-start'},settings)).rejects.toMatchObject({code:'EVENT_NOT_OPEN'});
  expect(()=>guardOperations(new Request('https://game.test/animal-expedition/finish',{method:'POST'}),'/animal-expedition/finish',settings)).not.toThrow();
  expect(parseRuntime(JSON.stringify({...settings,gameEvents:undefined})).gameEvents.animalExpedition.dailyLimit).toBe(3);
 });
});
function levelOverlap(a:number[],b:number[]){return a.some(cell=>b.includes(cell));}

describe('weekly event rotation and expired progress',()=>{
 it('saves a custom profile image in the account and returns it with public appearance',async()=>{
  const customImage='data:image/webp;base64,'+readFileSync('packages/assets/garden-minigame-arcade/runtime/acorn.webp').toString('base64');
  const appearance={avatar:'lumi' as const,frame:'leaf' as const,backdrop:'greenhouse' as const,customImage};
  const saved=await profile(env,user,{key:'profile-custom-image',profileAppearance:appearance});
  expect(saved.player.profileAppearance).toEqual(appearance);
  expect((await readPlayer(env.DB,user)).profileAppearance).toEqual(appearance);
  expect((await publicProfile(env,user,user)).profile.profileAppearance).toEqual(appearance);
  expect(withAppearance({...appearance,nickname:'정원사'})).toEqual({nickname:'정원사',profileAppearance:appearance});
  await expect(profile(env,user,{key:'profile-external-url',profileAppearance:{...appearance,customImage:'https://example.com/photo.svg'}})).rejects.toThrow();
  await profile(env,user,{key:'profile-character-again',profileAppearance:{avatar:'rabbit',frame:'leaf',backdrop:'greenhouse'}});
  expect((await readPlayer(env.DB,user)).profileAppearance?.customImage).toBeUndefined();
 });
 it('replaces rescue with pinball at Monday midnight and prevents the old attempt claiming a reward',async()=>{
  const player=(await startAnimalExpedition(env,user,{key:'weekly-rescue-start'})).player;
  const attempt=player.animalExpedition!.attempt!;
  vi.mocked(Date.now).mockReturnValue(weeklyEvent(now).endsAt);
  const reset=await readPlayer(env.DB,user);
  expect(reset.animalExpedition).toBeUndefined();
  expect(reset.coins).toBe(player.coins);
  await expect(finishAnimalExpedition(env,user,{key:'weekly-expired-rescue',attemptId:attempt.id,actions:winningActions(1)})).rejects.toMatchObject({code:'EVENT_NOT_OPEN'});
  const status=gardenGameStatus('acorn-pinball',reset,Date.now(),defaultOperationsRuntime());
  expect(status.canStart).toBe(true);
  const started=await startGardenGame(env,user,'acorn-pinball',{key:'weekly-pinball-start',roundId:status.roundId,pinballPhysics:2},defaultOperationsRuntime());
  expect(started.player.gardenGames!['acorn-pinball']!.rounds[status.roundId]!.attempt).toBeTruthy();
 });
 it('clears tickets, free-play counters and pending games as the next event starts',async()=>{
  vi.mocked(Date.now).mockReturnValue(weeklyEvent(now).endsAt);
  const player=await readPlayer(env.DB,user),settings=defaultOperationsRuntime();
  settings.gameEvents['acorn-pinball'].roundId='x'.repeat(39)+'A';
  const status=gardenGameStatus('acorn-pinball',player,Date.now(),settings);
  const started=await startGardenGame(env,user,'acorn-pinball',{key:'weekly-pinball-entry',roundId:status.roundId,pinballPhysics:2},settings);
  const attempt=started.player.gardenGames!['acorn-pinball']!.rounds[status.roundId]!.attempt!;
  vi.mocked(Date.now).mockReturnValue(weeklyEvent(Date.now()).endsAt);
  const reset=await readPlayer(env.DB,user);
  expect(reset.gardenGames).toBeUndefined();
  expect(gardenGameStatus('greenhouse-water',reset,Date.now(),settings)).toMatchObject({canStart:true,completed:0,tickets:0,free:true});
  await expect(finishGardenGame(env,user,'acorn-pinball',{key:'weekly-pinball-expired',roundId:status.roundId,attemptId:attempt.id,actions:[0],pinballPhysics:2})).rejects.toMatchObject({code:'EVENT_NOT_OPEN'});
 });
 it('starts the next rescue from stage one with a different animal',async()=>{
  const first=(await startAnimalExpedition(env,user,{key:'weekly-first-animal'})).player.animalExpedition!;
  vi.mocked(Date.now).mockReturnValue(now+21*86400000);
  const next=(await startAnimalExpedition(env,user,{key:'weekly-second-animal'})).player.animalExpedition!;
  expect(next.animal).not.toBe(first.animal);
  expect(next.roundId).not.toBe(first.roundId);
  expect(next.completedStages).toBe(0);
  expect(next.attempt!.stage).toBe(1);
  expect(next.pastRounds).toEqual([]);
 });
});

describe('operator-selected exclusive rescue rounds',()=>{
 it('keeps prior saved attempts and shares daily usage when the operator changes animals',async()=>{
  const settings=defaultOperationsRuntime(),panda=(await startAnimalExpedition(env,user,{key:'round-panda-first',roundId:('panda:'+weeklyRoundId('001',Date.now()))},settings)).player.animalExpedition!.attempt!;
  settings.gameEvents.animalExpedition.animal='fox';
  const fox=await startAnimalExpedition(env,user,{key:'round-fox-first',roundId:('fox:'+weeklyRoundId('001',Date.now()))},settings);
  expect(fox.player.animalExpedition).toMatchObject({roundId:('fox:'+weeklyRoundId('001',Date.now())),animal:'fox',completedStages:0,dailyAttempts:{used:2}});
  expect(expeditionRound(fox.player.animalExpedition,('panda:'+weeklyRoundId('001',Date.now())))?.attempt).toEqual(panda);
  settings.gameEvents.animalExpedition.endsAt=now;
  const resumed=await startAnimalExpedition(env,user,{key:'round-panda-resume',roundId:('panda:'+weeklyRoundId('001',Date.now()))},settings);
  expect(resumed.player.animalExpedition!.attempt).toEqual(panda);expect(resumed.player.animalExpedition!.dailyAttempts?.used).toBe(2);
  const done=await finishAnimalExpedition(env,user,{key:'round-panda-finish',attemptId:panda.id,actions:winningActions(1)});
  expect(done).toMatchObject({animal:'panda',roundId:('panda:'+weeklyRoundId('001',Date.now()))});expect(expeditionRound(done.player.animalExpedition,('fox:'+weeklyRoundId('001',Date.now())))?.attempt?.id).toBe(fox.player.animalExpedition!.attempt!.id);
  settings.gameEvents.animalExpedition.endsAt=null;settings.gameEvents.animalExpedition.animal='red-panda';
  const red=await startAnimalExpedition(env,user,{key:'round-red-first',roundId:('red-panda:'+weeklyRoundId('001',Date.now()))},settings);
  expect(red.player.animalExpedition!.dailyAttempts?.used).toBe(3);
  settings.gameEvents.animalExpedition.roundId='002';
  await expect(startAnimalExpedition(env,user,{key:'round-no-quota-reset',roundId:('red-panda:'+weeklyRoundId('002',Date.now()))},settings)).rejects.toMatchObject({code:'EXPEDITION_DAILY_LIMIT'});
  expect(expeditionRounds((await readPlayer(env.DB,user)).animalExpedition)).toHaveLength(3);
 });
 it('finishes an archived final stage for its original animal, atomically and only once',async()=>{
  const settings=defaultOperationsRuntime();let player=(await startAnimalExpedition(env,user,{key:'round-pinned-panda',roundId:('panda:'+weeklyRoundId('001',Date.now()))},settings)).player;
  const final={id:'panda-final-archived',stage:10,startedAt:now,variant:0,level:animalExpeditionLevel(10)};
  player.animalExpedition!.completedStages=9;player.animalExpedition!.attempt=final;store(player);
  settings.gameEvents.animalExpedition.animal='fox';await startAnimalExpedition(env,user,{key:'round-pinned-fox',roundId:('fox:'+weeklyRoundId('001',Date.now()))},settings);
  const results=await Promise.all(['pinned-claim-one','pinned-claim-two'].map(key=>finishAnimalExpedition(env,user,{key,attemptId:final.id,actions:winningActions(10)})));
  expect(results.filter(result=>result.granted)).toHaveLength(1);
  player=await readPlayer(env.DB,user);expect(player.animalExpedition!.roundId).toBe(('fox:'+weeklyRoundId('001',Date.now())));expect(expeditionRound(player.animalExpedition,('panda:'+weeklyRoundId('001',Date.now())))?.completedStages).toBe(10);
  const world=JSON.parse((db.prepare('SELECT data FROM garden_worlds WHERE user_id=?').get(user) as {data:string}).data);
  expect(world.owned[('expedition-friend:panda:'+weeklyRoundId('001',Date.now()))]).toMatchObject({itemId:'animal-panda',source:'event'});expect(Object.values(world.owned).filter((v:any)=>v.itemId==='animal-fox')).toHaveLength(0);
 });
 it('gives all three exclusive animals and keeps previous invitations across distinct operator rounds',async()=>{
  for(const [i,animal]of (['panda','fox','red-panda'] as const).entries()){
   vi.mocked(Date.now).mockReturnValue(now+i*86400000);const settings=defaultOperationsRuntime();settings.gameEvents.animalExpedition.animal=animal;
   let player=(await startAnimalExpedition(env,user,{key:'exclusive-'+animal,roundId:animal+':'+weeklyRoundId('001',Date.now())},settings)).player;
   const attempt={id:'exclusive-final-'+animal,stage:10,startedAt:Date.now(),level:animalExpeditionLevel(10)};player.animalExpedition!.completedStages=9;player.animalExpedition!.attempt=attempt;store(player);
   await finishAnimalExpedition(env,user,{key:'exclusive-win-'+animal,attemptId:attempt.id,actions:winningActions(10)});
  }
  const player=await readPlayer(env.DB,user),world=JSON.parse((db.prepare('SELECT data FROM garden_worlds WHERE user_id=?').get(user) as {data:string}).data);
  expect(expeditionRounds(player.animalExpedition).map(r=>r.completedStages)).toEqual([10,10,10]);
  for(const animal of ['panda','fox','red-panda'] as const)expect(world.owned['expedition-friend:'+animal+':'+weeklyRoundId('001',Date.now())]).toMatchObject({itemId:EXPEDITION_ANIMALS[animal].itemId,source:'event'});
 });
 it('rejects a fabricated round, defaults older operator settings to panda, and preserves legacy dog identity',async()=>{
  await expect(startAnimalExpedition(env,user,{key:'fabricated-round',roundId:'fox:hacked'})).rejects.toMatchObject({code:'EXPEDITION_CHANGED'});
  const settings=defaultOperationsRuntime();delete (settings.gameEvents.animalExpedition as Partial<typeof settings.gameEvents.animalExpedition>).animal;delete (settings.gameEvents.animalExpedition as Partial<typeof settings.gameEvents.animalExpedition>).roundId;
  expect(configuredExpeditionRound(parseRuntime(JSON.stringify(settings)))).toEqual({roundId:('panda:'+weeklyRoundId('001',Date.now())),animal:'panda'});
  const player=await readPlayer(env.DB,user);player.animalExpedition={completedStages:9,completedAttempts:[],attempt:{id:'legacy-dog-final',stage:10,startedAt:now,level:animalExpeditionLevel(10)}};store(player);
  const result=await finishAnimalExpedition(env,user,{key:'legacy-dog-final-reward',attemptId:'legacy-dog-final',actions:winningActions(10)});expect(result).toMatchObject({animal:'dog'});
  const world=JSON.parse((db.prepare('SELECT data FROM garden_worlds WHERE user_id=?').get(user) as {data:string}).data);expect(world.owned[ANIMAL_EXPEDITION_DOG_GRANT_ID].itemId).toBe('animal-dog');
 });
 it('only substitutes art for old apps on the wire, without modifying exclusive ownership',()=>{
  const world=applyTrustedDecorationGrant(createGardenWorld(user),{ownerId:user,grantId:'panda-invitation',itemId:'animal-panda',source:'event',variant:'classic',instanceIds:['panda-invitation']});
  const data={world};expect((compatibleGardenArt(data,true) as typeof data).world.owned['panda-invitation']!.itemId).toBe('animal-dog');expect(compatibleGardenArt(data,true,true)).toBe(data);expect(world.owned['panda-invitation']!.itemId).toBe('animal-panda');
 });
});

it('rejects purchase of all exclusive animal IDs on the real API without spending coins',async()=>{
 for(const itemId of ['animal-panda','animal-fox','animal-red-panda'])await expect(buyDecoration(env,user,{key:'cannot-buy-'+itemId,itemId})).rejects.toMatchObject({code:'ITEM_NOT_FOR_SALE'});
 expect((await readPlayer(env.DB,user)).coins).toBe(500);
});
