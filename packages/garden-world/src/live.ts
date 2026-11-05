import {RESTORATIONS} from '../../content/src';
import {DECORATIONS} from './catalog';
import {applyGardenCommand,applyTrustedDecorationGrant,applyTrustedRegionUnlock,createGardenWorld,validateGardenPlacement,type GardenWorldState} from './model';
import {restorationItemId,restorationSite} from './restoration-sites';

/** Published soft-currency prices; never accept a price or ownership from a client. */
export const GARDEN_SHOP_PRICES:Readonly<Record<string,number>>={
 'garden-path-stone':20,'garden-planter':100,'garden-bench':180,'garden-lamp':120,
 'garden-tree':200,'garden-rose-arch':300,'garden-gazebo':700,'garden-pond':450,
 'garden-picnic':350,'garden-hedge':100,'garden-mushroom':80,
 'animal-rabbit':300,'animal-cat':400,'animal-dog':500
};
/** Read-only migration from earned restorations. Stable grants never re-place moved/stored objects. */
export function projectLiveGarden(player:{id:string;restored:string[]},saved?:GardenWorldState|null):GardenWorldState{
 let world=saved||createGardenWorld(player.id);
 if(world.ownerId!==player.id)throw new Error('Garden owner mismatch');
 for(let index=0;index<RESTORATIONS.length;index++){
  const task=RESTORATIONS[index]!;if(!player.restored.includes(task.id))continue;
  if(task.area!=='sky')world=applyTrustedRegionUnlock(world,task.area as import('./catalog').GardenRegionId);
  const instanceId='restored-'+task.id,grantId='legacy-'+task.id;
  if(world.grants[grantId])continue;
  const itemId=restorationItemId(task);
  world=applyTrustedDecorationGrant(world,{ownerId:player.id,grantId,itemId,variant:'classic',source:'restoration',instanceIds:[instanceId]});
  const placement=restorationSite(task,index);
  // New restoration occupies its old site only when it is still free. Otherwise it goes to the bag.
  try{validateGardenPlacement(world,placement);world=applyGardenCommand(world,{...placement,type:'place',expectedRevision:world.revision,operationId:'initial-'+task.id},player.id);}catch{}
 }
 if(player.restored.includes('sky-path')&&!world.grants['legacy-path-paving']){
  const instanceIds=Array.from({length:49},(_,i)=>'restored-paving-'+i);
  world=applyTrustedDecorationGrant(world,{ownerId:player.id,grantId:'legacy-path-paving',itemId:'garden-path-stone',variant:'classic',source:'restoration',instanceIds});
  let i=0;for(let y=13;y<=19;y++)for(let x=13;x<=19;x++){
   const instanceId=instanceIds[i++]!;try{world=applyGardenCommand(world,{type:'place',instanceId,x,y,rotation:0,expectedRevision:world.revision,operationId:'initial-'+instanceId},player.id);}catch{}
  }
 }
 return world;
}
export const liveShopItems=()=>DECORATIONS.filter(item=>Object.hasOwn(GARDEN_SHOP_PRICES,item.id));
