import ground from '../../../../packages/garden-world/art/runtime/ground.png';
import path from '../../../../packages/garden-world/art/runtime/path.png';
import fountain from '../../../../packages/garden-world/art/runtime/fountain.png';
import greenhouse from '../../../../packages/garden-world/art/runtime/greenhouse.png';
import bench from '../../../../packages/garden-world/art/runtime/bench.png';
import planter from '../../../../packages/garden-world/art/runtime/planter.png';
import lamp from '../../../../packages/garden-world/art/runtime/lamp.png';
import tree from '../../../../packages/garden-world/art/runtime/tree.png';
import roseArch from '../../../../packages/garden-world/art/runtime/rose-arch.png';
import gazebo from '../../../../packages/garden-world/art/runtime/gazebo.png';
import pond from '../../../../packages/garden-world/art/runtime/pond.png';
import picnic from '../../../../packages/garden-world/art/runtime/picnic.png';
import hedge from '../../../../packages/garden-world/art/runtime/hedge.png';
import mushroom from '../../../../packages/garden-world/art/runtime/mushroom.png';
import rabbit from '../../../../packages/garden-world/art/runtime/rabbit.png';
import cat from '../../../../packages/garden-world/art/runtime/cat.png';
import dog from '../../../../packages/garden-world/art/runtime/dog.png';
import benchFestival from '../../../../packages/garden-world/art/runtime/bench-festival.png';
import planterFestival from '../../../../packages/garden-world/art/runtime/planter-festival.png';
import lampFestival from '../../../../packages/garden-world/art/runtime/lamp-festival.png';
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
export const WORLD_ART:Record<string,string>={ground,'garden-path-stone':path,'garden-fountain':fountain,'garden-greenhouse':greenhouse,'garden-bench':bench,'garden-planter':planter,'garden-lamp':lamp,'garden-tree':tree,'garden-rose-arch':roseArch,'garden-gazebo':gazebo,'garden-pond':pond,'garden-picnic':picnic,'garden-hedge':hedge,'garden-mushroom':mushroom,'animal-rabbit':rabbit,'animal-cat':cat,'animal-dog':dog};
WORLD_ART['garden-bench:festival']=benchFestival;WORLD_ART['garden-planter:festival']=planterFestival;WORLD_ART['garden-lamp:festival']=lampFestival;
WORLD_ART['garden-gate']=gate;WORLD_ART['garden-telescope']=telescope;
WORLD_ART['restoration-hammer']=hammer;
const storyFiles=import.meta.glob<string>('../../../../packages/garden-world/art/runtime/story-v30/*.png',{eager:true,import:'default',query:'?url'});
for(const [path,url]of Object.entries(storyFiles)){const id=path.match(/\/([^/]+)\.png$/)![1]!;WORLD_ART['garden-'+id.replace(/-rear$/,':rear')]=url;}
const rearFiles=import.meta.glob<string>('../../../../packages/garden-world/art/runtime/directions-v24/*-rear.png',{eager:true,import:'default',query:'?url'});
for(const [path,url]of Object.entries(rearFiles)){
 const id=path.match(/\/([^/]+)-rear\.png$/)![1]!,animal=['rabbit','cat','dog'].includes(id),festival=id.endsWith('-festival'),base=festival?id.slice(0,-9):id;
 WORLD_ART[(animal?'animal-':'garden-')+base+(festival?':festival':'')+':rear']=url;
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
export const UI_ART={play,secondary,amber,plate,dock,lumi,home,shop,close,hammer,inventory,ice,peach,lavender};
export interface LoadedArt {image:HTMLImageElement;alpha:Uint8ClampedArray;width:number;height:number}
let artCache:Promise<Record<string,LoadedArt>>|undefined;
export function loadWorldArt():Promise<Record<string,LoadedArt>> {
 if(!artCache)artCache=decodeWorldArt().catch(error=>{artCache=undefined;throw error});return artCache;
}
async function decodeWorldArt():Promise<Record<string,LoadedArt>> {
 return Object.fromEntries(await Promise.all(Object.entries(WORLD_ART).map(async([id,url])=>{
  const image=new Image();image.src=url;await image.decode();const canvas=document.createElement('canvas');canvas.width=image.naturalWidth;canvas.height=image.naturalHeight;
  const context=canvas.getContext('2d',{willReadFrequently:true});if(!context)throw new Error('이미지를 준비하지 못했어요.');context.drawImage(image,0,0);
  return [id,{image,width:canvas.width,height:canvas.height,alpha:context.getImageData(0,0,canvas.width,canvas.height).data}];
 })));
}
