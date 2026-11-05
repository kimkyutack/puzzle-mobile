import {describe,it,expect} from 'vitest';
import {createGame,applyAction,stateHash} from '@garden/core';
import {getLevel as getContentLevel} from '@garden/content';
import type {Action,GameEvent,GameState,Tile} from '@garden/contracts';
import solutions from '../packages/content/src/legacy-solutions-v1.json';
import {tileOrigins,tileDepartures,pointOnPath} from '../apps/client/src/tile-origins';
import {effectTiming} from '../apps/client/src/visual-timing';
// These exact spawn/shuffle regressions belong to the archived v1 boards/logs.
const getLevel=(id:number)=>getContentLevel(id,true);
function reverseBirths(after:GameState,events:GameEvent[]){const live=new Map<number,Tile>(after.cells.flatMap((cell,index)=>cell.tile?[[index,cell.tile] as const]:[])),births=new Map<number,number>();for(const event of [...events].reverse()){if(event.type==='spawn')for(const at of event.cells){const tile=live.get(at);if(tile)births.set(tile.id,at);live.delete(at);}else if(event.type==='fall'){const tile=live.get(event.to!);live.delete(event.to!);if(tile)live.set(event.from!,tile);}else if(event.type==='remove')for(const at of event.cells)live.delete(at);else if(event.type==='swap'){const a=live.get(event.from!),b=live.get(event.to!);live.delete(event.from!);live.delete(event.to!);if(a)live.set(event.to!,a);if(b)live.set(event.from!,b);}}return births;}
describe('authoritative newborn tile origins on archived v1 replays',()=>{
 it('keeps a tile that falls before its later match until that match impact',()=>{
  const before=createGame(getLevel(1)),id=before.cells[2]!.tile!.id,events:GameEvent[]=[{type:'special',kind:'rainbow',cells:[24]},{type:'remove',kind:'berry',cells:[9],effectId:1},{type:'fall',cells:[9],from:2,to:9},{type:'remove',kind:'sun',cells:[9],effectId:2}],plan=effectTiming(events,before),original=stateHash(before);
  expect(plan.firstRemovalAt.has(2)).toBe(false);expect(tileDepartures(before,events,plan).get(id)).toEqual({delay:1550,activation:false});expect(stateHash(before)).toBe(original);
 });
 it('feeds the first real refill from before its gravity inlet',()=>{const before=createGame(getLevel(1)),result=applyAction(before,(solutions['1'].actions as Action[])[0]!),origins=tileOrigins(before,result.state,result.events),normal=[...origins.values()].filter(value=>value.mode==='supply');expect(normal).toHaveLength(11);expect(normal.every(value=>value.origin.y<.5)).toBe(true);});
 it('preserves the actual birth and explicit shuffle destination in level 28 action eight',()=>{let before=createGame(getLevel(28));for(const action of (solutions['28'].actions as Action[]).slice(0,7))before=applyAction(before,action).state;const result=applyAction(before,(solutions['28'].actions as Action[])[7]!),origins=tileOrigins(before,result.state,result.events);expect(result.events.some(event=>event.type==='shuffle')).toBe(true);expect([...origins.values()].some(value=>value.shuffled)).toBe(true);const tile=result.state.cells[36]!.tile!,origin=origins.get(tile.id)!;expect(origin.mode).toBe('supply');expect(origin.origin.y).toBeLessThan(Math.floor(origin.inlet/result.state.width)+.5);expect(origin.points.at(-1)).toEqual({x:1.5,y:5.5});});
 it('samples a bent gravity path without cutting across its corner',()=>{const path=[{x:0,y:-1},{x:0,y:1},{x:2,y:1}];expect(pointOnPath(path,.5)).toEqual({x:0,y:1});expect(pointOnPath(path,.75)).toEqual({x:1,y:1});expect(pointOnPath(path,1)).toEqual({x:2,y:1});});
 it('validates all 3466 approved actions without solving again or altering the engine result',()=>{
  let actions=0,newborns=0,formations=0,internalInlets=0;
  for(const [id,fixture]of Object.entries(solutions)){let before=createGame(getLevel(Number(id)));for(const action of fixture.actions as Action[]){const result=applyAction(before,action),after=result.state,hash=stateHash(after),eventJSON=JSON.stringify(result.events),origins=tileOrigins(before,after,result.events),old=new Set(before.cells.flatMap(cell=>cell.tile?[cell.tile.id]:[])),fresh=after.cells.flatMap(cell=>cell.tile&&!old.has(cell.tile.id)?[cell.tile]:[]),reverse=result.events.some(event=>event.type==='shuffle')?null:reverseBirths(after,result.events);
   expect(origins.size).toBe(fresh.length);
   for(const tile of fresh){const origin=origins.get(tile.id)!;expect(origin.kind).toBe(tile.kind);if(reverse)expect(origin.birth).toBe(reverse.get(tile.id));expect(origin.points.at(-1)).toEqual({x:origin.destination%after.width+.5,y:Math.floor(origin.destination/after.width)+.5});
    if(origin.mode==='supply'){const lane=after.gravity.find(value=>value[0]===origin.inlet)!,head={x:origin.inlet%after.width+.5,y:Math.floor(origin.inlet/after.width)+.5},next=lane[1]!==undefined?{x:lane[1]%after.width+.5,y:Math.floor(lane[1]/after.width)+.5}:{x:head.x,y:head.y+1};expect((origin.origin.x-head.x)*(next.x-head.x)+(origin.origin.y-head.y)*(next.y-head.y)).toBeLessThan(0);if(Math.floor(origin.inlet/after.width)>0)internalInlets++;}
    else{formations++;expect(origin.origin).toEqual({x:origin.birth%after.width+.5,y:Math.floor(origin.birth/after.width)+.5});}
   }
   expect(stateHash(after)).toBe(hash);expect(JSON.stringify(result.events)).toBe(eventJSON);newborns+=fresh.length;actions++;before=after;
  }}expect(actions).toBe(3466);expect(newborns).toBe(25653);expect(formations).toBe(1398);expect(internalInlets).toBeGreaterThan(2780);
 });
});
