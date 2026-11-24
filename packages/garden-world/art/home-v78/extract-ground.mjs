import sharp from 'sharp';
import {createHash}from'node:crypto';
import{readFile,writeFile,copyFile}from'node:fs/promises';
const root='packages/garden-world/art/home-v78/',source=root+'source/selected-original.png';
const sourceBytes=await readFile(source),{data:rgb,info}=await sharp(sourceBytes).removeAlpha().raw().toBuffer({resolveWithObject:true}),alpha=await sharp('packages/garden-world/art/runtime/ground.png').ensureAlpha().raw().toBuffer();
const candidates=[{id:'a',u0:730,u1:864,v0:-147,v1:-11},{id:'b',u0:864,u1:998,v0:-11,v1:125},{id:'c',u0:730,u1:864,v0:-11,v1:125}];
const vertex=(u,v)=>({x:(u+v)/2,y:(u-v)/4});
const sample=(x,y,c)=>{const x0=Math.floor(x),y0=Math.floor(y),fx=x-x0,fy=y-y0;return Math.round(rgb[(y0*info.width+x0)*3+c]*(1-fx)*(1-fy)+rgb[(y0*info.width+x0+1)*3+c]*fx*(1-fy)+rgb[((y0+1)*info.width+x0)*3+c]*(1-fx)*fy+rgb[((y0+1)*info.width+x0+1)*3+c]*fx*fy);};
const reports=[];
for(const candidate of candidates){
 const pixels=Buffer.alloc(256*128*4);let sum=[0,0,0],squares=[0,0,0],count=0;
 for(let y=0;y<128;y++)for(let x=0;x<256;x++){
  const U=(x+.5)/256+(y+.5)/128-.5,V=(x+.5)/256-(y+.5)/128+.5,u=candidate.u0+U*(candidate.u1-candidate.u0),v=candidate.v0+V*(candidate.v1-candidate.v0),point=vertex(u,v),i=(y*256+x)*4;
  for(let c=0;c<3;c++)pixels[i+c]=sample(point.x,point.y,c);pixels[i+3]=alpha[i+3];
  if(pixels[i+3]>=128){count++;for(let c=0;c<3;c++){sum[c]+=pixels[i+c];squares[c]+=pixels[i+c]*pixels[i+c];}}
 }
 const mean=sum.map(n=>n/count),sd=squares.map((n,c)=>Math.sqrt(n/count-mean[c]*mean[c]));
 const vertices={left:vertex(candidate.u0,candidate.v0),top:vertex(candidate.u0,candidate.v1),right:vertex(candidate.u1,candidate.v1),bottom:vertex(candidate.u1,candidate.v0)};
 const bounds={left:Math.floor(Math.min(...Object.values(vertices).map(p=>p.x)))-2,top:Math.floor(Math.min(...Object.values(vertices).map(p=>p.y)))-2,width:140,height:73};
 await sharp(pixels,{raw:{width:256,height:128,channels:4}}).webp({lossless:true}).toFile(root+`verification/candidate-${candidate.id}.webp`);
 await sharp(sourceBytes).extract(bounds).png().toFile(root+`source/patch-${candidate.id}.png`);
 reports.push({...candidate,vertices,patchBounds:bounds,mean:mean.map(n=>Math.round(n*100)/100),sd:sd.map(n=>Math.round(n*100)/100)});
}
await writeFile(root+'verification/candidates.json',JSON.stringify({original:{width:info.width,height:info.height,sha256:createHash('sha256').update(sourceBytes).digest('hex')},method:'Direct original pixels sampled by affine UV coordinate crop (bilinear resampling only). Original ground alpha copied verbatim. No AI redraw, color correction, sharpening, painted seam, procedural noise or aesthetic filtering.',gridAnalysis:{u:'x+2y',uPeriod:134,uPhase:60,v:'x-2y',vPeriod:136,vPhase:125},candidates:reports},null,2));
console.log(reports);

// Cell A is completely within the empty upper lawn and closest to the reference lawn mean.
await copyFile(root+'verification/candidate-a.webp',root+'runtime/ground.webp');
await copyFile(root+'source/patch-a.png',root+'source/lawn-patch.png');
const decoded=await sharp(root+'runtime/ground.webp').ensureAlpha().raw().toBuffer();let alphaMismatches=0;
for(let n=0;n<256*128;n++)if(decoded[n*4+3]!==alpha[n*4+3])alphaMismatches++;
const patch=reports[0].patchBounds,sourcePatch=await sharp(sourceBytes).extract(patch).removeAlpha().raw().toBuffer(),savedPatch=await sharp(root+'source/lawn-patch.png').removeAlpha().raw().toBuffer();let sourcePatchMismatches=0;
for(let n=0;n<sourcePatch.length;n++)if(sourcePatch[n]!==savedPatch[n])sourcePatchMismatches++;
await writeFile(root+'verification/extraction.json',JSON.stringify({selected:'a',runtime:{width:256,height:128,format:'lossless WebP',hasAlpha:true,originalAlphaMismatches:alphaMismatches},sourcePatch:{...patch,pixelMismatches:sourcePatchMismatches},sourceQuad:reports[0].vertices,palette:reports[0].mean,method:'Direct original-pixel affine crop; bilinear sampling and existing alpha only; no AI generation or image recoloring.'},null,2));
