import missionsIcon from '../../../packages/assets/garden-v51/runtime/missions.webp';
import rankingIcon from '../../../packages/assets/garden-v51/runtime/ranking.webp';
import levelCompletedIcon from '../../../packages/assets/level-v61/runtime/level-completed.webp';
import {assets as bundledAssets} from '../../../packages/assets/asset-manifest.json';
import {COLORS,supportsVisibleTargets,type Obstacle} from '@garden/contracts';
import gardenDog from '../../../packages/garden-world/art/runtime/residents-v22/dog-0.png';
import gardenRabbit from '../../../packages/garden-world/art/runtime/residents-v22/rabbit-0.png';
import {tr} from "./i18n";
import {mechanicArtId} from './mechanic-ids';
import {guildEmblems} from './guild-emblems';
import {Texture} from 'pixi.js';
export interface AssetEntry {id:string;runtimePath:string;width:number;height:number;alpha:boolean;contentHash:string;sliceInsets?:{left:number;right:number;top:number;bottom:number};titleCenter?:{x:number;y:number};frames?:string[];fps?:number}
interface Sequence {id:string;frames:string[];contentHashes:string[];fps:number;loop:boolean}
export interface Manifest {version:string;assets:AssetEntry[];sequences:Sequence[]}
// The admission dialogs mount before App prepares the game artwork.
const admissionFrameIds = new Set(['panel_guild_v3', 'panel', 'button_play', 'button_secondary']);
const admissionFrames = new Map<string, AssetEntry>(bundledAssets
 .filter(asset => admissionFrameIds.has(asset.id))
 .map(asset => [asset.id, asset]));
let manifest:Manifest;
const metadata=new Map<string,AssetEntry>();
const urls=new Map<string,string>([
 ['missions_menu_v51',missionsIcon],['ranking_trophy_v51',rankingIcon],['level_completed_v61',levelCompletedIcon],
 ['garden-route',gardenRabbit],['dog-route',gardenDog],
 ...guildEmblems.map(({icon,url})=>[icon,url] as const),
]);
const textures=new Map<string,Texture>();
const images=new Map<string,HTMLImageElement>();
const sequences=new Map<string,Texture[]>();
const textureOwners=new Map<string,number>();
function prepareTileGlows(){
 const size=128,inset=3;
 for(const color of COLORS){
  const id=tileArt('normal',color),source=images.get(id);
  if(!source||textures.has(`${id}-glow`))continue;
  const canvas=document.createElement('canvas');
  canvas.width=canvas.height=size;
  const context=canvas.getContext('2d')!;
  context.drawImage(source,0,0,size,size);
  const image=context.getImageData(0,0,size,size),glow=context.createImageData(size,size);
  const alpha=(x:number,y:number)=>x>=0&&x<size&&y>=0&&y<size?image.data[(y*size+x)*4+3]!:0;
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
   const center=alpha(x,y),neighbors=[alpha(x-inset,y),alpha(x+inset,y),alpha(x,y-inset),alpha(x,y+inset)];
   const inside=Math.min(center,...neighbors),outside=Math.max(center,...neighbors);
   const pixel=(y*size+x)*4;
   glow.data[pixel]=glow.data[pixel+1]=glow.data[pixel+2]=255;
   glow.data[pixel+3]=center*.19+(center-inside)*.79+(outside-center)*.42;
  }
  context.putImageData(glow,0,0);
  textures.set(`${id}-glow`,Texture.from(canvas));
 }
}
const obstacleSprites=import.meta.glob('../../../packages/assets/breakable-obstacles/runtime/*.webp',{eager:true,query:'?url',import:'default'}) as Record<string,string>;
let obstacleTextures:Promise<void>|undefined;
function prepareObstacleTextures(){
 if(!obstacleTextures){
  obstacleTextures=Promise.all(Object.entries(obstacleSprites).map(async([path,url])=>{
   const id=path.split('/').at(-1)!.slice(0,-5);
   const image=new Image(); image.src=url;await image.decode();
   urls.set(id,url);textures.set(id,Texture.from(image));images.set(id,image);
  })).then(()=>undefined).catch(error=>{obstacleTextures=undefined;throw error;});
 }
 return obstacleTextures;
}
const CACHE='cloud-garden-verified-special-v25';
const cacheStorage=()=>typeof caches==='undefined'?Promise.resolve(null):caches.open(CACHE).catch(()=>null);
const publicOrigin=(import.meta.env.VITE_ASSET_ORIGIN||'').replace(/\/$/,'');
const assetVersion=import.meta.env.VITE_ASSET_VERSION||'garden-2026.11.04-campaign-v20';
const assetUrl=(path:string)=>publicOrigin?`${publicOrigin}/${manifest?.version||assetVersion}${path}`:path;
async function verifiedImage(path:string,expected:string){
 path=assetUrl(path);const cache=await cacheStorage();
 let res=await cache?.match(path);
 if(!res){res=await fetch(path);if(!res.ok)throw new Error(tr("이미지 로드 실패: {0}",{0:(path)}));}
 const bytes=await res.clone().arrayBuffer();
 const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),x=>x.toString(16).padStart(2,'0')).join('');
 if(hash!==expected){await cache?.delete(path);throw new Error(tr("이미지 버전이 달라요. 다시 연결해 주세요."));}
 await cache?.put(path,res).catch(()=>{});
 const url=URL.createObjectURL(new Blob([bytes],{type:'image/png'}));
 const decoded=new Image();decoded.src=url;await decoded.decode();
 return {url,texture:Texture.from(decoded),image:decoded};
}
export async function prepareAssets(progress:(n:number)=>void){
 const cache=await cacheStorage();
 const response=await fetch(assetUrl('/assets/asset-manifest.json'),{cache:'no-cache'}).catch(()=>cache?.match('garden-verified-manifest'));
 if(!response?.ok)throw new Error(tr("정원 리소스를 불러오지 못했어요. 연결을 확인해 주세요."));
 const manifestResponse=response.clone();
 manifest=await response.json();
 metadata.clear();for(const asset of manifest.assets)metadata.set(asset.id,asset);
 const essentials=manifest.assets.filter(a=>!a.id.startsWith('frame_'));
 const files=new Map<string,ReturnType<typeof verifiedImage>>();
 let complete=0;const total=essentials.length+(manifest.sequences?.reduce((n,s)=>n+s.frames.length,0)||0)+1;
 await Promise.all(essentials.map(async asset=>{
  const fileKey=asset.runtimePath+'#'+asset.contentHash;
  let file=files.get(fileKey);if(!file){file=verifiedImage(asset.runtimePath,asset.contentHash);files.set(fileKey,file);}
  const loaded=await file;
  urls.set(asset.id,loaded.url);textures.set(asset.id,loaded.texture);images.set(asset.id,loaded.image);
  progress(++complete/total);
 }));
 for(const sequence of manifest.sequences||[]){sequences.set(sequence.id,await Promise.all(sequence.frames.map(async(path,index)=>{const loaded=await verifiedImage(path,sequence.contentHashes[index]!);progress(++complete/total);return loaded.texture;})));}
 prepareTileGlows();
 await prepareObstacleTextures();progress(++complete/total);
 // Only a completely verified pack becomes the fallback. A run never changes its loaded pack.
 await cache?.put('garden-verified-manifest',manifestResponse).catch(()=>{});
}
export const art=(id:string)=>urls.get(id)||admissionFrames.get(id)?.runtimePath||'';
export function texture(id:string){const result=textures.get(id);if(!result)throw new Error(`Missing asset: ${id}`);return result;}
export const assetInfo=(id:string)=>metadata.get(id)||admissionFrames.get(id);
export const assetImage=(id:string)=>images.get(id);
export const hasArt=(id:string)=>textures.has(id);
export const animationTextures=(id:string)=>sequences.get(id)||[];
/** Shared images may be visible in both the scene and a popup. Release GPU copies only at zero owners. */
export function retainSceneTexture(id:string){textureOwners.set(id,(textureOwners.get(id)||0)+1);return texture(id);}
export function releaseSceneTexture(id:string){const remaining=Math.max(0,(textureOwners.get(id)||1)-1);textureOwners.set(id,remaining);if(!remaining)textures.get(id)?.source.unload();}
export const POWER_RAINBOW_ART='rainbow_enhanced';
export const tileArt=(kind:string,color?:string,powered=false)=>kind==='normal'?`tile_${color}`:kind==='rainbow'&&powered?POWER_RAINBOW_ART:kind;
export function goalArt(kind:string,board?:{obstacles:Record<string,Obstacle>|Obstacle[];engineVersion?:string}){
 if(kind==='starlight-lantern')return 'starlight-lantern-open';
 if(kind==='device')return 'stage_mud_gate_v33';
 if(kind==='pipe'&&board&&Object.values(board.obstacles).some(obstacle=>obstacle.endOnly))return 'magnet_rail_end_v39';
 if(kind==='garden-water')return 'stage_flower_bloom_v33';
 if(kind==='garden-route')return 'garden-route';
 if(kind==='special')return 'bundle_tools_v7';
 if(kind==='frost'&&board?.engineVersion&&supportsVisibleTargets(board.engineVersion))return 'frost-thick';
 return mechanicArtId(kind)||(kind==='combo'?'cross-firework':COLORS.some(color=>color===kind)?`tile_${kind}`:kind==='crate'?'crate_1':kind);
}
