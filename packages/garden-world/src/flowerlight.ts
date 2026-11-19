import {FLOWERLIGHT_GARDEN_GIFTS,flowerlightGiftInstanceIds} from '../../content/src/flowerlight';
import {DECORATIONS} from './catalog';
import {applyTrustedDecorationGrant,placementCells,validateGardenPlacement,type GardenWorldState,type GardenPlacement} from './model';
import {gardenLandCells} from './land';

/** Grant earned festival decor once; install only new instances in genuinely free owned cells. */
export function applyFlowerlightGardenGifts(world:GardenWorldState,completedStages:number):GardenWorldState{
 let next=world;
 for(const gift of FLOWERLIGHT_GARDEN_GIFTS.slice(0,completedStages)){
  // A previously moved or stored gift stays exactly where the player left it.
  if(next.grants[gift.grantId])continue;
  const ids=flowerlightGiftInstanceIds(gift);
  next=applyTrustedDecorationGrant(next,{ownerId:next.ownerId,itemId:gift.itemId,variant:gift.variant,grantId:gift.grantId,source:'event',instanceIds:ids});
  const item=DECORATIONS.find(item=>item.id===gift.itemId)!,land=gardenLandCells(next),occupied=new Set<string>();
  for(const placed of Object.values(next.placements)){
   const definition=DECORATIONS.find(d=>d.id===next.owned[placed.instanceId]?.itemId);
   if(definition?.layer===item.layer)for(const cell of placementCells(definition,placed))occupied.add(cell.x+','+cell.y);
  }
  const candidates=[...land.values()].sort((a,b)=>(a.x-gift.near.x)**2+(a.y-gift.near.y)**2-((b.x-gift.near.x)**2+(b.y-gift.near.y)**2)||a.y-b.y||a.x-b.x);
  for(const instanceId of ids){
   for(const point of candidates){
    const placement:GardenPlacement={instanceId,...point,rotation:0},cells=placementCells(item,placement);
    if(cells.some(c=>!land.has(c.x+','+c.y)||occupied.has(c.x+','+c.y)))continue;
    validateGardenPlacement(next,placement);
    next={...next,revision:next.revision+1,placements:{...next.placements,[instanceId]:placement}};
    cells.forEach(c=>occupied.add(c.x+','+c.y));break;
   }
  }
 }
 return next;
}
