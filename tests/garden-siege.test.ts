import {describe,it,expect} from 'vitest';
import {ENGINE_VERSION,GARDEN_CIRCUIT_ENGINE_VERSION,VARIED_OBSTACLE_ENGINE_VERSION,SUPPORTED_ENGINE_VERSIONS,type Action,type GameState} from '@garden/contracts';
import {applyAction,actionWithFrames,createGame,validateLevel,replay,legalActions} from '@garden/core';
import {gardenSiegeCandidate,gardenSiegeProfiles,siegeProfileKey} from '../packages/content/src/garden-siege';
import {engineRequest,publishedLevel} from '../apps/api/src/level-content';
import {unsuppliedTileCells} from '../packages/content/src/refill-corridors';
import {SIEGE_BEATS,gardenSiegeArt} from '../packages/contracts/src/garden-siege';
import {effectTiming} from '../apps/client/src/visual-timing';
import {impactOverlays} from '../apps/client/src/impact-overlays';
import recipes from '../packages/content/src/garden-siege-recipes.json';
import clearProofs from '../packages/content/src/garden-siege-proofs.json';

const level=(kind:'roller'|'beacon'|'bloom',tier=0,intro=false)=>{
 const profile={kind,tier,intro,mirror:false},recipe=(recipes as Record<string,number[]>)[siegeProfileKey(profile)]!;
 return gardenSiegeCandidate(profile,recipe[0]!,ENGINE_VERSION);
};
function hammer(state:GameState,at:number){
 const action={type:'booster',item:'hammer',at} as const,result=actionWithFrames(state,action);
 expect(result.accepted).toBe(true);expect(result.state).toEqual(applyAction(state,action).state);return result;
}
describe('dense garden siege boards',()=>{
 it('introduces the three distinct modes at 801, 901, 1001 and retains old client rules',()=>{
  for(const [id,kind]of [[801,'roller'],[901,'beacon'],[1001,'bloom']] as const){
   const board=publishedLevel(id,ENGINE_VERSION);
   expect(board.siege?.kind).toBe(kind);expect(board.goals).toHaveLength(1);expect(board.goals[0]!.count).toBe(24);
   expect(board.obstacles.filter(o=>o.kind===board.goals[0]!.kind)).toHaveLength(24);
   expect(validateLevel(board)).toEqual([]);expect(unsuppliedTileCells(board)).toEqual([]);
   expect(publishedLevel(id,VARIED_OBSTACLE_ENGINE_VERSION).siege).toBeUndefined();
  }
 });
 it('negotiates the complete current client version list without losing retained engines',()=>{
  const request=engineRequest({engineVersion:ENGINE_VERSION,supportedEngineVersions:[...SUPPORTED_ENGINE_VERSIONS]});
  expect(request.engineVersion).toBe(ENGINE_VERSION);expect(request.supportedEngineVersions).toContain(VARIED_OBSTACLE_ENGINE_VERSION);
 });
 it('separates two roller passes from the same machine even when both pins break in one blast',()=>{
  const before=createGame(level('roller'));
  for(const o of Object.values(before.obstacles))if(o.kind==='roller-pin')o.hp=1;
  const action={type:'booster',item:'sweep-column',at:8} as const,result=applyAction(before,action);
  expect(result.accepted).toBe(true);
  const rolls=result.events.map((e,i)=>({e,i})).filter(({e})=>e.kind==='roller-roll'&&e.from===12);
  expect(rolls).toHaveLength(2);
  const timing=effectTiming(result.events,before,action);
  expect(timing.delays[rolls[1]!.i]!-timing.delays[rolls[0]!.i]!).toBeGreaterThanOrEqual(SIEGE_BEATS.roll+80);
 });
 it('keeps all goals visible in a solid three by eight bank, without hidden refill tiles',()=>{
  for(const profile of gardenSiegeProfiles()){
   const recipe=(recipes as Record<string,number[]>)[siegeProfileKey(profile)]!,board=gardenSiegeCandidate(profile,recipe[0]!,ENGINE_VERSION),state=createGame(board);
   expect(validateLevel(board),siegeProfileKey(profile)).toEqual([]);expect(unsuppliedTileCells(board)).toEqual([]);
   const targets=board.obstacles.filter(o=>o.kind===board.goals[0]!.kind);
   const columns=new Set(targets.map(o=>o.anchor%9));expect(columns.size).toBe(3);
   for(let y=1;y<=8;y++)expect(targets.filter(o=>Math.floor(o.anchor/9)===y)).toHaveLength(3);
   for(const o of board.obstacles)for(const at of o.footprint)expect(state.cells[at]!.tile).toBeNull();
   expect(legalActions(state).length).toBeGreaterThanOrEqual(3);
  }
 });
 it('releases a real roller pass for each pin and breaks all six cells of that lane once',()=>{
  let state=createGame(level('roller'));
  const roller=Object.values(state.obstacles).find(o=>o.kind==='garden-roller')!;
  const pins=Object.values(state.obstacles).filter(o=>o.link===roller.id);
  for(const pin of pins){
   state=hammer(state,pin.anchor).state;
   const before=state,result=hammer(before,pin.anchor),timing=effectTiming(result.events,before,{type:'booster',item:'hammer',at:pin.anchor});
   const flight=result.events.findIndex(e=>e.kind==='roller-pin-flight'),roll=result.events.findIndex(e=>e.kind==='roller-roll');
   expect(timing.delays[roll]).toBe(timing.delays[flight]!+SIEGE_BEATS.collect);
   const targets=result.events.filter(e=>e.type==='hit'&&e.kind==='thorn-barricade'&&e.effectId===result.events[roll]!.effectId);
   expect(targets).toHaveLength(6);
   for(const e of targets)expect(timing.delays[result.events.indexOf(e)]).toBeGreaterThan(timing.delays[roll]!);
   const overlays=impactOverlays(before,result.state,result.events,timing);
   expect(overlays.some(s=>s.kind==='obstacle'&&s.id===roller.id&&s.value===null&&s.delay===timing.delays[roll])).toBe(true);
   state=result.state;
  }
  expect(state.obstacles[roller.id]).toBeUndefined();
  for(const at of roller.path!)expect(state.cells[at]!.tile).toBeNull();
  expect(state.goals[0]!.remaining).toBe(18);
 });
 it('requires all four visible dew sockets before the beacon can be attacked, then pulses the whole bank',()=>{
  let state=createGame(level('beacon',0,true));
  const beacon=Object.values(state.obstacles).find(o=>o.kind==='garden-beacon')!;
  const target=Object.values(state.obstacles).find(o=>o.kind==='thorn-barricade')!;
  expect(applyAction(state,{type:'booster',item:'hammer',at:beacon.anchor}).accepted).toBe(false);
  expect(applyAction(state,{type:'booster',item:'hammer',at:target.anchor}).accepted).toBe(false);
  const sources=Object.values(state.obstacles).filter(o=>o.link===beacon.id);expect(sources).toHaveLength(4);
  for(const [index,source]of sources.entries()){
   const before=state,result=hammer(state,source.anchor),timing=effectTiming(result.events,before,{type:'booster',item:'hammer',at:source.anchor});
   const hit=result.events.findIndex(e=>e.type==='hit'&&e.kind==='dew-cache'),arrival=result.events.findIndex(e=>e.kind==='beacon-charge');
   expect(timing.delays[arrival]).toBe(timing.delays[hit]!+35+SIEGE_BEATS.collect);
   const overlay=impactOverlays(before,result.state,result.events,timing).find(s=>s.kind==='obstacle'&&s.id===beacon.id);
   expect(overlay?.delay).toBe(timing.delays[arrival]);
   state=result.state;expect(state.obstacles[beacon.id]!.charge).toBe(index+1);
  }
  const before=state,result=hammer(state,beacon.anchor),timing=effectTiming(result.events,before,{type:'booster',item:'hammer',at:beacon.anchor});
  const pulse=result.events.findIndex(e=>e.kind==='beacon-pulse'&&e.type==='mechanic');expect(pulse).toBeGreaterThan(0);
  const targets=result.events.filter(e=>e.type==='hit'&&e.kind==='thorn-barricade');expect(targets).toHaveLength(24);
  for(const event of targets)expect(timing.delays[result.events.indexOf(event)]).toBeGreaterThan(timing.delays[pulse]!);
  expect(Object.values(result.state.obstacles).filter(o=>o.kind==='thorn-barricade').every(o=>o.hp===2)).toBe(true);
  expect(result.state.goals[0]!.remaining).toBe(24);
 });
 it('unlocks exactly the next greenhouse bud, and refills cleared cells with real playable tiles',()=>{
  let state=createGame(level('bloom',0,true));
  let root=Object.values(state.obstacles).find(o=>o.kind==='bloom-bud'&&!o.siege?.shielded)!;
  const next=state.obstacles[root.link!]!;
  expect(applyAction(state,{type:'booster',item:'hammer',at:next.anchor}).accepted).toBe(false);
  for(let n=0;n<6;n++){
   const before=state,result=hammer(state,root.anchor);state=result.state;
   expect(state.goals[0]!.remaining).toBe(23-n);expect(state.cells[root.anchor]!.tile).not.toBeNull();
   if(root.link){
    const event=result.events.findIndex(e=>e.kind==='bloom-unlock');expect(event).toBeGreaterThan(0);
    const timing=effectTiming(result.events,before,{type:'booster',item:'hammer',at:root.anchor});
    const hit=result.events.findIndex(e=>e.kind==='bloom-bud'&&e.type==='hit');
    expect(timing.delays[event]).toBe(timing.delays[hit]!+35+SIEGE_BEATS.unlock);
    expect(state.obstacles[root.link]!.siege?.shielded).toBeUndefined();root=state.obstacles[root.link]!;
   }
  }
 });
 it('normal three-tile matches and all attack items can hit available pins, dew and buds',()=>{
  for(const kind of ['roller','beacon','bloom'] as const){
   const state=createGame(level(kind,0,true)),source=Object.values(state.obstacles).find(o=>o.kind===(kind==='roller'?'roller-pin':kind==='beacon'?'dew-cache':'bloom-bud')&&!o.siege?.shielded)!;
   let found=false;
   for(const action of legalActions(state)){
    if(action.type!=='swap'||state.cells[action.from]?.tile?.kind!=='normal'||state.cells[action.to]?.tile?.kind!=='normal')continue;
    const result=applyAction(state,action);if(result.events.some(e=>e.type==='hit'&&e.kind===source.kind))found=true;
   }
   expect(found,kind).toBe(true);
   for(const power of ['wind-row','glider','beehive','bomb','rainbow'] as const){
    const seeded=structuredClone(state),at=kind==='bloom'?12:7;seeded.cells[at]!.tile={id:seeded.nextTileId++,kind:power};
    const result=applyAction(seeded,{type:'tap',at});expect(result.accepted).toBe(true);
    if(power==='glider'||power==='beehive')expect(result.events.some(e=>e.type==='hit'&&e.kind===source.kind),kind+'/'+power).toBe(true);
   }
  }
 });
 it('rejects missing linked ammunition, charge sources, bank metadata and greenhouse cycles',()=>{
  for(const kind of ['roller','beacon'] as const){
   const board=level(kind),source=board.obstacles.find(o=>o.link)!;board.obstacles=board.obstacles.filter(o=>o.id!==source.id);
   expect(validateLevel(board)).toContain(kind==='roller'?'SIEGE_AMMUNITION':'SIEGE_CHARGE');
  }
  const board=level('bloom'),root=board.obstacles.find(o=>!o.siege?.shielded)!;board.obstacles.find(o=>o.link===undefined)!.link=root.id;
  expect(validateLevel(board)).toContain('SIEGE_CYCLE');
  const bank=level('roller');bank.siege!.bank=[];expect(validateLevel(bank)).toContain('SIEGE_BANK');
  expect(validateLevel({...level('roller'),engineVersion:VARIED_OBSTACLE_ENGINE_VERSION})).toContain('SIEGE_ENGINE');
 });
 // Stored certification logs retain the 1.34 rules; current-engine behavior is checked above.
 it('uses visibly different damage stages and retains every certified no-shuffle clear',()=>{
  for(const kind of ['thorn-barricade','roller-pin','dew-cache','bloom-bud'])expect(new Set([3,2,1].map(hp=>gardenSiegeArt({kind,hp,maxHp:3}))).size).toBe(3);
  const proof=clearProofs as Record<string,{seed:number;actions:Action[]}>;
  for(const profile of gardenSiegeProfiles()){
   const key=siegeProfileKey(profile),saved=proof[key]!;
   const board=gardenSiegeCandidate(profile,saved.seed,GARDEN_CIRCUIT_ENGINE_VERSION),result=replay(board,saved.actions);
   expect(result.accepted,key).toBe(true);expect(result.state.status,key).toBe('won');
   if(!profile.intro)expect(saved.actions.length).toBeGreaterThanOrEqual(profile.tier>=2?12:8);
  }
 });
});
