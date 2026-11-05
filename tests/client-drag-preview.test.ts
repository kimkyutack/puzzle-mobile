import {describe,it,expect} from 'vitest';
import {createGame,stateHash} from '@garden/core';
import {getLevel} from '@garden/content';
import {projectDrag} from '../apps/client/src/drag-preview';
describe('finger-follow drag projection',()=>{
 it('follows the dominant axis and retains its direction while the finger jitters',()=>{const state=createGame(getLevel(1)),before=stateHash(state);const held=projectDrag(state,24,27,8,50);expect(held).toMatchObject({axis:'x',to:25,x:27,y:0,canRelease:true});expect(projectDrag(state,24,25,40,50,held.axis)).toMatchObject({axis:'x',to:25,x:25,y:0});expect(stateHash(state)).toBe(before);});
 it('never wraps a row edge or moves a locked target',()=>{const state=createGame(getLevel(1));expect(projectDrag(state,6,40,0,50)).toMatchObject({to:null,canRelease:false});state.cells[25]!.obstacleId='locked';expect(projectDrag(state,24,40,0,50)).toMatchObject({to:null,canRelease:false});});
 it('allows a reversal before release and keeps small gestures cancelable',()=>{const state=createGame(getLevel(1));expect(projectDrag(state,24,10,0,50)).toMatchObject({to:25,canRelease:false});expect(projectDrag(state,24,-35,2,50,'x')).toMatchObject({to:23,canRelease:true});expect(projectDrag(state,24,0,0,50,'x')).toMatchObject({to:null,canRelease:false});});
 it('bounds overshoot and refuses seed or missing-cell drag sources',()=>{const state=createGame(getLevel(1));expect(projectDrag(state,24,1000,0,50).x).toBe(54);state.cells[24]!.tile={id:10000,kind:'seed'};expect(projectDrag(state,24,40,0,50).axis).toBe(null);state.cells[24]!.exists=false;expect(projectDrag(state,24,40,0,50).to).toBe(null);});
});
