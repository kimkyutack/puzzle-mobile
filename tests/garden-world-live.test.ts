import {describe,it,expect} from 'vitest';
import {RESTORATIONS} from '@garden/content';
import {projectLiveGarden,GARDEN_SHOP_PRICES,liveShopItems} from '../packages/garden-world/src/live';
import {applyGardenCommand,validateGardenPlacement} from '../packages/garden-world/src';

const player={id:'live-gardener',restored:RESTORATIONS.map(t=>t.id)};
describe('live home migration',()=>{
 it('migrates all earned facilities into valid unlocked footprints without changing the player',()=>{
  const before=structuredClone(player),world=projectLiveGarden(player);
  expect(player).toEqual(before);expect(Object.keys(world.placements)).toHaveLength(112);
  expect(world.unlockedRegions).toEqual(['sky','workshop','terrace','postal','firefly','station']);
  for(const placed of Object.values(world.placements))expect(()=>validateGardenPlacement(world,placed)).not.toThrow();
 });
 it('does not award demo inventory, animals, or unearned buildings',()=>{
  const world=projectLiveGarden({id:player.id,restored:[]});
  expect(world.owned).toEqual({});expect(world.unlockedRegions).toEqual(['sky']);
 });
 it('is stable across reloads and never returns stored restoration objects to their old site',()=>{
  let world=projectLiveGarden(player);const id='restored-sky-bench';
  world=applyGardenCommand(world,{type:'store',instanceId:id,operationId:'store-bench-001',expectedRevision:world.revision},player.id);
  expect(projectLiveGarden(player,JSON.parse(JSON.stringify(world)))).toEqual(world);
  expect(world.placements[id]).toBeUndefined();expect(world.owned[id]).toBeTruthy();
 });
 it('adds only newly earned restoration grants and keeps prior user layout',()=>{
  const partial={id:player.id,restored:['sky-path','sky-planter']};let world=projectLiveGarden(partial);
  world=applyGardenCommand(world,{type:'move',instanceId:'restored-sky-planter',x:20,y:20,rotation:0,operationId:'move-planter-001',expectedRevision:world.revision},player.id);
  const next=projectLiveGarden({...partial,restored:[...partial.restored,'sky-bench']},world);
  expect(next.placements['restored-sky-planter']).toEqual(world.placements['restored-sky-planter']);
  expect(next.owned['restored-sky-bench']).toBeTruthy();expect(Object.keys(next.owned)).toHaveLength(Object.keys(world.owned).length+1);
 });
 it('keeps new restoration in the bag if the user already occupied its default site',()=>{
  let world=projectLiveGarden({id:player.id,restored:['sky-path','sky-planter']});
  world=applyGardenCommand(world,{type:'move',instanceId:'restored-sky-planter',x:19,y:14,rotation:0,operationId:'occupy-future-site',expectedRevision:world.revision},player.id);
  const next=projectLiveGarden({id:player.id,restored:['sky-path','sky-planter','sky-bench']},world);
  expect(next.owned['restored-sky-bench']).toBeTruthy();expect(next.placements['restored-sky-bench']).toBeUndefined();
 });
 it('does not migrate a foreign account world',()=>{expect(()=>projectLiveGarden({...player,id:'other'},projectLiveGarden(player))).toThrow('owner mismatch')});
 it('publishes only positively priced eligible decor and all three animals',()=>{
  expect(liveShopItems().map(i=>i.id).filter(id=>id.startsWith('animal-'))).toHaveLength(3);
  expect(liveShopItems().every(i=>i.futureShop&&GARDEN_SHOP_PRICES[i.id]!>0)).toBe(true);
  expect(GARDEN_SHOP_PRICES['garden-fountain']).toBeUndefined();
 });
});
