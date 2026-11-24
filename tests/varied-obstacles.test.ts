import {describe,it,expect} from 'vitest';
import {COLORS,ENGINE_VERSION,CONTINUOUS_REFILL_ENGINE_VERSION,type LevelDefinition,type Obstacle,type GameState} from '@garden/contracts';
import {applyAction,actionWithFrames,createGame,validateLevel,replay} from '@garden/core';
import {effectTiming,WIND_SEED_FLIGHT} from '../apps/client/src/visual-timing';
import {impactOverlays} from '../apps/client/src/impact-overlays';
import {variedObstacleArt,isVariedObstacle} from '../packages/contracts/src/varied-obstacles';
import {variedCampaignCandidate,variedProfiles,variedProfileKey} from '../packages/content/src/varied-campaign';
import {publishedLevel} from '../apps/api/src/level-content';
import {unsuppliedTileCells} from '../packages/content/src/refill-corridors';
import recipes from '../packages/content/src/varied-campaign-recipes.json';

const piece=(kind:Obstacle['kind'],at:number,hp=1,extra:Partial<Obstacle>={}):Obstacle=>({id:`o-${at}`,kind,anchor:at,footprint:[at],hp,maxHp:hp,...extra});
const board=(obstacles:Obstacle[],kind:Obstacle['kind'],count=1):LevelDefinition=>({id:501,version:'test',engineVersion:ENGINE_VERSION,width:7,height:7,
 colors:[...COLORS.slice(0,5)],shape:Array<boolean>(49).fill(true),seed:374921,moves:40,difficulty:'normal',obstacles,goals:[{kind,count,remaining:count}]});
function hammer(state:GameState,at:number){
 const action={type:'booster' as const,item:'hammer' as const,at},authoritative=applyAction(state,action),presented=actionWithFrames(state,action);
 expect(presented.accepted).toBe(true);expect(presented.state).toEqual(authoritative.state);expect(presented.events).toEqual(authoritative.events);return presented;
}
describe('original varied garden obstacles',()=>{
 it('fires on every launcher hit and breaks the remote gate only after all linked ammunition arrives',()=>{
  const level=board([piece('sun-gate',33,6,{footprint:[33,34,40,41]}),piece('petal-launcher',0,3,{link:'o-33'}),piece('petal-launcher',6,3,{link:'o-33'})],'sun-gate');
  expect(validateLevel(level)).toEqual([]);let state=createGame(level);
  for(const [index,at] of [0,6,0,6,0,6].entries()){
   const before=state,result=hammer(before,at);state=result.state;
   const launch=result.events.findIndex(e=>e.kind==='petal-disc-flight'),hit=result.events.findIndex(e=>e.kind==='sun-gate'&&e.type==='hit');
   expect(launch).toBeGreaterThanOrEqual(0);expect(hit).toBeGreaterThan(launch);
   const timing=effectTiming(result.events,before,{type:'booster',item:'hammer',at});
   expect(timing.delays[hit]).toBe(timing.delays[launch]!+WIND_SEED_FLIGHT);
   const steps=impactOverlays(before,state,result.events,timing);
   expect(steps.some(s=>s.kind==='obstacle'&&s.id==='o-33'&&s.delay===timing.delays[hit])).toBe(true);
   expect(state.obstacles['o-33']?.hp??0).toBe(5-index);
   expect(state.goals[0]!.remaining).toBe(index===5?0:1);
   if(index<4)expect(state.obstacles[`o-${at}`]).toBeDefined();
  }
  expect(state.status).toBe('won');
 });
 it('cannot bypass a sun gate with hammer, rockets, bees or dragonflies',()=>{
  const level=board([piece('sun-gate',33,2,{footprint:[33,34,40,41]}),piece('petal-launcher',0,2,{link:'o-33'})],'sun-gate');
  const state=createGame(level);expect(applyAction(state,{type:'booster',item:'hammer',at:33}).accepted).toBe(false);
  for(const kind of ['wind-row','beehive','glider'] as const){
   const seeded=structuredClone(state);seeded.cells[35]!.tile={id:seeded.nextTileId++,kind};
   const result=applyAction(seeded,{type:'tap',at:35});expect(result.accepted).toBe(true);
   const gateHits=result.events.filter(e=>e.type==='hit'&&e.kind==='sun-gate');
   const flights=result.events.filter(e=>e.kind==='petal-disc-flight');expect(gateHits).toHaveLength(flights.length);
  }
 });
 it('rejects insufficient remote ammunition and forbids new obstacles in retained old rules',()=>{
  const level=board([piece('sun-gate',33,3,{footprint:[33,34,40,41]}),piece('petal-launcher',0,2,{link:'o-33'})],'sun-gate');
  expect(validateLevel(level)).toContain('WIND_LINK');
  expect(validateLevel({...board([piece('tea-caddy',10,3)],'tea-caddy'),engineVersion:CONTINUOUS_REFILL_ENGINE_VERSION})).toContain('BREAKABLE_ENGINE');
 });
 it('reveals a real inner crystal without prematurely completing the crystal goal',()=>{
  const state=createGame(board([piece('crystal-geode',24,1,{contents:{kind:'star-core',hp:2}})],'star-core'));
  const opened=hammer(state,24);expect(opened.state.obstacles['o-24']?.kind).toBe('star-core');expect(opened.state.goals[0]!.remaining).toBe(1);
  const cracked=hammer(opened.state,24),collected=hammer(cracked.state,24);
  expect(cracked.state.goals[0]!.remaining).toBe(1);expect(collected.state.status).toBe('won');
  expect(variedObstacleArt(cracked.state.obstacles['o-24']!)).toBe('obstacle-star-core-2');
 });
 it('releases usable bee and dragonfly power-ups from destroyed obstacles',()=>{
  for(const [kind,power] of [['acorn-nest','beehive'],['cloud-pillow','glider']] as const){
   const result=hammer(createGame(board([piece(kind,24),piece(kind,48,3)],kind,2)),24);
   expect(result.events.some(e=>e.type==='spawn'&&e.kind===power&&e.cells.includes(24))).toBe(true);
   expect(result.state.cells.some(c=>c.tile?.kind===power)).toBe(true);
  }
 });
 it('pulses through the eight surrounding cells without instantly cascading through the entire mushroom bank',()=>{
  const result=hammer(createGame(board([piece('mushroom-cluster',0),piece('mushroom-cluster',1),piece('mushroom-cluster',2)],'mushroom-cluster',3)),0);
  expect(result.events.filter(e=>e.kind==='mushroom-pulse'&&e.type==='mechanic')).toHaveLength(1);
  expect(result.state.obstacles['o-1']).toBeUndefined();expect(result.state.obstacles['o-2']).toBeDefined();
  const timing=effectTiming(result.events,createGame(board([piece('mushroom-cluster',0),piece('mushroom-cluster',1),piece('mushroom-cluster',2)],'mushroom-cluster',3)),{type:'booster',item:'hammer',at:0});
  const first=result.events.findIndex(e=>e.type==='hit'&&e.cells.includes(0));
  const pulse=result.events.findIndex(e=>e.type==='mechanic'&&e.kind==='mushroom-pulse');
  const second=result.events.findIndex(e=>e.type==='hit'&&e.cells.includes(1));
  expect(timing.delays[pulse]).toBeGreaterThan(timing.delays[first]!);
  expect(timing.delays[second]).toBe(timing.delays[pulse]);
 });
 it('publishes different 100 and 500 bands and keeps old-engine levels compatible',()=>{
  expect(publishedLevel(101,ENGINE_VERSION).obstacles.every(o=>o.kind==='tea-caddy')).toBe(true);
  expect(publishedLevel(501,ENGINE_VERSION).obstacles.some(o=>o.kind==='sun-gate')).toBe(true);
  for(const id of [101,201,301,401,501,601,701,1501,6001,12001,19999,20000]){
   const level=publishedLevel(id,ENGINE_VERSION);expect(validateLevel(level),String(id)).toEqual([]);
   expect(publishedLevel(id,CONTINUOUS_REFILL_ENGINE_VERSION).obstacles.some(o=>isVariedObstacle(o.kind))).toBe(false);
  }
 });
 it('retains a complete seed catalogue for every reachable density and layout',()=>{
  const saved:Record<string,number[]>=recipes;
  for(const profile of variedProfiles()){
   const recipe=saved[variedProfileKey(profile)]!;expect(recipe?.length).toBe(2);
   const level=variedCampaignCandidate(profile,recipe[0]!,ENGINE_VERSION);
   expect(validateLevel(level)).toEqual([]);expect(unsuppliedTileCells(level)).toEqual([]);
  }
 });
});
