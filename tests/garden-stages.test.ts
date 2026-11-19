import {describe,it,expect} from 'vitest';
import {BEEHIVE_ENGINE_VERSION,GARDEN_STAGE_ENGINE_VERSION,OPEN_GARDEN_STAGE_ENGINE_VERSION,SUPPORTED_ENGINE_VERSIONS,type Action,type GameEvent} from '@garden/contracts';
import {getLevel,gardenStageKind,APPROVED_LEVEL_COUNT} from '@garden/content';
import {applyAction,createGame,legalActions,replay,stateHash,validateLevel} from '@garden/core';
import {advanceGardenStage,connectedGardenCells} from '../packages/game-core/src/garden-stages';
import {gardenStageCandidate,GARDEN_STAGE_VARIANTS} from '../packages/content/src/garden-stage-candidates';
import recipes from '../packages/content/src/garden-stage-recipes.json';
import proofs from '../packages/content/src/garden-stage-proofs.json';
import openRecipes from '../packages/content/src/garden-stage-recipes-v2.json';
import openProofs from '../packages/content/src/garden-stage-proofs-v2.json';
import {gardenStageMotion} from '../apps/client/src/garden-stage-motion';
import {createRunGateway} from '../apps/client/src/run-gateway';
describe('occasional garden story stages',()=>{
 it('alternates water and animal stages every ten levels, with ordinary puzzles between them',()=>{
  for(let id=1;id<=APPROVED_LEVEL_COUNT;id++)expect(gardenStageKind(id)).toBe(id%10?null:id%20===10?'water':'animal');
  for(const id of [1,9,11,19,21,201]){
   const old=getLevel(id,BEEHIVE_ENGINE_VERSION),current=getLevel(id,GARDEN_STAGE_ENGINE_VERSION);
   expect(current.gardenStage).toBeUndefined();expect({...current,engineVersion:old.engineVersion}).toEqual(old);
  }
 });
 it('retains all published pre-stage rules and enforces the publication boundary',()=>{
  for(const version of ['1.0.0','1.1.0','1.2.0','1.3.0','1.4.0','1.5.0'])for(const id of [10,20,30,40])expect(getLevel(id,version).gardenStage).toBeUndefined();
  expect(()=>getLevel(APPROVED_LEVEL_COUNT+1,GARDEN_STAGE_ENGINE_VERSION)).toThrow();
 });
 it('replays every certified variant to a win without paid tools or forced shuffles',()=>{
  expect(recipes).toHaveLength(GARDEN_STAGE_VARIANTS*2);expect(proofs).toHaveLength(recipes.length);
  for(const recipe of recipes){
   const proof=proofs.find(p=>p.kind===recipe.kind&&p.variant===recipe.variant)!,level={...gardenStageCandidate(recipe.kind as 'water'|'animal',recipe.variant),moves:recipe.moves,seed:recipe.seed};
   expect(validateLevel(level)).toEqual([]);const result=replay(level,proof.actions as Action[]);
   expect(result.accepted).toBe(true);expect(result.state.status).toBe('won');expect(stateHash(result.state)).toBe(recipe.hash);expect(result.events.some(e=>e.type==='shuffle')).toBe(false);
   const id=(recipe.kind==='water'?10:20)+recipe.variant*20,live=getLevel(id,GARDEN_STAGE_ENGINE_VERSION);
   expect(replay(live,proof.actions as Action[]).state.status).toBe('won');
  }
 });
 it('keeps mud on the floor, clears only hit gates, and does not reclose it when pieces refill',()=>{
  const state=createGame(getLevel(10,GARDEN_STAGE_ENGINE_VERSION)),before=stateHash(state),stage=state.gardenStage!,gate=stage.blocked[0]!,unrelated=state.cells.findIndex((c,i)=>c.tile&&!stage.channels.includes(i)),next=structuredClone(state);
  advanceGardenStage(next,[{type:'remove',kind:'berry',cells:[unrelated]}]);expect(next).toEqual(state);
  const events:GameEvent[]=[{type:'remove',kind:'berry',cells:[gate]},{type:'spawn',kind:'normal',cells:[gate]}];advanceGardenStage(next,events);
  expect(next.gardenStage!.blocked).not.toContain(gate);expect(next.gardenStage!.connected).toContain(gate);expect(stateHash(state)).toBe(before);
  const open=structuredClone(next.gardenStage);advanceGardenStage(next,[{type:'spawn',kind:'normal',cells:[gate]}]);expect(next.gardenStage).toEqual(open);
 });
 it('requires a connected source route and never awards a disconnected flower',()=>{
  const state=createGame(getLevel(50,GARDEN_STAGE_ENGINE_VERSION)),stage=state.gardenStage!,last=stage.blocked.at(-1)!;
  advanceGardenStage(state,[{type:'remove',cells:[last]}]);expect(stage.connected).toEqual([stage.source]);expect(stage.completed).toEqual([]);
  advanceGardenStage(state,[{type:'remove',cells:[...stage.blocked]}]);expect(stage.completed).toEqual(stage.destinations);expect(state.goals[0]!.remaining).toBe(0);
 });
 it('walks the animal along contiguous open path cells and serializes progress for resume',()=>{
  const state=createGame(getLevel(20,GARDEN_STAGE_ENGINE_VERSION)),events:GameEvent[]=[{type:'remove',cells:[...state.gardenStage!.blocked]}];advanceGardenStage(state,events);
  const move=events.find(e=>e.kind==='garden-route')!;
  expect(move.cells[0]).toBe(state.gardenStage!.source);expect(move.to).toBe(state.gardenStage!.destinations[0]);
  for(let i=1;i<move.cells.length;i++)expect(Math.abs(move.cells[i]!%9-move.cells[i-1]!%9)+Math.abs(Math.floor(move.cells[i]!/9)-Math.floor(move.cells[i-1]!/9))).toBe(1);
  expect(stateHash(JSON.parse(JSON.stringify(state)))).toBe(stateHash(state));
 });
 it('keeps invalid exchanges free and allows existing specials and tools to open floor gates',()=>{
  const state=createGame(getLevel(10,GARDEN_STAGE_ENGINE_VERSION)),hash=stateHash(state),bad=applyAction(state,{type:'swap',from:0,to:80});expect(bad.accepted).toBe(false);expect(stateHash(bad.state)).toBe(hash);
  const cleared=applyAction(state,{type:'booster',item:'world-bomb'});expect(cleared.state.status).toBe('won');expect(cleared.state.gardenStage!.blocked).toEqual([]);expect(cleared.state.moves).toBe(state.moves);
  const first=applyAction(state,legalActions(state)[0]!);expect(first.state.status).not.toBe('error');
 });
 it('rejects foreign versions, broken routes and mismatched flower targets',()=>{
  const level=getLevel(10,GARDEN_STAGE_ENGINE_VERSION);expect(validateLevel({...level,engineVersion:'1.5.0'})).toContain('GARDEN_STAGE_ENGINE');
  expect(validateLevel({...level,gardenStage:{...level.gardenStage!,gates:[1000]}})).toContain('GARDEN_STAGE_SHAPE');
  expect(validateLevel({...level,goals:[{kind:'garden-water',count:9,remaining:9}]})).toContain('GARDEN_STAGE_GOAL');
  expect(connectedGardenCells(level.gardenStage!,[],9)).toHaveLength(level.gardenStage!.channels.length);
 });
 it('holds completion through water flow and walking, with a bounded reduced-motion path',()=>{
  const events:GameEvent[]=[{type:'mechanic',kind:'garden-water',cells:[1,2,3,4,5]}],normal=gardenStageMotion(events,700);
  expect(normal.delay).toBe(800);expect(normal.end).toBeGreaterThan(normal.delay+normal.duration);expect(normal.end).toBeLessThan(3000);
  expect(gardenStageMotion(events,700,true).end).toBe(110);expect(gardenStageMotion([],700).end).toBe(0);
 });
 it('downloads the exact stage definition and negotiates older clients independently',async()=>{
  const level=getLevel(10,OPEN_GARDEN_STAGE_ENGINE_VERSION),digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(level))),levelHash=Array.from(new Uint8Array(digest),n=>n.toString(16).padStart(2,'0')).join('');
  const gateway=createRunGateway(async<T>(path:string)=>(path==='/health'?{ok:true,engineVersion:'1.3.0',supportedEngineVersions:SUPPORTED_ENGINE_VERSIONS}:{schemaVersion:1,contentVersion:level.version,level,levelHash}) as T,[OPEN_GARDEN_STAGE_ENGINE_VERSION]);
  expect((await gateway.preview(10)).level).toEqual(level);
  const older=createRunGateway(async<T>()=>({ok:true,engineVersion:'1.5.0',supportedEngineVersions:SUPPORTED_ENGINE_VERSIONS}) as T,['1.5.0']);expect(await older.resolveEngine()).toBe('1.5.0');
 });
});
describe('visible open garden floor rules',()=>{
 it('certifies all 24 new boards while retaining the v1.6 recipes unchanged',()=>{
  expect(openRecipes).toHaveLength(24);expect(openProofs).toHaveLength(24);
  for(const recipe of openRecipes){
   const id=(recipe.kind==='water'?10:20)+recipe.variant*20,level=getLevel(id,OPEN_GARDEN_STAGE_ENGINE_VERSION),proof=openProofs.find(p=>p.kind===recipe.kind&&p.variant===recipe.variant)!;
   const result=replay(level,proof.actions as Action[]);expect(result.accepted).toBe(true);expect(result.state.status).toBe('won');
   const certified={...gardenStageCandidate(recipe.kind as 'water'|'animal',recipe.variant,OPEN_GARDEN_STAGE_ENGINE_VERSION),seed:recipe.seed,moves:recipe.moves};
   expect(stateHash(replay(certified,proof.actions as Action[]).state)).toBe(recipe.hash);
   for(const at of result.state.gardenStage!.connected)expect(result.state.cells[at]!.tile).toBeNull();
  }
 });
 it('keeps every opened cell empty through subsequent matches and refills',()=>{
  let state=createGame(getLevel(60,OPEN_GARDEN_STAGE_ENGINE_VERSION));
  for(const action of openProofs.find(p=>p.kind==='animal'&&p.variant===2)!.actions as Action[]){
   const result=applyAction(state,action);expect(result.accepted).toBe(true);state=result.state;
   for(const at of state.gardenStage!.connected)expect(state.cells[at]!.tile).toBeNull();
  }
  expect(state.status).toBe('won');
 });
 it('does not complete a disconnected route and exposes gate removals as progress',()=>{
  const state=createGame(getLevel(50,OPEN_GARDEN_STAGE_ENGINE_VERSION)),last=state.gardenStage!.blocked.at(-1)!,events:GameEvent[]=[{type:'remove',cells:[last]}];
  advanceGardenStage(state,events);expect(state.goals[0]!.remaining).toBeGreaterThan(0);expect(state.gardenStage!.completed).toHaveLength(0);expect(events.some(e=>e.kind==='garden-gate')).toBe(true);
 });
});
