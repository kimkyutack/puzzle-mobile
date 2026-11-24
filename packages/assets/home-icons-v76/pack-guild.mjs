import sharp from 'sharp';
import {writeFile} from 'node:fs/promises';
const root='packages/assets/home-icons-v76/';
const source=root+'source/guild.png';
const {data,info}=await sharp(source).ensureAlpha().raw().toBuffer({resolveWithObject:true});
function bounds(pixels,width,height,threshold=8){let left=width,top=height,right=-1,bottom=-1;for(let y=0;y<height;y++)for(let x=0;x<width;x++){if(pixels[(y*width+x)*4+3]<threshold)continue;left=Math.min(left,x);top=Math.min(top,y);right=Math.max(right,x);bottom=Math.max(bottom,y);}return {left,top,width:right-left+1,height:bottom-top+1,right,bottom};}
const crop=bounds(data,info.width,info.height);
const {data:fitted,info:fit}=await sharp(source).extract({left:crop.left,top:crop.top,width:crop.width,height:crop.height}).resize(120,120,{fit:'inside'}).png().toBuffer({resolveWithObject:true});
await sharp({create:{width:128,height:128,channels:4,background:'#00000000'}}).composite([{input:fitted,left:Math.floor((128-fit.width)/2),top:Math.floor((128-fit.height)/2)}]).webp({lossless:true}).toFile(root+'runtime/guild.webp');
const decoded=await sharp(root+'runtime/guild.webp').ensureAlpha().raw().toBuffer({resolveWithObject:true});
const alpha=bounds(decoded.data,decoded.info.width,decoded.info.height);
await writeFile(root+'reports/guild.json',JSON.stringify({tool:'image_gen.imagegen',source:{width:info.width,height:info.height,alphaBounds:crop},runtime:{width:128,height:128,hasAlpha:decoded.info.channels===4,alphaBounds:alpha,alphaThreshold:8,padding:{left:alpha.left,top:alpha.top,right:127-alpha.right,bottom:127-alpha.bottom}},packing:'Alpha crop and aspect-preserving resize into 120px; centered in transparent 128px canvas. No recolor, no procedural drawing.'},null,2));
console.log({crop,alpha});
