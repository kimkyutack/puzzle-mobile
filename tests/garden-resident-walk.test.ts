import {describe,it,expect} from 'vitest';
import {createGardenWorld} from '../packages/garden-world/src';
import {GardenResidents,residentHeading,residentWalkFrame} from '../apps/client/src/garden-world/residents';
import {residentDirectionArt} from '../apps/client/src/garden-world/resident-art';

describe('four diagonal resident walks',()=>{
 it('faces the actual projected direction for humans and animals, including both uphill paths',()=>{
  const cases=[{dx:1,dy:0,rear:false,facing:1,direction:'se'},{dx:0,dy:1,rear:false,facing:-1,direction:'sw'},{dx:0,dy:-1,rear:true,facing:1,direction:'ne'},{dx:-1,dy:0,rear:true,facing:-1,direction:'nw'}] as const;
  for(const animal of [false,true])for(const c of cases){
   const simulation=new GardenResidents();simulation.sync(createGardenWorld('walk-test'));
   const actor=simulation.actors[0]!;Object.assign(actor,{animal,x:15,y:15,target:{x:15+c.dx,y:15+c.dy},until:0});simulation.actors=[actor];simulation.step(.1);
   expect(actor).toMatchObject({pose:'walk',rear:c.rear,facing:c.facing});expect(residentHeading(c.dx,c.dy)).toEqual({rear:c.rear,facing:c.facing});
   const assetId=`resident-walk:${actor.art}:${c.rear?'rear':'front'}:${actor.frame}`;
   expect(residentDirectionArt({[assetId]:'leg-frame'},actor)).toMatchObject({art:'leg-frame',assetId,direction:c.direction,flipped:c.facing===-1});
  }
 });
 it('advances all four leg poses by distance, holds them while paused, and stops at a waypoint',()=>{
  const simulation=new GardenResidents();simulation.sync(createGardenWorld('walk-test'));const actor=simulation.actors[0]!;
  Object.assign(actor,{x:15,y:15,target:{x:16,y:15},route:[],walkDistance:0,phase:0,until:0});simulation.actors=[actor];const frames=new Set<number>();
  for(let i=0;i<26;i++){simulation.step(.1);frames.add(actor.frame);}expect([...frames].sort()).toEqual([0,1,2,3]);
  expect(actor.walkDistance).toBeCloseTo(.936);const before=structuredClone(actor);simulation.step(2,true);expect(actor).toEqual(before);
  for(let i=0;i<3;i++)simulation.step(.1);expect(actor).toMatchObject({x:16,y:15,pose:'idle',frame:0,target:undefined});
  expect(actor.walkDistance).toBeCloseTo(1);expect(residentWalkFrame(.62,false)).toBe(0);expect(residentWalkFrame(.78,true)).toBe(0);
 });
 it('uses animated rear frames instead of the static decoration image and preserves existing leisure poses',()=>{
  const actor={art:'animal-cat',pose:'walk' as const,frame:2,rear:true,facing:1 as const};
  expect(residentDirectionArt({'animal-cat:rear':'static','resident-walk:animal-cat:rear:2':'rear-leg-2'},actor).art).toBe('rear-leg-2');
  expect(()=>residentDirectionArt({'animal-cat:rear':'static'},actor)).toThrow('Missing garden resident art');
  expect(residentDirectionArt({'resident:animal-cat:4':'sleep'},{...actor,pose:'sleep',frame:4}).art).toBe('sleep');
  expect(residentDirectionArt({'resident:visitor_a:0':'standing'},{...actor,art:'visitor_a',pose:'idle',frame:0,rear:false}).art).toBe('standing');
  expect(residentDirectionArt({'animal-cat:rear':'resting-rear'},{...actor,pose:'idle',frame:0}).art).toBe('resting-rear');
 });
 it('keeps the uphill walking view between adjacent route segments instead of flashing the front idle view',()=>{
  const simulation=new GardenResidents();simulation.sync(createGardenWorld('walk-test'));const actor=simulation.actors[0]!;
  Object.assign(actor,{x:15,y:15,target:{x:15,y:14.99},route:[{x:15,y:14}],until:0});simulation.actors=[actor];simulation.step(.1);
  expect(actor).toMatchObject({pose:'walk',rear:true,facing:1});simulation.step(.1);simulation.step(.1);
  expect(actor).toMatchObject({pose:'walk',rear:true,facing:1});expect(actor.y).toBeLessThan(14.99);
 });
});
