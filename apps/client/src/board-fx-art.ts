import {BufferImageSource,DisplacementFilter,Sprite,Texture,type Application,type Container,type Filter} from 'pixi.js';
import {assetImage} from './assets';
import {inkBounds} from './board-sprite-art';
import {SHARD_PIECES} from './tile-shards';

/** A tile piece drawn in place on a full tile frame; the anchor sits on the piece's centre. */
export interface ShardArt {texture:Texture;anchor:{x:number;y:number}}

const SHARD_FRAME=128;
const shardCache=new Map<string,ShardArt[]|null>();

/** Cut the tile's own artwork into the crack pieces once per colour, so the shards always match the tile. */
export function tileShards(art:string):ShardArt[]|undefined{
 if(shardCache.has(art))return shardCache.get(art)??undefined;
 let result:ShardArt[]|null=null;
 try{
  const image=assetImage(art),size=SHARD_FRAME;
  const probe=image&&typeof document!=='undefined'?document.createElement('canvas').getContext('2d',{willReadFrequently:true}):null;
  if(image&&probe){
   probe.canvas.width=probe.canvas.height=size;probe.drawImage(image,0,0,size,size);
   const body=inkBounds(probe.getImageData(0,0,size,size).data,size,size);
   if(body){
    const cx=(body.left+body.right)/2,cy=(body.top+body.bottom)/2,hw=(body.right-body.left)/2,hh=(body.bottom-body.top)/2;
    const point=([x,y]:readonly [number,number]):[number,number]=>[cx+x*hw,cy+y*hh];
    result=SHARD_PIECES.map(piece=>{
     const canvas=document.createElement('canvas');canvas.width=canvas.height=size;const g=canvas.getContext('2d')!;
     g.beginPath();piece.points.forEach((p,k)=>{const [x,y]=point(p);if(k)g.lineTo(x,y);else g.moveTo(x,y);});g.closePath();
     g.clip();g.drawImage(image,0,0,size,size);
     const [ax,ay]=point(piece.centroid);
     return {texture:Texture.from(canvas),anchor:{x:ax/size,y:ay/size}};
    });
   }
  }
 }catch{result=null;}
 shardCache.set(art,result);
 return result??undefined;
}

/** Light materials made with imagegen (white light, alpha from brightness; see tools/fx-materials.mjs). */
export type FxMaterial='fx_glow'|'fx_puff'|'fx_rays'|'fx_sparks'|'fx_star'|'fx_streak'|'fx_trail'|'rocket_half'|`${'rainbow'|'power_rainbow'}_spin_blur_sheet_${0|1|2|3}`;
const fxUrls=import.meta.glob('../../../packages/assets/effects/runtime/*.png',{eager:true,query:'?url',import:'default'}) as Record<string,string>;
const fxTextures=new Map<string,Texture>();
let fxLoading:Promise<void>|undefined;
/** Decode every material once; effects fall back to the older sprites until this resolves. */
export function prepareFxMaterials(){
 fxLoading??=Promise.all(Object.entries(fxUrls).map(async([path,url])=>{
  const image=new Image();image.src=url;await image.decode();
  fxTextures.set(path.split('/').at(-1)!.slice(0,-4),Texture.from(image));
 })).then(()=>undefined).catch(()=>{fxLoading=undefined;});
 return fxLoading;
}
export const fxMaterial=(id:FxMaterial)=>fxTextures.get(id);

/** A displacement ring that bends the board outwards from a blast: air being shoved aside, no drawn band. */
function rippleMap(){
 const size=128,data=new Uint8Array(size*size*4);
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const nx=(x+.5)/size*2-1,ny=(y+.5)/size*2-1,d=Math.hypot(nx,ny),u=(d-.74)/.22,o=(y*size+x)*4;
  const f=Math.abs(u)<1&&d>0?Math.sin(Math.PI*u)*(1-u*u):0;
  data[o]=Math.round(128+127*f*nx/(d||1));data[o+1]=Math.round(128+127*f*ny/(d||1));data[o+2]=128;data[o+3]=255;
 }
 return new Texture({source:new BufferImageSource({resource:data,width:size,height:size})});
}

export function createBoardRipple(app:Application,layer:Container){
 let filter:DisplacementFilter|undefined,map:Sprite|undefined,broken=false;
 let job:{start:number;duration:number;x:number;y:number;reach:number;strength:number}|undefined;
 const stageFilters=()=>{const current=app.stage.filters as Filter|Filter[]|null|undefined;return current?(Array.isArray(current)?[...current]:[current]):[];};
 function detach(){
  job=undefined;
  if(!filter)return;
  const rest=stageFilters().filter(item=>item!==filter);
  app.stage.filters=rest.length?rest:null;
 }
 function ensure(){
  if(filter||broken)return !broken;
  try{map=new Sprite(rippleMap());map.anchor.set(.5);layer.addChild(map);filter=new DisplacementFilter({sprite:map,scale:0});}
  catch{broken=true;}
  return !broken;
 }
 function tick(){
  if(!job||!filter||!map)return;
  const k=(performance.now()-job.start)/job.duration;
  if(k>=1){detach();return;}
  if(k<0)return;
  // The ring's peak sits at 74% of the map's radius.
  const radius=job.reach*(.12+.88*(1-(1-k)**3));
  map.position.set(job.x,job.y);map.width=map.height=radius*2/.74;
  filter.scale.x=filter.scale.y=job.strength*(1-k)**1.3;
 }
 app.ticker.add(tick);
 return {
  play(origin:{x:number;y:number},reach:number,duration:number,strength:number){
   if(duration<=0||reach<=0){detach();return;}
   if(!ensure()||!filter)return;
   job={start:performance.now(),duration,x:origin.x,y:origin.y,reach,strength};
   const list=stageFilters();if(!list.includes(filter))app.stage.filters=[...list,filter];
   tick();
  },
  destroy(){app.ticker.remove(tick);detach();filter?.destroy();filter=undefined;map?.destroy({texture:true});map=undefined;},
 };
}
