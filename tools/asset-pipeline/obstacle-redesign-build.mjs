import sharp from 'sharp';
import {readFile,writeFile,mkdir,stat} from 'node:fs/promises';
const root='packages/assets/obstacle-redesign';
let active={revision:'framed'};try{active=JSON.parse(await readFile(`${root}/active-source.json`,'utf8'));}catch{}
const open=process.argv.includes('--open')||active.revision==='open-silhouette';
const definitions=JSON.parse(await readFile(`${root}/${open?'open-definitions':'definitions'}.json`,'utf8'));
await mkdir(`${root}/runtime`,{recursive:true});const frames=[],missing=[],diagnostics=[];
for(const family of Object.keys(definitions)){
 const source=`${root}/source/${open?'open-silhouette/':''}${family}.png`;try{await stat(source);}catch{missing.push(family);continue;}
 const data=await readFile(source),meta=await sharp(data).metadata(),{data:rgba,info}=await sharp(data).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 if(!meta.hasAlpha)throw Error(`${family}: no alpha`);
 let minAlpha=255;const coverage=[];
 for(let y=0;y<info.height;y++){let count=0;for(let x=0;x<info.width;x++){const a=rgba[(y*info.width+x)*4+3];minAlpha=Math.min(minAlpha,a);if(a>=80)count++;}coverage.push(count);}
 if(minAlpha>4)throw Error(`${family}: exterior is not transparent (min alpha ${minAlpha})`);
 // Imagegen may use more height for tall upper sprites. Split at the actual transparent gutter, never through their feet.
 let bestStart=-1,bestLength=0,start=-1;for(let y=Math.floor(info.height*.38);y<=Math.floor(info.height*.68);y++){
  if(coverage[y]<Math.max(3,info.width*.006)){if(start<0)start=y;if(y-start+1>bestLength){bestStart=start;bestLength=y-start+1;}}
  else start=-1;
 }
 if(open&&bestLength<4)throw Error(`${family}: missing clear row gutter`);
 const split=bestLength>=4?Math.round(bestStart+bestLength/2):Math.round(meta.height/2),crops=[];
 let gutterAlpha=0;for(let x=0;x<info.width;x++)gutterAlpha+=rgba[(Math.min(info.height-1,split)*info.width+x)*4+3];gutterAlpha/=info.width;
 if(open&&gutterAlpha>8)throw Error(`${family}: non-transparent gutter (alpha ${gutterAlpha})`);
 let cornerAlpha=0;for(let column=0;column<3;column++)for(const fx of [.03,.97]){const x=Math.floor((column+fx)*info.width/3),y=Math.floor(info.height*.015);cornerAlpha=Math.max(cornerAlpha,rgba[(y*info.width+x)*4+3]);}
 if(open&&cornerAlpha>8)throw Error(`${family}: backdrop haze outside silhouette (alpha ${cornerAlpha})`);
 for(let i=0;i<6;i++){const c=i%3,r=Math.floor(i/3),left=Math.round(c*meta.width/3),right=Math.round((c+1)*meta.width/3),top=r?split:0,bottom=r?meta.height:split;crops.push(await sharp(data).extract({left,top,width:right-left,height:bottom-top}).png().toBuffer());}
 const bounds=[];for(const crop of crops.slice(0,3)){
  const {data:p,info:s}=await sharp(crop).ensureAlpha().raw().toBuffer({resolveWithObject:true});let left=s.width,top=s.height,right=0,bottom=0;
  for(let y=0;y<s.height;y++)for(let x=0;x<s.width;x++)if(p[(y*s.width+x)*4+3]>=80){left=Math.min(left,x);right=Math.max(right,x+1);top=Math.min(top,y);bottom=Math.max(bottom,y+1);}
  if(right<=left||bottom<=top)throw Error(`${family}: empty obstacle frame`);bounds.push({left,top,right,bottom,width:s.width,height:s.height});
 }
 const common={left:Math.max(0,Math.min(...bounds.map(b=>b.left))-2),top:Math.max(0,Math.min(...bounds.map(b=>b.top))-2),right:Math.min(...bounds.map(b=>b.width),Math.max(...bounds.map(b=>b.right))+2),bottom:Math.min(split,Math.max(...bounds.map(b=>b.bottom))+2)};
 for(let i=0;i<6;i++){
  const column=i%3,row=Math.floor(i/3),id=`mobile-${family}-${row?'debris-':''}${column}`;
  const body=row?sharp(crops[i]).trim({threshold:24}):sharp(crops[i]).extract({left:common.left,top:common.top,width:common.right-common.left,height:common.bottom-common.top});
  const output=await body.resize(row?120:248,row?120:248,{fit:'contain',background:'#00000000'}).extend({top:4,bottom:4,left:4,right:4,background:'#00000000'}).webp({quality:94,alphaQuality:100}).toBuffer();
  await writeFile(`${root}/runtime/${id}.webp`,output);frames.push({id,family,role:row?'debris':'obstacle',stage:column,path:`${root}/runtime/${id}.webp`,source});
 }
 diagnostics.push({family,source,rowBoundary:split,nominalBoundary:Math.round(meta.height/2),clearGutter:bestLength,gutterAlpha,cornerAlpha,bodyBounds:common,minAlpha});
}
await writeFile(`${root}/manifest.json`,JSON.stringify({version:open?'open-silhouette-2026.11.20':'bright-obstacles-2026.11.20',mode:'built-in imagegen',frames,missing,diagnostics},null,2)+'\n');
console.log(JSON.stringify({families:frames.length/6,frames:frames.length,missing}));if(missing.length&&!process.argv.includes('--partial'))process.exitCode=1;
