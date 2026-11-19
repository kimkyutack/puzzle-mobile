import {Texture} from 'pixi.js';
import {art,assetImage,texture} from './assets';

const rendered=new WeakMap<HTMLImageElement,{src:string;texture:Texture}>();

/** Sample the same symmetric strip for every opening, including rotated tiles. */
function routeEdge(data:Uint8ClampedArray,size:number){
 const strip=new Uint8ClampedArray(4*size);
 for(let i=0;i<size;i++){
  const opposite=size-1-i;
  const samples=[i*size,i*size+size-1,opposite*size,opposite*size+size-1].map(at=>4*at);
  const total=samples.reduce((alpha,at)=>alpha+data[at+3]!,0);
  strip[i*4+3]=total/samples.length;
  if(total===0)continue;
  for(let channel=0;channel<3;channel++){
   strip[i*4+channel]=samples.reduce((sum,at)=>sum+data[at+channel]!*data[at+3]!,0)/total;
  }
 }
 return strip;
}

function fitOpening(image:ImageData,strip:Uint8ClampedArray,edge:'west'|'east'|'north'|'south'){
 const {data,width:size}=image;
 const depth=Math.round(size*.19);
 // Use the exact strip at the boundary, then ease back into the original art.
 for(let inset=0;inset<depth;inset++){
  const t=Math.max(0,(inset-3)/(depth-3));
  const blend=1-t*t*(3-2*t);
  for(let i=0;i<size;i++){
   const at=4*(edge==='west'?i*size+inset:edge==='east'?i*size+size-1-inset:edge==='north'?inset*size+i:(size-1-inset)*size+i);
   const sample=i*4;
   const sourceAlpha=(1-blend)*data[at+3]!,edgeAlpha=blend*strip[sample+3]!;
   const alpha=sourceAlpha+edgeAlpha;
   for(let channel=0;channel<3;channel++){
    data[at+channel]=alpha===0?0:(data[at+channel]!*sourceAlpha+strip[sample+channel]!*edgeAlpha)/alpha;
   }
   data[at+3]=alpha;
  }
 }
}

/** Wrap the existing paving texture around a quarter circle between straight approaches. */
function bendFloor(straight:ImageData,strip:Uint8ClampedArray){
 const size=straight.width,center=size/2,radius=size*.34;
 const turnX=center-radius,turnY=center+radius;
 const turnLength=Math.PI*radius/2;
 const total=turnX+turnLength+size-turnY;
 const bend=new ImageData(size,size);
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const px=x+.5,py=y+.5;
  let distance:number,across:number;
  if(px<turnX){
   if(py>turnY)continue;
   distance=px;across=py-.5;
  }else if(py>=turnY){
   distance=turnX+turnLength+py-turnY;across=size-px-.5;
  }else{
   const dx=px-turnX,dy=turnY-py;
   distance=turnX+radius*Math.atan2(dx,dy);
   across=center+radius-Math.hypot(dx,dy)-.5;
  }
  if(across<0||across>=size-1)continue;
  const row=Math.floor(across),fraction=across-row,from=row*4,to=from+4;
  const opacity=strip[from+3]!*(1-fraction)+strip[to+3]!*fraction;
  if(!opacity)continue;
  const at=(y*size+x)*4;
  const station=Math.min(size-1,Math.floor(distance/total*size));
  const grain=(Math.round(across)*size+station)*4;
  const endFade=Math.min(1,Math.max(0,(Math.min(distance,total-distance)-3)/(size*.16)));
  const textureWeight=endFade*.75*straight.data[grain+3]!/255;
  for(let channel=0;channel<3;channel++){
   const profile=(strip[from+channel]!*strip[from+3]!*(1-fraction)+strip[to+channel]!*strip[to+3]!*fraction)/opacity;
   bend.data[at+channel]=profile*(1-textureWeight)+straight.data[grain+channel]!*textureWeight;
  }
  bend.data[at+3]=opacity;
 }
 return bend;
}

export function stageFloorArt(id:string):{src:string;texture:Texture}{
 const route=/^stage_(dry|water)_(straight|corner|cross)_v33$/.exec(id);
 if(route){
  const [,surface,shape]=route;
  const image=assetImage(id),straight=assetImage(`stage_${surface}_straight_v33`);
  if(image&&straight){
   const cached=rendered.get(image);
   if(cached)return cached;
   const canvas=document.createElement('canvas');
   const size=straight.naturalWidth;
   canvas.width=canvas.height=size;
   const context=canvas.getContext('2d',{willReadFrequently:true});
   if(context){
    context.drawImage(straight,0,0,size,size);
    let floor=context.getImageData(0,0,size,size);
    const strip=routeEdge(floor.data,size);
    if(shape==='corner'){
     floor=bendFloor(floor,strip);
    }else if(shape==='cross'){
     // The authored junction arms are narrower than the straight channels.
     const enlarged=size*1.24,offset=(size-enlarged)/2;
     context.clearRect(0,0,size,size);
     context.drawImage(image,offset,offset,enlarged,enlarged);
     floor=context.getImageData(0,0,size,size);
     for(const edge of ['west','east','north','south'] as const)fitOpening(floor,strip,edge);
    }else{
     fitOpening(floor,strip,'west');
     fitOpening(floor,strip,'east');
    }
    context.putImageData(floor,0,0);
    // The floor under the tiles and its reveal overlay use the exact same pixels.
    const result={src:canvas.toDataURL(),texture:Texture.from(canvas)};
    rendered.set(image,result);
    return result;
   }
  }
 }
 return {src:art(id),texture:texture(id)};
}
