import {describe,it,expect} from 'vitest';
import {applyAction,findMatches,stateHash} from '@garden/core';
import {LEGACY_ENGINE_VERSION,type GameEvent,type Special} from '@garden/contracts';
import {specialSwapBoard} from '../tools/fixtures/special-swap';

const firstPhase=(events:GameEvent[])=>{const gravity=events.findIndex(e=>e.type==='fall'||e.type==='spawn'&&e.kind==='normal');return gravity<0?events:events.slice(0,gravity)};
const specials:Special[]=['wind-row','wind-column','bomb','glider','rainbow'];

describe('ordinary match formed by a special swap',()=>{
 for(const kind of specials)for(const reverse of [false,true])it(`${kind} + water square resolves both effects (${reverse?'normal first':'special first'})`,()=>{
  const before=specialSwapBoard(kind),hash=stateHash(before);expect(findMatches(before)).toEqual([]);
  const result=applyAction(before,reverse?{type:'swap',from:17,to:24}:{type:'swap',from:24,to:17}),phase=firstPhase(result.events);
  expect(result.accepted).toBe(true);expect(result.state.status).not.toBe('error');expect(stateHash(before)).toBe(hash);
  expect(result.state.moves).toBe(before.moves-1);expect(result.state.turn).toBe(before.turn+1);
  expect(phase.filter(e=>e.type==='special'&&e.kind===kind&&e.cells[0]===17)).toHaveLength(1);
  expect(phase).toContainEqual({type:'spawn',cells:[24],kind:'glider'});
  for(const at of [25,31,32])expect(phase.some(e=>e.type==='remove'&&e.kind==='drop'&&e.cells.includes(at)),`water ${at}`).toBe(true);
  expect(phase.some(e=>e.type==='remove'&&e.cells.includes(24))).toBe(false);
  expect(phase.some(e=>e.type==='special'&&e.kind==='glider'&&e.cells[0]===24)).toBe(false);
  expect(result.state.goals[0]!.remaining).toBeLessThanOrEqual(96);
 });
 for(const [matched,destination,created]of [
  [[22,23,24,25],17,'wind-row'],
  [[10,17,24,31],25,'wind-column'],
  [[22,23,24,25,26],17,'rainbow'],
  [[10,17,24,25,26],31,'bomb']
 ] as const)it(`also creates ${created} from the exchanged normal tiles`,()=>{
  const before=specialSwapBoard('wind-row',[...matched],destination);expect(findMatches(before)).toEqual([]);
  const result=applyAction(before,{type:'swap',from:24,to:destination}),phase=firstPhase(result.events);
  expect(result.state.status).not.toBe('error');expect(phase).toContainEqual({type:'spawn',cells:[24],kind:created});
  expect(phase.filter(e=>e.type==='special'&&e.kind==='wind-row'&&e.cells[0]===destination)).toHaveLength(1);
 });
 it('clears a three-tile match alongside the power without creating an extra power',()=>{
  const result=applyAction(specialSwapBoard('wind-row',[23,24,25]),{type:'swap',from:24,to:17}),phase=firstPhase(result.events);
  for(const at of [23,24,25])expect(phase.some(e=>e.type==='remove'&&e.kind==='drop'&&e.cells.includes(at))).toBe(true);
  expect(phase.some(e=>e.type==='spawn')).toBe(false);
 });
 it('counts frost and a distant matching-color pot once per match while preserving the new power',()=>{
  const before=specialSwapBoard('wind-column');for(const i of [24,25,31,32])before.cells[i]!.frost=1;
  before.obstacles.p={id:'p',kind:'pot',hp:4,maxHp:4,color:'drop',anchor:48,footprint:[48]};before.cells[48]!.obstacleId='p';before.cells[48]!.tile=null;
  const result=applyAction(before,{type:'swap',from:24,to:17}),phase=firstPhase(result.events);
  expect(phase.filter(e=>e.type==='hit'&&e.kind==='pot')).toHaveLength(1);
  for(const at of [25,31,32])expect(phase.filter(e=>e.type==='hit'&&e.kind==='frost'&&e.cells.includes(at))).toHaveLength(1);
  expect(result.state.cells.filter(c=>c.frost).length).toBe(0);
 });
 it('keeps original 1.0 replay semantics',()=>{
  const before=specialSwapBoard('wind-row');before.engineVersion=LEGACY_ENGINE_VERSION;
  const result=applyAction(before,{type:'swap',from:24,to:17});
  expect(firstPhase(result.events).some(e=>e.type==='spawn'&&e.kind==='glider')).toBe(false);
 });
});
