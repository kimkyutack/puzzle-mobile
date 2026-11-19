import {describe,it,expect} from 'vitest';
import {createGame,applyAction,stateHash} from '@garden/core';
import {getLevel} from '@garden/content';
import type {GameEvent,Special} from '@garden/contracts';
import {rainbowSelections} from '../apps/client/src/rainbow-selection';
import {effectTiming,VISUAL_BEATS} from '../apps/client/src/visual-timing';
import {tileDepartures} from '../apps/client/src/tile-origins';

describe('rainbow conversion before combined release',()=>{
 it('does not confuse a later falling tile with the earlier conversion at that cell',()=>{
  const before=createGame(getLevel(1)),id=before.cells[2]!.tile!.id;
  const events:GameEvent[]=[{type:'special',kind:'rainbow+bomb',cells:[24,25]},{type:'remove',kind:'bomb',cells:[4],effectId:1},{type:'special',kind:'bomb',cells:[4]},{type:'remove',kind:'berry',cells:[6],effectId:2},{type:'fall',cells:[4],from:2,to:4},{type:'remove',kind:'sun',cells:[4],effectId:3}];
  const plan=effectTiming(events,before),later=tileDepartures(before,events,plan).get(id)!;
  expect(later.activation).toBe(false);expect(later.delay).toBeGreaterThan(plan.conversionAt.get(4)!);
 });
 for(const partner of ['wind-row','wind-column','bomb','glider'] as Special[])for(const reverse of [false,true])it(`shows all ${partner} conversions before any launch (${reverse?'reverse':'forward'})`,()=>{
  const before=createGame(getLevel(1)),hash=stateHash(before);before.cells[24]!.tile={id:500,kind:'rainbow'};before.cells[25]!.tile={id:501,kind:partner};before.nextTileId=502;
  const unchanged=stateHash(before),action={type:'swap',from:reverse?25:24,to:reverse?24:25} as const,result=applyAction(before,action),finalHash=stateHash(result.state);
  const selection=[...rainbowSelections(result.events).values()][0]!,plan=effectTiming(result.events,result.state,action),departures=tileDepartures(before,result.events,plan);
  expect(hash).not.toBe(unchanged);expect(result.accepted).toBe(true);expect(selection.replacement).toBe(partner);expect(selection.children.size).toBe(selection.targets.length);expect(selection.targets.length).toBeGreaterThan(12);
  const arrivals=selection.targets.map(at=>plan.conversionAt.get(at)!);expect(arrivals.every(Number.isFinite)).toBe(true);expect(new Set(arrivals).size).toBeGreaterThan(1);
  const launches=[...selection.children.keys()].map(index=>plan.delays[index]!);expect(new Set(launches).size).toBe(1);expect(Math.min(...launches)-Math.max(...arrivals)).toBeGreaterThanOrEqual(VISUAL_BEATS.rainbowHold);
  for(const at of selection.targets){const original=before.cells[at]!.tile!;expect(departures.get(original.id)).toEqual({delay:plan.conversionAt.get(at),activation:true});}
  const blastCells=new Set(result.events.filter(e=>e.type==='remove'&&e.effectId!==selection.effectId&&e.effectId!==undefined).flatMap(e=>e.cells));expect(blastCells.size).toBeGreaterThan(0);
  expect(plan.primaryImpactAt).toBeGreaterThan(Math.max(...arrivals)+VISUAL_BEATS.rainbowHold);
  expect(stateHash(before)).toBe(unchanged);expect(stateHash(result.state)).toBe(finalHash);
 });
});
