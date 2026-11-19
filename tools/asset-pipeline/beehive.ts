// Register only the two new reviewed sprites. This does not bundle the app,
// rebuild unrelated assets, touch native projects, or publish anything.
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
import {cleanAlphaIslands} from './alpha-cleanup';
const manifestPaths=['packages/assets/asset-manifest.json','apps/client/public/assets/asset-manifest.json'];
const additions:Array<{id:string;runtimePath:string;contentHash:string;[key:string]:unknown}>=[];
for(const id of ['beehive','bee_flight']){
 const sourcePath=`packages/assets/source/${id}.png`,original=await readFile(sourcePath),meta=await sharp(original).metadata(),cleaned=await cleanAlphaIslands(original,{singleObject:true});
 const buffer=await sharp(cleaned.buffer).trim({threshold:10}).resize(210,210,{fit:'contain',background:{r:0,g:0,b:0,alpha:0}}).extend({top:23,bottom:23,left:23,right:23,background:{r:0,g:0,b:0,alpha:0}}).png({compressionLevel:9}).toBuffer();
 const contentHash=createHash('sha256').update(buffer).digest('hex'),runtimePath=`/assets/${id}.${contentHash.slice(0,12)}.png`;
 await writeFile(`apps/client/public${runtimePath}`,buffer);
 additions.push({id,category:'sprite',sourcePromptId:id,sourcePath,runtimePath,width:256,height:256,logicalSize:{width:64,height:64},alpha:true,pivot:{x:.5,y:.5},originalSize:{width:meta.width,height:meta.height},trimOffset:{x:0,y:0},atlasGroup:'interface',contentHash,generationReference:'packages/assets/beehive-prompts.json'});
}
for(const path of manifestPaths){const manifest=JSON.parse(await readFile(path,'utf8'));manifest.assets=manifest.assets.filter((entry:{id:string})=>!additions.some(asset=>asset.id===entry.id));manifest.assets.push(...additions);await writeFile(path,JSON.stringify(manifest,null,2));}
console.log(JSON.stringify(additions.map(({id,runtimePath,contentHash})=>({id,runtimePath,contentHash}))));
