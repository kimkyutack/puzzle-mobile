import {describe,it,expect} from 'vitest';
import {createGame,stateHash} from '@garden/core';
import {getLevel} from '@garden/content';
import {projectDrag,dragIntent,releaseDrag,sameCanvasBounds} from '../apps/client/src/drag-preview';
describe('finger-follow drag projection',()=>{
 it('follows the dominant axis and retains its direction while the finger jitters',()=>{const state=createGame(getLevel(1)),before=stateHash(state);const held=projectDrag(state,24,27,8,50);expect(held).toMatchObject({axis:'x',to:25,x:27,y:0,canRelease:true});expect(projectDrag(state,24,25,40,50,held.axis)).toMatchObject({axis:'x',to:25,x:25,y:0});expect(stateHash(state)).toBe(before);});
 it('never wraps a row edge or moves a locked target',()=>{const state=createGame(getLevel(1));expect(projectDrag(state,6,40,0,50)).toMatchObject({to:null,canRelease:false});state.cells[25]!.obstacleId='locked';expect(projectDrag(state,24,40,0,50)).toMatchObject({to:null,canRelease:false});});
 it('allows a reversal before release and keeps small gestures cancelable',()=>{const state=createGame(getLevel(1));expect(projectDrag(state,24,10,0,50)).toMatchObject({to:25,canRelease:false});expect(projectDrag(state,24,-35,2,50,'x')).toMatchObject({to:23,canRelease:true});expect(projectDrag(state,24,0,0,50,'x')).toMatchObject({to:null,canRelease:false});});
 it('bounds overshoot and refuses seed or missing-cell drag sources',()=>{const state=createGame(getLevel(1));expect(projectDrag(state,24,1000,0,50).x).toBe(54);state.cells[24]!.tile={id:10000,kind:'seed'};expect(projectDrag(state,24,40,0,50).axis).toBe(null);state.cells[24]!.exists=false;expect(projectDrag(state,24,40,0,50).to).toBe(null);});
});
describe('touch swipe intent',()=>{
 it.each([['left',-30,6,23],['right',30,-6,25],['up',6,-30,17],['down',-6,30,31]] as const)('does not let initial perpendicular touch jitter hijack a %s swipe',(_direction,dx,dy,to)=>{
  const state=createGame(getLevel(1)),horizontal=Math.abs(dx)>Math.abs(dy);
  const start=dragIntent(state,24,horizontal?1:5,horizontal?5:1,40);
  expect(start.axis).toBeNull();
  const intended=dragIntent(state,24,dx,dy,40,start.axis);
  expect(intended.projection).toMatchObject({to,canRelease:true});
  expect(intended.axis).toBe(horizontal?'x':'y');
 });
 it('keeps an ambiguous diagonal adjustable until the intended direction is clear',()=>{
  const state=createGame(getLevel(1)),diagonal=dragIntent(state,24,12,13,40);
  expect(diagonal.axis).toBeNull();
  expect(dragIntent(state,24,-29,14,40,diagonal.axis)).toMatchObject({axis:'x',projection:{to:23,canRelease:true}});
 });
 it('retains a deliberate axis and still allows an intentional reversal or cancellation',()=>{
  const state=createGame(getLevel(1)),held=dragIntent(state,24,-25,3,40);
  expect(held.axis).toBe('x');
  expect(dragIntent(state,24,-24,34,40,held.axis).projection.to).toBe(23);
  expect(dragIntent(state,24,25,2,40,held.axis).projection.to).toBe(25);
  expect(dragIntent(state,24,0,0,40,held.axis).projection.canRelease).toBe(false);
 });
 it('never fixes the axis from a blocked or nonexistent neighbour',()=>{
  const state=createGame(getLevel(1)),edge=dragIntent(state,6,30,0,40);
  expect(edge.axis).toBeNull();expect(edge.projection.canRelease).toBe(false);
  expect(dragIntent(state,6,7,30,40,edge.axis)).toMatchObject({axis:'y',projection:{to:13,canRelease:true}});
 });
});
describe('curved swipes and release consistency',()=>{
 it.each([28,40,56])('corrects an initially committed perpendicular axis at %ipx cell size',size=>{
  const state=createGame(getLevel(1));
  const start=dragIntent(state,24,0,size*.4,size);expect(start.axis).toBe('y');
  const end=dragIntent(state,24,-size,size*.4,size,start.axis);
  expect(end).toMatchObject({axis:'x',projection:{to:23,canRelease:true}});
 });
 it('cancels a corrected direction into a blocked target instead of committing the old direction',()=>{
  const state=createGame(getLevel(1));state.cells[23]!.obstacleId='locked';
  const end=dragIntent(state,24,-40,14,40,'y');
  expect(end.projection).toMatchObject({axis:'x',to:null,canRelease:false});
 });
 it('cancels an opposite release coordinate after the last visible left preview',()=>{
  const state=createGame(getLevel(1)),shown=projectDrag(state,24,-30,0,40,'x');
  expect(releaseDrag(state,24,30,0,40,'x',shown)).toMatchObject({cancelled:true,reason:'release-changed-target',projection:{to:23}});
 });
 it('allows intentional reversal shown in a move event and supports a fast flick with no move event',()=>{
  const state=createGame(getLevel(1)),shown=projectDrag(state,24,30,0,40,'x');
  expect(releaseDrag(state,24,31,0,40,'x',shown)).toMatchObject({cancelled:false,projection:{to:25}});
  expect(releaseDrag(state,24,-30,1,40,null,projectDrag(state,24,0,0,40))).toMatchObject({cancelled:false,projection:{to:23}});
 });
 it('keeps returning to the source cancellable and never infers an orthogonal release-only move',()=>{
  const state=createGame(getLevel(1)),shown=projectDrag(state,24,-30,0,40,'x');
  expect(releaseDrag(state,24,0,0,40,'x',shown).projection.canRelease).toBe(false);
  expect(releaseDrag(state,24,1,-40,40,'x',shown).cancelled).toBe(true);
 });
 it('detects a moved, resized or invalid canvas during a held gesture',()=>{
  const bounds={left:20,top:180,width:350,height:350};
  expect(sameCanvasBounds(bounds,{...bounds,top:180.5})).toBe(true);
  for(const change of [{top:220},{left:0},{width:355},{height:0}])expect(sameCanvasBounds(bounds,{...bounds,...change})).toBe(false);
 });
});
