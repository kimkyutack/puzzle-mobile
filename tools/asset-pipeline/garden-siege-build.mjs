import sharp from 'sharp';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
const root='packages/assets/garden-siege',inputs=JSON.parse(await readFile(`${root}/generation.json`,'utf8'));
await mkdir(`${root}/runtime`,{recursive:true});
for(const [name,{path,count,frameSize=256}]of Object.entries(inputs)){
 const original=await readFile(path),meta=await sharp(original).metadata();
 if(!meta.hasAlpha)throw Error(`No alpha ${name}`);
 const columns=count===1?1:3,rows=count===6?2:1;
 for(let i=0;i<count;i++){
  const left=Math.round(i%columns*meta.width/columns),right=Math.round((i%columns+1)*meta.width/columns);
  const top=Math.round(Math.floor(i/columns)*meta.height/rows),bottom=Math.round((Math.floor(i/columns)+1)*meta.height/rows);
  const crop=await sharp(original).extract({left,top,width:right-left,height:bottom-top}).png().toBuffer();
  const frame=await sharp(crop).trim({threshold:20}).resize(frameSize-8,frameSize-8,{fit:'contain',background:'#00000000'}).extend({top:4,bottom:4,left:4,right:4,background:'#00000000'}).webp({quality:94,alphaQuality:100}).toBuffer();
  const id=`siege-${name}${count===1?'':'-'+i}`;await writeFile(`${root}/runtime/${id}.webp`,frame);
 }
}
console.log('Built '+Object.values(inputs).reduce((n,x)=>n+x.count,0)+' garden siege runtime frames.');
