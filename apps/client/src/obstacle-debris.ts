import type {ObstacleKind} from '@garden/contracts';
import {assetImage} from './assets';

type Point={x:number;y:number};
type Rect=Point&{width:number;height:number};
export type DebrisKind=ObstacleKind|'frost'|'garden-gate';
export type DebrisPose=Point&{art:string;size:number;rotation:number;tilt:number};
export interface DebrisSurface {
 bounds():Rect;
 paint(pieces:readonly DebrisPose[]):void;
 destroy():void;
}

const wood=['crate-debris-lid','crate-debris-wall','crate-debris-plank','crate-debris-corner'];
const soil='debris-soil',petal='debris-petal',leaves='debris-leaves',cloth='debris-cloth';
const rim='debris-ceramic-rim',ceramic='debris-ceramic-wall',ring='debris-metal-ring',plate='debris-metal-plate';
const ceramicParts=[rim,ceramic],foliage=[leaves,petal],metal=[ring,plate];
const lamp=['debris-glass-long',ring,'debris-glass-chip',plate];
const materials:Record<DebrisKind,readonly string[]>={
 crate:wood, vine:foliage, pot:ceramicParts, moss:[leaves,soil], cabinet:[wood[0]!,wood[1]!,ring,wood[2]!],
 pipe:metal, bud:[petal,leaves], carousel:[rim,ring,ceramic,petal], curtain:[cloth,ring],
 urn:ceramicParts, statue:['debris-stone-carving','debris-stone-block'], 'flower-seal':['debris-stone-carving','debris-petal'], 'supply-crate':wood,
 crystal:['debris-crystal-long','debris-crystal-chip'], 'starlight-lantern':lamp,
 'wind-pod':[cloth,leaves,petal], windmill:[wood[2]!,plate,wood[3]!,ring],
 'greenhouse-sluice':[ring,wood[1]!,plate,wood[2]!], 'vine-knot':foliage,
 'rotating-shelf':[wood[1]!,ring,wood[2]!,plate], 'garden-planter':[rim,ceramic,leaves,soil],
 'domino-slat':[wood[2]!,wood[3]!], 'harvest-cart':[wood[1]!,ring,wood[2]!,plate],
 'soil-clod':[soil], 'soil-chip':[soil], 'garden-light':lamp, 'shadow-bud':[petal,leaves],
 'wire-planter':[ring,leaves,plate,soil], 'fence-thicket':foliage,
 frost:['debris-ice-sheet','debris-ice-chip'], 'garden-gate':['debris-stone-block',soil],
};

type Flight={art:string;origin:Point;size:number;angle:number;spin:number;start:number;end:number;dx:number;dy:number};
const MAX_SHARDS_PER_FRAME=120;
const spread=[-.18,.14,-.22,.21,.03];

export function createObstacleDebris(surface:DebrisSurface){
 let pending:Flight[]=[];
 let active:Flight[]=[];
 let painted=false;

 function burst(kind:DebrisKind,origin:Point,cell:number,hitAt:number,refillAt:number,broken:boolean,seed:number){
  const rect=surface.bounds(),art=materials[kind];
  const count=broken?4:2;
  const sizes=kind==='crate'||kind==='supply-crate'?[.88,.64,.54,.37]:[.74,.59,.45,.32];
  const firstAngle=seed*2.399963;
  for(let i=0;i<count;i++){
   const angle=firstAngle+i*Math.PI*2/count+spread[(i+seed)%spread.length]!;
   const x=Math.cos(angle),y=Math.sin(angle);
   const size=cell*(broken?sizes[i]!:.22+i*.08);
   const padding=size*.75+3;
   const edgeX=(x>0?rect.x+rect.width+padding:rect.x-padding)-origin.x;
   const edgeY=(y>0?rect.y+rect.height+padding:rect.y-padding)-origin.y;
   const distance=Math.max(cell,Math.min(x===0?Infinity:edgeX/x,y===0?Infinity:edgeY/y));
   const start=hitAt+i*13;
   const travel=Math.max(broken?620:450,refillAt-start+(broken?235:125),Math.min(890,320+distance/cell*52))+((i+seed)%4)*37;
   // Chips use the broken edge. A full break sends the recognizable parts first.
   const part=broken?i:art.length-1-i%art.length;
   pending.push({art:art[part%art.length]!,origin,size,angle,spin:(i%2?1:-1)*(2.8+i*.58),start,end:start+travel,dx:x*distance,dy:y*distance});
  }
 }

 function update(now:number){
  if(!pending.length&&!active.length&&!painted)return;
  active=active.filter(flight=>flight.end>now);
  pending=pending.filter(flight=>{
   if(flight.start>now)return true;
   // Admit only freshly launched shards. Already visible ones fly to the edge.
   if(flight.end>now&&active.length<MAX_SHARDS_PER_FRAME)active.push(flight);
   return false;
  });
  const pieces:DebrisPose[]=[];
  for(const flight of active){
   const t=(now-flight.start)/(flight.end-flight.start);
   const distance=.78*t+.22*(1-(1-t)**4);
   const rotation=flight.angle*.6+flight.spin*t;
   pieces.push({art:flight.art,x:flight.origin.x+flight.dx*distance,y:flight.origin.y+flight.dy*distance,
    size:flight.size*(1-.22*t),rotation,tilt:.68+.32*Math.abs(Math.cos(t*9+flight.angle))});
  }
  if(pieces.length||painted)surface.paint(pieces);
  painted=pieces.length>0;
 }

 function clear(){
  pending=[];
  active=[];
  if(painted)surface.paint([]);
  painted=false;
 }

 return {burst,update,clear,destroy:()=>{clear();surface.destroy();}};
}

// The Pixi board is cropped to the playable grid. Project the same coordinates
// into a transparent game-sized canvas so fragments can fly over its edges.
export function createDebrisSurface(host:HTMLElement,board:HTMLCanvasElement,boardSize:()=>{width:number;height:number}):DebrisSurface{
 const scene=host.closest<HTMLElement>('.game-shell');
 let canvas:HTMLCanvasElement|undefined,context:CanvasRenderingContext2D|null=null;
 function projection(){
  const area=scene?.getBoundingClientRect()??{left:0,top:0,width:window.innerWidth,height:window.innerHeight};
  const rect=board.getBoundingClientRect(),size=boardSize();
  return {area,offsetX:rect.left-area.left,offsetY:rect.top-area.top,
   scaleX:rect.width/Math.max(1,size.width)||1,scaleY:rect.height/Math.max(1,size.height)||1};
 }
 return {
  bounds(){
   const {area,offsetX,offsetY,scaleX,scaleY}=projection();
   return {x:-offsetX/scaleX,y:-offsetY/scaleY,width:area.width/scaleX,height:area.height/scaleY};
  },
  paint(pieces){
   if(!pieces.length){if(context&&canvas)context.clearRect(0,0,canvas.width,canvas.height);return;}
   if(!canvas){
    canvas=document.createElement('canvas');
    canvas.className='obstacle-debris';
    canvas.setAttribute('aria-hidden','true');
    Object.assign(canvas.style,{position:scene?'absolute':'fixed',inset:'0',width:'100%',height:'100%',pointerEvents:'none',zIndex:'5'});
    context=canvas.getContext('2d',{alpha:true});
    (scene??document.body).appendChild(canvas);
   }
   if(!context)return;
   const {area,offsetX,offsetY,scaleX,scaleY}=projection(),resolution=Math.min(window.devicePixelRatio||1,1.5);
   const width=Math.ceil(area.width*resolution),height=Math.ceil(area.height*resolution);
   if(canvas.width!==width)canvas.width=width;
   if(canvas.height!==height)canvas.height=height;
   context.setTransform(1,0,0,1,0,0);
   context.clearRect(0,0,width,height);
   for(const {art,x,y,size,rotation,tilt} of pieces){
    const image=assetImage(art);
    if(!image?.naturalWidth)continue;
    const scale=size/Math.max(image.naturalWidth,image.naturalHeight);
    const w=image.naturalWidth*scale,h=image.naturalHeight*scale*tilt;
    context.setTransform(scaleX*resolution,0,0,scaleY*resolution,(x*scaleX+offsetX)*resolution,(y*scaleY+offsetY)*resolution);
    context.rotate(rotation);
    context.drawImage(image,-w/2,-h/2,w,h);
   }
   context.resetTransform();
  },
  destroy(){canvas?.remove();canvas=undefined;context=null;},
 };
}
