import type {GardenPoint,GridRect} from '../../../../packages/garden-world/src';

/** Test the near edge of the footprint at the same projected column as the feet. */
export function gardenObjectOccludes(feet:GardenPoint,footprint:GridRect){
 const {x,y,width,height}=footprint,right=x+width,front=y+height;
 // Isometric screen columns are x-y. Outside the footprint, use its nearest side.
 const column=Math.max(x-front,Math.min(right-y,feet.x-feet.y));
 const edgeDepth=Math.min(2*right-column,2*front+column);
 return feet.x+feet.y<edgeDepth;
}
