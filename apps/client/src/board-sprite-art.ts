import {mobileObstacleAlias} from './mobile-obstacle-art';
import {Rectangle,Texture} from 'pixi.js';
import {assetImage,hasArt,texture} from './assets';

const replacements:Record<string,string>={
 'domino-slat':'board-domino-slat','harvest-cart':'board-harvest-cart',
 'wind-row':'board-wind-row','wind-column':'board-wind-column',glider:'board-glider',
 'mechanic_carousel_v20':'board-carousel',statue:'board-statue','statue-damaged':'board-statue',
};
const frames=new WeakMap<Texture,Texture>();
let sampler:CanvasRenderingContext2D|null|undefined;

/** Find where the visible body starts and ends, excluding the soft alpha fringe. */
export function inkBounds(rgba:ArrayLike<number>,width:number,height:number){
 let left=width,top=height,right=-1,bottom=-1;
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  if(rgba[(y*width+x)*4+3]!<52)continue;
  left=Math.min(left,x);top=Math.min(top,y);right=Math.max(right,x);bottom=Math.max(bottom,y);
 }
 return right<0?undefined:{left,top,right:right+1,bottom:bottom+1};
}

export function boardTexture(id:string,cropMobile=false):Texture{
 const replacement=replacements[id];
 const revised=mobileObstacleAlias(id);
 const art=revised&&hasArt(revised)?revised:replacement&&hasArt(replacement)?replacement:id;
 const original=texture(art),known=frames.get(original);
 if(art.startsWith('mobile-')&&!cropMobile)return original;
 if(known)return known;
 const image=assetImage(art);
 if(!image)return original;
 const size=96;
 if(sampler===undefined){
  const canvas=document.createElement('canvas');canvas.width=canvas.height=size;
  sampler=canvas.getContext('2d',{willReadFrequently:true});
 }
 if(!sampler)return original;
 sampler.clearRect(0,0,size,size);
 sampler.drawImage(image,0,0,size,size);
 const sample=inkBounds(sampler.getImageData(0,0,size,size).data,size,size);
 if(!sample)return original;
 const w=original.frame.width,h=original.frame.height;
 const left=Math.floor(Math.max(0,sample.left-1)*w/size),top=Math.floor(Math.max(0,sample.top-1)*h/size);
 const right=Math.ceil(Math.min(size,sample.right+1)*w/size),bottom=Math.ceil(Math.min(size,sample.bottom+1)*h/size);
 const crop=new Texture({source:original.source,frame:new Rectangle(original.frame.x+left,original.frame.y+top,right-left,bottom-top)});
 frames.set(original,crop);
 return crop;
}

export function boardEffectTexture(id:string):Texture{
 return replacements[id]||mobileObstacleAlias(id)?boardTexture(id):texture(id);
}

/** Keep some space between rocket tips so their axis is readable on a packed board. */
export function boardSpriteSize(art:{width:number;height:number},width:number,height:number,kind:'obstacle'|'item'|'rocket'='obstacle'){
 const fit=Math.min(width/art.width,height/art.height);
 if(kind==='rocket'){
  const scale=.90*fit;
  return {width:art.width*scale,height:art.height*scale};
 }
 const longest=kind==='item' ? .985 : .99;
 const shortest=kind==='item' ? .91 : .965;
 const scale=longest*fit;
 return {width:Math.max(width*shortest,art.width*scale),height:Math.max(height*shortest,art.height*scale)};
}
