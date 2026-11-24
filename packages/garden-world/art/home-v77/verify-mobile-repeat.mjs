import sharp from 'sharp';
import {writeFile} from 'node:fs/promises';
const root='packages/garden-world/art/home-v77/',DPR=4,W=512,H=256,TW=48,TH=24,factor=1.008;
for(const [name,source]of [['before','verification/ground-pre-seam.webp'],['after','runtime/ground.webp']]){
 const w=Math.round(TW*factor*DPR),h=Math.round(TH*factor*DPR),tile=await sharp(root+source).resize(w,h).png().toBuffer();
 const layers=[];
 for(let y=-20;y<=20;y++)for(let x=-20;x<=20;x++){
  const cx=W*DPR/2+(x-y)*TW*DPR/2,cy=H*DPR/2+(x+y)*TH*DPR/2,left=Math.round(cx-w/2),top=Math.round(cy-h/2);
  if(left<0||top<0||left+w>W*DPR||top+h>H*DPR)continue;
  layers.push({input:tile,left,top});
 }
 const full=await sharp({create:{width:W*DPR,height:H*DPR,channels:4,background:'#87ae3d'}}).composite(layers).png().toBuffer();
 await sharp(full).resize(W,H).png().toFile(root+`verification/mobile-${name}-48x24.png`);
 await sharp(full).resize(W,H).extract({left:176,top:88,width:160,height:80}).resize(640,320,{kernel:'nearest'}).png().toFile(root+`verification/mobile-${name}-detail.png`);
}
const before=await sharp(root+'verification/mobile-before-48x24.png').png().toBuffer(),after=await sharp(root+'verification/mobile-after-48x24.png').png().toBuffer();
await sharp({create:{width:W,height:H*2,channels:4,background:'#87ae3d'}}).composite([{input:before,left:0,top:0},{input:after,left:0,top:H}]).png().toFile(root+'verification/mobile-before-after.png');
await writeFile(root+'verification/mobile-repeat.json',JSON.stringify({tileWidth:TW,tileHeight:TH,drawFactor:factor,devicePixelRatio:DPR,output:{width:W,height:H},method:'Raster tile repetitions rendered at DPR4 and downsampled to actual 48x24 mobile tile size; before/after both use original alpha; no procedural grid lines.'},null,2));
