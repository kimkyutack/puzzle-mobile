import sharp from 'sharp';
import {writeFile} from 'node:fs/promises';

const folder=new URL('./',import.meta.url);
const source=new URL('source/chain-promo.png',folder);
const output=new URL('runtime/chain-promo.webp',folder);
const packed=await sharp(source.pathname).trim({threshold:8}).resize(120,120,{fit:'inside',withoutEnlargement:false}).png().toBuffer();
const {width,height}=await sharp(packed).metadata();
const pixels=await sharp({create:{width:128,height:128,channels:4,background:'#00000000'}})
 .composite([{input:packed,left:Math.floor((128-width)/2),top:Math.floor((128-height)/2)}]).ensureAlpha().raw().toBuffer();
for(let i=0;i<pixels.length;i+=4)if(pixels[i+3]<8){pixels[i]=0;pixels[i+1]=0;pixels[i+2]=0;pixels[i+3]=0;}
await sharp(pixels,{raw:{width:128,height:128,channels:4}}).webp({lossless:true}).toFile(output.pathname);
const {data,info}=await sharp(output.pathname).ensureAlpha().raw().toBuffer({resolveWithObject:true});
let left=128,top=128,right=-1,bottom=-1;
for(let y=0;y<128;y++)for(let x=0;x<128;x++)if(data[(y*128+x)*info.channels+3]>16){left=Math.min(left,x);top=Math.min(top,y);right=Math.max(right,x);bottom=Math.max(bottom,y);}
const report={width:128,height:128,hasAlpha:true,bounds:{left,top,width:right-left+1,height:bottom-top+1},overlayCenters:{timer:{x:64,y:85},caption:{x:64,y:110}},source:'source/chain-promo.png',runtime:'runtime/chain-promo.webp'};
await writeFile(new URL('chain-promo-report.json',folder),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report));
