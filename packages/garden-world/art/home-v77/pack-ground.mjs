import sharp from 'sharp';
import {writeFile} from 'node:fs/promises';
const root='packages/garden-world/art/home-v77/';
const {data:source,info}=await sharp(root+'source/ground.png').ensureAlpha().raw().toBuffer({resolveWithObject:true});
let minX=info.width,minY=info.height,maxX=0,maxY=0,count=0,sum=[0,0,0];
for(let y=0;y<info.height;y++)for(let x=0;x<info.width;x++){
 const i=(y*info.width+x)*4;if(source[i+3]<128)continue;
 minX=Math.min(minX,x);minY=Math.min(minY,y);maxX=Math.max(maxX,x);maxY=Math.max(maxY,y);count++;
 for(let c=0;c<3;c++)sum[c]+=source[i+c];
}
const rgb=sum.map(n=>Math.round(n/count));
const background={r:rgb[0],g:rgb[1],b:rgb[2]};
const packed=await sharp(root+'source/ground.png').extract({left:minX,top:minY,width:maxX-minX+1,height:maxY-minY+1}).flatten({background}).resize(256,128,{fit:'fill'}).raw().toBuffer();
const original=await sharp('packages/garden-world/art/runtime/ground.png').ensureAlpha().raw().toBuffer();
const output=Buffer.alloc(256*128*4);
for(let n=0;n<256*128;n++){for(let c=0;c<3;c++)output[n*4+c]=packed[n*3+c];output[n*4+3]=original[n*4+3];}
await sharp(output,{raw:{width:256,height:128,channels:4}}).webp({lossless:true}).toFile(root+'runtime/ground.webp');
const decoded=await sharp(root+'runtime/ground.webp').ensureAlpha().raw().toBuffer();let mismatches=0;for(let n=0;n<256*128;n++)if(decoded[n*4+3]!==original[n*4+3])mismatches++;
const layers=[];for(let y=0;y<5;y++)for(let x=0;x<5;x++)layers.push({input:root+'runtime/ground.webp',left:512+(x-y)*128,top:(x+y)*64});
await sharp({create:{width:1280,height:640,channels:4,background:'#a8c965'}}).composite(layers).png().toFile(root+'verification/ground-tiled.png');
await writeFile(root+'verification/ground-report.json',JSON.stringify({width:256,height:128,hasAlpha:true,originalAlphaMismatches:mismatches,sourceBounds:{left:minX,top:minY,width:maxX-minX+1,height:maxY-minY+1},sourceMeanRgb:rgb,packing:'Trim source alpha bounds, pack to original diamond canvas; retain original alpha exactly. Generated artwork RGB only, no recoloring.'},null,2));
console.log({sourceBounds:{minX,minY,maxX,maxY},rgb,mismatches});
