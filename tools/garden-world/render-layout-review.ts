/** Offline raster placement review only; never presented as a browser screenshot. */
import sharp,{type OverlayOptions} from 'sharp';
import {mkdir} from 'node:fs/promises';
import {createPreviewGarden} from '../../apps/client/src/garden-world/preview-state';
import {DECORATIONS,decorationFootprint,gardenGridToScreen,type GardenPlacement} from '../../packages/garden-world/src';
const width=960,height=720,zoom=.72,grid={tileWidth:96,tileHeight:48},world=createPreviewGarden();
const center=gardenGridToScreen({x:12,y:16},{x:0,y:0,zoom},grid),camera={zoom,x:width/2-center.x,y:height*.48-center.y},tw=96*zoom,th=48*zoom;
const layers:OverlayOptions[]=[];
async function add(path:string|Buffer,x:number,y:number,w:number,h:number,alpha=1){
 const left=Math.round(x),top=Math.round(y),w1=Math.max(1,Math.round(w)),h1=Math.max(1,Math.round(h));
 if(left>=width||top>=height||left+w1<=0||top+h1<=0)return;
 let image=sharp(path).resize(w1,h1).ensureAlpha();
 if(alpha!==1){const pixels=await image.raw().toBuffer({resolveWithObject:true});for(let i=3;i<pixels.data.length;i+=4)pixels.data[i]=Math.round(pixels.data[i]!*alpha);image=sharp(pixels.data,{raw:pixels.info});}
 const crop={left:Math.max(0,-left),top:Math.max(0,-top),width:Math.min(w1,width-left)-Math.max(0,-left),height:Math.min(h1,height-top)-Math.max(0,-top)};
 if(crop.width<=0||crop.height<=0)return;layers.push({input:await image.extract(crop).png().toBuffer(),left:Math.max(0,left),top:Math.max(0,top)});
}
for(let sum=0;sum<64;sum++)for(let y=0;y<32;y++){
 const x=sum-y;if(x<0||x>=32)continue;const at=gardenGridToScreen({x:x+.5,y:y+.5},camera,grid);
 await add('packages/garden-world/art/runtime/ground.png',at.x-tw*.525,at.y-th*.525,tw*1.05,th*1.05);
}
for(const placed of Object.values(world.placements).filter(placed=>world.owned[placed.instanceId]!.itemId==='garden-path-stone')){
 const at=gardenGridToScreen({x:placed.x+.5,y:placed.y+.5},camera,grid);await add('packages/garden-world/art/runtime/path.png',at.x-tw*.504,at.y-th*.504,tw*1.008,th*1.008);
}
const names:Record<string,string>={'garden-bench':'bench','garden-planter':'planter','garden-lamp':'lamp','garden-tree':'tree','garden-fountain':'fountain','garden-greenhouse':'greenhouse'};
const definition=(placed:GardenPlacement)=>DECORATIONS.find(item=>item.id===world.owned[placed.instanceId]!.itemId)!;
const objects=Object.values(world.placements).filter(placed=>names[world.owned[placed.instanceId]!.itemId]);
objects.sort((a,b)=>{const af=decorationFootprint(definition(a),a.rotation),bf=decorationFootprint(definition(b),b.rotation);return a.x+a.y+af.width+af.height-(b.x+b.y+bf.width+bf.height)||a.x-b.x;});
for(const placed of objects){
 const item=definition(placed),foot=decorationFootprint(item,placed.rotation),path='packages/garden-world/art/runtime/'+names[item.id]+'.png',meta=await sharp(path).metadata(),bottom=gardenGridToScreen({x:placed.x+foot.width,y:placed.y+foot.height},camera,grid),w=(foot.width+foot.height)*tw/2*.96,h=w*meta.height!/meta.width!;
 await add(placed.rotation===90?await sharp(path).flop().png().toBuffer():path,bottom.x-w/2,bottom.y-h*.98,w,h);
}
await mkdir('output/verification/garden-world',{recursive:true});
await sharp({create:{width,height,channels:4,background:'#bfdfec'}}).composite(layers).png().toFile('output/verification/garden-world/map-layout-review.png');
console.log('Offline art-placement review rendered; not a browser screenshot.');
