import {readFile,writeFile,mkdir,copyFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
import {cleanAlphaIslands} from '../asset-pipeline/alpha-cleanup';

const root='packages/garden-world/art',output='output/verification/residents-walk-v26';
const records=JSON.parse(await readFile(root+'/residents-walk-v26-prompts.json','utf8')) as Array<{id:string;generatedPath:string;sourcePath:string;passingSheet?:{generatedPath:string;sourcePath:string;indices:number[]}}>;
await mkdir(root+'/source/residents-walk-v26',{recursive:true});await mkdir(root+'/runtime/residents-walk-v26',{recursive:true});await mkdir(output,{recursive:true});
const report=[];
for(const record of records){
 await copyFile(record.generatedPath,record.sourcePath);
 if(record.passingSheet)await copyFile(record.passingSheet.generatedPath,record.passingSheet.sourcePath);
 const meta=await sharp(record.sourcePath).metadata();if(!meta.width||!meta.height||!meta.hasAlpha)throw new Error('Missing transparent source: '+record.id);
 const frames=[];let largest=0;
 for(let index=0;index<8;index++){
  const sourcePath=record.passingSheet?.indices.includes(index)?record.passingSheet.sourcePath:record.sourcePath,sourceMeta=await sharp(sourcePath).metadata();
  const column=index%4,row=Math.floor(index/4),left=Math.floor(column*sourceMeta.width!/4),top=Math.floor(row*sourceMeta.height!/2),width=Math.floor((column+1)*sourceMeta.width!/4)-left,height=Math.floor((row+1)*sourceMeta.height!/2)-top;
  const original=await sharp(sourcePath).extract({left,top,width,height}).ensureAlpha().png().toBuffer();
  const cleaned=await cleanAlphaIslands(original),buffer=cleaned.buffer;
  const {data,info}=await sharp(buffer).raw().toBuffer({resolveWithObject:true});
  if([0,width-1,(height-1)*width,height*width-1].some(pixel=>data[pixel*info.channels+3]!>8))throw new Error('Background is not transparent: '+record.id+' '+index);
  let x0=width,y0=height,x1=0,y1=0;
  for(let y=0;y<height;y++)for(let x=0;x<width;x++)if(data[(y*width+x)*info.channels+3]!>24){x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y);}
  if(x0>=x1||y0>=y1)throw new Error('Empty walk frame');
  const box={left:Math.max(0,x0-2),top:Math.max(0,y0-2),width:Math.min(width,x1+3)-Math.max(0,x0-2),height:Math.min(height,y1+3)-Math.max(0,y0-2)};
  largest=Math.max(largest,box.width,box.height);frames.push({index,buffer,box,sourcePath});
 }
 const scale=236/largest,normal=[];
 for(const frame of frames){
  const width=Math.max(1,Math.round(frame.box.width*scale)),height=Math.max(1,Math.round(frame.box.height*scale));
  const sprite=await sharp(frame.buffer).extract(frame.box).resize(width,height).png().toBuffer();
  const path=`${root}/runtime/residents-walk-v26/${record.id}-${frame.index<4?'front':'rear'}-${frame.index%4}.png`;
  const canvas=await sharp({create:{width:256,height:256,channels:4,background:{r:0,g:0,b:0,alpha:0}}}).composite([{input:sprite,left:Math.round((256-width)/2),top:250-height}]).png().toBuffer();
  await writeFile(path,canvas);normal.push(canvas);report.push({id:record.id,frame:frame.index%4,view:frame.index<4?'front':'rear',path,width,height,footY:250,sourcePath:frame.sourcePath,sourceBox:frame.box,sha256:createHash('sha256').update(canvas).digest('hex')});
 }
 // Contact sheets and GIFs only rearrange the authored raster frames; they draw no game art.
 await sharp({create:{width:1024,height:512,channels:4,background:{r:45,g:83,b:51,alpha:1}}}).composite(normal.map((input,i)=>({input,left:(i%4)*256,top:Math.floor(i/4)*256}))).png().toFile(`${output}/${record.id}-frames.png`);
 for(const rear of [false,true]){
  const raw=[];for(let i=0;i<4;i++)raw.push(await sharp(normal[(rear?4:0)+i]!).raw().toBuffer());
  await sharp(Buffer.concat(raw),{raw:{width:256,height:1024,channels:4,pageHeight:256}}).gif({loop:0,delay:[180,180,180,180]}).toFile(`${output}/${record.id}-${rear?'rear':'front'}.gif`);
 }
}
await writeFile(root+'/residents-walk-v26-report.json',JSON.stringify({method:'Original 4x2 sheets, technical alpha island cleanup, same scale across eight frames, aligned feet at y=250. Front/rear authored separately, each mirrored at runtime for four isometric directions.',frames:report},null,2)+'\n');
const comparison=[];
for(let frame=0;frame<4;frame++){
 const sprites=[];
 for(const [row,record]of records.entries())for(let direction=0;direction<4;direction++){
  const sprite=sharp(`${root}/runtime/residents-walk-v26/${record.id}-${direction<2?'rear':'front'}-${frame}.png`);
  if(direction===0||direction===2)sprite.flop();
  sprites.push({input:await sprite.resize(96,96).png().toBuffer(),left:direction*110+7,top:row*100+2});
 }
 comparison.push(await sharp({create:{width:440,height:500,channels:4,background:{r:111,g:148,b:82,alpha:1}}}).composite(sprites).raw().toBuffer());
}
await sharp(Buffer.concat(comparison),{raw:{width:440,height:2000,channels:4,pageHeight:500}}).gif({loop:0,delay:[430,430,430,430]}).toFile(`${output}/four-directions.gif`);
console.log(JSON.stringify({sheets:records.length,frames:report.length}));
