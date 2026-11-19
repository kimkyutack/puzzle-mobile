import {describe,it,expect} from 'vitest';
import {applyAction,createGame,findMatches,stateHash,replay,validateLevel} from '@garden/core';
import {getLevel} from '@garden/content';
import {powerUses} from '../packages/content/src/power-festival';
import {BEEHIVE_ENGINE_VERSION,PERPENDICULAR_ROCKET_ENGINE_VERSION,GARDEN_ENGINE_VERSION,COLORS,type GameState,type Color,type GameEvent,type Special} from '@garden/contracts';
import {actionActivity} from '../apps/api/src/activity';
import {effectTiming} from '../apps/client/src/visual-timing';
import {BEE_BEATS,beePoint} from '../apps/client/src/bee-motion';
import {impactOverlays} from '../apps/client/src/impact-overlays';
import {featureHelp,unseenBoardFeatures} from '../apps/client/src/feature-help';
import {combinationAt} from '../apps/client/src/special-combination';
import proofs from '../packages/content/src/campaign-solutions.json';
import type {Action} from '@garden/contracts';

function board(){
 const state=createGame(getLevel(1,BEEHIVE_ENGINE_VERSION));
 state.cells.forEach((cell,i)=>{cell.tile={id:1000+i,kind:'normal',color:COLORS[(i%7+Math.floor(i/7)*2)%6]!};cell.frost=0;});
 state.nextTileId=2000;state.goals=[{kind:'berry',count:100,remaining:100}];state.moves=30;return state;
}
function put(s:GameState,at:number,color:Color){s.cells[at]!.tile={id:1000+at,kind:'normal',color};}
function power(s:GameState,at:number,kind:Special){s.cells[at]!.tile={id:1000+at,kind};}
function doubleMatch(){const s=board();for(const at of [15,16,24])put(s,at,'berry');for(const at of [17,22,23])put(s,at,'drop');return s;}
function crate(s:GameState,at:number,hp:number){const id='crate-'+at;s.obstacles[id]={id,kind:'crate',anchor:at,footprint:[at],hp,maxHp:hp};s.cells[at]!.obstacleId=id;s.cells[at]!.tile=null;}
function phase(events:GameEvent[]){const end=events.findIndex(e=>e.type==='fall'||e.type==='spawn'&&e.kind==='normal');return end<0?events:events.slice(0,end);}
const flights=(events:GameEvent[])=>events.filter(e=>e.kind==='bee-flight');

describe('beehive creation from a deliberate double match',()=>{
 for(const reverse of [false,true])it(`creates exactly one hive at the dragged tile destination (${reverse?'reverse':'forward'})`,()=>{
  const s=doubleMatch(),before=stateHash(s),action={type:'swap',from:reverse?17:24,to:reverse?24:17} as const;
  expect(findMatches(s)).toEqual([]);const result=applyAction(s,action),opening=phase(result.events);
  expect(result.accepted).toBe(true);expect(result.state.status).not.toBe('error');expect(stateHash(s)).toBe(before);
  expect(opening.filter(e=>e.type==='spawn'&&e.kind==='beehive')).toEqual([{type:'spawn',kind:'beehive',cells:[action.to]}]);
  expect(result.state.moves).toBe(s.moves-1);expect(result.state.turn).toBe(1);expect(flights(opening)).toEqual([]);
  expect(opening.filter(e=>e.type==='remove'&&['berry','drop'].includes(e.kind??'')).reduce((n,e)=>n+e.cells.length,0)).toBe(5);
  expect(stateHash(applyAction(structuredClone(s),action).state)).toBe(stateHash(result.state));
 });
 it('also recognizes vertically oriented double matches',()=>{
  const before=doubleMatch(),s=structuredClone(before);for(let i=0;i<49;i++)s.cells[(i%7)*7+Math.floor(i/7)]=before.cells[i]!;
  const transpose=(at:number)=>(at%7)*7+Math.floor(at/7),result=applyAction(s,{type:'swap',from:transpose(24),to:transpose(17)});
  expect(findMatches(s)).toEqual([]);expect(phase(result.events)).toContainEqual({type:'spawn',kind:'beehive',cells:[transpose(17)]});
 });
 it('keeps stronger four/five formations and ordinary single matches',()=>{
  const s=doubleMatch();put(s,18,'berry');const result=applyAction(s,{type:'swap',from:24,to:17}),opening=phase(result.events);
  expect(opening.some(e=>e.type==='spawn'&&e.kind==='beehive')).toBe(false);expect(opening).toContainEqual({type:'spawn',kind:'wind-column',cells:[17]});
  const single=doubleMatch();put(single,22,'flower');expect(applyAction(single,{type:'swap',from:24,to:17}).events.some(e=>e.kind==='beehive')).toBe(false);
 });
 it('retains v1.4 and v1.3 simulation, including saved v1.3 replay hashes',()=>{
  for(const engine of [PERPENDICULAR_ROCKET_ENGINE_VERSION,GARDEN_ENGINE_VERSION]){const s=doubleMatch();s.engineVersion=engine;expect(applyAction(s,{type:'swap',from:24,to:17}).events.some(e=>e.kind==='beehive')).toBe(false);}
  const proof=proofs['1'];expect(stateHash(replay(getLevel(1,GARDEN_ENGINE_VERSION),proof.actions as Action[]).state)).toBe(proof.hash);
 });
 it('rejects a hive in an older level definition',()=>{
  const level=getLevel(1,PERPENDICULAR_ROCKET_ENGINE_VERSION);level.initial=board().cells.map(c=>c.tile);level.initial[0]={id:9999,kind:'beehive'};
  expect(validateLevel(level)).toContain('BEEHIVE_ENGINE');
 });
});

describe('focused bees and power-up combinations',()=>{
 it('hits one obstacle three times and preserves the other obstacle',()=>{
  const s=board();crate(s,0,5);crate(s,6,4);power(s,24,'beehive');const r=applyAction(s,{type:'tap',at:24});
  expect(flights(phase(r.events)).map(e=>e.to)).toEqual([0,0,0]);expect(r.state.obstacles['crate-0']?.hp).toBe(2);expect(r.state.obstacles['crate-6']?.hp).toBe(4);
  const delta=actionActivity([{type:'tap',at:24}],r.events);expect(delta['specials-used']).toBe(1);
 });
 it('retargets only after the focused obstacle is destroyed',()=>{
  const s=board();crate(s,0,2);crate(s,6,1);power(s,24,'beehive');const r=applyAction(s,{type:'tap',at:24});expect(flights(phase(r.events)).map(e=>e.to)).toEqual([0,0,6]);
 });
 it('follows a retracting pipe instance as its anchor changes',()=>{
  const s=board();s.obstacles.pipe={id:'pipe',kind:'pipe',anchor:0,footprint:[0,1,2,3],hp:4,maxHp:4};for(const at of [0,1,2,3]){s.cells[at]!.obstacleId='pipe';s.cells[at]!.tile=null;}
  power(s,24,'beehive');const r=applyAction(s,{type:'tap',at:24});expect(flights(phase(r.events)).map(e=>e.to)).toEqual([0,1,2]);expect(phase(r.events).filter(e=>e.obstacleId==='pipe').at(-1)?.obstacleAfter?.hp).toBe(1);
 });
 it('never bypasses color-charge goals or targets falling seeds',()=>{
  const s=board();s.obstacles.pot={id:'pot',kind:'pot',anchor:0,footprint:[0],hp:4,maxHp:4,color:'berry'};s.cells[0]!.obstacleId='pot';s.cells[0]!.tile=null;s.cells[1]!.tile={id:9999,kind:'seed'};power(s,24,'beehive');
  const opening=phase(applyAction(s,{type:'tap',at:24}).events);expect(flights(opening).every(e=>e.to!==0&&e.to!==1)).toBe(true);expect(opening.some(e=>e.type==='hit'&&e.kind==='pot')).toBe(false);
 });
 for(const partner of ['wind-row','wind-column','bomb','glider','beehive','rainbow'] as const)for(const reverse of [false,true])it(`combines with ${partner} (${reverse?'reverse':'forward'})`,()=>{
  const s=board();crate(s,0,9);crate(s,6,9);power(s,24,reverse?partner:'beehive');power(s,25,reverse?'beehive':partner);const before=stateHash(s);
  expect(combinationAt(s,24,25)).not.toBeNull();const action={type:'swap',from:24,to:25} as const,r=applyAction(s,action),opening=phase(r.events),bees=flights(opening);
  expect(r.accepted).toBe(true);expect(r.state.status).not.toBe('error');expect(stateHash(s)).toBe(before);expect(r.state.moves).toBe(29);
  if(partner==='rainbow'){expect(bees.length).toBeGreaterThanOrEqual(3);expect(bees.length%3).toBe(0);expect(opening.some(e=>e.type==='remove'&&e.kind==='beehive')).toBe(true);}
  else{expect(bees).toHaveLength(partner==='beehive'?6:partner==='glider'?5:3);for(const bee of bees)expect(bee.payload).toBe(['wind-row','wind-column','bomb'].includes(partner)?partner:undefined);}
  expect(stateHash(applyAction(structuredClone(s),action).state)).toBe(stateHash(r.state));
 });
 it('announces discovery in both languages and counts generated hives for missions',()=>{
  const s=board();power(s,24,'beehive');expect(unseenBoardFeatures(s,[])).toContain('beehive');expect(featureHelp('beehive','ko')).toContain('3마리');expect(featureHelp('beehive','en')).toContain('three bees');
  expect(actionActivity([],[{type:'spawn',kind:'beehive',cells:[24]}])['specials-made']).toBe(1);
  expect(powerUses([{type:'special',kind:'beehive+glider',cells:[24,25]}]).glider).toBe(1);
  expect(powerUses([{type:'special',kind:'beehive+rainbow',cells:[24,25]}]).rainbow).toBe(1);
 });
});

describe('bee flight and damage presentation',()=>{
 it('shows three separate impacts, changing obstacle HP at each arrival',()=>{
  const s=board();crate(s,0,5);power(s,24,'beehive');const r=applyAction(s,{type:'tap',at:24}),timing=effectTiming(r.events,r.state,{type:'tap',at:24}),indices=r.events.flatMap((e,i)=>e.kind==='bee-flight'?[i]:[]);
  const arrivals=indices.map(i=>timing.delays[i]!+BEE_BEATS.flight);expect(arrivals).toEqual([1340,1600,1860]);expect(timing.primaryImpactAt).toBe(arrivals[0]);
  const overlays=impactOverlays(s,r.state,r.events,timing).filter(step=>step.kind==='obstacle'&&step.id==='crate-0');
  expect(overlays.map(step=>step.delay)).toEqual(arrivals);expect(overlays.map(step=>step.kind==='obstacle'?step.value?.hp:null)).toEqual([4,3,2]);expect(timing.settleAt).toBeGreaterThan(arrivals[2]!);
 });
 it('starts a carried rocket only after its bee arrives',()=>{
  const s=board();crate(s,0,9);power(s,24,'beehive');power(s,25,'wind-row');const r=applyAction(s,{type:'swap',from:24,to:25}),timing=effectTiming(r.events,r.state);
  const flight=r.events.findIndex(e=>e.kind==='bee-flight'),payload=r.events.findIndex((e,i)=>i>flight&&e.type==='special'&&e.kind==='wind-row');expect(timing.delays[payload]).toBeGreaterThanOrEqual(timing.delays[flight]!+BEE_BEATS.flight);
 });
 it('plays the rainbow-hive impact sound when the first converted bee actually arrives',()=>{
  const s=board();crate(s,0,9);power(s,24,'beehive');power(s,25,'rainbow');const r=applyAction(s,{type:'swap',from:24,to:25}),timing=effectTiming(r.events,r.state),first=r.events.findIndex(e=>e.kind==='bee-flight');
  expect(timing.primaryImpactAt).toBe(timing.delays[first]!+BEE_BEATS.flight);
 });
 it('keeps the curved flight continuous at both endpoints',()=>{
  const from={x:10,y:200},to={x:210,y:50};expect(beePoint(from,to,0,40)).toEqual(from);expect(beePoint(from,to,1,40).x).toBeCloseTo(to.x);expect(beePoint(from,to,1,40).y).toBeCloseTo(to.y);expect(beePoint(from,to,.5,40).y).toBeLessThan(125);
 });
});
