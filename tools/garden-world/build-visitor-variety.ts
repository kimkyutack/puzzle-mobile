import {readFile,writeFile,mkdir,copyFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
import {cleanAlphaIslands} from '../asset-pipeline/alpha-cleanup';

const root='packages/garden-world/art',version='residents-variety-v29',output='output/verification/'+version;
const records=JSON.parse(await readFile(root+'/'+version+'-prompts.json','utf8')) as Array<{id:string;generatedPath:string;sourcePath:string}>;
await mkdir(root+'/source/'+version,{recursive:true});await mkdir(root+'/runtime/'+version,{recursive:true});await mkdir(output,{recursive:true});
const report=[];
for(const record of records){
 await copyFile(record.generatedPath,record.sourcePath);
 const meta=await sharp(record.sourcePath).metadata();if(!meta.width||!meta.height||!meta.hasAlpha)throw new Error('Missing transparent source: '+record.id);
 const frames=[];let largest=0;
 for(let index=0;index<12;index++){
  const column=index%4,row=Math.floor(index/4),left=Math.floor(column*meta.width/4),top=Math.floor(row*meta.height/3),width=Math.floor((column+1)*meta.width/4)-left,height=Math.floor((row+1)*meta.height/3)-top;
  const original=await sharp(record.sourcePath).extract({left,top,width,height}).ensureAlpha().png().toBuffer(),cleaned=await cleanAlphaIslands(original),buffer=cleaned.buffer;
  const {data,info}=await sharp(buffer).raw().toBuffer({resolveWithObject:true});
  if([0,width-1,(height-1)*width,height*width-1].some(pixel=>data[pixel*info.channels+3]!>8))throw new Error('Opaque frame corner: '+record.id+' '+index);
  let x0=width,y0=height,x1=0,y1=0;
  for(let y=0;y<height;y++)for(let x=0;x<width;x++)if(data[(y*width+x)*info.channels+3]!>24){x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y);}
  if(x0>=x1||y0>=y1)throw new Error('Empty visitor frame');
  const box={left:Math.max(0,x0-2),top:Math.max(0,y0-2),width:Math.min(width,x1+3)-Math.max(0,x0-2),height:Math.min(height,y1+3)-Math.max(0,y0-2)};
  // Leisure stretches may be taller; size by the standing/stride body, preserving one scale.
  if(index<9)largest=Math.max(largest,box.width,box.height);
  frames.push({index,buffer,box});
 }
 const scale=Math.min(226/largest,...frames.map(frame=>244/Math.max(frame.box.width,frame.box.height))),normal=[];
 for(const frame of frames){
  const width=Math.max(1,Math.round(frame.box.width*scale)),height=Math.max(1,Math.round(frame.box.height*scale)),sprite=await sharp(frame.buffer).extract(frame.box).resize(width,height).png().toBuffer();
  const canvas=await sharp({create:{width:256,height:256,channels:4,background:{r:0,g:0,b:0,alpha:0}}}).composite([{input:sprite,left:Math.round((256-width)/2),top:250-height}]).png().toBuffer();
  normal.push(canvas);
 }
 const outputs=[...Array.from({length:8},(_,index)=>({index,view:index<4?'front':'rear',frame:index%4})),...[8,0,2,9,10,11].map((index,frame)=>({index,view:'idle',frame}))];
 for(const entry of outputs){
  const path=`${root}/runtime/${version}/${record.id}-${entry.view}-${entry.frame}.png`,buffer=normal[entry.index]!;await writeFile(path,buffer);
  report.push({id:record.id,view:entry.view,frame:entry.frame,sourceFrame:entry.index,path,sha256:createHash('sha256').update(buffer).digest('hex')});
 }
 await sharp({create:{width:1024,height:768,channels:4,background:{r:137,g:169,b:105,alpha:1}}}).composite(normal.map((input,i)=>({input,left:(i%4)*256,top:Math.floor(i/4)*256}))).png().toFile(`${output}/${record.id}-frames.png`);
 for(const [offset,view]of [[0,'front'],[4,'rear']] as const){const raw=await Promise.all(normal.slice(offset,offset+4).map(input=>sharp(input).raw().toBuffer()));await sharp(Buffer.concat(raw),{raw:{width:256,height:1024,channels:4,pageHeight:256}}).gif({loop:0,delay:[190,190,190,190]}).toFile(`${output}/${record.id}-${view}.gif`);}
}
await writeFile(root+'/'+version+'-report.json',JSON.stringify({method:'Built-in image_gen 4x3 authored sheets; technical cell extraction, alpha island cleanup and common-scale normalization; no frame synthesis.',frames:report},null,2)+'\n');
console.log(JSON.stringify({characters:records.length,frames:report.length}));
