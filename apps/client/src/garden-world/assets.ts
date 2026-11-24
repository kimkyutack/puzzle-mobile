import festivalArch from '../../../../packages/assets/garden-v51/runtime/festival-arch.webp';
import lotusPavilion from '../../../../packages/garden-world/art/runtime/showcase/lotus-pavilion.webp';
import auroraConservatory from '../../../../packages/garden-world/art/runtime/showcase/aurora-conservatory.webp';
import starlightPavilion from '../../../../packages/assets/garden-invite-v117/runtime/pavilion.webp';
import starlightSparkle from '../../../../packages/assets/effects/runtime/fx_star.png';
import festivalArchRear from '../../../../packages/assets/garden-v51/runtime/festival-arch-rear.webp';
import flowerlight from '../../../../packages/assets/flowerlight-v42/flowerlight-fountain.png';
import flowerlightRear from '../../../../packages/assets/flowerlight-v42/flowerlight-fountain-rear.png';
import ground from '../../../../packages/garden-world/art/home-v78/runtime/ground.webp';
import path from '../../../../packages/garden-world/art/home-v78/runtime/path-paving.webp';
import fountain from '../../../../packages/garden-world/art/runtime/fountain.png';
import greenhouse from '../../../../packages/garden-world/art/runtime/greenhouse.png';
import bench from '../../../../packages/garden-world/art/runtime/bench.png';
import planter from '../../../../packages/garden-world/art/runtime/planter.png';
import lamp from '../../../../packages/garden-world/art/home-v77/runtime/lamp.webp';
import lampRear from '../../../../packages/garden-world/art/home-v77/runtime/lamp-rear.webp';
import tree from '../../../../packages/garden-world/art/home-v77/runtime/tree.webp';
import treeRear from '../../../../packages/garden-world/art/home-v77/runtime/tree-rear.webp';
import fence from '../../../../packages/garden-world/art/home-v77/runtime/fence.webp';
import fenceRear from '../../../../packages/garden-world/art/home-v77/runtime/fence-rear.webp';
import roseArch from '../../../../packages/garden-world/art/runtime/rose-arch.png';
import gazebo from '../../../../packages/garden-world/art/runtime/gazebo.png';
import pond from '../../../../packages/garden-world/art/runtime/pond.png';
import picnic from '../../../../packages/garden-world/art/runtime/picnic.png';
import hedge from '../../../../packages/garden-world/art/runtime/hedge.png';
import mushroom from '../../../../packages/garden-world/art/runtime/mushroom.png';
import rabbit from '../../../../packages/garden-world/art/runtime/rabbit.png';
import cat from '../../../../packages/garden-world/art/runtime/cat.png';
import dog from '../../../../packages/garden-world/art/runtime/dog.png';
import benchFestival from '../../../../packages/garden-world/art/runtime/festival/bench.webp';
import benchFestivalRear from '../../../../packages/garden-world/art/runtime/festival/bench-rear.webp';
import planterFestival from '../../../../packages/garden-world/art/runtime/festival/planter.webp';
import planterFestivalRear from '../../../../packages/garden-world/art/runtime/festival/planter-rear.webp';
import lampFestival from '../../../../packages/garden-world/art/runtime/festival/lamp.webp';
import lampFestivalRear from '../../../../packages/garden-world/art/runtime/festival/lamp-rear.webp';
import gate from '../../../../packages/garden-world/art/runtime/gate.png';
import telescope from '../../../../packages/garden-world/art/runtime/telescope.png';
import play from '../../../../packages/garden-world/art/runtime/ui-button_lime_v9.png';
import secondary from '../../../../packages/garden-world/art/runtime/ui-button_blue_v9.png';
import amber from '../../../../packages/garden-world/art/runtime/ui-button_amber_v9.png';
import plate from '../../../../packages/garden-world/art/runtime/ui-resource_pearl_v9.png';
import dock from '../../../../packages/garden-world/art/runtime/ui-footer_azure_v9.png';
import lumi from '../../../../packages/garden-world/art/runtime/ui-lumi.png';
import home from '../../../../packages/garden-world/art/runtime/ui-home.png';
import shop from '../../../../packages/garden-world/art/runtime/ui-shop.png';
import close from '../../../../packages/garden-world/art/runtime/ui-close.png';
import hammer from '../../../../packages/garden-world/art/runtime/ui-hammer.png';
import inventory from '../../../../packages/garden-world/art/runtime/ui-chest.png';
import ice from '../../../../packages/garden-world/art/runtime/ui-card_ice_v9.png';
import peach from '../../../../packages/garden-world/art/runtime/ui-card_peach_v9.png';
import lavender from '../../../../packages/garden-world/art/runtime/ui-card_lavender_v9.png';
import acornCottage from '../../../../packages/garden-world/art/runtime/minigames/acorn-cottage.webp';
import waterworkPavilion from '../../../../packages/garden-world/art/runtime/minigames/waterwork-pavilion.webp';
export const WORLD_ART:Record<string,string>={ground,'garden-path-stone':path,'garden-fountain':fountain,'garden-greenhouse':greenhouse,'garden-bench':bench,'garden-planter':planter,'garden-lamp':lamp,'garden-tree':tree,'garden-rose-arch':roseArch,'garden-gazebo':gazebo,'garden-pond':pond,'garden-picnic':picnic,'garden-hedge':hedge,'garden-mushroom':mushroom,'animal-rabbit':rabbit,'animal-cat':cat,'animal-dog':dog};
WORLD_ART['garden-bench:festival']=benchFestival;WORLD_ART['garden-bench:festival:rear']=benchFestivalRear;
WORLD_ART['garden-planter:festival']=planterFestival;WORLD_ART['garden-planter:festival:rear']=planterFestivalRear;
WORLD_ART['garden-lamp:festival']=lampFestival;WORLD_ART['garden-lamp:festival:rear']=lampFestivalRear;
WORLD_ART['garden-flowerlight-arch']=festivalArch;WORLD_ART['garden-flowerlight-arch:rear']=festivalArchRear;
WORLD_ART['garden-flowerlight-fountain']=flowerlight;WORLD_ART['garden-flowerlight-fountain:rear']=flowerlightRear;
WORLD_ART['garden-gate']=gate;WORLD_ART['garden-telescope']=telescope;
WORLD_ART['garden-lotus-pavilion']=lotusPavilion;WORLD_ART['garden-aurora-conservatory']=auroraConservatory;
WORLD_ART['garden-acorn-cottage']=acornCottage;WORLD_ART['garden-waterwork-pavilion']=waterworkPavilion;
WORLD_ART['garden-starlight-wish-pavilion']=starlightPavilion;
WORLD_ART['invite-starlight-sparkle']=starlightSparkle;
const marketFiles=import.meta.glob<string>('../../../../packages/garden-world/art/runtime/market-v64/*.webp',{eager:true,import:'default',query:'?url'});
for(const [path,url]of Object.entries(marketFiles)){
 const id=path.match(/\/([^/]+)\.webp$/)![1]!;
 WORLD_ART[id]=url;
 if(id.startsWith('animal-')){
  WORLD_ART[id+':rear']=url;
  for(let frame=0;frame<6;frame++)WORLD_ART[`resident:${id}:${frame}`]=url;
  for(let frame=0;frame<4;frame++)for(const side of ['front','rear'])WORLD_ART[`resident-walk:${id}:${side}:${frame}`]=url;
 }
}
const newRearFiles=import.meta.glob<string>('../../../../packages/garden-world/art/runtime/directions-v64/*-rear.webp',{eager:true,import:'default',query:'?url'});
for(const [path,url]of Object.entries(newRearFiles)){
 const id=path.match(/\/([^/]+)-rear\.webp$/)![1]!;
 WORLD_ART[id+':rear']=url;
}
WORLD_ART['restoration-hammer']=hammer;
const storyFiles=import.meta.glob<string>('../../../../packages/garden-world/art/runtime/story-v30/*.png',{eager:true,import:'default',query:'?url'});
for(const [path,url]of Object.entries(storyFiles)){const id=path.match(/\/([^/]+)\.png$/)![1]!;WORLD_ART['garden-'+id.replace(/-rear$/,':rear')]=url;}
const rearFiles=import.meta.glob<string>([
 '../../../../packages/garden-world/art/runtime/directions-v24/*-rear.png',
 '!../../../../packages/garden-world/art/runtime/directions-v24/*-festival-rear.png'
],{eager:true,import:'default',query:'?url'});
for(const [path,url]of Object.entries(rearFiles)){
 const id=path.match(/\/([^/]+)-rear\.png$/)![1]!,animal=['rabbit','cat','dog'].includes(id);
 WORLD_ART[(animal?'animal-':'garden-')+id+':rear']=url;
}
const residentFiles=import.meta.glob<string>('../../../../packages/garden-world/art/runtime/residents-v22/*.png',{eager:true,import:'default',query:'?url'});
for(const [path,url]of Object.entries(residentFiles)){const match=path.match(/\/([a-z_]+)-(\d)\.png$/);if(match){const actor=match[1]!.startsWith('visitor')?match[1]:'animal-'+match[1];WORLD_ART['resident:'+actor+':'+match[2]]=url;}}
const walkFiles=import.meta.glob<string>('../../../../packages/garden-world/art/runtime/residents-walk-v26/*.png',{eager:true,import:'default',query:'?url'});
for(const [path,url]of Object.entries(walkFiles)){
 const match=path.match(/\/([a-z_]+)-(front|rear)-(\d)\.png$/);if(!match)continue;
 const actor=match[1]!.startsWith('visitor')?match[1]:'animal-'+match[1];WORLD_ART[`resident-walk:${actor}:${match[2]}:${match[3]}`]=url;
}
const visitorVarietyFiles=import.meta.glob<string>('../../../../packages/garden-world/art/runtime/residents-variety-v29/*.png',{eager:true,import:'default',query:'?url'});
for(const [path,url]of Object.entries(visitorVarietyFiles)){
 const match=path.match(/\/(visitor_[a-z]+)-(front|rear|idle)-(\d)\.png$/);if(!match)continue;
 WORLD_ART[match[2]==='idle'?`resident:${match[1]}:${match[3]}`:`resident-walk:${match[1]}:${match[2]}:${match[3]}`]=url;
}
// Authored front/rear walks and leisure poses for exclusive expedition friends.
const expeditionFiles=import.meta.glob<string>('../../../../packages/assets/expedition-v50/runtime/*.webp',{eager:true,import:'default',query:'?url'});
for(const animal of ['panda','fox','red-panda']){
 const id='animal-'+animal,frame=(n:number)=>expeditionFiles[`../../../../packages/assets/expedition-v50/runtime/${animal}-${n}.webp`]!;
 WORLD_ART[id]=frame(0);WORLD_ART[id+':rear']=frame(10);
 for(const [i,n]of [0,1,2,3,4,5].entries())WORLD_ART[`resident:${id}:${i}`]=frame(n);
 for(let i=0;i<4;i++){WORLD_ART[`resident-walk:${id}:front:${i}`]=frame(6+i);WORLD_ART[`resident-walk:${id}:rear:${i}`]=frame(11+i);}
}
WORLD_ART['garden-lamp:rear']=lampRear;
WORLD_ART['garden-tree:rear']=treeRear;
WORLD_ART['garden-wood-fence']=fence;WORLD_ART['garden-wood-fence:rear']=fenceRear;
const botanicalFiles=import.meta.glob<string>('../../../../packages/garden-world/art/home-v78/runtime/*.webp',{eager:true,import:'default',query:'?url'});
for(const [path,url]of Object.entries(botanicalFiles)){
 const match=path.match(/\/([^/]+?)(-rear)?\.webp$/)!;if(['ground','path','path-paving'].includes(match[1]!))continue;
 WORLD_ART['garden-'+match[1]+(match[2]?':rear':'')]=url;
}
export const UI_ART={play,secondary,amber,plate,dock,lumi,home,shop,close,hammer,inventory,ice,peach,lavender};
export interface LoadedArt {image:HTMLImageElement|HTMLCanvasElement;alpha:Uint8ClampedArray;width:number;height:number}
// Measured slopes of the supports or the longest ground edge in the source sprites.
const groundSlopes:Readonly<Partial<Record<string,number>>>={
 'garden-flowerlight-arch':-.18,'garden-flowerlight-arch:rear':.18,
 'garden-pond':-.33,'garden-pond:rear':-.34,
 'garden-swing':.22,'garden-swing:rear':-.22,
 'garden-stone-bridge':.30,'garden-stone-bridge:rear':-.30,
 'garden-lantern-arcade':.31,'garden-lantern-arcade:rear':.31
};

async function decodeGardenArt(url:string,shear:number):Promise<LoadedArt>{
 const image=new Image();
 image.src=url;
 await image.decode();
 const width=image.naturalWidth,height=image.naturalHeight;
 const canvas=document.createElement('canvas');
 canvas.width=width;
 canvas.height=height+Math.ceil(Math.abs(shear)*width);
 const context=canvas.getContext('2d',{willReadFrequently:true});
 if(!context)throw new Error('이미지를 준비하지 못했어요.');
 context.setTransform(1,shear,0,1,0,Math.max(0,-shear*width));
 context.drawImage(image,0,0);
 const pixels=context.getImageData(0,0,width,canvas.height);
 if(!shear)return {image,width,height,alpha:pixels.data};

 // Trim the padding introduced by the shear so the bottom remains the ground anchor.
 const alpha=pixels.data,row=width*4;
 let first=3,last=alpha.length-1;
 while(first<last&&alpha[first]!<8)first+=4;
 while(last>first&&alpha[last]!<8)last-=4;
 const top=Math.floor(first/row),bottom=Math.floor(last/row)+1;
 const aligned=document.createElement('canvas');
 aligned.width=width;
 aligned.height=bottom-top;
 aligned.getContext('2d')!.putImageData(pixels,0,-top);
 return {image:aligned,width,height:aligned.height,alpha:alpha.slice(top*row,bottom*row)};
}
let artCache:Promise<Record<string,LoadedArt>>|undefined;
export function loadWorldArt():Promise<Record<string,LoadedArt>> {
 if(!artCache)artCache=decodeWorldArt().catch(error=>{artCache=undefined;throw error});return artCache;
}
async function decodeWorldArt():Promise<Record<string,LoadedArt>> {
 const decoded=new Map<string,Promise<LoadedArt>>();
 return Object.fromEntries(await Promise.all(Object.entries(WORLD_ART).map(async([id,url])=>{
  const slope=groundSlopes[id],shear=slope===undefined?0:Math.sign(slope)*.5-slope;
  const key=`${url}|${shear}`;
  let art=decoded.get(key);
  if(!art){art=decodeGardenArt(url,shear);decoded.set(key,art);}
  return [id,await art];
 })));
}
