import type {GardenWorldState} from './model';

export interface GardenVisitResponse {
 owner:{userId:string;nickname:string;level:number};
 world:GardenWorldState;
 /** Absent on older servers, which cannot acknowledge invitation visits. */
 invitationVisits?:true;
}

/** A display snapshot contains placed objects only, never the bag or grant/command receipts. */
export function gardenVisitWorld(world:GardenWorldState):GardenWorldState {
 const owned:GardenWorldState['owned']={},placements:GardenWorldState['placements']={};
 for(const [id,placement] of Object.entries(world.placements)){
  const item=world.owned[id];if(!item)continue;
  owned[id]={id:item.id,itemId:item.itemId,variant:item.variant,source:item.source};
  placements[id]={instanceId:id,x:placement.x,y:placement.y,rotation:placement.rotation};
 }
 return {ownerId:world.ownerId,mapId:world.mapId,revision:world.revision,unlockedRegions:[...world.unlockedRegions],
  ...(world.expansions?{expansions:[...world.expansions]}:{}),owned,placements,grants:{},operations:{}};
}
