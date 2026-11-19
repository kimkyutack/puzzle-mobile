import {mkdir,writeFile} from 'node:fs/promises';
import sharp from 'sharp';
const root='packages/assets/garden-v51';await mkdir(root+'/runtime',{recursive:true});
const report=[];
for(const id of ['missions','ranking']){const path=root+'/source/'+id+'.png',buffer=await sharp(path).trim({background:'#00000000',threshold:10}).resize(256,256,{fit:'contain',background:'#00000000'}).webp({quality:94,alphaQuality:100,effort:4}).toBuffer();await writeFile(root+'/runtime/'+id+'.webp',buffer);report.push({id,bytes:buffer.length});}
const source=root+'/source/festival-arch-sheet.png',meta=await sharp(source).metadata(),cellWidth=meta.width!/2;
for(let i=0;i<2;i++){
 const cell=await sharp(source).extract({left:Math.round(i*cellWidth),top:0,width:Math.round(cellWidth),height:meta.height!}).png().toBuffer();
 const {data,info}=await sharp(cell).raw().toBuffer({resolveWithObject:true});let left=info.width,top=info.height,right=0,bottom=0;
 for(let y=0;y<info.height;y++)for(let x=0;x<info.width;x++)if(data[(y*info.width+x)*info.channels+3]!>32){left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);}
 if(right<=left||bottom<=top)throw Error('Empty festival arch view');
 const buffer=await sharp(cell).extract({left,top,width:right-left+1,height:bottom-top+1}).resize({width:512,height:640,fit:'inside'}).webp({quality:94,alphaQuality:100,effort:4}).toBuffer();
 const id=i?'festival-arch-rear':'festival-arch';await writeFile(root+'/runtime/'+id+'.webp',buffer);report.push({id,bytes:buffer.length});
}
await writeFile(root+'/build-report.json',JSON.stringify(report,null,2)+'\n');console.log(report);
