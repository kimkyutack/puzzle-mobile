import {describe,expect,it} from 'vitest';
import {CHAPTER_OBSTACLE_ENGINE_VERSION,GARDEN_WORKSHOP_ENGINE_VERSION,GLIDER_SWARM_ENGINE_VERSION,type Action,type GameState} from '@garden/contracts';
import {actionWithFrames,applyAction,createGame,findMatches,legalActions,validateLevel} from '@garden/core';
import {publishedLevel} from '../apps/api/src/level-content';
import {tileFallPaths,tileOrigins} from '../apps/client/src/tile-origins';
import {WORKSHOP_DEVICES} from '../packages/contracts/src/campaign-devices';
import {advanceDevice} from '../packages/game-core/src/campaign-devices';

function play(id:number,from:number,to:number){
 const before=createGame(publishedLevel(id,CHAPTER_OBSTACLE_ENGINE_VERSION));
 const action:Action={type:'swap',from,to};
 expect(legalActions(before)).toContainEqual(action);
 const result=actionWithFrames(before,action);
 expect(result.accepted).toBe(true);
 expect(result.state).toEqual(applyAction(before,action).state);
 return {before,...result};
}

describe('workshop campaign',()=>{
 it('teaches six new rules at successive boundaries and preserves older board catalogues',()=>{
  let redesigned=0;
  for(let id=1801;id<=2400;id++){
   const old=publishedLevel(id,GLIDER_SWARM_ENGINE_VERSION),level=publishedLevel(id,GARDEN_WORKSHOP_ENGINE_VERSION);
   if(!level.strategy?.id.startsWith('workshop/')){
    expect({...level,engineVersion:old.engineVersion}).toEqual(old);
    continue;
   }
   redesigned++;
   expect(validateLevel(level),String(id)).toEqual([]);
   expect(level.moves).toBeGreaterThanOrEqual(old.moves);
   expect(validateLevel({...level,engineVersion:old.engineVersion})).toContain('DEVICE_ZONE');
   if(id%100<=3){
    expect(level.devices?.map(step=>step.kind)).toEqual([WORKSHOP_DEVICES[Math.floor((id-1801)/100)]]);
    expect(level.campaign?.beat).toBe(id%100===1?'introduction':'practice');
   }
  }
  expect(redesigned).toBe(120);
 });

 it('charges a marked pair with a color alignment swap even without a triple match',()=>{
  const result=play(1801,48,49);
  expect(result.state.moves).toBe(result.before.moves-1);
  expect(result.state.devices?.chargedPlates).toEqual([1]);
  expect(result.events.some(event=>event.type==='remove')).toBe(false);
  expect(findMatches(result.state)).toEqual([]);
 });

 it('relocates both blocks atomically before resolving the match at the destination',()=>{
  const result=play(1901,19,20),portal=result.frames[0]!;
  expect(portal.events).toContainEqual({type:'mechanic',kind:'portal-transfer',cells:[20,60],from:20,to:60});
  expect(portal.state.cells[60]!.tile?.id).toBe(result.before.cells[19]!.tile?.id);
  expect(portal.state.cells[20]!.tile?.id).toBe(result.before.cells[60]!.tile?.id);
  expect(tileFallPaths(result.before,portal.state,portal.events).size).toBeGreaterThanOrEqual(2);
  expect(result.state.devices?.progress).toBe(1);
 });

 it('dyes a remote stencil and clears the blocks there through a real cascade',()=>{
  const result=play(2001,12,21);
  const stencil=result.events.findIndex(event=>event.kind==='dye-stencil');
  expect(stencil).toBeGreaterThan(-1);
  expect(result.events.slice(stencil+1).filter(event=>event.type==='remove').flatMap(event=>event.cells)).toEqual(expect.arrayContaining([23,24,25]));
  expect(result.state.devices?.progress).toBe(1);
 });

 it('tracks separate scales and empties only a pan that overflows',()=>{
  const level=publishedLevel(2101,CHAPTER_OBSTACLE_ENGINE_VERSION),state=createGame(level),[left,right]=state.devices!.steps[0]!.zones;
  const events:Parameters<typeof advanceDevice>[1]=[];
  const match=(cells:number[])=>({cells,color:'drop' as const,wave:0});
  advanceDevice(state,events,[match(left!.slice(0,4)),match(right!.slice(0,3))],false);
  expect(state.devices?.pans).toEqual([4,3]);
  advanceDevice(state,events,[match(left!.slice(0,3))],false);
  expect(state.devices?.pans).toEqual([0,3]);
  expect(state.goals[0]?.remaining).toBe(1);
 });

 it('reflects impact to the symmetric cell even when that cell was outside the match',()=>{
  const result=play(2201,3,4);
  const reflection=result.events.findIndex(event=>event.kind==='mirror-pulse');
  expect(reflection).toBeGreaterThan(-1);
  expect(result.events[reflection]?.cells).toContain(12);
  expect(result.events.slice(reflection+1).some(event=>event.type==='remove'&&event.cells.includes(12))).toBe(true);
 });

 it('sends actual refills from below and keeps normal lane data in the saved state',()=>{
  const result=play(2301,6,7);
  expect(result.events.some(event=>event.type==='fall'&&event.from!>event.to!)).toBe(true);
  expect(result.state.gravity).toEqual(result.before.gravity);
  const births=[...tileOrigins(result.before,result.state,result.events).values()];
  expect(births.some(birth=>birth.mode==='supply'&&birth.origin.y>result.state.height)).toBe(true);
 });
});
