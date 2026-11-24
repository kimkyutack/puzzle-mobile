import {describe,it,expect} from 'vitest';
import {ENGINE_VERSION,GARDEN_CIRCUIT_ENGINE_VERSION,GARDEN_ASSAULT_ENGINE_VERSION,SUPPORTED_ENGINE_VERSIONS,type Action,type GameState} from '@garden/contracts';
import {actionWithFrames,applyAction,createGame,legalActions,replay,stateHash,validateLevel} from '@garden/core';
import {gardenFrontierCandidate,gardenFrontierProfiles,frontierProfileKey} from '../packages/content/src/garden-frontier';
import {FRONTIER_BEATS} from '../packages/contracts/src/garden-frontier';
import {unsuppliedTileCells} from '../packages/content/src/refill-corridors';
import {engineRequest,publishedLevel} from '../apps/api/src/level-content';
import {effectTiming} from '../apps/client/src/visual-timing';
import {impactOverlays} from '../apps/client/src/impact-overlays';
import recipes from '../packages/content/src/garden-frontier-recipes.json';
import proofs from '../packages/content/src/garden-frontier-proofs.json';
const board=(kind:'shelf'|'shade'|'expedition',intro=true,tier=0,mirror=false)=>{
 const p={kind,intro,tier,mirror},saved=(recipes as Record<string,number[]>)[frontierProfileKey(p)]!;return gardenFrontierCandidate(p,saved[0]!,ENGINE_VERSION);
};
function hammer(state:GameState,at:number){const action={type:'booster',item:'hammer',at} as const,result=actionWithFrames(state,action);expect(result.accepted).toBe(true);expect(result.state).toEqual(applyAction(state,action).state);return result;}
function enterInside(input:GameState){let state=input;const actions:Action[]=[];let last:ReturnType<typeof hammer>|undefined,before=state;
 while(state.journey?.stage===1){const target=Object.values(state.obstacles).find(o=>o.kind==='journey-vine')!;before=state;const action={type:'booster',item:'hammer',at:target.anchor} as const;actions.push(action);last=hammer(state,target.anchor);state=last.state;}
 return {state,actions,last:last!,before};
}
describe('dense shelves, awnings and a two-board journey',()=>{
 it('publishes three new introductions and keeps old rule versions isolated',()=>{
  for(const [id,kind]of [[1301,'shelf'],[1401,'shade'],[1501,'expedition']] as const){
   const level=publishedLevel(id,ENGINE_VERSION);expect(level.frontier?.kind).toBe(kind);expect(validateLevel(level)).toEqual([]);
   expect(publishedLevel(id,GARDEN_ASSAULT_ENGINE_VERSION).frontier).toBeUndefined();
  }
  for(const [id,kind]of [[801,'roller'],[901,'beacon'],[1001,'bloom'],[1101,'dandelion'],[1201,'pottery']] as const)expect(publishedLevel(id,ENGINE_VERSION).siege?.kind).toBe(kind);
  expect(engineRequest({engineVersion:ENGINE_VERSION,supportedEngineVersions:[...SUPPORTED_ENGINE_VERSIONS]}).engineVersion).toBe(ENGINE_VERSION);
 });
 it('packs a whole side with independent obstacles and validates both journey boards',()=>{
  for(const p of gardenFrontierProfiles()){
   const saved=(recipes as Record<string,number[]>)[frontierProfileKey(p)]!,level=gardenFrontierCandidate(p,saved[0]!,ENGINE_VERSION),state=createGame(level);
   expect(validateLevel(level),frontierProfileKey(p)).toEqual([]);expect(unsuppliedTileCells(level)).toEqual([]);
   for(const o of level.obstacles)for(const at of o.footprint)expect(state.cells[at]!.tile).toBeNull();
   expect(level.goals[0]!.count).toBe(p.kind==='shelf'?32:24);
   if(p.kind==='shelf')expect(level.frontier?.groups.every(g=>g.cells.length===8)).toBe(true);
   if(level.journey?.next){expect(level.journey.next.goals[0]!.count).toBe(32);expect(unsuppliedTileCells(level.journey.next)).toEqual([]);expect(legalActions(createGame(level.journey.next)).length).toBeGreaterThanOrEqual(3);}
  }
 });
 it('keeps an unfinished shelf bank empty and releases all eight slots only after the last vase',()=>{
  let state=createGame(board('shelf'));const group=state.frontier!.groups[0]!;
  const first=hammer(state,group.cells[0]!);state=first.state;
  expect(state.siege!.bank).toContain(group.cells[0]);expect(state.cells[group.cells[0]!]!.tile).toBeNull();
  expect(first.events.some(e=>e.kind==='shelf-collapse')).toBe(false);
  for(const at of group.cells.slice(1)){const id=state.cells[at]!.obstacleId;if(id)state=hammer(state,at).state;}
  expect(group.cells.every(at=>!state.siege!.bank.includes(at))).toBe(true);
  expect(group.cells.every(at=>!!state.cells[at]!.tile)).toBe(true);
  expect(state.goals[0]!.remaining).toBeLessThanOrEqual(24);
 });
 it('lets a broad blast finish multiple shelves and records one collapse per completed shelf',()=>{
  const state=createGame(board('shelf')),result=applyAction(state,{type:'booster',item:'world-bomb'});
  expect(result.accepted).toBe(true);expect(result.state.status).toBe('won');expect(result.state.siege!.bank).toEqual([]);
  expect(result.events.filter(e=>e.kind==='shelf-collapse')).toHaveLength(4);
 });
 it('keeps visible orchids protected until their own winch unrolls that row',()=>{
  const state=createGame(board('shade')),group=state.frontier!.groups[0]!,source=state.obstacles[group.source!]!;
  expect(applyAction(state,{type:'booster',item:'hammer',at:group.cells[0]}).accepted).toBe(false);
  const result=hammer(state,source.anchor),timing=effectTiming(result.events,state,{type:'booster',item:'hammer',at:source.anchor});
  const hit=result.events.findIndex(e=>e.kind==='awning-crank'&&e.type==='hit'),opened=result.events.findIndex(e=>e.kind==='canopy-open');
  expect(opened).toBeGreaterThan(hit);expect(timing.delays[opened]).toBe(timing.delays[hit]);
  const overlays=impactOverlays(state,result.state,result.events,timing);
  for(const at of group.cells){const o=result.state.obstacles[result.state.cells[at]!.obstacleId!]!;expect(o.frontier?.locked).toBeUndefined();expect(overlays.some(s=>s.kind==='obstacle'&&s.id===o.id&&s.delay===timing.delays[hit]!+FRONTIER_BEATS.unroll)).toBe(true);}
  const other=state.frontier!.groups[1]!;expect(other.cells.every(at=>result.state.obstacles[result.state.cells[at]!.obstacleId!]!.frontier?.locked)).toBe(true);
  const collected=hammer(result.state,group.cells[0]!);expect(collected.state.goals[0]!.remaining).toBeLessThan(result.state.goals[0]!.remaining);
 });
 it('allows normal triples and guided powers to operate a winch',()=>{
  const state=createGame(board('shade'));
  expect(legalActions(state).some(a=>a.type==='swap'&&state.cells[a.from]?.tile?.kind==='normal'&&state.cells[a.to]?.tile?.kind==='normal'&&applyAction(state,a).events.some(e=>e.type==='hit'&&e.kind==='awning-crank'))).toBe(true);
  for(const kind of ['glider','beehive','wind-row'] as const){const seeded=structuredClone(state);seeded.cells[16]!.tile={id:seeded.nextTileId++,kind};const result=applyAction(seeded,{type:'tap',at:16});expect(result.events.some(e=>e.type==='hit'&&e.kind==='awning-crank')).toBe(true);}
 });
 it('carries moves, turn and rainbow enhancement into the second board without an intermediate win',()=>{
  let state=createGame(board('expedition'));state.powerRainbow=true;
  state=applyAction(state,legalActions(state)[0]!).state;
  const entered=enterInside(state);
  expect(entered.state.journey?.stage).toBe(2);expect(entered.state.status).toBe('playing');
  expect(entered.state.moves).toBe(entered.before.moves);expect(entered.state.turn).toBe(entered.before.turn);expect(entered.state.powerRainbow).toBe(true);
  expect(entered.state.goals).toEqual([{kind:'journey-relic',count:32,remaining:32}]);
  expect(entered.last.events.some(e=>e.kind==='journey-transition')).toBe(true);expect(entered.last.events.some(e=>e.type==='win')).toBe(false);
  expect(entered.last.frames.some(f=>f.state.journey?.stage===1&&f.state.goals.every(g=>g.remaining===0))).toBe(true);
  expect(entered.last.frames.at(-1)!.state.journey?.stage).toBe(2);
  expect(Math.min(...entered.state.cells.flatMap(c=>c.tile?[c.tile.id]:[]))).toBeGreaterThan(entered.before.nextTileId);
 });
 it('fails at zero remaining moves on entry to area two, and continues in the same area',()=>{
  const minimal=board('expedition');minimal.obstacles=minimal.obstacles.slice(0,1);minimal.goals=[{kind:'journey-vine',count:1,remaining:1}];
  const initial=createGame(minimal);initial.moves=1;initial.cells[16]!.tile={id:initial.nextTileId++,kind:'wind-row'};
  const entered=applyAction(initial,{type:'tap',at:16});expect(entered.state.journey?.stage).toBe(2);expect(entered.state.status).toBe('lost');
  const resumed=applyAction(entered.state,{type:'continue',moves:5});expect(resumed.accepted).toBe(true);expect(resumed.state.moves).toBe(5);expect(resumed.state.journey?.stage).toBe(2);
 });
 it('wins only after the actual second-area relics are collected and survives JSON save/resume',()=>{
  const entered=enterInside(createGame(board('expedition')));let state=entered.state;
  const first=Object.values(state.obstacles)[0]!,action={type:'booster',item:'hammer',at:first.anchor} as const;
  expect(stateHash(applyAction(state,action).state)).toBe(stateHash(applyAction(JSON.parse(JSON.stringify(state)),action).state));
  let wins=0;while(state.status==='playing'){const target=Object.values(state.obstacles)[0]!;const result=hammer(state,target.anchor);wins+=result.events.filter(e=>e.type==='win').length;state=result.state;}
  expect(state.status).toBe('won');expect(state.goals[0]!.remaining).toBe(0);expect(wins).toBe(1);
 });
 it('rejects broken groups, hidden initial tiles and invalid journey nesting',()=>{
  const shelf=board('shelf');shelf.frontier!.groups[0]!.cells.pop();expect(validateLevel(shelf)).toContain('FRONTIER_GROUP');
  const shade=board('shade');shade.frontier!.groups[0]!.source='missing';expect(validateLevel(shade)).toContain('FRONTIER_SOURCE');
  const journey=board('expedition');journey.journey!.next!.journey={stage:1};expect(validateLevel(journey)).toContain('FRONTIER_JOURNEY');
  const unsupported={...board('shelf'),engineVersion:GARDEN_ASSAULT_ENGINE_VERSION};expect(validateLevel(unsupported)).toContain('FRONTIER_ENGINE');
 });
 // Stored certification logs retain the 1.34 rules; current-engine behavior is checked above.
 it('replays all authored profiles through their actual final board without boosters or reshuffles',()=>{
  for(const p of gardenFrontierProfiles()){
   const proof=(proofs as Record<string,{seed:number;actions:Action[]}>)[frontierProfileKey(p)]!,level=gardenFrontierCandidate(p,proof.seed,GARDEN_CIRCUIT_ENGINE_VERSION);
   expect(proof.actions.every(a=>a.type==='tap'||a.type==='swap')).toBe(true);
   const result=replay(level,proof.actions);expect(result.accepted,frontierProfileKey(p)).toBe(true);expect(result.state.status,frontierProfileKey(p)).toBe('won');expect(result.events.some(e=>e.type==='shuffle')).toBe(false);
   if(p.kind==='expedition')expect(result.state.journey?.stage).toBe(2);
  }
 });
});
