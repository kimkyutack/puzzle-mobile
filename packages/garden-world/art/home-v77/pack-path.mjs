import sharp from 'sharp';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.dirname(fileURLToPath(import.meta.url));
const {data:generated,info}=await sharp(path.join(root,'source/path.png')).trim({threshold:10}).resize({width:256,height:128,fit:'fill'}).ensureAlpha().raw().toBuffer({resolveWithObject:true});
const {data:mask}=await sharp(path.join(root,'../runtime/path.png')).ensureAlpha().raw().toBuffer({resolveWithObject:true});
const count=info.width*info.height,seen=new Uint8Array(count),queue=new Int32Array(count);
let tail=0;
// Atlas-style edge bleed: copy only existing generated texels into transparent padding.
for(let p=0;p<count;p++)if(generated[p*4+3]>=128){seen[p]=1;queue[tail++]=p;}
if(!tail)throw Error('Generated path has no opaque texels');
for(let head=0;head<tail;head++){
 const current=queue[head],x=current%info.width,y=Math.floor(current/info.width);
 for(const next of [x?current-1:-1,x<info.width-1?current+1:-1,y?current-info.width:-1,y<info.height-1?current+info.width:-1]){
  if(next<0||seen[next])continue;seen[next]=1;
  for(let channel=0;channel<3;channel++)generated[next*4+channel]=generated[current*4+channel];
  queue[tail++]=next;
 }
}
for(let p=0;p<count;p++)generated[p*4+3]=mask[p*4+3];
const runtime=path.join(root,'runtime/path.webp');
await sharp(generated,{raw:{width:256,height:128,channels:4}}).webp({lossless:true}).toFile(runtime);
const decoded=await sharp(runtime).ensureAlpha().raw().toBuffer();
let alphaDifferences=0,nonzeroAlpha=0;
for(let p=3;p<decoded.length;p+=4){if(decoded[p]!==mask[p])alphaDifferences++;if(decoded[p])nonzeroAlpha++;}
const report={runtime:'runtime/path.webp',width:256,height:128,nonzeroAlpha,alphaDifferences,bytes:(await fs.stat(runtime)).size,mask:'../runtime/path.png'};
await fs.writeFile(path.join(root,'path-meta.json'),JSON.stringify(report,null,2)+'\n');
if(alphaDifferences)throw Error('Path alpha footprint changed');
console.log(report);
