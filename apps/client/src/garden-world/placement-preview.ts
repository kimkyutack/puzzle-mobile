import {gardenBounds,validateGardenPlacement,type GardenPlacement,type GardenPoint,type GardenWorldState} from '../../../../packages/garden-world/src';
/** Choose the nearest legal starting spot; moving the preview never changes ownership. */
export function findPreviewPlacement(world:GardenWorldState,instanceId:string,near:GardenPoint):GardenPlacement|null {
 const candidates=[],bounds=gardenBounds(world);
 for(let y=0;y<bounds.height;y++)for(let x=0;x<bounds.width;x++)candidates.push({x,y,distance:(x-near.x)**2+(y-near.y)**2});
 candidates.sort((a,b)=>a.distance-b.distance||a.y-b.y||a.x-b.x);
 for(const point of candidates){const placement:GardenPlacement={instanceId,x:point.x,y:point.y,rotation:0};try{validateGardenPlacement(world,placement);return placement;}catch{}}
 return null;
}
