import {describe,it,expect} from 'vitest';
import {createPreviewGarden,readPreviewGarden} from '../apps/client/src/garden-world/preview-state';
import {findPreviewPlacement} from '../apps/client/src/garden-world/placement-preview';
import {validateGardenPlacement,applyGardenCommand,storedDecorations} from '../packages/garden-world/src';
describe('independent garden preview',()=>{
 it('creates a legal complete starter scene without any player/account input',()=>{
  const world=createPreviewGarden();expect(world.ownerId).toBe('garden-preview-owner');expect(Object.keys(world.placements)).toHaveLength(67);
  for(const placement of Object.values(world.placements))expect(()=>validateGardenPlacement(world,placement)).not.toThrow();
  expect(readPreviewGarden(JSON.stringify(world)).status).toBe('restored');
 });
 it('saves and restores a real rearrangement while preserving the owned inventory',()=>{
  const world=createPreviewGarden(),stored=storedDecorations(world).find(item=>item.itemId==='garden-bench')!,preview=findPreviewPlacement(world,stored.id,{x:19,y:19})!;
  expect(preview).not.toBeNull();expect(()=>validateGardenPlacement(world,preview)).not.toThrow();
  const placed=applyGardenCommand(world,{...preview,type:'place',operationId:'preview-place-1',expectedRevision:world.revision},world.ownerId);
  const saved=readPreviewGarden(JSON.stringify(placed));expect(saved.status).toBe('restored');expect(saved.world.placements[stored.id]).toEqual(preview);expect(saved.world.owned).toEqual(world.owned);
 });
 it('recovers a broken/foreign/overlapping preview without reading or modifying the live account',()=>{
  expect(readPreviewGarden('invalid-json').status).toBe('invalid');
  const foreign=createPreviewGarden();foreign.ownerId='real-player';expect(readPreviewGarden(JSON.stringify(foreign)).status).toBe('invalid');
  const corrupt=createPreviewGarden();corrupt.placements['garden-bench-1']={...corrupt.placements['garden-bench-0']!,instanceId:'garden-bench-1'};
  expect(readPreviewGarden(JSON.stringify(corrupt)).status).toBe('invalid');
 });
 it('does not mutate or reserve an item when finding a starting placement',()=>{
  const world=createPreviewGarden(),before=structuredClone(world),stored=storedDecorations(world).find(item=>item.itemId==='garden-planter')!;
  expect(findPreviewPlacement(world,stored.id,{x:15,y:15})).not.toBeNull();expect(world).toEqual(before);
 });
});
