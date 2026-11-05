import {describe,it,expect} from 'vitest';
import {DECORATIONS,applyGardenCommand,validateGardenPlacement,storedDecorations} from '../packages/garden-world/src';
import {createPreviewGarden,readPreviewGarden} from '../apps/client/src/garden-world/preview-state';
import {findPreviewPlacement} from '../apps/client/src/garden-world/placement-preview';
import {purchasePreviewItem} from '../apps/client/src/garden-world/preview-shop';

describe('decoration and animal sample shop',()=>{
 it('defines distinct placeable animals and a variety of new decorations',()=>{
  expect(DECORATIONS.filter(item=>item.category==='animal').map(item=>item.id)).toEqual(['animal-rabbit','animal-cat','animal-dog']);
  expect(DECORATIONS.filter(item=>item.category==='animal').every(item=>item.width===1&&item.height===1&&item.layer==='object'&&item.futureShop)).toBe(true);
  for(const id of ['garden-rose-arch','garden-gazebo','garden-pond','garden-picnic','garden-hedge','garden-mushroom'])expect(DECORATIONS.some(item=>item.id===id&&item.futureShop)).toBe(true);
  expect(new Set(DECORATIONS.map(item=>item.id)).size).toBe(DECORATIONS.length);
 });
 it('keeps an animal purchased for the demonstration in storage until placement is confirmed',()=>{
  const before=createPreviewGarden(),original=structuredClone(before),result=purchasePreviewItem(before,'animal-rabbit','rabbit-1');
  expect(before).toEqual(original);expect(result.world.owned[result.instanceId]).toMatchObject({itemId:'animal-rabbit',source:'shop'});
  expect(result.world.placements[result.instanceId]).toBeUndefined();expect(storedDecorations(result.world).some(item=>item.id===result.instanceId)).toBe(true);
  expect('coins' in result.world).toBe(false);expect('stars' in result.world).toBe(false);
 });
 it('does not duplicate a retry, and keeps separately purchased animal copies separate',()=>{
  const one=purchasePreviewItem(createPreviewGarden(),'animal-cat','purchase-1'),retry=purchasePreviewItem(one.world,'animal-cat','purchase-1');
  expect(retry.world).toBe(one.world);expect(retry.instanceId).toBe(one.instanceId);
  expect(()=>purchasePreviewItem(one.world,'animal-dog','purchase-1')).toThrow('GRANT_CONFLICT');
  const two=purchasePreviewItem(one.world,'animal-cat','purchase-2');expect(two.instanceId).not.toBe(one.instanceId);
  expect(Object.values(two.world.owned).filter(item=>item.itemId==='animal-cat')).toHaveLength(2);
 });
 it('places and retrieves an animal while enforcing tile occupancy and keeping ownership',()=>{
  let result=purchasePreviewItem(createPreviewGarden(),'animal-dog','dog-1'),world=result.world;
  const spot=findPreviewPlacement(world,result.instanceId,{x:18,y:19})!;
  world=applyGardenCommand(world,{...spot,type:'place',operationId:'place-dog',expectedRevision:world.revision},world.ownerId);
  expect(world.placements[result.instanceId]).toEqual(spot);
  const rabbit=purchasePreviewItem(world,'animal-rabbit','rabbit-2');
  expect(()=>validateGardenPlacement(rabbit.world,{...spot,instanceId:rabbit.instanceId})).toThrow('OCCUPIED');
  world=applyGardenCommand(world,{type:'store',operationId:'store-dog',expectedRevision:world.revision,instanceId:result.instanceId},world.ownerId);
  expect(world.placements[result.instanceId]).toBeUndefined();expect(world.owned[result.instanceId]).toMatchObject({itemId:'animal-dog'});
 });
 it('persists new purchased items without resetting an older saved garden',()=>{
  const legacy=createPreviewGarden(),restored=readPreviewGarden(JSON.stringify(legacy));expect(restored.status).toBe('restored');
  const purchase=purchasePreviewItem(restored.world,'garden-pond','pond-1'),spot=findPreviewPlacement(purchase.world,purchase.instanceId,{x:11,y:19})!;
  const placed=applyGardenCommand(purchase.world,{...spot,type:'place',operationId:'place-pond',expectedRevision:purchase.world.revision},purchase.world.ownerId);
  const saved=readPreviewGarden(JSON.stringify(placed));expect(saved.status).toBe('restored');expect(saved.world.placements[purchase.instanceId]).toEqual(spot);
  for(const [id,placement]of Object.entries(legacy.placements))expect(saved.world.placements[id]).toEqual(placement);
 });
 it('does not offer story landmarks or accept a real-account world',()=>{
  const world=createPreviewGarden();expect(()=>purchasePreviewItem(world,'garden-greenhouse','no-landmark')).toThrow('ITEM_NOT_FOR_SALE');
  expect(()=>purchasePreviewItem(world,'not-an-item','unknown')).toThrow('ITEM_NOT_FOR_SALE');
  expect(()=>purchasePreviewItem({...world,ownerId:'real-player'},'animal-cat','wrong-owner')).toThrow('FORBIDDEN');
 });
 it('retains a purchased item when there is no valid placement space',()=>{
  const result=purchasePreviewItem(createPreviewGarden(),'animal-cat','no-space'),closed={...result.world,unlockedRegions:[]};
  expect(findPreviewPlacement(closed,result.instanceId,{x:18,y:19})).toBeNull();
  expect(storedDecorations(closed).some(item=>item.id===result.instanceId)).toBe(true);
 });
 it('keeps the preview save limit intact and still accepts an old purchase retry at capacity',()=>{
  const purchased=purchasePreviewItem(createPreviewGarden(),'animal-cat','capacity-retry');
  const full={...purchased.world,owned:{...purchased.world.owned}};
  for(let i=Object.keys(full.owned).length;i<1000;i++){const id='capacity-item-'+i;full.owned[id]={id,itemId:'garden-planter',variant:'classic',source:'event'};}
  expect(()=>purchasePreviewItem(full,'animal-dog','new-overflow')).toThrow('꾸미기 보관함이 가득 찼어요.');
  expect(purchasePreviewItem(full,'animal-cat','capacity-retry').world).toBe(full);
  expect(readPreviewGarden(JSON.stringify(full)).status).toBe('restored');
 });
});
