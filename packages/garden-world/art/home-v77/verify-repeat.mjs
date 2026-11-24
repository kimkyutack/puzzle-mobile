import sharp from 'sharp';
import {writeFile} from 'node:fs/promises';
const root='packages/garden-world/art/home-v77/';
for(const factor of [1.008,1.05]){
 const w=Math.round(256*factor),h=Math.round(128*factor),tile=await sharp(root+'runtime/ground.webp').resize(w,h).png().toBuffer();
 const layers=[];
 for(let y=0;y<5;y++)for(let x=0;x<5;x++)layers.push({input:tile,left:522+(x-y)*128-Math.floor((w-256)/2),top:(x+y)*64+10-Math.floor((h-128)/2)});
 await sharp({create:{width:1300,height:660,channels:4,background:'#87ae3d'}}).composite(layers).png().toFile(root+`verification/ground-repeat-${String(factor).replace('.','')}.png`);
}
const {data,info}=await sharp(root+'runtime/ground.webp').ensureAlpha().raw().toBuffer({resolveWithObject:true});let count=0,sum=[0,0,0],squares=[0,0,0];
for(let n=0;n<info.width*info.height;n++){if(data[n*4+3]<128)continue;count++;for(let c=0;c<3;c++){const v=data[n*4+c];sum[c]+=v;squares[c]+=v*v;}}
const mean=sum.map(n=>n/count),std=squares.map((n,c)=>Math.sqrt(n/count-mean[c]*mean[c]));
await writeFile(root+'verification/palette.json',JSON.stringify({runtimeMean:mean.map(n=>Math.round(n*100)/100),runtimeStd:std.map(n=>Math.round(n*100)/100),referenceMean:[135,174,61],referenceStd:[4.46,3.69,3.23],notes:'Color and focused seam correction performed by image_gen; no manual color filter or procedural grid. Original alpha preserved exactly. Also verified at actual 64x32 mobile tile size via verify-mobile-repeat-64.mjs.'},null,2));
console.log({mean,std});
