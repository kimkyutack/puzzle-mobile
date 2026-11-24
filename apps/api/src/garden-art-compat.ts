import type {GardenWorldState} from '../../../packages/garden-world/src';
import {GARDEN_MARKET_ART,GARDEN_MARKET_ITEMS,GARDEN_BOTANICAL_ART,GARDEN_BOTANICAL_ITEMS,GARDEN_INVITE_ART} from '../../../packages/garden-world/src/catalog';

const marketFallback=new Map<string,string>(GARDEN_MARKET_ITEMS.map(([id,,,,,,,,fallback])=>[id,fallback]));
const botanicalFallback=new Map<string,string>(GARDEN_BOTANICAL_ITEMS.map(([id,,,,,,,,fallback])=>[id,fallback]));
export function gardenArtCapabilities(art:string|null){
 const invitation=art===GARDEN_INVITE_ART,botanical=invitation||art===GARDEN_BOTANICAL_ART,market=botanical||art===GARDEN_MARKET_ART,minigames=market||art==='garden-v63',showcase=minigames||art==='garden-v62';
 const festival=showcase||art==='garden-v51',expedition=festival||art==='expedition-v50';
 return {invitation,botanical,market,minigames,showcase,festival,expedition,flowerlight:expedition||art==='flowerlight-v42'};
}
/** Wire-only fallback. Never rewrite the canonical grant, instance ID, or saved world. */
export function compatibleGardenArt(data:unknown,flowerlightArt:boolean,expeditionArt=false,festivalArchArt=false,showcaseArt=false,minigameArt=false,marketArt=false,botanicalArt=false,invitationArt=false):unknown {
 if(!data||typeof data!=='object'||!('world' in data))return data;
 const world=data.world as GardenWorldState|undefined;
 if(!world?.owned)return data;
 const itemFallback=(itemId:string)=>
  !invitationArt&&itemId==='garden-starlight-wish-pavilion'?'garden-gazebo':
  !botanicalArt&&botanicalFallback.has(itemId)?botanicalFallback.get(itemId)!:
  !marketArt&&marketFallback.has(itemId)?marketFallback.get(itemId)!:
  !minigameArt&&(itemId==='garden-acorn-cottage'||itemId==='garden-waterwork-pavilion')?'garden-gazebo':
  !showcaseArt&&(itemId==='garden-lotus-pavilion'||itemId==='garden-aurora-conservatory')?'garden-gazebo':
  !festivalArchArt&&itemId==='garden-flowerlight-arch'?'garden-rose-arch':
  !flowerlightArt&&itemId==='garden-flowerlight-fountain'?'garden-fountain':
  !expeditionArt&&['animal-panda','animal-fox','animal-red-panda'].includes(itemId)?'animal-dog':itemId;
 let owned:GardenWorldState['owned']|undefined;
 for(const [id,item]of Object.entries(world.owned)){
  const itemId=itemFallback(item.itemId);
  if(itemId!==item.itemId){owned??={...world.owned};owned[id]={...item,itemId};}
 }
 return owned?{...data,world:{...world,owned}}:data;
}
