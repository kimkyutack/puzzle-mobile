import {describe,expect,it} from 'vitest';
import {actionWithFrames,applyAction,createGame} from '@garden/core';
import {CAMPAIGN_DEVICE_ENGINE_VERSION,COLORS,ENGINE_VERSION,type LevelDefinition,type Tile} from '@garden/contracts';
import {effectTiming,VISUAL_BEATS} from '../apps/client/src/visual-timing';

const swap={type:'swap',from:0,to:1} as const;
function comboBoard(engineVersion:string){
 const width=7,height=7;
 const initial:Tile[]=Array.from({length:width*height},(_,i)=>({
  id:i+1,kind:'normal',color:COLORS[(i%width+2*Math.floor(i/width))%4]!,
 }));
 initial[0]={id:1,kind:'rainbow'};
 initial[1]={id:2,kind:'glider'};
 // The most common color creates gliders across the upper part of the board.
 for(const at of [2,5,8,12,17])initial[at]={id:at+1,kind:'normal',color:'berry'};
 const obstacles:LevelDefinition['obstacles']=[
  {id:'statue',kind:'statue',footprint:[35,36,42,43],anchor:35,hp:6,maxHp:6},
  {id:'urn',kind:'urn',footprint:[38],anchor:38,hp:2,maxHp:2},
  {id:'pipe',kind:'pipe',footprint:[40,41,48,47],anchor:40,hp:4,maxHp:4,endOnly:true},
 ];
 // Keep the launch blasts away from the three principal targets.
 for(let i=28;i<initial.length;i++){
  const tile=initial[i]!;
  if(tile.kind==='normal'&&tile.color==='berry')tile.color='flower';
 }
 const level:LevelDefinition={id:414,version:'swarm-fixture',engineVersion,width,height,seed:73199,colors:[...COLORS.slice(0,5)],
  shape:Array(49).fill(true),moves:32,difficulty:'normal',initial,obstacles,goals:obstacles.map(o=>({kind:o.kind,count:1,remaining:1}))};
 return createGame(level);
}

describe('rainbow plus glider',()=>{
 it('chips separate frost cells when several gliders hunt for remaining ice',()=>{
  const board=comboBoard(ENGINE_VERSION);
  board.cells[35]!.frost=2;
  board.cells[38]!.frost=2;
  board.goals=[{kind:'frost',count:4,remaining:4}];
  const result=applyAction(board,swap);
  const flights=result.events.filter(event=>event.kind==='glider-flight'&&event.effectId!==undefined);
  expect(flights.slice(0,2).map(flight=>flight.to)).toEqual([35,38]);
  for(const flight of flights.slice(0,2)){
   expect(result.events).toContainEqual({type:'hit',kind:'frost',cells:[flight.to],effectId:flight.effectId});
  }
 });
 it('spreads impacts across surviving goal obstacles and retains the old replay behavior',()=>{
  const board=comboBoard(ENGINE_VERSION);
  const previous=applyAction(comboBoard(CAMPAIGN_DEVICE_ENGINE_VERSION),swap);
  expect(previous.accepted).toBe(true);
  const legacyFlights=previous.events.filter(event=>event.kind==='glider-flight').slice(0,3);
  expect(legacyFlights.map(event=>event.to)).toEqual([35,35,35]);
  const result=actionWithFrames(board,swap);
  expect(result.accepted).toBe(true);
  expect(result.state).toEqual(applyAction(board,swap).state);
  const flights=result.events.filter(event=>event.kind==='glider-flight'&&event.effectId!==undefined);
  expect(flights.slice(0,3).map(event=>board.cells[event.to!]!.obstacleId)).toEqual(['statue','pipe','urn']);
  const timing=effectTiming(result.events,board);
  for(const flight of flights.slice(0,3)){
   const hit=result.events.findIndex(event=>event.type==='hit'&&event.effectId===flight.effectId);
   expect(hit).toBeGreaterThan(result.events.indexOf(flight));
   expect(timing.delays[hit]).toBe(timing.delays[result.events.indexOf(flight)]!+VISUAL_BEATS.charge+VISUAL_BEATS.gliderFlight);
  }
  const finalLanding=Math.max(...flights.map(flight=>timing.delays[result.events.indexOf(flight)]!+VISUAL_BEATS.charge+VISUAL_BEATS.gliderFlight));
  expect(timing.settleAt).toBeGreaterThan(finalLanding);
 });
});
