import sharp from 'sharp';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.dirname(fileURLToPath(import.meta.url)),sheet=path.join(root,'source/small-cypress-sheet.png');
const meta=await sharp(sheet).metadata(),canvas={width:512,height:640},anchor={x:256,y:628},results=[];
for(let col=0;col<2;col++){
 const id='small-cypress'+(col?'-rear':''),left=Math.round(meta.width*col/2),right=Math.round(meta.width*(col+1)/2),cell={left,top:0,width:right-left,height:meta.height};
 const source=path.join(root,'source',id+'.png');await sharp(sheet).extract(cell).png().toFile(source);
 const {data,info}=await sharp(source).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 for(let p=3;p<data.length;p+=4)if(data[p]<16)data[p]=0;
 const clean=await sharp(data,{raw:{width:info.width,height:info.height,channels:4}}).png().toBuffer();
 const body=await sharp(clean).trim({threshold:10}).resize({width:360,height:592,fit:'inside'}).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 for(let p=3;p<body.data.length;p+=4)if(body.data[p]<8)body.data[p]=0;
 const x=Math.round(anchor.x-body.info.width/2),y=anchor.y-body.info.height,runtime=path.join(root,'runtime',id+'.webp');
 await sharp({create:{...canvas,channels:4,background:{r:0,g:0,b:0,alpha:0}}}).composite([{input:body.data,raw:{width:body.info.width,height:body.info.height,channels:4},left:x,top:y}]).webp({quality:96,alphaQuality:100}).toFile(runtime);
 const {data:decoded}=await sharp(runtime).ensureAlpha().raw().toBuffer({resolveWithObject:true});let x0=512,y0=640,x1=-1,y1=-1;
 for(let y=0;y<640;y++)for(let x=0;x<512;x++)if(decoded[(y*512+x)*4+3]){x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x);y1=Math.max(y1,y);}
 results.push({id,cell,canvas,anchor,footprint:{width:1,height:1},body:{width:body.info.width,height:body.info.height,left:x,top:y},alphaBounds:{x:x0,y:y0,width:x1-x0+1,height:y1-y0+1},bytes:(await fs.stat(runtime)).size});
}
await fs.writeFile(path.join(root,'small-cypress-meta.json'),JSON.stringify(results,null,2)+'\n');console.log(results);
