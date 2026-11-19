import {describe,it,expect} from 'vitest';
import {CHAPTER_OBSTACLE_ENGINE_VERSION,CAMPAIGN_DEVICE_ENGINE_VERSION,type Obstacle} from '@garden/contracts';
import {applyAction,createGame,validateLevel} from '@garden/core';
import {magnetRailPath} from '../apps/client/src/magnet-rail-visual';
import {publishedLevel} from '../apps/api/src/level-content';

const at=(i:number)=>({x:i%9*100,y:Math.floor(i/9)*100});
const rail=(footprint:number[]):Obstacle=>({id:'r',kind:'pipe',endOnly:true,anchor:footprint[0]!,footprint,hp:footprint.length,maxHp:footprint.length});

describe('continuous magnet rail',()=>{
 it('turns along the footprint in either order and caps both ends of a single cell',()=>{
  const path=magnetRailPath(rail([10,11,20,29,28]),at,100)!;
  const reverse=magnetRailPath(rail([28,29,20,11,10]),at,100)!;
  expect(path.corners.map(corner=>corner.center)).toEqual([at(11),at(29)]);
  expect(path.corners[0]).toEqual({center:at(11),enter:{x:154,y:100},leave:{x:200,y:146}});
  expect(reverse.ends).toEqual([...path.ends].reverse());
  expect(reverse.corners[0]).toEqual({center:at(29),enter:path.corners[1]!.leave,leave:path.corners[1]!.enter});
  const single=magnetRailPath(rail([20]),at,100)!;
  expect(single.ends.map(end=>end.tip)).toEqual([{x:171,y:200},{x:229,y:200}]);
  expect(single.corners).toEqual([]);
 });
 it('releases only the struck end cell on the updated 414 layout and preserves older maps',()=>{
  const level=publishedLevel(414,CHAPTER_OBSTACLE_ENGINE_VERSION),old=publishedLevel(414,CAMPAIGN_DEVICE_ENGINE_VERSION);
  expect(validateLevel(level)).toEqual([]);
  expect(old.strategy?.id).toBe('mix/switch/pots/1');
  expect(level.obstacles.find(o=>o.endOnly)?.footprint.length).toBeGreaterThanOrEqual(10);
  const state=createGame(level),magnet=Object.values(state.obstacles).find(o=>o.endOnly)!;
  const start=applyAction(state,{type:'booster',item:'hammer',at:magnet.footprint[0]});
  const end=applyAction(state,{type:'booster',item:'hammer',at:magnet.footprint.at(-1)});
  expect(start.events.find(event=>event.kind==='pipe')?.obstacleAfter?.footprint).toEqual(magnet.footprint.slice(1));
  expect(end.events.find(event=>event.kind==='pipe')?.obstacleAfter?.footprint).toEqual(magnet.footprint.slice(0,-1));
 });
});
