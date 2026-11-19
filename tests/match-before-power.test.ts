import {describe,expect,it} from 'vitest';
import {COLORS,ENGINE_VERSION,OBJECTIVE_POWERS_ENGINE_VERSION,type Action,type GameState} from '@garden/contracts';
import {getLevel} from '@garden/content';
import {actionWithFrames,applyAction,createGame,findMatches} from '@garden/core';
import {effectTiming,VISUAL_BEATS} from '../apps/client/src/visual-timing';
import {tileDepartures} from '../apps/client/src/tile-origins';

function board(version:string){
 const state=createGame(getLevel(1,version));
 for(const [at,cell] of state.cells.entries())
  cell.tile={id:at+1,kind:'normal',color:COLORS[(at%7+2*Math.floor(at/7))%6]!};
 for(const at of [22,23,25])state.cells[at]!.tile={id:at+1,kind:'normal',color:'berry'};
 state.cells[21]!.tile={id:22,kind:'normal',color:'drop'};
 state.cells[24]!.tile={id:25,kind:'bomb'};
 state.cells[19]!.tile={id:20,kind:'glider'};
 state.cells[22]!.frost=state.cells[45]!.frost=1;
 state.goals=[{kind:'frost',count:2,remaining:2}];
 return state;
}

const swap:Action={type:'swap',from:24,to:25};
function schedule(state:GameState){
 const result=actionWithFrames(state,swap);
 const events=result.frames[0]!.events;
 const timing=effectTiming(events,state,swap);
 return {result,events,timing,departures:tileDepartures(state,events,timing)};
}

describe('a power swap that also makes a normal match',()=>{
 it('clears the whole match before the bomb relays the glider to another goal',()=>{
  const state=board(ENGINE_VERSION);
  expect(findMatches(state)).toHaveLength(0);
  const {result,events,timing,departures}=schedule(state);
  expect(result.state).toEqual(applyAction(state,swap).state);
  const match=events.find(event=>event.kind==='direct-match')!;
  expect(match.cells).toEqual([22,23,24]);
  const removals=events.filter(event=>event.type==='remove'&&event.effectId===match.effectId);
  expect(removals.flatMap(event=>event.cells)).toEqual(match.cells);
  const flightIndex=events.findIndex(event=>event.kind==='glider-flight');
  const flight=events[flightIndex]!;
  expect(flight).toMatchObject({from:19,to:45});
  const gone=[23,24,26].map(id=>departures.get(id)!.delay);
  expect(new Set(gone).size).toBe(1);
  expect(gone[0]).toBeLessThan(timing.delays[flightIndex]!);
  const landing=events.findIndex(event=>event.type==='hit'&&event.effectId===flight.effectId&&event.kind==='frost');
  expect(timing.delays[landing]).toBe(timing.delays[flightIndex]!+VISUAL_BEATS.charge+VISUAL_BEATS.gliderFlight);
  expect(result.state.status).toBe('won');
 });

 it('retains the earlier flight target when replaying a saved run',()=>{
  const {events,departures}=schedule(board(OBJECTIVE_POWERS_ENGINE_VERSION));
  expect(events.find(event=>event.kind==='glider-flight')).toMatchObject({from:19,to:22});
  expect(departures.get(23)!.delay).toBeGreaterThan(departures.get(24)!.delay);
 });
});
