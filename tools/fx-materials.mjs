// Turns the black-background light materials made with imagegen into runtime sprites:
// brightness becomes alpha (so they work with both normal and additive blending), colour is kept,
// the empty black margin is trimmed symmetrically around the light's centre, and the result is resized.
// Usage: node tools/fx-materials.mjs [sourceDir]
import {createRequire} from 'node:module';
import {mkdir,readdir,copyFile} from 'node:fs/promises';
import {join} from 'node:path';
const require=createRequire(import.meta.url);
const sharp=require('sharp');
const root=process.cwd(),from=process.argv[2]??join(root,'output/fx-imagegen');
const sourceDir=join(root,'packages/assets/effects/source'),runtimeDir=join(root,'packages/assets/effects/runtime');
await mkdir(sourceDir,{recursive:true});await mkdir(runtimeDir,{recursive:true});
// Long, thin materials keep their aspect; everything else is radial and stays square.
const longest={fx_streak:512,fx_trail:512};
const NOISE=8;
for(const file of (await readdir(from)).filter(name=>/^fx_[a-z_]+\.png$/.test(name)).sort()){
 const id=file.slice(0,-4),path=join(from,file);
 await copyFile(path,join(sourceDir,file));
 const {data,info}=await sharp(path).removeAlpha().raw().toBuffer({resolveWithObject:true});
 const {width,height}=info,out=Buffer.alloc(width*height*4);
 let left=width,right=-1,top=height,bottom=-1;
 for(let i=0;i<width*height;i++){
  const r=data[i*3],g=data[i*3+1],b=data[i*3+2],peak=Math.max(r,g,b),alpha=Math.max(0,Math.min(255,Math.round((peak-NOISE)*255/(255-NOISE))));
  const scale=peak?255/peak:0;
  out[i*4]=Math.round(r*scale);out[i*4+1]=Math.round(g*scale);out[i*4+2]=Math.round(b*scale);out[i*4+3]=alpha;
  if(alpha>6){const x=i%width,y=Math.floor(i/width);left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);}
 }
 if(right<0)throw new Error(`${file}: no visible light`);
 const pad=8,thin=id in longest;
 // Radial pieces are cropped symmetrically about the image centre so rotation and scaling stay centred.
 const cx=width/2,cy=height/2;
 const halfW=thin?(right-left)/2+pad:Math.max(cx-left,right-cx,cy-top,bottom-cy)+pad;
 const halfH=thin?Math.max(cy-top,bottom-cy)+pad:halfW;
 const midX=thin?(left+right)/2:cx;
 const crop={left:Math.max(0,Math.floor(midX-halfW)),top:Math.max(0,Math.floor(cy-halfH))};
 crop.width=Math.min(width-crop.left,Math.ceil(halfW*2));crop.height=Math.min(height-crop.top,Math.ceil(halfH*2));
 const target=longest[id]??512;
 const resized=sharp(out,{raw:{width,height,channels:4}}).extract(crop).resize(thin?{width:target}:{width:target,height:target,fit:'contain',background:{r:0,g:0,b:0,alpha:0}});
 const meta=await resized.png({compressionLevel:9}).toFile(join(runtimeDir,file));
 console.log(id,`${crop.width}x${crop.height} -> ${meta.width}x${meta.height}`);
}

// Item sprites already carry real alpha. Stray specks around the subject are dropped (largest alpha island only).
function keepLargestIsland(rgba,width,height){
 const seen=new Uint8Array(width*height);let best=[];
 for(let start=0;start<width*height;start++){
  if(seen[start]||rgba[start*4+3]<40)continue;
  const island=[start];seen[start]=1;
  for(let i=0;i<island.length;i++){const p=island[i],x=p%width,y=(p-x)/width;
   for(const [nx,ny] of [[x+1,y],[x-1,y],[x,y+1],[x,y-1]]){if(nx<0||ny<0||nx>=width||ny>=height)continue;const q=ny*width+nx;if(!seen[q]&&rgba[q*4+3]>=40){seen[q]=1;island.push(q);}}}
  if(island.length>best.length)best=island;
 }
 // Keep the soft edge: anything within 6px of the main island survives.
 const keep=new Uint8Array(width*height);for(const p of best)keep[p]=1;
 for(let pass=0;pass<6;pass++){const grow=keep.slice();for(let p=0;p<width*height;p++)if(keep[p]){const x=p%width;if(x>0)grow[p-1]=1;if(x<width-1)grow[p+1]=1;if(p>=width)grow[p-width]=1;if(p<width*(height-1))grow[p+width]=1;}keep.set(grow);}
 for(let p=0;p<width*height;p++)if(!keep[p])rgba[p*4+3]=0;
 return rgba;
}
// A painted halo behind the subject becomes a soft glow: full strength inside `inner`, fading out by `outer`
// (both as fractions of the cell size, measured from the cell centre), at `strength` of its painted alpha.
function featherHalo(rgba,width,height,{inner,outer,strength}){
 const cx=width/2,cy=height/2,size=Math.min(width,height);
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  const r=Math.hypot(x+.5-cx,y+.5-cy)/size;if(r<=inner)continue;
  const fade=Math.max(0,1-(r-inner)/(outer-inner)),o=(y*width+x)*4;
  rgba[o+3]=Math.round(rgba[o+3]*strength*fade*fade);
 }
 return rgba;
}
async function itemSprite(file,{frames=1,columns=1,size=512,feather}={}){
 const path=join(from,file);
 try{await copyFile(path,join(sourceDir,file));}catch{return;}
 const {data,info}=await sharp(path).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 const cellW=info.width/columns,cellH=info.height/Math.ceil(frames/columns);
 for(let i=0;i<frames;i++){
  const left=Math.round((i%columns)*cellW),top=Math.round(Math.floor(i/columns)*cellH),w=Math.round(cellW),h=Math.round(cellH);
  const cell=Buffer.alloc(w*h*4);
  for(let y=0;y<h;y++)data.copy(cell,y*w*4,((top+y)*info.width+left)*4,((top+y)*info.width+left+w)*4);
  keepLargestIsland(cell,w,h);
  if(feather)featherHalo(cell,w,h,feather);
  // Frames keep one shared box so the subject never jitters between them; a single sprite is trimmed.
  let image=sharp(cell,{raw:{width:w,height:h,channels:4}});
  if(frames===1)image=sharp(await image.png().toBuffer()).trim({threshold:2});
  const name=frames===1?file:file.replace('.png',`_${i}.png`);
  const meta=await image.resize({width:size,height:size,fit:'contain',background:{r:0,g:0,b:0,alpha:0}}).png({compressionLevel:9}).toFile(join(runtimeDir,name));
  console.log(name,`${w}x${h} -> ${meta.width}x${meta.height}`);
 }
}
await itemSprite('rocket_half.png');
// Fast spin: the glass body is smeared into horizontal motion-blur stripes (Royal Match disco-ball style).
const lanternHalo={inner:.34,outer:.47,strength:.6};
await itemSprite('rainbow_spin_blur_sheet.png',{frames:4,columns:2,size:256,feather:lanternHalo});
await itemSprite('power_rainbow_spin_blur_sheet.png',{frames:4,columns:2,size:256,feather:lanternHalo});
// Lumi's start-booster delivery: four poses and the basket she throws from.
for(const name of ['lumi_hop','lumi_windup','lumi_toss','lumi_cheer','basket_full','basket_burst'])await itemSprite(`${name}.png`);
