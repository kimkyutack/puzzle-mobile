import sharp from'sharp';import{readFile,writeFile,stat}from'node:fs/promises';
const root='packages/assets/obstacle-redesign',defs=JSON.parse(await readFile(`${root}/open-definitions.json`,'utf8')),report=[];
for(const family of Object.keys(defs)){
 const path=`${root}/source/open-silhouette/${family}.png`;try{await stat(path);}catch{report.push({family,error:'missing'});continue;}
 const{data,info}=await sharp(path).ensureAlpha().raw().toBuffer({resolveWithObject:true});let minAlpha=255,bestStart=-1,bestLength=0,start=-1;
 for(let y=0;y<info.height;y++){let count=0;for(let x=0;x<info.width;x++){const a=data[(y*info.width+x)*4+3];minAlpha=Math.min(minAlpha,a);if(a>=80)count++;}if(y<info.height*.38||y>info.height*.68)continue;if(count<Math.max(3,info.width*.006)){if(start<0)start=y;if(y-start+1>bestLength){bestStart=start;bestLength=y-start+1;}}else start=-1;}
 const split=Math.min(info.height-1,Math.round(bestStart+bestLength/2));let gutterAlpha=0;for(let x=0;x<info.width;x++)gutterAlpha+=data[(split*info.width+x)*4+3];gutterAlpha/=info.width;
 let cornerAlpha=0;for(let column=0;column<3;column++)for(const fx of [.03,.97]){const x=Math.floor((column+fx)*info.width/3),y=Math.floor(info.height*.015);cornerAlpha=Math.max(cornerAlpha,data[(y*info.width+x)*4+3]);}
 report.push({family,minAlpha,gutterAlpha,cornerAlpha,gutter:bestLength,rowBoundary:split,...(minAlpha>4||bestLength<4||gutterAlpha>8||cornerAlpha>8?{error:'opaque background or clipped row layout'}:{})});
}
await writeFile('output/verification/royal-obstacle-audit/source-preflight.json',JSON.stringify(report,null,2)+'\n');const bad=report.filter(r=>r.error);console.log(JSON.stringify({total:report.length,bad},null,2));if(bad.length)process.exitCode=1;
