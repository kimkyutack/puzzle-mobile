export interface GardenPoint {x:number;y:number}
export interface GardenCamera {x:number;y:number;zoom:number}
export interface IsometricGrid {tileWidth:number;tileHeight:number}
export const ISOMETRIC_GRID:IsometricGrid={tileWidth:128,tileHeight:64};
export const GARDEN_ZOOM={min:.45,max:1.8} as const;
function finite(...values:number[]){if(values.some(value=>!Number.isFinite(value)))throw new RangeError('Non-finite garden geometry');}
function validateGrid(grid:IsometricGrid){finite(grid.tileWidth,grid.tileHeight);if(grid.tileWidth<=0||grid.tileHeight<=0)throw new RangeError('Invalid garden grid');}
function validateCamera(camera:GardenCamera){finite(camera.x,camera.y,camera.zoom);if(camera.zoom<=0)throw new RangeError('Invalid garden zoom');}

/** Continuous grid coordinates; a cell center is (column+.5,row+.5). */
export function gardenGridToScreen(point:GardenPoint,camera:GardenCamera,grid:IsometricGrid=ISOMETRIC_GRID):GardenPoint {
 finite(point.x,point.y);validateCamera(camera);validateGrid(grid);
 return {x:(point.x-point.y)*grid.tileWidth/2*camera.zoom+camera.x,y:(point.x+point.y)*grid.tileHeight/2*camera.zoom+camera.y};
}
export function gardenScreenToGrid(point:GardenPoint,camera:GardenCamera,grid:IsometricGrid=ISOMETRIC_GRID):GardenPoint {
 finite(point.x,point.y);validateCamera(camera);validateGrid(grid);
 const x=(point.x-camera.x)/camera.zoom/(grid.tileWidth/2),y=(point.y-camera.y)/camera.zoom/(grid.tileHeight/2);
 return {x:(x+y)/2,y:(y-x)/2};
}
export function gardenScreenToCell(point:GardenPoint,camera:GardenCamera,grid:IsometricGrid=ISOMETRIC_GRID):GardenPoint {
 const cell=gardenScreenToGrid(point,camera,grid);return {x:Math.floor(cell.x),y:Math.floor(cell.y)};
}
/** Pinch/wheel zoom preserves the world point under the user's fingers. */
export function zoomGardenAt(camera:GardenCamera,screenPoint:GardenPoint,requestedZoom:number):GardenCamera {
 validateCamera(camera);finite(screenPoint.x,screenPoint.y,requestedZoom);
 const zoom=Math.max(GARDEN_ZOOM.min,Math.min(GARDEN_ZOOM.max,requestedZoom)),ratio=zoom/camera.zoom;
 return {zoom,x:screenPoint.x-(screenPoint.x-camera.x)*ratio,y:screenPoint.y-(screenPoint.y-camera.y)*ratio};
}
export function panGarden(camera:GardenCamera,delta:GardenPoint):GardenCamera {
 validateCamera(camera);finite(delta.x,delta.y);return {...camera,x:camera.x+delta.x,y:camera.y+delta.y};
}
/** Keep the map's projected bounding rectangle within reach, including when it is smaller than the viewport. */
export function constrainGardenCamera(camera:GardenCamera,map:{width:number;height:number},viewport:{width:number;height:number},margin=48,grid:IsometricGrid=ISOMETRIC_GRID):GardenCamera {
 validateCamera(camera);validateGrid(grid);finite(map.width,map.height,viewport.width,viewport.height,margin);
 if(map.width<=0||map.height<=0||viewport.width<=0||viewport.height<=0||margin<0)throw new RangeError('Invalid garden bounds');
 const left=-map.height*grid.tileWidth/2*camera.zoom,right=map.width*grid.tileWidth/2*camera.zoom,bottom=(map.width+map.height)*grid.tileHeight/2*camera.zoom;
 function clampOffset(offset:number,min:number,max:number,extent:number){
  if(max-min+margin*2<=extent)return (extent-min-max)/2;
  return Math.max(extent-margin-max,Math.min(margin-min,offset));
 }
 return {...camera,x:clampOffset(camera.x,left,right,viewport.width),y:clampOffset(camera.y,0,bottom,viewport.height)};
}
