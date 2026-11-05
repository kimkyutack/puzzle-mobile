import {describe,it,expect} from 'vitest';
import {hammerPose,rakePose,curvedPoint,rainbowHeroPose} from '../apps/client/src/effect-motion';
describe('distinct tool motion with fixed impact anchors',()=>{
 it('enlarges the rainbow to more than twice its size and keeps it visible until the actual target impact',()=>{
  const face={x:0,y:0,width:315,height:315};
  for(const origin of [{x:17.5,y:17.5},{x:297.5,y:17.5},{x:17.5,y:297.5},{x:297.5,y:297.5},{x:157.5,y:157.5}]){
   expect(rainbowHeroPose(0,origin,35,face,900,650)).toMatchObject({...origin,scale:1,alpha:1});
   for(const ms of [800,900,1300,1550]){const pose=rainbowHeroPose(ms,origin,35,face,900,650);expect(pose.scale).toBeGreaterThan(2);expect(pose.alpha).toBe(1);expect(pose.x-pose.scale*35/2).toBeGreaterThanOrEqual(0);expect(pose.x+pose.scale*35/2).toBeLessThanOrEqual(315);expect(pose.y-pose.scale*35/2).toBeGreaterThanOrEqual(0);expect(pose.y+pose.scale*35/2).toBeLessThanOrEqual(315);}
   expect(rainbowHeroPose(1810,origin,35,face,900,650).alpha).toBe(0);
  }
 });
 it('keeps all four corner preparations inside the board and lands exactly at 760 ms',()=>{for(const target of [{x:25,y:25},{x:325,y:25},{x:25,y:325},{x:325,y:325}]){for(const ms of [0,100,250,350,500,579]){const pose=hammerPose(ms,target,50,350,350);expect(pose.x).toBeGreaterThan(20);expect(pose.x).toBeLessThan(330);expect(pose.y).toBeGreaterThan(20);expect(pose.y).toBeLessThan(330);}expect(hammerPose(760,target,50,350,350)).toMatchObject(target);expect(hammerPose(1120,target,50,350,350).alpha).toBe(0);}});
 it('winds back before an accelerating strike and rebounds after the hit',()=>{const target={x:175,y:175},ready=hammerPose(300,target,50,350,350),wound=hammerPose(570,target,50,350,350),early=hammerPose(620,target,50,350,350),late=hammerPose(740,target,50,350,350),recoil=hammerPose(900,target,50,350,350);expect(Math.abs(wound.rotation)).toBeGreaterThan(Math.abs(ready.rotation)+.7);expect(Math.hypot(late.x-target.x,late.y-target.y)).toBeLessThan(Math.hypot(early.x-target.x,early.y-target.y));expect(recoil.y).not.toBe(target.y);});
 it('keeps rake endpoints fixed and transposes row travel into column travel',()=>{const row=rakePose(.5,{x:100,y:150},{x:300,y:150},true,1,50),column=rakePose(.5,{x:150,y:100},{x:150,y:300},false,1,50);expect(row.x).toBe(column.y);expect(row.y).toBe(column.x);expect(rakePose(1,{x:100,y:150},{x:300,y:150},true,1,50)).toMatchObject({x:300,y:150});});
 it('curves light packets without changing their actual target endpoints',()=>{const from={x:20,y:40},to={x:180,y:230};expect(curvedPoint(from,to,0,30)).toEqual(from);expect(curvedPoint(from,to,1,30).x).toBeCloseTo(to.x);expect(curvedPoint(from,to,1,30).y).toBeCloseTo(to.y);expect(curvedPoint(from,to,.5,30).x).not.toBe(100);});
});
