import sharp from 'sharp';
import {writeFile} from 'node:fs/promises';

const folder=new URL('./',import.meta.url),sheet=new URL('source/yellow-pergola-sheet.png',folder);
const metadata=await sharp(sheet.pathname).metadata(),half=Math.floor(metadata.width/2);
const names=['yellow-pergola','yellow-pergola-rear'],frames=[];
for(let i=0;i<2;i++){
 const frame=await sharp(sheet.pathname).extract({left:i*half,top:0,width:i?metadata.width-half:half,height:metadata.height}).png().toBuffer();
 await writeFile(new URL('source/'+names[i]+'.png',folder),frame);
 const packed=await sharp(frame).trim({threshold:8}).resize({height:640}).png().toBuffer();
 const size=await sharp(packed).metadata();frames.push({name:names[i],packed,width:size.width,height:size.height});
}
const width=Math.max(...frames.map(frame=>frame.width))+8,height=648,report={width,height,groundAnchor:{x:width/2,y:height-4},frames:[]};
for(const frame of frames){
 const composed=await sharp({create:{width,height,channels:4,background:'#00000000'}}).composite([{input:frame.packed,left:Math.floor((width-frame.width)/2),top:4}]).ensureAlpha().raw().toBuffer();
 for(let i=0;i<composed.length;i+=4)if(composed[i+3]<8){composed[i]=0;composed[i+1]=0;composed[i+2]=0;composed[i+3]=0;}
 const output=await sharp(composed,{raw:{width,height,channels:4}}).png().toBuffer();
 await writeFile(new URL('runtime/'+frame.name+'.png',folder),output);
 await sharp(output).webp({lossless:true}).toFile(new URL('runtime/'+frame.name+'.webp',folder).pathname);
 const {data,info}=await sharp(output).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 let left=width,top=height,right=-1,bottom=-1;
 for(let y=0;y<height;y++)for(let x=0;x<width;x++)if(data[(y*width+x)*info.channels+3]>16){left=Math.min(left,x);top=Math.min(top,y);right=Math.max(right,x);bottom=Math.max(bottom,y);}
 report.frames.push({name:frame.name,alphaBounds:{left,top,width:right-left+1,height:bottom-top+1}});
}
await writeFile(new URL('yellow-pergola-report.json',folder),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
