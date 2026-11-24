import sharp from 'sharp';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.dirname(fileURLToPath(import.meta.url));
const canvas={width:640,height:640},anchor={x:320,y:628};
const results=[];
for(const id of ['cherry-tree','cherry-tree-rear']){
 const {data,info}=await sharp(path.join(root,'source',id+'.png')).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 for(let p=3;p<data.length;p+=4)if(data[p]<16)data[p]=0;
 const cleaned=await sharp(data,{raw:{width:info.width,height:info.height,channels:4}}).png().toBuffer();
 const body=await sharp(cleaned).trim({threshold:10}).resize({width:592,height:592,fit:'inside'}).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 for(let p=3;p<body.data.length;p+=4)if(body.data[p]<8)body.data[p]=0;
 const left=Math.round(anchor.x-body.info.width/2),top=anchor.y-body.info.height;
 const runtime=path.join(root,'runtime',id+'.webp');
 await sharp({create:{...canvas,channels:4,background:{r:0,g:0,b:0,alpha:0}}}).composite([{input:body.data,raw:{width:body.info.width,height:body.info.height,channels:4},left,top}]).webp({quality:96,alphaQuality:100}).toFile(runtime);
 const {data:decoded}=await sharp(runtime).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 let x0=640,y0=640,x1=-1,y1=-1;
 for(let y=0;y<640;y++)for(let x=0;x<640;x++)if(decoded[(y*640+x)*4+3]){x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x);y1=Math.max(y1,y);}
 results.push({id,canvas,anchor,body:{width:body.info.width,height:body.info.height,left,top},alphaBounds:{x:x0,y:y0,width:x1-x0+1,height:y1-y0+1},bytes:(await fs.stat(runtime)).size});
}
await fs.writeFile(path.join(root,'cherry-tree-meta.json'),JSON.stringify(results,null,2)+'\n');
console.log(results);
