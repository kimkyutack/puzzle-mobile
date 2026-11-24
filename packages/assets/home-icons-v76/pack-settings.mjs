import sharp from 'sharp';
import {writeFile} from 'node:fs/promises';

const folder=new URL('./',import.meta.url);
const source=new URL('source/settings.png',folder);
const output=new URL('runtime/settings.webp',folder);
const packed=await sharp(source.pathname).trim({threshold:8}).resize(120,120,{fit:'inside',withoutEnlargement:false}).png().toBuffer();
const {width,height}=await sharp(packed).metadata();
await sharp({create:{width:128,height:128,channels:4,background:'#00000000'}})
 .composite([{input:packed,left:Math.floor((128-width)/2),top:Math.floor((128-height)/2)}])
 .webp({lossless:true}).toFile(output.pathname);
const {data,info}=await sharp(output.pathname).ensureAlpha().raw().toBuffer({resolveWithObject:true});
let left=128,top=128,right=-1,bottom=-1;
for(let y=0;y<128;y++)for(let x=0;x<128;x++)if(data[(y*128+x)*info.channels+3]>16){left=Math.min(left,x);top=Math.min(top,y);right=Math.max(right,x);bottom=Math.max(bottom,y);}
const report={width:128,height:128,hasAlpha:true,bounds:{left,top,width:right-left+1,height:bottom-top+1},source:'source/settings.png',runtime:'runtime/settings.webp'};
await writeFile(new URL('settings-report.json',folder),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report));
