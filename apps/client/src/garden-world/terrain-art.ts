import type {GardenCamera,GardenPoint} from '../../../../packages/garden-world/src';
import type {LoadedArt} from './assets';

const lawnRepeats=new WeakMap<LoadedArt,HTMLCanvasElement>();

/** Only exposed cell edges are visible; adjoining regions/expansions share no seam. */
export function gardenLandEdges(land:ReadonlyMap<string,GardenPoint>){
 const edges:Array<{from:GardenPoint;to:GardenPoint}>=[];
 for(const {x,y}of land.values()){
  if(!land.has(x+','+(y-1)))edges.push({from:{x,y},to:{x:x+1,y}});
  if(!land.has((x+1)+','+y))edges.push({from:{x:x+1,y},to:{x:x+1,y:y+1}});
  if(!land.has(x+','+(y+1)))edges.push({from:{x:x+1,y:y+1},to:{x,y:y+1}});
  if(!land.has((x-1)+','+y))edges.push({from:{x,y:y+1},to:{x,y}});
 }
 return edges;
}

/** Repeat the authored diamond raster across the viewport, including beyond the interactive land. */
export function paintGardenLawn(ctx:CanvasRenderingContext2D,art:LoadedArt,camera:GardenCamera,tileWidth:number,tileHeight:number,width:number,height:number,opacity=1){
 let repeat=lawnRepeats.get(art);
 if(!repeat){
  repeat=document.createElement('canvas');repeat.width=art.width;repeat.height=art.height;
  const context=repeat.getContext('2d')!;
  const draw=(x:number,y:number)=>context.drawImage(art.image,x-art.width*.004,y-art.height*.004,art.width*1.008,art.height*1.008);
  draw(0,0);
  for(const x of [-art.width/2,art.width/2])for(const y of [-art.height/2,art.height/2])draw(x,y);
  lawnRepeats.set(art,repeat);
 }
 const pattern=ctx.createPattern(repeat,'repeat');if(!pattern)return;
 pattern.setTransform(new DOMMatrix().translate(camera.x-tileWidth/2,camera.y).scale(tileWidth/art.width,tileHeight/art.height));
 ctx.save();ctx.globalAlpha=opacity;ctx.fillStyle=pattern;ctx.fillRect(0,0,width,height);ctx.restore();
}
