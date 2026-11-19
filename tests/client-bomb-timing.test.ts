import {describe,it,expect} from 'vitest';
import {createGame,applyAction} from '@garden/core';
import {getLevel} from '@garden/content';
import type {Action} from '@garden/contracts';
import {BOMB_BEATS,VISUAL_BEATS,effectTiming} from '../apps/client/src/visual-timing';
import {SHARD_PIECES} from '../apps/client/src/tile-shards';

function fire(pair:boolean){
 const state=createGame(getLevel(1)),center=Math.floor(state.cells.length/2);
 state.cells[center]!.tile={id:90000,kind:'bomb'};if(pair)state.cells[center+1]!.tile={id:90001,kind:'bomb'};state.nextTileId=Math.max(state.nextTileId,90002);
 const action:Action=pair?{type:'swap',from:center,to:center+1}:{type:'tap',at:center},result=applyAction(state,action);
 expect(result.accepted).toBe(true);
 return {result,plan:effectTiming(result.events,result.state,action),width:state.width};
}
const ring=(at:number,anchor:number,width:number)=>Math.max(Math.abs(at%width-anchor%width),Math.abs(Math.floor(at/width)-Math.floor(anchor/width)));

describe('bomb presentation',()=>{
 it('a single bomb just goes off after the ordinary charge',()=>{
  const {result,plan,width}=fire(false),special=result.events.findIndex(event=>event.type==='special'&&event.kind==='bomb'),anchor=result.events[special]!.cells.at(-1)!;
  expect(plan.heroBombs.size).toBe(0);
  const impact=plan.delays[special]!+VISUAL_BEATS.charge+BOMB_BEATS.ignition;
  let checked=0;
  result.events.forEach((event,index)=>{if(event.type==='remove'&&event.kind!=='bomb'&&event.effectId===result.events[special]!.effectId){checked++;expect(plan.delays[index]).toBe(impact+ring(event.cells[0]!,anchor,width)*BOMB_BEATS.step);}});
  expect(checked).toBeGreaterThan(8);
 });
 it('a fused bomb pair holds the long swell and hit-stop before its blast reaches each ring',()=>{
  const {result,plan,width}=fire(true),special=result.events.findIndex(event=>event.type==='special'&&event.kind==='bomb+bomb'),anchor=result.events[special]!.cells.at(-1)!;
  expect(plan.heroBombs.has(special)).toBe(true);
  const impact=plan.delays[special]!+BOMB_BEATS.charge+BOMB_BEATS.ignition;let checked=0,earliest=Infinity;
  result.events.forEach((event,index)=>{
   // The fused pair's blast removals carry their own effect id; the two consumed bombs do not.
   if(event.type!=='remove'||event.kind==='bomb'||event.effectId===undefined)return;
   const at=event.cells[0]!;
   checked++;earliest=Math.min(earliest,plan.delays[index]!);
   expect(plan.delays[index]).toBeGreaterThanOrEqual(impact+ring(at,anchor,width)*BOMB_BEATS.step);
  });
  expect(checked).toBeGreaterThan(20);
  expect(earliest).toBe(impact+BOMB_BEATS.step);
 });
 for(const pair of [false,true])it(`never breaks a refilled cascade before the blast that emptied the board (${pair?'pair':'single'})`,()=>{
  const {result,plan}=fire(pair);let refilled=false,firstWave=0;
  result.events.forEach((event,index)=>{
   if(event.type==='fall'||event.type==='spawn'&&event.kind==='normal')refilled=true;
   if(event.type!=='remove'&&event.type!=='hit')return;
   if(!refilled)firstWave=Math.max(firstWave,plan.delays[index]!);
   else expect(plan.delays[index]).toBeGreaterThanOrEqual(firstWave);
  });
 });
 it('cuts a tile into eight pieces that cover its whole body',()=>{
  expect(SHARD_PIECES).toHaveLength(8);
  const area=(points:ReadonlyArray<readonly [number,number]>)=>Math.abs(points.reduce((sum,[x,y],i)=>{const [nx,ny]=points[(i+1)%points.length]!;return sum+x*ny-nx*y;},0))/2;
  expect(SHARD_PIECES.reduce((sum,piece)=>sum+area(piece.points),0)).toBeCloseTo(4,6);
 });
});
