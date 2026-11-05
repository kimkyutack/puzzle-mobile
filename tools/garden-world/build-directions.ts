import {readFile,writeFile,copyFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
import {cleanAlphaIslands} from '../asset-pipeline/alpha-cleanup';
const root='packages/garden-world/art',records=JSON.parse(await readFile(root+'/directions-v24-prompts.json','utf8')) as Array<{id:string;reference:string;generatedPath:string;sourcePath:string;runtimePath:string}>;
await mkdir(root+'/source/directions-v24',{recursive:true});await mkdir(root+'/runtime/directions-v24',{recursive:true});await mkdir('output/verification/garden-directions-v24',{recursive:true});
const report=[],tiles=[];
for(const [i,record]of records.entries()){
 await copyFile(record.generatedPath,record.sourcePath);
 const source=await readFile(record.sourcePath),meta=await sharp(record.reference).metadata();
 if(!(await sharp(source).metadata()).hasAlpha)throw Error('Missing transparency: '+record.id);
 const cleaned=await cleanAlphaIslands(source),output=await sharp(cleaned.buffer).trim({threshold:8}).resize(meta.width,meta.height,{fit:'contain',position:'south',background:{r:0,g:0,b:0,alpha:0}}).png().toBuffer();
 await writeFile(record.runtimePath,output);
 report.push({id:record.id,path:record.runtimePath,width:meta.width,height:meta.height,sha256:createHash('sha256').update(output).digest('hex'),bytes:output.length});
 tiles.push({input:await sharp(output).resize(176,176,{fit:'contain',background:{r:0,g:0,b:0,alpha:0}}).png().toBuffer(),left:(i%4)*180+2,top:Math.floor(i/4)*180+2});
}
await sharp({create:{width:720,height:900,channels:4,background:'#dce5c5'}}).composite(tiles).png().toFile('output/verification/garden-directions-v24/rear-contact-sheet.png');
await writeFile(root+'/directions-v24-report.json',JSON.stringify({method:'Original front art preserved; authored rear sources preserved; technical alpha cleanup, crop and uniform contain resize aligned at the ground edge. Front/rear each have a mirrored companion view.',assets:report},null,2)+'\n');
console.log(JSON.stringify({rearAssets:report.length,bytes:report.reduce((sum,item)=>sum+item.bytes,0)}));
