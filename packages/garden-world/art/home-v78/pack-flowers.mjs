import sharp from 'sharp';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.dirname(fileURLToPath(import.meta.url));
const sheet=path.join(root,'source/flowers-sheet.png'),sheetMeta=await sharp(sheet).metadata();
const kinds=['pink-flower-bed','daisy-bed','blue-hydrangea'];
const canvas={width:512,height:384},anchor={x:256,y:372},results=[];
for(let row=0;row<2;row++)for(let col=0;col<3;col++){
 const id=kinds[col]+(row?'-rear':'');
 const x=Math.round(sheetMeta.width*col/3),y=Math.round(sheetMeta.height*row/2),right=Math.round(sheetMeta.width*(col+1)/3),bottom=Math.round(sheetMeta.height*(row+1)/2);
 const cell={left:x,top:y,width:right-x,height:bottom-y};
 const sourceFile=path.join(root,'source',id+'.png');
 await sharp(sheet).extract(cell).png().toFile(sourceFile);
 const {data,info}=await sharp(sourceFile).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 for(let p=3;p<data.length;p+=4)if(data[p]<16)data[p]=0;
 const clean=await sharp(data,{raw:{width:info.width,height:info.height,channels:4}}).png().toBuffer();
 const body=await sharp(clean).trim({threshold:10}).resize({width:456,height:320,fit:'inside'}).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 for(let p=3;p<body.data.length;p+=4)if(body.data[p]<8)body.data[p]=0;
 const left=Math.round(anchor.x-body.info.width/2),top=anchor.y-body.info.height;
 const runtime=path.join(root,'runtime',id+'.webp');
 await sharp({create:{...canvas,channels:4,background:{r:0,g:0,b:0,alpha:0}}}).composite([{input:body.data,raw:{width:body.info.width,height:body.info.height,channels:4},left,top}]).webp({quality:96,alphaQuality:100}).toFile(runtime);
 const {data:decoded}=await sharp(runtime).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 let x0=512,y0=384,x1=-1,y1=-1;
 for(let y=0;y<384;y++)for(let x=0;x<512;x++)if(decoded[(y*512+x)*4+3]){x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x);y1=Math.max(y1,y);}
 results.push({id,kind:kinds[col],view:row?'rear':'front',cell,footprint:{width:1,height:1},canvas,anchor,body:{width:body.info.width,height:body.info.height,left,top},alphaBounds:{x:x0,y:y0,width:x1-x0+1,height:y1-y0+1},bytes:(await fs.stat(runtime)).size});
}
await fs.writeFile(path.join(root,'flowers-meta.json'),JSON.stringify(results,null,2)+'\n');console.log(results);
