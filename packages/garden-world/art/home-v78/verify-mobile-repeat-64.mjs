import sharp from 'sharp';
import {writeFile} from 'node:fs/promises';
const root='packages/garden-world/art/home-v78/',DPR=4,W=512,H=256,TW=64,TH=32,factor=1.008;
for(const [name,source]of [['after','runtime/ground.webp']]){
 const w=Math.round(TW*factor*DPR),h=Math.round(TH*factor*DPR),tile=await sharp(root+source).resize(w,h).png().toBuffer();
 const layers=[];
 for(let y=-20;y<=20;y++)for(let x=-20;x<=20;x++){
  const cx=W*DPR/2+(x-y)*TW*DPR/2,cy=H*DPR/2+(x+y)*TH*DPR/2,left=Math.round(cx-w/2),top=Math.round(cy-h/2);
  if(left<0||top<0||left+w>W*DPR||top+h>H*DPR)continue;
  layers.push({input:tile,left,top});
 }
 const full=await sharp({create:{width:W*DPR,height:H*DPR,channels:4,background:'#87ae3d'}}).composite(layers).png().toBuffer();
 await sharp(full).resize(W,H).png().toFile(root+`verification/mobile-${name}-64x32.png`);
 await sharp(full).resize(W,H).extract({left:176,top:88,width:160,height:80}).resize(640,320,{kernel:'nearest'}).png().toFile(root+`verification/mobile-${name}-detail-64.png`);
}
await writeFile(root+'verification/mobile-repeat-64.json',JSON.stringify({tileWidth:TW,tileHeight:TH,drawFactor:factor,devicePixelRatio:DPR,output:{width:W,height:H},method:'Raster tile repetitions rendered at DPR4 and downsampled to actual 64x32 mobile tile size; directly extracted tile uses original alpha; no procedural grid lines.'},null,2));
