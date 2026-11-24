import {PINBALL_WIDTH,PINBALL_HEIGHT,type PinballShot} from '../../../packages/content/src/acorn-pinball';

export const PINBALL_STEP_MS=1000/60;
export const pinballFlightDuration=(shot:PinballShot)=>Math.max(1,shot.path.length-1)*PINBALL_STEP_MS;
export const pinballDisplayY=(y:number,weekly:boolean)=>weekly?(y<=270?y*.78:210.6+(y-270)*2.188):y;

/** Compositor keyframes use the certified physics path, including every contact. */
export function pinballFlightFrames(shot:PinballShot,width:number,height:number,weekly:boolean):Keyframe[]{
 const first=shot.path[0]!;
 return shot.path.map((point,index)=>({
  offset:shot.path.length===1?0:index/(shot.path.length-1),
  transform:`translate3d(${point.x/PINBALL_WIDTH*width}px,${pinballDisplayY(point.y,weekly)/PINBALL_HEIGHT*height}px,0) translate(-50%,-50%) rotate(${(point.x-first.x)*3}deg)`,
 }));
}
