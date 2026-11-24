import {describe,it,expect} from 'vitest';
import {ENGINE_VERSION,GARDEN_CIRCUIT_ENGINE_VERSION,GARDEN_FRONTIER_ENGINE_VERSION,SUPPORTED_ENGINE_VERSIONS,type Action,type GameState} from '@garden/contracts';
import {createGame,applyAction,actionWithFrames,legalActions,replay,validateLevel,stateHash} from '@garden/core';
import {gardenCircuitCandidate,gardenCircuitProfiles,circuitProfileKey} from '../packages/content/src/garden-circuit';
import {CIRCUIT_BEATS} from '../packages/contracts/src/garden-circuit';
import {publishedLevel,engineRequest} from '../apps/api/src/level-content';
import {unsuppliedTileCells} from '../packages/content/src/refill-corridors';
import {effectTiming} from '../apps/client/src/visual-timing';
import {impactOverlays} from '../apps/client/src/impact-overlays';
import recipes from '../packages/content/src/garden-circuit-recipes.json';
import proofs from '../packages/content/src/garden-circuit-proofs.json';
const board=(kind:'rail'|'boomerang'|'crystal',intro=true,tier=0,mirror=false)=>{const p={kind,intro,tier,mirror};return gardenCircuitCandidate(p,(recipes as Record<string,number[]>)[circuitProfileKey(p)]![0]!,ENGINE_VERSION);};
function hammer(state:GameState,at:number){const action={type:'booster',item:'hammer',at} as const,result=actionWithFrames(state,action);expect(result.accepted).toBe(true);expect(result.state).toEqual(applyAction(state,action).state);return result;}
describe('moving obstacles, returning boomerangs and linked crystals',()=>{
 it('introduces new rules at 1601, 1701 and 1801, retaining every earlier introduction',()=>{
  for(const [id,kind]of [[1601,'rail'],[1701,'boomerang'],[1801,'crystal']] as const){const level=publishedLevel(id,ENGINE_VERSION);expect(level.circuit?.kind).toBe(kind);expect(validateLevel(level)).toEqual([]);expect(publishedLevel(id,GARDEN_FRONTIER_ENGINE_VERSION).circuit).toBeUndefined();}
  for(const [id,kind]of [[1301,'shelf'],[1401,'shade'],[1501,'expedition']] as const)expect(publishedLevel(id,ENGINE_VERSION).frontier?.kind).toBe(kind);
  expect(engineRequest({engineVersion:ENGINE_VERSION,supportedEngineVersions:[...SUPPORTED_ENGINE_VERSIONS]}).engineVersion).toBe(ENGINE_VERSION);
 });
 it('keeps 24 to 32 individual targets dense on one side and never hides colored tiles under them',()=>{
  for(const p of gardenCircuitProfiles()){
   const saved=(recipes as Record<string,number[]>)[circuitProfileKey(p)]!,level=gardenCircuitCandidate(p,saved[0]!,ENGINE_VERSION),state=createGame(level);
   expect(validateLevel(level),circuitProfileKey(p)).toEqual([]);expect(unsuppliedTileCells(level)).toEqual([]);expect([24,32]).toContain(level.goals[0]!.count);
   for(const o of level.obstacles)expect(state.cells[o.anchor]!.tile).toBeNull();
   expect(legalActions(state).length).toBeGreaterThanOrEqual(3);
  }
 });
 it('moves surviving pots by one carrier after a player move, preserving their IDs and layers',()=>{
  const before=createGame(board('rail',false)),action=legalActions(before).find(a=>a.type==='swap'&&before.cells[a.from]?.tile?.kind==='normal'&&before.cells[a.to]?.tile?.kind==='normal')!,result=applyAction(before,action);
  expect(result.accepted).toBe(true);const survivors=Object.values(result.state.obstacles);expect(survivors.length).toBeGreaterThan(0);
  for(const o of survivors){const old=before.obstacles[o.id]!,track=before.circuit!.tracks.find(t=>t.id===o.circuit!.track)!;expect(o.anchor).toBe(track.cells[(track.cells.indexOf(old.anchor)+1)%track.cells.length]);expect(o.hp).toBeGreaterThan(0);expect(result.state.cells[o.anchor]!.obstacleId).toBe(o.id);}
  const moves=result.events.filter(e=>e.kind==='rail-move');expect(moves).toHaveLength(survivors.length);expect(moves.every(e=>e.obstacleAfter?.id===e.obstacleId)).toBe(true);
 });
 it('keeps pots stationary for a hammer use, and does not refill empty carriers until their track is cleared',()=>{
  let state=createGame(board('rail')),track=state.circuit!.tracks[0]!;
  const first=hammer(state,track.cells[0]!);state=first.state;expect(first.events.some(e=>e.kind==='rail-move')).toBe(false);
  expect(state.siege!.bank).toContain(track.cells[0]);expect(state.cells[track.cells[0]!]!.tile).toBeNull();
  for(const at of track.cells.slice(1))if(state.cells[at]!.obstacleId)state=hammer(state,at).state;
  expect(track.cells.every(at=>!state.siege!.bank.includes(at)&&!!state.cells[at]!.tile)).toBe(true);
 });
 it('schedules rail travel after impacts and retains exact moving obstacle geometry',()=>{
  const before=createGame(board('rail',false)),action=legalActions(before)[0]!,result=actionWithFrames(before,action),timing=effectTiming(result.events,before,action),steps=impactOverlays(before,result.state,result.events,timing);
  const move=result.events.find(e=>e.kind==='rail-move')!;expect(move).toBeDefined();
  expect(steps.some(s=>s.kind==='obstacle'&&s.id===move.obstacleId&&s.value?.anchor===move.to&&s.delay>=timing.settleAt)).toBe(true);
 });
 it('releases one boomerang with three distinct live targets and an ordered return',()=>{
  const before=createGame(board('boomerang')),pod=Object.values(before.obstacles).find(o=>o.kind==='boomerang-pod')!,result=hammer(before,pod.anchor),flights=result.events.filter(e=>e.kind==='petal-boomerang-flight');
  expect(flights).toHaveLength(3);expect(new Set(flights.map(e=>e.to)).size).toBe(3);expect(result.state.goals[0]!.remaining).toBe(21);
  const timing=effectTiming(result.events,before,{type:'booster',item:'hammer',at:pod.anchor});
  for(const [i,e]of flights.entries()){
   const launch=timing.delays[result.events.indexOf(e)]!,hit=result.events.findIndex(h=>h.type==='hit'&&h.kind==='boomerang-bell'&&h.effectId===e.effectId),flight=i===0?CIRCUIT_BEATS.firstFlight:CIRCUIT_BEATS.nextFlight;
   expect(timing.delays[hit]).toBe(launch+flight);expect(timing.settleAt).toBeLessThan(timing.delays[hit]!);
   if(i>0)expect(e.from).toBe(flights[i-1]!.to);
  }
  const returned=result.events.findIndex(e=>e.kind==='petal-boomerang-return');expect(returned).toBeGreaterThan(0);expect(timing.circuitEnd).toBe(timing.delays[returned]!+CIRCUIT_BEATS.returnFlight);
 });
 it('never bypasses bells with direct powers and uses every salvo without dead-target waste',()=>{
  let state=createGame(board('boomerang'));const bell=Object.values(state.obstacles).find(o=>o.kind==='boomerang-bell')!;
  expect(applyAction(state,{type:'booster',item:'hammer',at:bell.anchor}).accepted).toBe(false);
  const pods=Object.values(state.obstacles).filter(o=>o.kind==='boomerang-pod');
  for(const pod of pods){const r=hammer(state,pod.anchor);expect(r.events.filter(e=>e.kind==='petal-boomerang-flight')).toHaveLength(3);expect(r.events.filter(e=>e.type==='hit'&&e.kind==='boomerang-bell')).toHaveLength(3);state=r.state;}
  expect(state.status).toBe('won');expect(state.goals[0]!.remaining).toBe(0);
 });
 it('breaks only the connected crystal group after a member is fully destroyed',()=>{
  let state=createGame(board('crystal',false,1)),group=state.circuit!.groups[0]!,target=group.cells[0]!;
  const first=hammer(state,target);expect(first.events.some(e=>e.kind==='crystal-chain')).toBe(false);state=first.state;
  const before=state,broken=hammer(state,target),chain=broken.events.find(e=>e.kind==='crystal-chain'&&e.type==='mechanic')!;
  expect(chain.cells).toHaveLength(3);expect(broken.state.goals[0]!.remaining).toBe(28);expect(group.cells.every(at=>!broken.state.cells[at]!.obstacleId)).toBe(true);
  expect(Object.values(broken.state.obstacles).filter(o=>o.circuit?.group!==group.id)).toHaveLength(28);
  const timing=effectTiming(broken.events,before,{type:'booster',item:'hammer',at:target});
  for(const e of broken.events.filter(e=>e.type==='hit'&&e.kind==='linked-crystal'&&e.effectId===chain.effectId))expect(timing.delays[broken.events.indexOf(e)]).toBeGreaterThan(timing.delays[broken.events.indexOf(chain)]!);
 });
 it('does not recursively double-count groups in a board-wide blast',()=>{
  const state=createGame(board('crystal')),result=applyAction(state,{type:'booster',item:'world-bomb'});expect(result.accepted).toBe(true);expect(result.state.status).toBe('won');expect(result.state.goals[0]!.remaining).toBe(0);
  expect(result.events.filter(e=>e.type==='hit'&&e.kind==='linked-crystal')).toHaveLength(24);
 });
 it('rejects broken rail loops, overlapping groups, insufficient salvos and unsupported engines',()=>{
  const rail=board('rail');rail.circuit!.tracks[0]!.cells[1]=40;expect(validateLevel(rail)).toContain('CIRCUIT_TRACK');
  const boom=board('boomerang');boom.obstacles=boom.obstacles.filter(o=>o.id!==boom.obstacles.find(o=>o.kind==='boomerang-pod')!.id);expect(validateLevel(boom)).toContain('CIRCUIT_AMMUNITION');
  const crystal=board('crystal');crystal.circuit!.groups[1]!.cells[0]=crystal.circuit!.groups[0]!.cells[0]!;expect(validateLevel(crystal)).toContain('CIRCUIT_GROUP');
  expect(validateLevel({...board('rail'),engineVersion:GARDEN_FRONTIER_ENGINE_VERSION})).toContain('CIRCUIT_ENGINE');
 });
 // Stored certification logs retain the 1.34 rules; current-engine behavior is checked above.
 it('preserves JSON resume and replays every certified profile without purchased boosters',()=>{
  for(const p of gardenCircuitProfiles()){
   const proof=(proofs as Record<string,{seed:number;actions:Action[]}>)[circuitProfileKey(p)]!,level=gardenCircuitCandidate(p,proof.seed,GARDEN_CIRCUIT_ENGINE_VERSION),result=replay(level,proof.actions);
   expect(proof.actions.every(a=>a.type==='swap'||a.type==='tap')).toBe(true);expect(result.accepted,circuitProfileKey(p)).toBe(true);expect(result.state.status,circuitProfileKey(p)).toBe('won');expect(result.events.some(e=>e.type==='shuffle')).toBe(false);
   const state=createGame(level),action=proof.actions[0]!;expect(stateHash(applyAction(state,action).state)).toBe(stateHash(applyAction(JSON.parse(JSON.stringify(state)),action).state));
  }
 });
});
