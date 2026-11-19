import {describe,it,expect} from 'vitest';
import {FLOWERLIGHT_GARDEN_GIFTS,flowerlightGiftInstanceIds,FLOWERLIGHT_ID} from '../packages/content/src/flowerlight';
import {applyFlowerlightGardenGifts} from '../packages/garden-world/src/flowerlight';
import {applyGardenCommand,applyTrustedDecorationGrant,createGardenWorld,validateGardenPlacement,gardenLandCells} from '../packages/garden-world/src';
import {projectLiveGarden,liveShopItems} from '../packages/garden-world/src/live';

describe('permanent flowerlight garden gifts',()=>{
 it('installs every earned themed stage in real owned land, without moving an existing decoration',()=>{
  let world=createGardenWorld('festival-garden');world=applyTrustedDecorationGrant(world,{ownerId:world.ownerId,itemId:'garden-tree',variant:'classic',source:'shop',grantId:'tree-grant',instanceIds:['my-tree']});world=applyGardenCommand(world,{type:'place',instanceId:'my-tree',x:16,y:20,rotation:90,operationId:'place-tree',expectedRevision:world.revision},world.ownerId);
  const before=structuredClone(world),next=applyFlowerlightGardenGifts(world,5);expect(world).toEqual(before);expect(next.placements['my-tree']).toEqual(world.placements['my-tree']);
  for(const gift of FLOWERLIGHT_GARDEN_GIFTS)for(const id of flowerlightGiftInstanceIds(gift)){expect(next.owned[id]).toMatchObject({itemId:gift.itemId,variant:gift.variant,source:'event'});expect(next.placements[id]).toBeTruthy();expect(()=>validateGardenPlacement(next,next.placements[id]!)).not.toThrow();}
  expect(Object.keys(next.owned)).toHaveLength(10);expect(applyFlowerlightGardenGifts(next,5)).toBe(next);expect(liveShopItems().some(item=>item.id==='garden-flowerlight-arch')).toBe(false);
 });
 it('migrates completed festival stages and keeps a previously stored or moved gift unchanged',()=>{
  let world=applyFlowerlightGardenGifts(createGardenWorld('festival-migration'),1),arch=flowerlightGiftInstanceIds(FLOWERLIGHT_GARDEN_GIFTS[0])[0]!;
  world=applyGardenCommand(world,{type:'store',instanceId:arch,operationId:'store-arch',expectedRevision:world.revision},world.ownerId);
  const next=projectLiveGarden({id:world.ownerId,restored:[],flowerFestival:{restoredStages:5}},world);expect(next.placements[arch]).toBeUndefined();expect(next.owned[arch]).toEqual(world.owned[arch]);expect(Object.keys(next.owned)).toHaveLength(9);expect(projectLiveGarden({id:world.ownerId,restored:[],flowerFestival:{restoredStages:5}},next)).toBe(next);
 });
 it('never duplicates the original final fountain or moves it after migrating earlier stages',()=>{
  let world=createGardenWorld('legacy-festival');world=applyTrustedDecorationGrant(world,{ownerId:world.ownerId,itemId:'garden-flowerlight-fountain',variant:'classic',source:'event',grantId:FLOWERLIGHT_ID,instanceIds:[FLOWERLIGHT_ID]});
  const next=applyFlowerlightGardenGifts(world,5);expect(Object.values(next.owned).filter(item=>item.itemId==='garden-flowerlight-fountain')).toHaveLength(1);expect(next.placements[FLOWERLIGHT_ID]).toBeUndefined();
 });
 it('keeps gifts in inventory when no free footprint exists and never replaces the player layout',()=>{
  let world=createGardenWorld('full-festival');for(const [i,cell]of [...gardenLandCells(world).values()].entries()){const id='occupied-'+i;world=applyTrustedDecorationGrant(world,{ownerId:world.ownerId,itemId:'garden-planter',variant:'classic',source:'shop',grantId:'grant-'+i,instanceIds:[id]});world=applyGardenCommand(world,{type:'place',instanceId:id,...cell,rotation:0,operationId:'place-'+i,expectedRevision:world.revision},world.ownerId);}
  const before=structuredClone(world.placements),next=applyFlowerlightGardenGifts(world,5);expect(next.placements).toEqual(before);for(const gift of FLOWERLIGHT_GARDEN_GIFTS)for(const id of flowerlightGiftInstanceIds(gift)){expect(next.owned[id]).toBeTruthy();expect(next.placements[id]).toBeUndefined();}expect(applyFlowerlightGardenGifts(next,5)).toBe(next);
 });
});
