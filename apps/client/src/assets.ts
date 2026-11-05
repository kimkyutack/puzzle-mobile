import {tr} from "./i18n";
import {mechanicArtId} from './mechanic-ids';
import {Texture} from 'pixi.js';
export interface AssetEntry {id:string;runtimePath:string;width:number;height:number;alpha:boolean;contentHash:string;sliceInsets?:{left:number;right:number;top:number;bottom:number};titleCenter?:{x:number;y:number};frames?:string[];fps?:number}
interface Sequence {id:string;frames:string[];contentHashes:string[];fps:number;loop:boolean}
export interface Manifest {version:string;assets:AssetEntry[];sequences:Sequence[]}
let manifest:Manifest;
const urls=new Map<string,string>();
const textures=new Map<string,Texture>();
const sequences=new Map<string,Texture[]>();
const textureOwners=new Map<string,number>();
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
 return {url,texture:Texture.from(decoded)};
}
export async function prepareAssets(progress:(n:number)=>void){
 const cache=await cacheStorage();
 const response=await fetch(assetUrl('/assets/asset-manifest.json'),{cache:'no-cache'}).catch(()=>cache?.match('garden-verified-manifest'));
 if(!response?.ok)throw new Error(tr("정원 리소스를 불러오지 못했어요. 연결을 확인해 주세요."));
 const manifestResponse=response.clone();
 manifest=await response.json();
 const essentials=manifest.assets.filter(a=>!a.id.startsWith('frame_'));
 const files=new Map<string,ReturnType<typeof verifiedImage>>();
 let complete=0;const total=essentials.length+(manifest.sequences?.reduce((n,s)=>n+s.frames.length,0)||0);
 await Promise.all(essentials.map(async asset=>{
  const fileKey=asset.runtimePath+'#'+asset.contentHash;
  let file=files.get(fileKey);if(!file){file=verifiedImage(asset.runtimePath,asset.contentHash);files.set(fileKey,file);}
  const loaded=await file;
  urls.set(asset.id,loaded.url);textures.set(asset.id,loaded.texture);
  progress(++complete/total);
 }));
 for(const sequence of manifest.sequences||[]){sequences.set(sequence.id,await Promise.all(sequence.frames.map(async(path,index)=>{const loaded=await verifiedImage(path,sequence.contentHashes[index]!);progress(++complete/total);return loaded.texture;})));}
 // Only a completely verified pack becomes the fallback. A run never changes its loaded pack.
 await cache?.put('garden-verified-manifest',manifestResponse).catch(()=>{});
}
export const art=(id:string)=>urls.get(id)||'';
export function texture(id:string){const result=textures.get(id);if(!result)throw new Error(`Missing asset: ${id}`);return result;}
export const assetInfo=(id:string)=>manifest.assets.find(a=>a.id===id);
export const hasArt=(id:string)=>textures.has(id);
export const animationTextures=(id:string)=>sequences.get(id)||[];
/** Shared images may be visible in both the scene and a popup. Release GPU copies only at zero owners. */
export function retainSceneTexture(id:string){textureOwners.set(id,(textureOwners.get(id)||0)+1);return texture(id);}
export function releaseSceneTexture(id:string){const remaining=Math.max(0,(textureOwners.get(id)||1)-1);textureOwners.set(id,remaining);if(!remaining)textures.get(id)?.source.unload();}
export const tileArt=(kind:string,color?:string)=>kind==='normal'?`tile_${color}`:kind==='seed'?'seed':kind;
export const goalArt=(kind:string)=>mechanicArtId(kind)||(kind==='combo'?'cross-firework':kind==='special'?'bomb':['berry','drop','sun','sprout','flower','acorn'].includes(kind)?`tile_${kind}`:kind==='crate'?'crate_1':kind==='frost'?'frost':kind);
