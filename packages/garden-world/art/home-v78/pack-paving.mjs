import sharp from'sharp';
import{writeFile,readFile}from'node:fs/promises';
import{createHash}from'node:crypto';
const root='packages/garden-world/art/home-v78/',input=root+'runtime/path.webp',beforeBytes=await readFile(input),{data:source,info}=await sharp(beforeBytes).ensureAlpha().raw().toBuffer({resolveWithObject:true});
const output=Buffer.from(source);let fullyRemoved=0,softened=0,unchangedStone=0;
for(let i=0;i<output.length;i+=4){
 const r=source[i],g=source[i+1],b=source[i+2];
 if(source[i+3]===0)continue;
 if(g>r&&g>b){
  const strength=Math.min(1,(g-r)/5),smooth=strength*strength*(3-2*strength),alpha=Math.round(source[i+3]*(1-smooth));
  output[i+3]=alpha;if(alpha===0)fullyRemoved++;else if(alpha!==source[i+3])softened++;
 }else unchangedStone++;
}
await sharp(output,{raw:{width:info.width,height:info.height,channels:4}}).webp({lossless:true}).toFile(root+'runtime/path-paving.webp');
const decoded=await sharp(root+'runtime/path-paving.webp').ensureAlpha().raw().toBuffer();let stoneRgbMismatches=0,stoneAlphaMismatches=0,nonGreenAlphaChanges=0;
for(let i=0;i<source.length;i+=4){if(source[i+3]===0)continue;const green=source[i+1]>source[i]&&source[i+1]>source[i+2];if(!green){for(let c=0;c<3;c++)if(source[i+c]!==decoded[i+c])stoneRgbMismatches++;if(source[i+3]!==decoded[i+3]){stoneAlphaMismatches++;nonGreenAlphaChanges++;}}}
const afterBytes=await readFile(input);
await writeFile(root+'verification/path-paving-mask.json',JSON.stringify({source:'runtime/path.webp',output:'runtime/path-paving.webp',width:info.width,height:info.height,sourceSha256:createHash('sha256').update(beforeBytes).digest('hex'),originalPathUnchanged:beforeBytes.equals(afterBytes),rule:'Modify only alpha for green-dominant pixels G>R and G>B. Smoothstep transition at G-R=0..5; G-R>=5 becomes transparent. RGB never modified.',fullyRemoved,softened,unchangedStone,stoneRgbMismatches,stoneAlphaMismatches,nonGreenAlphaChanges},null,2));
console.log({fullyRemoved,softened,unchangedStone,stoneRgbMismatches,stoneAlphaMismatches});
