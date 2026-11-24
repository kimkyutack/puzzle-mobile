import sharp from 'sharp';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.dirname(fileURLToPath(import.meta.url));
const canvas={width:512,height:384},anchor={x:256,y:260};
const views=[
 {id:'fence',slope:.5,feet:[{x:280,y:560},{x:1440,y:729}]},
 {id:'fence-rear',slope:-.5,feet:[{x:269,y:780},{x:1530,y:595}]},
];
const results=[];
for(const view of views){
 const {data,info}=await sharp(path.join(root,'source',view.id+'.png')).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 // Suppress low-alpha generation haze outside the real fence, retaining its authored opaque art.
 for(let p=3;p<data.length;p+=4)if(data[p]<64)data[p]=0;
 const [a,b]=view.feet,measuredSlope=(b.y-a.y)/(b.x-a.x),shear=view.slope-measuredSlope;
 const source=sharp(data,{raw:{width:info.width,height:info.height,channels:4}});
 const transformed=await source.affine([[1,0],[shear,1]],{background:{r:0,g:0,b:0,alpha:0}}).png().toBuffer();
 const trim=await sharp(transformed).trim({threshold:10}).png().toBuffer({resolveWithObject:true});
 const body=await sharp(trim.data).resize({width:480}).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 const scaleX=body.info.width/trim.info.width,scaleY=body.info.height/trim.info.height;
 const crop={x:-trim.info.trimOffsetLeft,y:-trim.info.trimOffsetTop};
 const offsetY=shear<0?-Math.floor(shear*info.width):0;
 const projected=view.feet.map(p=>({x:(p.x-crop.x)*scaleX,y:(p.y+shear*p.x+offsetY-crop.y)*scaleY}));
 const midpoint={x:(projected[0].x+projected[1].x)/2,y:(projected[0].y+projected[1].y)/2};
 const left=Math.round(anchor.x-midpoint.x),top=Math.round(anchor.y-midpoint.y);
 if(left<0||top<0||left+body.info.width>canvas.width||top+body.info.height>canvas.height)throw Error('Fence exceeds common canvas: '+view.id+' '+JSON.stringify({left,top,body:body.info}));
 for(let p=3;p<body.data.length;p+=4)if(body.data[p]<8)body.data[p]=0;
 const runtime=path.join(root,'runtime',view.id+'.webp');
 await sharp({create:{...canvas,channels:4,background:{r:0,g:0,b:0,alpha:0}}}).composite([{input:body.data,raw:{width:body.info.width,height:body.info.height,channels:4},left,top}]).webp({quality:96,alphaQuality:100}).toFile(runtime);
 const {data:packed}=await sharp(runtime).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 let x0=512,y0=384,x1=-1,y1=-1;
 for(let y=0;y<384;y++)for(let x=0;x<512;x++)if(packed[(y*512+x)*4+3]){x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x);y1=Math.max(y1,y);}
 const feet=projected.map(p=>({x:p.x+left,y:p.y+top}));
 results.push({id:view.id,footprint:{width:2,height:1},canvas,anchor,measuredSourceFeet:view.feet,measuredSourceSlope:measuredSlope,packingShear:shear,runtimeGroundSlope:(feet[1].y-feet[0].y)/(feet[1].x-feet[0].x),runtimeFeet:feet,alphaBounds:{x:x0,y:y0,width:x1-x0+1,height:y1-y0+1},bytes:(await fs.stat(runtime)).size});
}
await fs.writeFile(path.join(root,'fence-meta.json'),JSON.stringify(results,null,2)+'\n');
console.log(results);
