import {describe,it,expect} from 'vitest';
import {RESTORATIONS} from '@garden/content';
import {projectLiveGarden} from '../packages/garden-world/src/live';
import {applyGardenCommand,gardenBounds,validateGardenPlacement} from '../packages/garden-world/src';
import {restorationPreview} from '../apps/client/src/garden-world/restoration-preview';
describe('continuous restoration preview and legacy progress',()=>{
 it('continues an old completed garden with no repeated grant or charge',()=>{
  const restored=RESTORATIONS.slice(0,18).map(t=>t.id),world=projectLiveGarden({id:'old-garden',restored}),before=structuredClone(world);
  const preview=restorationPreview(world,RESTORATIONS[18]!.id)!;
  expect(preview.pending).toBe(true);expect(preview.placement.instanceId).toBe('restored-postal-arrival');
  expect(preview.world.unlockedRegions).toContain('postal');expect(gardenBounds(preview.world).width).toBeGreaterThan(32);
  expect(world).toEqual(before);expect(world.owned['restored-postal-arrival']).toBeUndefined();
  expect(projectLiveGarden({id:'old-garden',restored},JSON.parse(JSON.stringify(world)))).toEqual(world);
 });
 it('previews every next task without modifying the authoritative world, then preserves the exact site on confirmation',()=>{
  let world=projectLiveGarden({id:'story-preview',restored:[]});const restored:string[]=[];
  for(const task of RESTORATIONS){const before=structuredClone(world),preview=restorationPreview(world,task.id)!;expect(preview,task.id).toBeTruthy();expect(world).toEqual(before);
   restored.push(task.id);world=projectLiveGarden({id:world.ownerId,restored},world);
   expect(world.placements['restored-'+task.id],task.id).toEqual(preview.placement);
   expect(()=>validateGardenPlacement(world,preview.placement)).not.toThrow();expect(restorationPreview(world,task.id)?.pending).toBe(false);
  }
 });
 it('never previews over an occupied site or re-places a stored earned object',()=>{
  let world=projectLiveGarden({id:'occupied-site',restored:['sky-path','sky-planter']});world=applyGardenCommand(world,{type:'move',instanceId:'restored-sky-planter',x:19,y:14,rotation:0,expectedRevision:world.revision,operationId:'occupy-next'},world.ownerId);
  expect(restorationPreview(world,'sky-bench')).toBeNull();world=projectLiveGarden({id:world.ownerId,restored:['sky-path','sky-planter','sky-bench']},world);expect(restorationPreview(world,'sky-bench')).toBeNull();
  expect(restorationPreview(world,'unknown')).toBeNull();
 });
});
