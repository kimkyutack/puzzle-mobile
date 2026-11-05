import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
import {cleanAlphaIslands} from '../asset-pipeline/alpha-cleanup';
const root='packages/garden-world/art',record=JSON.parse(await readFile(root+'/story-v30-prompts.json','utf8')) as {assets:Array<{id:string;sourcePath:string;runtimePath:string}>};
await mkdir(root+'/runtime/story-v30',{recursive:true});await mkdir('output/verification/story-v30',{recursive:true});
const report=[],tiles=[];
for(const [i,asset]of record.assets.entries()){
 const source=await readFile(asset.sourcePath);if(!(await sharp(source).metadata()).hasAlpha)throw Error('Missing transparency: '+asset.id);
 const cleaned=await cleanAlphaIslands(source),output=await sharp(cleaned.buffer).trim({threshold:8}).resize(512,asset.id==='rail'?256:512,{fit:'contain',position:'south',background:{r:0,g:0,b:0,alpha:0}}).png().toBuffer();
 await writeFile(asset.runtimePath,output);
 report.push({id:asset.id,path:asset.runtimePath,bytes:output.length,sha256:createHash('sha256').update(output).digest('hex')});
 tiles.push({input:await sharp(output).resize(178,178,{fit:'contain',background:{r:0,g:0,b:0,alpha:0}}).png().toBuffer(),left:(i%4)*190+6,top:Math.floor(i/4)*190+6});
}
await sharp({create:{width:760,height:Math.ceil(tiles.length/4)*190,channels:4,background:'#dce5c5'}}).composite(tiles).png().toFile('output/verification/story-v30/decorations.png');
await writeFile(root+'/story-v30-report.json',JSON.stringify({method:'Authored front/rear sprites; only alpha cleanup, trim and uniform contain resize. Originals retained.',assets:report},null,2)+'\n');
console.log(JSON.stringify({sprites:report.length,bytes:report.reduce((sum,r)=>sum+r.bytes,0)}));
