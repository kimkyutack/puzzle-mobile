import {describe,it,expect} from 'vitest';
import {createGardenWorld,gardenLandCells,applyGardenExpansion,isGardenCellUnlocked} from '../packages/garden-world/src';
import {gardenLandEdges} from '../apps/client/src/garden-world/terrain-art';
describe('visible garden ownership boundary',()=>{
 it('follows the initial legal land and moves immediately when a connected plot is purchased',()=>{
  const world=createGardenWorld('terrain-owner'),land=gardenLandCells(world);expect(land.size).toBe(144);expect(gardenLandEdges(land)).toHaveLength(48);
  expect(isGardenCellUnlocked(world,22,12)).toBe(false);
  const expanded=applyGardenExpansion(world,{plotId:'land-22-12',expectedRevision:world.revision,operationId:'terrain-expansion'},world.ownerId),next=gardenLandCells(expanded);
  expect(next.size).toBe(164);expect(isGardenCellUnlocked(expanded,22,12)).toBe(true);expect(gardenLandEdges(next)).toHaveLength(58);
  // The old shared border disappears rather than outlining two separate plots.
  expect(gardenLandEdges(next).some(e=>e.from.x===22&&e.to.x===22&&Math.min(e.from.y,e.to.y)>=12&&Math.max(e.from.y,e.to.y)<=16)).toBe(false);
 });
 it('keeps notches and disconnected regions instead of painting their bounding rectangle',()=>{
  const land=new Map(['0,0','1,0','0,1'].map(key=>{const[x,y]=key.split(',').map(Number);return[key,{x,y}] as const}));
  const edges=gardenLandEdges(land);expect(edges).toHaveLength(8);expect(edges).toContainEqual({from:{x:2,y:1},to:{x:1,y:1}});expect(edges).toContainEqual({from:{x:1,y:1},to:{x:1,y:2}});
  const world=createGardenWorld('terrain-regions');world.unlockedRegions=['sky','forest'];const cells=gardenLandCells(world);expect(cells.has('4,4')).toBe(false);expect(gardenLandEdges(cells).length).toBeGreaterThan(48);
 });
});
