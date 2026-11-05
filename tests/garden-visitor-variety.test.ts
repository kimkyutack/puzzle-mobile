import {describe,it,expect} from 'vitest';
import {applyTrustedRegionUnlock,createGardenWorld} from '../packages/garden-world/src';
import {GardenResidents,VISITOR_ART} from '../apps/client/src/garden-world/residents';

function expanded(owner='visitor-variety'){
 let world=createGardenWorld(owner);
 for(const region of ['workshop','terrace'] as const)world=applyTrustedRegionUnlock(world,region);
 return world;
}
describe('dispersed garden visitors',()=>{
 it('starts across the garden in active, varied walk phases with four appearances',()=>{
  for(const owner of ['one','two','three','four','five']){
   const world=expanded(owner),before=structuredClone(world),simulation=new GardenResidents();simulation.sync(world);
   const people=simulation.actors.filter(actor=>!actor.animal);
   expect(people).toHaveLength(5);expect(new Set(people.map(actor=>actor.art))).toEqual(new Set(VISITOR_ART));
   expect(new Set(people.map(actor=>actor.frame)).size).toBeGreaterThan(1);
   for(const [index,actor]of people.entries()){
    expect(actor.pose).toBe('walk');expect(actor.target).toBeDefined();
    expect(simulation.walkable.has(actor.x+','+actor.y)).toBe(true);
    expect(actor.route.every(p=>simulation.walkable.has(p.x+','+p.y))).toBe(true);
    for(const other of people.slice(index+1))expect(Math.hypot(actor.x-other.x,actor.y-other.y)).toBeGreaterThanOrEqual(4);
   }
   expect(world).toEqual(before);
  }
 });
 it('keeps existing people and their position when garden data refreshes, with stable owner-specific starts',()=>{
  const world=expanded(),a=new GardenResidents(),b=new GardenResidents(),c=new GardenResidents();a.sync(world);b.sync(world);c.sync(expanded('different-owner'));
  expect(a.actors).toEqual(b.actors);expect(a.actors.map(p=>p.home)).not.toEqual(c.actors.map(p=>p.home));
  for(let i=0;i<20;i++)a.step(.1);
  const before=structuredClone(a.actors),references=[...a.actors];a.sync({...world,revision:world.revision+1});
  expect(a.actors).toEqual(before);for(let i=0;i<a.actors.length;i++)expect(a.actors[i]).toBe(references[i]);
 });
});
