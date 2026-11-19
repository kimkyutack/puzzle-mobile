import {mkdir,writeFile} from 'node:fs/promises';
import sharp from 'sharp';
const root='packages/assets/expedition-v50',out=root+'/runtime';await mkdir(out,{recursive:true});
const report=[];
for(const animal of ['panda','fox','red-panda']){
 const source=root+'/source/'+animal+'.png',{width,height,hasAlpha}=await sharp(source).metadata();
 if(!width||!height||!hasAlpha)throw Error('Expected transparent animal sheet');
 const frames=[];let largest=0;
 for(let i=0;i<16;i++){
  const left=Math.round((i%4)*width/4),top=Math.round(Math.floor(i/4)*height/4),w=Math.round(((i%4)+1)*width/4)-left,h=Math.round((Math.floor(i/4)+1)*height/4)-top;
  const cell=await sharp(source).extract({left,top,width:w,height:h}).png().toBuffer();
  const {data,info}=await sharp(cell).raw().toBuffer({resolveWithObject:true});let x0=w,y0=h,x1=0,y1=0;
  for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(data[(y*w+x)*info.channels+3]!>32){x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y);}
  if(x0>=x1||y0>=y1)throw Error('Empty frame '+animal+':'+i);
  const box={left:Math.max(0,x0-2),top:Math.max(0,y0-2),width:Math.min(w,x1+3)-Math.max(0,x0-2),height:Math.min(h,y1+3)-Math.max(0,y0-2)};
  largest=Math.max(largest,box.width,box.height);frames.push({cell,box});
 }
 const scale=236/largest;
 for(const [i,frame]of frames.entries()){
  const width=Math.round(frame.box.width*scale),height=Math.round(frame.box.height*scale),sprite=await sharp(frame.cell).extract(frame.box).resize(width,height).png().toBuffer();
  await sharp({create:{width:256,height:256,channels:4,background:{r:0,g:0,b:0,alpha:0}}}).composite([{input:sprite,left:Math.round((256-width)/2),top:250-height}]).webp({quality:92,alphaQuality:100,effort:6}).toFile(`${out}/${animal}-${i}.webp`);
 }
 report.push({animal,source,frames:16,size:256,footY:250,format:'webp',quality:92,scale});
}
await writeFile(root+'/sprite-report.json',JSON.stringify(report,null,2)+'\n');
console.log('Extracted 48 alpha sprites with per-animal scale and aligned foot line.');
