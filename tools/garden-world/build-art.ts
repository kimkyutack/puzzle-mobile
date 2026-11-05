import {readFile,writeFile,mkdir,copyFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve,join} from 'node:path';
import sharp from 'sharp';
import {cleanAlphaIslands} from '../asset-pipeline/alpha-cleanup';
const root=resolve('packages/garden-world/art'),runtime=join(root,'runtime');
await mkdir(join(root,'source'),{recursive:true});await mkdir(runtime,{recursive:true});
const records=[...JSON.parse(await readFile(join(root,'prompts.json'),'utf8')),...JSON.parse(await readFile(join(root,'expansion-prompts.json'),'utf8'))] as Array<{id:string;generatedPath:string}>;
if(new Set(records.map(record=>record.id)).size!==records.length)throw new Error('Duplicate world art ID');
const report=[];
for(const record of records){
 const source=join(root,'source',record.id+'.png');await copyFile(record.generatedPath,source);
 const original=await readFile(source),cleaned=await cleanAlphaIslands(original),flat=['ground','path'].includes(record.id);
 const image=sharp(cleaned.buffer).trim({threshold:8});
 const output=flat?await image.resize(256,128,{fit:'fill'}).png().toBuffer():await image.resize({width:640,height:640,fit:'inside'}).png().toBuffer();
 await writeFile(join(runtime,record.id+'.png'),output);const meta=await sharp(output).metadata();
 report.push({id:record.id,width:meta.width,height:meta.height,alpha:meta.hasAlpha,bytes:output.length,removedPixels:cleaned.removed,sha256:createHash('sha256').update(output).digest('hex')});
}
const manifest=JSON.parse(await readFile('packages/assets/asset-manifest.json','utf8')) as {assets:Array<{id:string;runtimePath:string}>};
for(const id of ['button_lime_v9','button_blue_v9','button_amber_v9','resource_pearl_v9','footer_azure_v9','card_ice_v9','card_peach_v9','card_lavender_v9','chest','lumi','home','shop','close','hammer','star']){
 const entry=manifest.assets.find(item=>item.id===id);if(!entry)throw new Error('Missing shared UI asset '+id);
 await copyFile('apps/client/public'+entry.runtimePath,join(runtime,'ui-'+id+'.png'));
}
for(const [id,name]of [['door_after','gate'],['telescope_after','telescope'],['bench_festival_v8','bench-festival'],['planter_festival_v8','planter-festival'],['lamp_festival_v8','lamp-festival']]){const entry=manifest.assets.find(item=>item.id===id);if(!entry)throw new Error('Missing migration art '+id);await copyFile('apps/client/public'+entry.runtimePath,join(runtime,name+'.png'));}
for(const file of ['Jua-Regular.ttf','LilitaOne-Regular.ttf','jua-OFL.txt','lilitaone-OFL.txt'])await copyFile(join('apps/client/public/fonts',file),join(runtime,file));
await writeFile(join(root,'runtime-report.json'),JSON.stringify({method:'Technical alpha normalization, trim, resize; originals preserved. Existing approved UI PNGs copied independently of the main asset pack.',assets:report},null,2)+'\n');
console.log(JSON.stringify(report.map(({id,width,height,bytes})=>({id,width,height,bytes}))));
