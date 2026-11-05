import {z} from 'zod';
import {DECORATIONS,GARDEN_WORLD,applyGardenCommand,applyTrustedDecorationGrant,applyTrustedRegionUnlock,createGardenWorld,validateGardenPlacement,type GardenWorldState} from '../../../../packages/garden-world/src';
export const PREVIEW_OWNER='garden-preview-owner';
export const PREVIEW_KEY='cloud-garden-world-preview-v1';
export function createPreviewGarden():GardenWorldState {
 let world=createGardenWorld(PREVIEW_OWNER);
 world=applyTrustedRegionUnlock(applyTrustedRegionUnlock(world,'workshop'),'terrace');
 for(const [itemId,quantity]of [['garden-bench',3],['garden-planter',10],['garden-lamp',6],['garden-tree',8],['garden-path-stone',100],['garden-fountain',1],['garden-greenhouse',1]] as const){
  world=applyTrustedDecorationGrant(world,{ownerId:PREVIEW_OWNER,grantId:'sample-'+itemId,itemId,variant:'classic',source:'event',instanceIds:Array.from({length:quantity},(_,i)=>itemId+'-'+i)});
 }
 let operation=0;
 const place=(instanceId:string,x:number,y:number,rotation:0|90=0)=>{world=applyGardenCommand(world,{type:'place',operationId:'sample-layout-'+operation++,expectedRevision:world.revision,instanceId,x,y,rotation},PREVIEW_OWNER);};
 let path=0;
 for(let y=13;y<=19;y++)for(let x=13;x<=19;x++)place('garden-path-stone-'+path++,x,y);
 for(let x=8;x<13;x++)place('garden-path-stone-'+path++,x,16);
 place('garden-fountain-0',15,15);place('garden-greenhouse-0',4,14);
 place('garden-bench-0',13,18);place('garden-bench-1',18,14,90);
 place('garden-planter-0',14,14);place('garden-planter-1',18,18);place('garden-planter-2',14,19);place('garden-planter-3',19,14);
 place('garden-lamp-0',13,13);place('garden-lamp-1',19,19);
 place('garden-tree-0',10,12);place('garden-tree-1',19,11);place('garden-tree-2',20,19);
 return world;
}
const id=z.string().regex(/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,95}$/);
const region=z.enum(['sky','workshop','terrace','pond','forest']);
const schema=z.object({ownerId:z.literal(PREVIEW_OWNER),mapId:z.literal(GARDEN_WORLD.id),revision:z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),unlockedRegions:z.array(region).max(5),owned:z.record(id,z.object({id,itemId:id,variant:z.string().max(40),source:z.enum(['restoration','shop','event'])})),placements:z.record(id,z.object({instanceId:id,x:z.number().int(),y:z.number().int(),rotation:z.union([z.literal(0),z.literal(90),z.literal(180),z.literal(270)])})),grants:z.record(id,z.string().max(30000)),operations:z.record(id,z.string().max(500))});
export function readPreviewGarden(raw:string|null):{world:GardenWorldState;status:'fresh'|'restored'|'invalid'} {
 if(raw===null)return {world:createPreviewGarden(),status:'fresh'};
 try {
  if(raw.length>2_000_000)throw new Error('Oversized preview');
  const world=schema.parse(JSON.parse(raw));
  if(Object.keys(world.owned).length>1000||Object.keys(world.placements).length>1024||Object.keys(world.operations).length>10000||Object.keys(world.grants).length>1000)throw new Error('Oversized preview');
  for(const [key,item]of Object.entries(world.owned))if(key!==item.id||!DECORATIONS.some(def=>def.id===item.itemId&&def.variants.includes(item.variant)))throw new Error('Invalid item');
  for(const [key,placement]of Object.entries(world.placements)){if(key!==placement.instanceId)throw new Error('Invalid placement');validateGardenPlacement(world,placement);}
  return {world,status:'restored'};
 }catch{return {world:createPreviewGarden(),status:'invalid'};}
}
