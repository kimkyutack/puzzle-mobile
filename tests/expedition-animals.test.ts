import {describe,it,expect} from 'vitest';
import {readFile} from 'node:fs/promises';
import sharp from 'sharp';
import {applyGardenCommand,applyTrustedDecorationGrant,createGardenWorld,DECORATIONS} from '../packages/garden-world/src';
import {liveShopItems} from '../packages/garden-world/src/live';
import {GardenResidents} from '../apps/client/src/garden-world/residents';
import {residentDirectionArt} from '../apps/client/src/garden-world/resident-art';
import {runtimeSchema} from '../apps/api/src/operations';
import {defaultOperationsRuntime} from '../packages/contracts/src/operations';

describe('exclusive expedition animal assets and movement',()=>{
 it('registers all four directions, leisure poses and four walking frames for each new animal',async()=>{
  const registry=await readFile('apps/client/src/garden-world/assets.ts','utf8');expect(registry).toContain('expedition-v50/runtime/*.webp');
  for(const animal of ['panda','fox','red-panda']){
   const id='animal-'+animal,item=DECORATIONS.find(item=>item.id===id)!;expect(item.rotations).toEqual([0,90,180,270]);expect(liveShopItems().some(item=>item.id===id)).toBe(false);
   for(let i=0;i<16;i++){const image=sharp(`packages/assets/expedition-v50/runtime/${animal}-${i}.webp`),metadata=await image.metadata(),stats=await image.stats();expect(metadata).toMatchObject({width:256,height:256,hasAlpha:true});expect(stats.channels[3]!.min).toBe(0);expect(stats.channels[3]!.max).toBe(255);}
   let world=createGardenWorld('exclusive-friend-test');world=applyTrustedDecorationGrant(world,{ownerId:world.ownerId,itemId:id,grantId:'grant-'+animal,instanceIds:[id],source:'event',variant:'classic'});world=applyGardenCommand(world,{type:'place',instanceId:id,x:16,y:16,rotation:270,expectedRevision:world.revision,operationId:'place-'+animal},world.ownerId);
   const residents=new GardenResidents();residents.sync(world);const actor=residents.actors.find(a=>a.id===id)!;expect(actor).toMatchObject({art:id,animal:true,rear:true,facing:-1});
   const images:Record<string,string>={[id+':rear']:'rear'};for(let frame=0;frame<6;frame++)images[`resident:${id}:${frame}`]='pose-'+frame;for(const side of ['front','rear'])for(let frame=0;frame<4;frame++)images[`resident-walk:${id}:${side}:${frame}`]=side+'-'+frame;
   expect(residentDirectionArt(images,actor).art).toBe('rear');for(const pose of ['yawn','sleep','stretch'] as const)expect(residentDirectionArt(images,{...actor,pose,frame:pose==='yawn'?3:pose==='sleep'?4:5}).art).toMatch(/^pose-/);
   for(const rear of [false,true])for(const facing of [-1,1] as const)for(let frame=0;frame<4;frame++)expect(residentDirectionArt(images,{...actor,pose:'walk',rear,facing,frame}).assetId).toBe(`resident-walk:${id}:${rear?'rear':'front'}:${frame}`);
   const poses=new Set<string>();for(let i=0;i<1800;i++){residents.step(.15);poses.add(actor.pose);}expect(poses.has('walk')).toBe(true);expect(poses.has('sleep')).toBe(true);
  }
 });
 it('only permits supported exclusive animals and stable, bounded operator round IDs',()=>{
  const settings=defaultOperationsRuntime();for(const animal of ['rabbit','dog','dragon'])expect(runtimeSchema.safeParse({...settings,gameEvents:{...settings.gameEvents,animalExpedition:{...settings.gameEvents.animalExpedition,animal}}}).success).toBe(false);
  for(const roundId of ['', 'a'.repeat(65),'../other','회차'])expect(runtimeSchema.safeParse({...settings,gameEvents:{...settings.gameEvents,animalExpedition:{...settings.gameEvents.animalExpedition,roundId}}}).success).toBe(false);
 });
});
