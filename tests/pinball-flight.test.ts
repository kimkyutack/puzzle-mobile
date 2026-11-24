import {describe,expect,it} from 'vitest';
import {launchAcorn,pinballBoard,PINBALL_LAUNCHES,PINBALL_WIDTH,PINBALL_HEIGHT,PINBALL_POCKETS} from '../packages/content/src/acorn-pinball';
import {PINBALL_PHYSICS_VERSION} from '../packages/contracts/src/garden-games';
import {pinballDisplayY,pinballFlightDuration,pinballFlightFrames,PINBALL_STEP_MS} from '../apps/client/src/pinball-flight';

describe('compositor pinball flight',()=>{
 it('preserves every certified contact and lands in the same pocket at different render sizes',()=>{
  for(const version of [undefined,PINBALL_PHYSICS_VERSION]){
   const board=pinballBoard(3,62,version);
   for(const slot of PINBALL_LAUNCHES.keys()){
    const shot=launchAcorn(board,slot),original=structuredClone(shot);
    for(const [width,height,weekly]of [[210,180,true],[330,400,false]] as const){
     const frames=pinballFlightFrames(shot,width,height,weekly);
     expect(frames).toHaveLength(shot.path.length);expect(frames[0]!.offset).toBe(0);expect(frames.at(-1)!.offset).toBe(1);
     const last=String(frames.at(-1)!.transform).match(/translate3d\(([^p]+)px,([^p]+)px,0\)/)!;
     const renderedX=Number(last[1]),renderedY=Number(last[2]);
     expect(Math.floor(renderedX/width*PINBALL_POCKETS)).toBe(shot.pocket);
     expect(renderedY/height*PINBALL_HEIGHT).toBeCloseTo(pinballDisplayY(shot.path.at(-1)!.y,weekly));
     for(const hit of shot.hits)expect(frames[hit.tick]!.transform).toContain(`${shot.path[hit.tick]!.x/PINBALL_WIDTH*width}px`);
    }
    expect(shot).toEqual(original);
    expect(pinballFlightDuration(shot)/(shot.path.length-1)).toBeCloseTo(PINBALL_STEP_MS);
   }
  }
 });
 it('keeps the shared weekly projection continuous where pockets become taller',()=>{
  expect(pinballDisplayY(270,true)).toBeCloseTo(pinballDisplayY(270+1e-7,true),5);
  expect(pinballDisplayY(304,false)).toBe(304);
 });
});
