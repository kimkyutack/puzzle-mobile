import sharp from 'sharp';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
const root='packages/assets/varied-obstacles';
const inputs=JSON.parse(await readFile(`${root}/generation.json`,'utf8'));
const alias={bellows:'petal-launcher',mushroom:'mushroom-cluster'};
await mkdir(`${root}/runtime`,{recursive:true});
for(const [name,path] of Object.entries(inputs)){
 const original=await readFile(path),meta=await sharp(original).metadata();
 const alpha=(await sharp(original).stats()).channels[3];
 if(!alpha||alpha.min!==0)throw Error(`No transparency: ${name}`);
 const n=name==='petal-disc'?1:3;
 for(let i=0;i<n;i++){
  const left=Math.round(meta.width*i/n),right=Math.round(meta.width*(i+1)/n);
  const crop=await sharp(original).extract({left,top:0,width:right-left,height:meta.height}).png().toBuffer();
  const frame=await sharp(crop).trim({threshold:20}).resize(248,248,{fit:'contain',background:'#00000000'}).extend({top:4,bottom:4,left:4,right:4,background:'#00000000'}).webp({quality:92,alphaQuality:100}).toBuffer();
  const id=n===1?name:`obstacle-${alias[name]??name}-${i}`;
  await writeFile(`${root}/runtime/${id}.webp`,frame);
 }
}
console.log(`Built ${Object.keys(inputs).length} authored sprite families.`);
