import {describe,expect,it} from 'vitest';
import {gardenVisitWorld,createGardenWorld,applyTrustedDecorationGrant} from '../packages/garden-world/src';

describe('garden visit display snapshot',()=>{
 it('includes placed objects and land, excluding the bag and all private receipts',()=>{
  const granted=applyTrustedDecorationGrant(createGardenWorld('garden-owner'),{ownerId:'garden-owner',grantId:'secret-purchase-receipt',itemId:'garden-bench',variant:'classic',source:'shop',instanceIds:['placed-bench','bag-bench']});
  const world={...granted,placements:{'placed-bench':{instanceId:'placed-bench',x:15,y:17,rotation:90 as const}},expansions:['plot-1'],operations:{'secret-command':'private-input'}};
  const before=structuredClone(world),view=gardenVisitWorld(world);
  expect(view.owned).toEqual({'placed-bench':world.owned['placed-bench']});
  expect(view.placements).toEqual(world.placements);
  expect(view.expansions).toEqual(world.expansions);
  expect(view.grants).toEqual({});expect(view.operations).toEqual({});
  expect(JSON.stringify(view)).not.toMatch(/bag-bench|secret-|private-input/);
  view.placements['placed-bench']!.x=1;view.owned['placed-bench']!.variant='festival';view.unlockedRegions.length=0;view.expansions!.length=0;
  expect(world).toEqual(before);
 });
 it('supports empty gardens saved before expansion support without adding fake decorations',()=>{
  const world=createGardenWorld('new-gardener'),view=gardenVisitWorld(world);
  expect(view.placements).toEqual({});expect(view.owned).toEqual({});expect(view.expansions).toBeUndefined();
  expect(view.ownerId).toBe('new-gardener');
 });
});
