import {decorationFootprint,gardenGridToScreen,type DecorationDefinition,type GardenCamera,type GardenPlacement,type GardenRotation} from '../../../../packages/garden-world/src';

/** Front and reverse are separately authored rasters; each has a mirrored companion view. */
export function gardenDirectionArt<T>(images:Record<string,T>,itemId:string,variant:string,rotation:GardenRotation):{art:T;assetId:string;flipped:boolean}{
 const rear=rotation===180||rotation===270,keys=rear?[itemId+':'+variant+':rear',itemId+':rear']:[itemId+':'+variant,itemId];
 const assetId=keys.find(key=>Object.hasOwn(images,key));if(!assetId)throw Error('Missing garden direction art: '+keys[0]);
 return {art:images[assetId]!,assetId,flipped:rotation===90||rotation===270};
}
/** One geometry contract is shared by drawing, ghost dragging and alpha hit testing. */
export function gardenObjectBounds(item:DecorationDefinition,placed:GardenPlacement,art:{width:number;height:number},camera:GardenCamera,grid:{tileWidth:number;tileHeight:number}){
 const foot=decorationFootprint(item,placed.rotation),bottom=gardenGridToScreen({x:placed.x+foot.width,y:placed.y+foot.height},camera,grid);
 const width=(foot.width+foot.height)*grid.tileWidth*camera.zoom/2*.96,height=width*art.height/art.width;
 return {foot,x:bottom.x-width/2,y:bottom.y-height*.98,width,height};
}
