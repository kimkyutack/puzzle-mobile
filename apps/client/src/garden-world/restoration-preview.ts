import {RESTORATIONS} from '@garden/content';
import {projectLiveGarden} from '../../../../packages/garden-world/src/live';
import type {GardenWorldState} from '../../../../packages/garden-world/src';

/** A read-only construction preview. Ownership and currency still come from the server. */
export function restorationPreview(world:GardenWorldState,taskId?:string){
 if(!taskId||!RESTORATIONS.some(task=>task.id===taskId))return null;
 const instanceId='restored-'+taskId,pending=!world.owned[instanceId];
 const projected=pending?projectLiveGarden({id:world.ownerId,restored:[taskId]},world):world;
 const placement=projected.placements[instanceId];
 // An occupied site sends the earned facility to the bag; do not preview it over a user's layout.
 return placement?{world:projected,placement,pending}:null;
}
