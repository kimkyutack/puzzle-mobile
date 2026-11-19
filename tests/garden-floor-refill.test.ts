import {describe,it,expect} from 'vitest';
import {createGame,applyAction,actionWithFrames,replay,stateHash} from '@garden/core';
import {getLevel} from '@garden/content';
import {IMMEDIATE_GARDEN_STAGE_ENGINE_VERSION,type Action} from '@garden/contracts';
import recipes from '../packages/content/src/garden-stage-recipes-v3.json';
import proofs from '../packages/content/src/garden-stage-proofs-v3.json';
import retainedRecipes from '../packages/content/src/garden-stage-recipes-v2.json';
import retainedProofs from '../packages/content/src/garden-stage-proofs-v2.json';
import {gardenStageCandidate} from '../packages/content/src/garden-stage-candidates';
import {boardClip,boardGeometry,cellPosition} from '../apps/client/src/board-geometry';
import {solve} from '../tools/level-validation/validate';

describe('a revealed floor never refills during the same action',()=>{
 it('keeps all 24 maps, seeds and move limits while certifying the new refill order',()=>{
  for(const recipe of recipes){
   const previous=retainedRecipes.find(r=>r.kind===recipe.kind&&r.variant===recipe.variant)!;
   expect(recipe.seed).toBe(previous.seed);expect(recipe.moves).toBe(previous.moves);
   const definition={...gardenStageCandidate(recipe.kind as 'water'|'animal',recipe.variant,IMMEDIATE_GARDEN_STAGE_ENGINE_VERSION),seed:recipe.seed,moves:recipe.moves},proof=proofs.find(p=>p.kind===recipe.kind&&p.variant===recipe.variant)!;
   const result=replay(definition,proof.actions as Action[]);expect(result.accepted).toBe(true);expect(result.state.status).toBe('won');expect(stateHash(result.state)).toBe(recipe.hash);
  }
 });
 it('removes newly connected pieces before the first refill, in every intermediate cascade',()=>{
  let openings=0,intermediate=0;
  for(const proof of proofs){
   const id=(proof.kind==='water'?10:20)+proof.variant*20,level=getLevel(id);
   const retained=proof.actions as Action[];
   // Target selection can change the cascade, so find a current winning path if the old one diverges.
   let actions=retained;
   if(replay(level,retained).state.status!=='won'){
    const result=solve(level);
    actions=(result.status==='won'?result:solve(level,'special')).actions;
   }
   let before=createGame(level);
   for(const action of actions){
    const result=actionWithFrames(before,action);expect(result.state).toEqual(applyAction(before,action).state);
    let prior=before;
    for(const frame of result.frames){
     const connected=frame.state.gardenStage!.connected,fresh=connected.filter(at=>!prior.gardenStage!.connected.includes(at));
     for(const at of connected)expect(frame.state.cells[at]!.tile,`${id} floor ${at}`).toBeNull();
     // Floor progress is emitted before supply. A tile may be destroyed to open
     // a gate, but a replacement must never enter the newly revealed route.
     const reveal=frame.events.findIndex(e=>e.kind==='garden-gate');
     for(const event of frame.events.slice(reveal<0?0:reveal)){
      if(event.type==='fall')expect(connected).not.toContain(event.to);
      if(event.type==='spawn'&&event.kind==='normal')for(const at of event.cells)expect(connected).not.toContain(at);
     }
     if(fresh.length){openings++;expect(reveal).toBeGreaterThanOrEqual(0);}
     if(result.frames.length>1)intermediate++;prior=frame.state;
    }before=result.state;
   }
   expect(before.status).toBe('won');
  }expect(openings).toBeGreaterThan(24);expect(intermediate).toBeGreaterThan(10);
 });
 it('retains published 1.7 replay hashes for active runs and older apps',()=>{
  for(const recipe of retainedRecipes){const proof=retainedProofs.find(p=>p.kind===recipe.kind&&p.variant===recipe.variant)!,level={...gardenStageCandidate(recipe.kind as 'water'|'animal',recipe.variant,'1.7.0'),seed:recipe.seed,moves:recipe.moves};expect(stateHash(replay(level,proof.actions as Action[]).state)).toBe(recipe.hash);}
 });
 it('cuts the complete open cell out of the piece layer while keeping neighbouring tile pixels',()=>{
  for(const width of [320,390,556]){
   const state=createGame(getLevel(10)),open=new Set(state.gardenStage!.connected),geometry=boardGeometry(width,9,9,{left:0,right:0,top:0,bottom:0}),raster=boardClip(geometry,state.cells.map((cell,i)=>cell.exists&&!open.has(i)),null,{left:0,right:0,top:0,bottom:0});
   for(let at=0;at<81;at++){const center=cellPosition(at,geometry),x=Math.floor(center.x*2),y=Math.floor(center.y*2);expect(raster.pixels[(y*raster.width+x)*4+3]).toBe(open.has(at)?0:255);}
  }
 });
});
