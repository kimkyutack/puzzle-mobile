import {decorationFootprint,gardenGridToScreen,type DecorationDefinition,type GardenCamera,type GardenPlacement,type GardenRotation} from '../../../../packages/garden-world/src';

// These source views run along the opposite grid diagonal from their footprint.
const mirroredArt=new Set([
 'garden-pond','garden-pond:rear','garden-carriage','garden-flowerlight-arch',
 'garden-rose-arch:rear','garden-greenhouse:rear','garden-post-office:rear','garden-forest-station:rear',
 'garden-wood-fence:rear','garden-swing:rear','garden-stone-bridge:rear'
]);

/** Front and reverse are separately authored rasters; each has a mirrored companion view. */
export function gardenDirectionArt<T>(images:Record<string,T>,itemId:string,variant:string,rotation:GardenRotation):{art:T;assetId:string;flipped:boolean}{
 const rear=rotation===180||rotation===270,keys=rear?[itemId+':'+variant+':rear',itemId+':rear']:[itemId+':'+variant,itemId];
 const assetId=keys.find(key=>Object.hasOwn(images,key));if(!assetId)throw Error('Missing garden direction art: '+keys[0]);
 return {art:images[assetId]!,assetId,flipped:(rotation===90||rotation===270)!==mirroredArt.has(assetId)};
}
/** One geometry contract is shared by drawing, ghost dragging and alpha hit testing. */
export function gardenObjectBounds(item:DecorationDefinition,placed:GardenPlacement,art:{width:number;height:number},camera:GardenCamera,grid:{tileWidth:number;tileHeight:number}){
 const foot=decorationFootprint(item,placed.rotation);
 const center=gardenGridToScreen({x:placed.x+foot.width/2,y:placed.y+foot.height/2},camera,grid);
 const bottom=center.y+(foot.width+foot.height)*grid.tileHeight*camera.zoom/4;
 const width=(foot.width+foot.height)*grid.tileWidth*camera.zoom/2*.96,height=width*art.height/art.width;
 return {foot,x:center.x-width/2,y:bottom-height*.98,width,height};
}
