import {describe,it,expect} from 'vitest';
import {ENGINE_VERSION,GARDEN_CIRCUIT_ENGINE_VERSION,GARDEN_SIEGE_ENGINE_VERSION,SUPPORTED_ENGINE_VERSIONS,type Action,type GameState} from '@garden/contracts';
import {applyAction,actionWithFrames,createGame,legalActions,replay,validateLevel} from '@garden/core';
import {gardenAssaultCandidate,gardenAssaultProfiles,assaultProfileKey} from '../packages/content/src/garden-assault';
import {ASSAULT_BEATS} from '../packages/contracts/src/garden-assault';
import {gardenSiegeArt} from '../packages/contracts/src/garden-siege';
import {unsuppliedTileCells} from '../packages/content/src/refill-corridors';
import {engineRequest,publishedLevel} from '../apps/api/src/level-content';
import {effectTiming} from '../apps/client/src/visual-timing';
import {impactOverlays} from '../apps/client/src/impact-overlays';
import recipes from '../packages/content/src/garden-assault-recipes.json';
import proofs from '../packages/content/src/garden-assault-proofs.json';

const board=(kind:'dandelion'|'pottery',tier=0,intro=false,mirror=false)=>{
 const profile={kind,tier,intro,mirror},saved=(recipes as Record<string,number[]>)[assaultProfileKey(profile)]!;
 return gardenAssaultCandidate(profile,saved[0]!,ENGINE_VERSION);
};
function hammer(state:GameState,at:number){
 const action={type:'booster',item:'hammer',at} as const,result=actionWithFrames(state,action);
 expect(result.accepted).toBe(true);expect(result.state).toEqual(applyAction(state,action).state);
 return {...result,timing:effectTiming(result.events,state,action)};
}
describe('follow-up dense garden boards',()=>{
 it('introduces new rules at 1101 and 1201 while retaining the three earlier introductions and old clients',()=>{
  for(const [id,kind]of [[801,'roller'],[901,'beacon'],[1001,'bloom'],[1101,'dandelion'],[1201,'pottery']] as const){
   const level=publishedLevel(id,ENGINE_VERSION);expect(level.siege?.kind).toBe(kind);expect(validateLevel(level)).toEqual([]);
  }
  for(const id of [1101,1201,6005,12005,19995])expect(['dandelion','pottery']).not.toContain(publishedLevel(id,GARDEN_SIEGE_ENGINE_VERSION).siege?.kind);
  expect(engineRequest({engineVersion:ENGINE_VERSION,supportedEngineVersions:[...SUPPORTED_ENGINE_VERSIONS]}).engineVersion).toBe(ENGINE_VERSION);
 });
 it('fills a whole bank with 24 cocoons or eight covers containing 32 visible pots',()=>{
  for(const profile of gardenAssaultProfiles()){
   const saved=(recipes as Record<string,number[]>)[assaultProfileKey(profile)]!,level=gardenAssaultCandidate(profile,saved[0]!,ENGINE_VERSION),state=createGame(level);
   expect(validateLevel(level),assaultProfileKey(profile)).toEqual([]);expect(unsuppliedTileCells(level)).toEqual([]);
   if(profile.kind==='dandelion'){
    expect(level.obstacles.filter(o=>o.kind==='seed-cocoon')).toHaveLength(24);
    for(let y=1;y<=8;y++)expect(level.obstacles.filter(o=>o.kind==='seed-cocoon'&&Math.floor(o.anchor/9)===y)).toHaveLength(3);
   }else{
    expect(level.obstacles).toHaveLength(8);expect(level.obstacles.every(o=>o.contents?.kind==='ceramic-pot'&&o.footprint.length===4)).toBe(true);
    expect(level.goals[0]!.count).toBe(32);
   }
   for(const o of level.obstacles)for(const at of o.footprint)expect(state.cells[at]!.tile).toBeNull();
  }
 });
 it('fires one seed on EVERY turret hit and chips its target only when the projectile arrives visually',()=>{
  let state=createGame(board('dandelion'));
  const turret=Object.values(state.obstacles).find(o=>o.kind==='dandelion-turret')!;
  for(let n=0;n<turret.maxHp;n++){
   const before=state,result=hammer(state,turret.anchor);state=result.state;
   const source=result.events.findIndex(e=>e.type==='hit'&&e.kind==='dandelion-turret'),flight=result.events.findIndex(e=>e.kind==='dandelion-seed-flight'),hit=result.events.findIndex(e=>e.type==='hit'&&e.kind==='seed-cocoon');
   expect(flight).toBeGreaterThan(source);expect(hit).toBeGreaterThan(flight);
   expect(result.timing.delays[flight]).toBeGreaterThan(result.timing.delays[source]!);
   expect(result.timing.delays[hit]).toBe(result.timing.delays[flight]!+ASSAULT_BEATS.seedFlight);
   expect(result.timing.settleAt).toBeLessThan(result.timing.delays[hit]!);
   const target=result.events[hit]!.obstacleId;
   expect(impactOverlays(before,state,result.events,result.timing).some(s=>s.kind==='obstacle'&&s.id===target&&s.delay===result.timing.delays[hit])).toBe(true);
   expect(state.obstacles[turret.id]?.hp??0).toBe(turret.maxHp-n-1);
  }
  expect(state.goals[0]!.remaining).toBe(22);
 });
 it('retargets simultaneous seeds to live cocoons instead of wasting a salvo on a destroyed cell',()=>{
  const before=createGame(board('dandelion',0,true)),action={type:'booster',item:'sweep-column',at:8} as const,result=applyAction(before,action);
  const flights=result.events.filter(e=>e.kind==='dandelion-seed-flight');expect(flights).toHaveLength(9);
  expect(new Set(flights.map(e=>e.to)).size).toBe(9);expect(result.state.goals[0]!.remaining).toBe(15);
  for(const at of before.siege!.bank)expect(result.state.cells[at]!.tile).toBeNull();
 });
 it('rejects direct hits on protected cocoons while normal triples, rockets, bees and gliders attack the turrets',()=>{
  const state=createGame(board('dandelion',0,true)),cocoon=Object.values(state.obstacles).find(o=>o.kind==='seed-cocoon')!;
  expect(applyAction(state,{type:'booster',item:'hammer',at:cocoon.anchor}).accepted).toBe(false);
  expect(legalActions(state).some(a=>a.type==='swap'&&state.cells[a.from]?.tile?.kind==='normal'&&state.cells[a.to]?.tile?.kind==='normal'&&applyAction(state,a).events.some(e=>e.type==='hit'&&e.kind==='dandelion-turret'))).toBe(true);
  for(const kind of ['wind-row','glider','beehive'] as const){
   const seeded=structuredClone(state);seeded.cells[7]!.tile={id:seeded.nextTileId++,kind};
   const result=applyAction(seeded,{type:'tap',at:7});expect(result.accepted).toBe(true);
   const fired=result.events.filter(e=>e.kind==='dandelion-seed-flight'),struck=result.events.filter(e=>e.kind==='seed-cocoon'&&e.type==='hit');
   expect(fired.length,kind).toBeGreaterThan(0);expect(struck).toHaveLength(fired.length);
  }
 });
 it('reveals four independently breakable pots without awarding the cover as a collected pot',()=>{
  const before=createGame(board('pottery',0,true)),nest=Object.values(before.obstacles)[0]!,opened=hammer(before,nest.anchor);
  expect(opened.state.obstacles[nest.id]).toBeUndefined();expect(opened.state.goals[0]!.remaining).toBe(32);
  const children=Object.values(opened.state.obstacles).filter(o=>o.id.startsWith(nest.id+'/'));
  expect(children).toHaveLength(4);expect(children.every(o=>o.kind==='ceramic-pot'&&o.hp===1)).toBe(true);
  const parentHit=opened.events.findIndex(e=>e.type==='hit'&&e.kind==='pottery-nest');
  for(const e of opened.events.filter(e=>e.kind==='crate-pieces-reveal'))expect(opened.timing.delays[opened.events.indexOf(e)]).toBe(opened.timing.delays[parentHit]!+ASSAULT_BEATS.reveal);
  const removed=hammer(opened.state,children[0]!.anchor);
  expect(removed.state.goals[0]!.remaining).toBe(31);expect(removed.state.cells[children[0]!.anchor]!.tile).not.toBeNull();
 });
 it('preserves newly revealed pots through the same blast that opened their cover',()=>{
  const before=createGame(board('pottery',0,true)),nest=Object.values(before.obstacles)[0]!,action={type:'booster',item:'world-bomb',at:40} as const,result=applyAction(before,action);
  expect(result.accepted).toBe(true);
  const parent=result.events.find(e=>e.type==='hit'&&e.kind==='pottery-nest'&&e.obstacleId===nest.id)!;
  const reveal=result.events.filter(e=>e.kind==='crate-pieces-reveal');expect(reveal).toHaveLength(32);
  // Later refilled matches may hit the new pots; the opening explosion may not.
  expect(result.events.some(e=>e.type==='hit'&&e.kind==='ceramic-pot'&&e.effectId===parent.effectId)).toBe(false);
 });
 it('validates source ammunition, bank geometry, child counts and version compatibility',()=>{
  const level=board('dandelion');level.obstacles.find(o=>o.kind==='dandelion-turret')!.hp--;
  expect(validateLevel(level)).toContain('ASSAULT_AMMUNITION');
  const bank=board('dandelion');bank.siege!.bank.pop();expect(validateLevel(bank)).toContain('ASSAULT_BANK');
  const pottery=board('pottery');pottery.obstacles[0]!.contents!.hp=4;expect(validateLevel(pottery)).toContain('ASSAULT_CONTENTS');
  expect(validateLevel({...board('dandelion'),engineVersion:GARDEN_SIEGE_ENGINE_VERSION})).toContain('ASSAULT_ENGINE');
 });
 // Stored certification logs retain the 1.34 rules; current-engine behavior is checked above.
 it('keeps separate authored damage images and replays every profile without purchased items or reshuffles',()=>{
  for(const kind of ['seed-cocoon','dandelion-turret','pottery-nest','ceramic-pot'])expect(new Set([3,2,1].map(hp=>gardenSiegeArt({kind,hp,maxHp:3}))).size).toBe(3);
  const savedProofs=proofs as Record<string,{seed:number;actions:Action[]}>;
  for(const profile of gardenAssaultProfiles()){
   const key=assaultProfileKey(profile),proof=savedProofs[key]!,level=gardenAssaultCandidate(profile,proof.seed,GARDEN_CIRCUIT_ENGINE_VERSION);
   expect(proof.actions.every(a=>a.type==='tap'||a.type==='swap')).toBe(true);
   const result=replay(level,proof.actions);expect(result.accepted,key).toBe(true);expect(result.state.status,key).toBe('won');expect(result.events.some(e=>e.type==='shuffle')).toBe(false);
  }
 });
});
