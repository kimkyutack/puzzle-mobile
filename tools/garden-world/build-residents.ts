import {readFile,writeFile,mkdir,copyFile} from 'node:fs/promises';
import sharp from 'sharp';
const root='packages/garden-world/art',records=JSON.parse(await readFile(root+'/residents-v22-prompts.json','utf8'));
await mkdir(root+'/source/residents-v22',{recursive:true});await mkdir(root+'/runtime/residents-v22',{recursive:true});
const report=[];
for(const record of records){
 await copyFile(record.generatedPath,record.sourcePath);
 const {width,height}=await sharp(record.sourcePath).metadata();if(width!==1536||height!==1024)throw new Error('Unexpected sheet grid: '+record.id);
 const frames=[];let largest=0;
 for(let i=0;i<6;i++){
  const buffer=await sharp(record.sourcePath).extract({left:(i%3)*512,top:Math.floor(i/3)*512,width:512,height:512}).png().toBuffer();
  const {data,info}=await sharp(buffer).raw().toBuffer({resolveWithObject:true});let left=512,top=512,right=0,bottom=0;
  for(let y=0;y<512;y++)for(let x=0;x<512;x++)if(data[(y*512+x)*info.channels+3]!>24){left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);}
  if(left>=right||top>=bottom)throw new Error('Empty sprite frame');
  const box={left:Math.max(0,left-3),top:Math.max(0,top-3),width:Math.min(512,right+4)-Math.max(0,left-3),height:Math.min(512,bottom+4)-Math.max(0,top-3)};
  largest=Math.max(largest,box.width,box.height);frames.push({buffer,box});
 }
 const scale=236/largest;
 for(const [i,frame]of frames.entries()){
  const width=Math.round(frame.box.width*scale),height=Math.round(frame.box.height*scale),sprite=await sharp(frame.buffer).extract(frame.box).resize(width,height).png().toBuffer();
  const path=root+'/runtime/residents-v22/'+record.id+'-'+i+'.png';
  await sharp({create:{width:256,height:256,channels:4,background:{r:0,g:0,b:0,alpha:0}}}).composite([{input:sprite,left:Math.round((256-width)/2),top:250-height}]).png().toFile(path);
  report.push({id:record.id,frame:i,path,width,height,footY:250,sourceBox:frame.box});
 }
}
await writeFile(root+'/residents-v22-report.json',JSON.stringify({method:'Technical extraction of six authored frames, alpha-bound crop, same scale per actor and aligned foot line; source art unchanged.',frames:report},null,2)+'\n');
console.log(JSON.stringify({sheets:records.length,frames:report.length}));
