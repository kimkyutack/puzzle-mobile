import {describe,it,expect} from 'vitest';
import {actionWithFrames,applyAction,createGame,findMatches,legalActions,stateHash} from '@garden/core';
import {getLevel} from '@garden/content';
import {SUPPORTED_ENGINE_VERSIONS,type Action} from '@garden/contracts';
import proofs from '../packages/content/src/campaign-solutions.json';
import gardenProofs from '../packages/content/src/garden-stage-proofs-v3.json';
import {fallMotion,fallPose} from '../apps/client/src/tile-fall';
import {tileFallPaths,pointOnPath} from '../apps/client/src/tile-origins';

describe('local cascade presentation without simulation changes',()=>{
 it('preserves exact server results, event order and input state across every supported ruleset',()=>{
  for(const version of SUPPORTED_ENGINE_VERSIONS)for(const id of [1,13,17,31,60]){
   const before=createGame(getLevel(id,version)),hash=stateHash(before),action=legalActions(before)[0]!,server=applyAction(before,action),local=actionWithFrames(before,action);
   expect(stateHash(before)).toBe(hash);expect(local.state).toEqual(server.state);expect(local.events).toEqual(server.events);expect(local.frames.flatMap(f=>f.events)).toEqual(server.events);
   expect(local.frames.at(-1)!.state).toEqual(server.state);expect(local.frames.length).toBeLessThanOrEqual(12);
   const earlier=local.frames[0]?.state;if(earlier&&local.frames.length>1){const saved=stateHash(earlier);local.frames.at(-1)!.state.moves=999;expect(stateHash(earlier)).toBe(saved);}
  }
 });
 it('shows real newly supplied pieces before they participate in the next cascade',()=>{
  let checked=0,chainFound=false;
  for(const id of [1,2,4,7,13,17,31]){
   let state=createGame(getLevel(id,'1.3.0'));
   for(const action of (proofs as Record<string,{actions:Action[]}>)[id]!.actions){
    const result=actionWithFrames(state,action);expect(result.accepted).toBe(true);
    for(let i=0;i<result.frames.length-1;i++){
     const current=result.frames[i]!,next=result.frames[i+1]!;expect(findMatches(current.state).length).toBeGreaterThan(0);
     const newborns=current.state.cells.flatMap(c=>c.tile&&c.tile.id>=state.nextTileId?[c.tile.id]:[]);
     const removed=new Set(next.events.filter(e=>e.type==='remove').flatMap(e=>e.cells));
     if(newborns.some(id=>current.state.cells.some((c,at)=>c.tile?.id===id&&removed.has(at))))chainFound=true;
     checked++;
    }
    state=result.state;
   }
  }
  expect(checked).toBeGreaterThan(10);expect(chainFound).toBe(true);
 });
 it('keeps opened garden floors, completed goals and terminal status identical to server replay',()=>{
  for(const id of [10,50,60]){
   let state=createGame(getLevel(id));const stage=state.gardenStage!,proof=gardenProofs.find(p=>p.kind===stage.kind&&p.variant===Math.floor((id-10)/20)%12)!;
   for(const action of proof.actions as Action[]){const server=applyAction(state,action),local=actionWithFrames(state,action);expect(local.state).toEqual(server.state);expect(local.frames.at(-1)!.state).toEqual(server.state);state=local.state;}
   expect(state.status).toBe('won');for(const at of state.gardenStage!.connected)expect(state.cells[at]!.tile).toBeNull();
  }
 });
 it('does not manufacture presentation frames for invalid input',()=>{
  const state=createGame(getLevel(1)),result=actionWithFrames(state,{type:'swap',from:0,to:48});expect(result.accepted).toBe(false);expect(result.frames).toEqual([]);expect(result.state).toBe(state);
 });
});
describe('gravity contact motion',()=>{
 it('moves surviving pieces around declared bends instead of across empty diagonal space',()=>{
  const before=createGame(getLevel(1)),after=structuredClone(before),tile=before.cells[0]!.tile!,lane=[0,7,14,15,16];after.gravity=[lane];
  for(const at of lane)after.cells[at]!.tile=null;after.cells[16]!.tile=tile;
  const path=tileFallPaths(before,after,[{type:'remove',cells:[7,14,15,16]},{type:'fall',cells:[16],from:0,to:16}]).get(tile.id)!;
  expect(path).toEqual([{x:.5,y:.5},{x:.5,y:1.5},{x:.5,y:2.5},{x:1.5,y:2.5},{x:2.5,y:2.5}]);expect(pointOnPath(path,.5)).toEqual({x:.5,y:2.5});
 });
 it('accelerates without reversing and lands exactly, with a short compression after contact',()=>{
  for(const distance of [.5,1,3,8]){
   const motion=fallMotion(distance,0);let previous=0;
   for(let ms=0;ms<=motion.travel;ms+=5){const pose=fallPose(ms,motion.travel);expect(pose.progress).toBeGreaterThanOrEqual(previous);expect(pose.progress).toBeLessThanOrEqual(1);expect(pose.scaleY).toBe(1);previous=pose.progress;}
   expect(fallPose(motion.travel+25,motion.travel).scaleY).toBeLessThan(1);expect(fallPose(motion.duration,motion.travel)).toEqual({progress:1,offset:0,scaleX:1,scaleY:1});
   expect(motion.duration).toBeLessThanOrEqual(405);
  }
 });
});
