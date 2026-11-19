import {describe,expect,it} from 'vitest';
import {boardSpriteSize,inkBounds} from '../apps/client/src/board-sprite-art';

describe('board sprite footprints',()=>{
 it('finds the visible body without counting transparent padding or a faint fringe',()=>{
  const rgba=new Uint8Array(8*8*4);
  const alpha=(x:number,y:number,value:number)=>{rgba[(y*8+x)*4+3]=value;};
  alpha(0,0,17);
  alpha(2,1,240);
  alpha(5,6,255);
  expect(inkBounds(rgba,8,8)).toEqual({left:2,top:1,right:6,bottom:7});
  expect(inkBounds(new Uint8Array(16),2,2)).toBeUndefined();
 });

 it('fills both axes for thin art within one-cell and multi-cell footprints',()=>{
  expect(boardSpriteSize({width:210,height:114},48,48,'item')).toEqual({width:48*.985,height:48*.91});
  expect(boardSpriteSize({width:136,height:223},96,96)).toEqual({width:96*.965,height:96*.99});
  const cabinet=boardSpriteSize({width:512,height:251},96,48);
  expect(cabinet.width).toBeLessThanOrEqual(96);
  expect(cabinet.height).toBeGreaterThan(46);
 });

 it('preserves rocket proportions with room between adjacent tips in both directions',()=>{
  const row=boardSpriteSize({width:300,height:174},40,40,'rocket');
  const column=boardSpriteSize({width:174,height:300},40,40,'rocket');
  expect(row.width).toBeCloseTo(36);
  expect(row.height/row.width).toBeCloseTo(174/300);
  expect(column).toEqual({width:row.height,height:row.width});
 });
});
