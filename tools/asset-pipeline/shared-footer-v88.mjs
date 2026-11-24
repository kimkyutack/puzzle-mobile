import sharp from 'sharp';
import fs from 'node:fs/promises';
const root='packages/assets/shared-footer-v88';
await fs.mkdir(root+'/runtime',{recursive:true});
const source='packages/assets/home-polish-v82/runtime/footer-panel.webp';
const {data,info}=await sharp(source).ensureAlpha().raw().toBuffer({resolveWithObject:true});
const metadata=JSON.parse(await fs.readFile('packages/assets/home-contours-v81/extraction.json','utf8'));
const edge=metadata.records.find(record=>record.name==='footer-panel').ridgeY;
for(let x=0;x<info.width;x++){
 const rim=(edge[x]*info.width+x)*4,color=[...data.subarray(rim,rim+3)];
 for(let y=0;y<edge[x];y++){
  const at=(y*info.width+x)*4,d=y-edge[x];
  // Source pixels above the rim contain the old ivory page backdrop. Replace
  // their baked backdrop with a short alpha ramp so the same rim works on blue.
  data[at+3]=d<=-4?0:d===-3?32:d===-2?112:216;
  if(data[at+3])for(let c=0;c<3;c++)data[at+c]=color[c];
 }
}
await sharp(data,{raw:info}).webp({lossless:true}).toFile(root+'/runtime/footer-panel.webp');
for(const[name,left,width]of [['footer-left',0,30],['footer-middle',80,1],['footer-crown',150,90],['footer-right',360,30]])
 await sharp(data,{raw:info}).extract({left:left*2,top:0,width:width*2,height:info.height}).webp({lossless:true}).toFile(root+'/runtime/'+name+'.webp');
await fs.writeFile(root+'/extraction.json',JSON.stringify({source,rimMetadata:'packages/assets/home-contours-v81/extraction.json',method:'Original source rim and interior retained. Baked outer backdrop replaced by alpha for reuse on all page backgrounds.'},null,2)+'\n');
