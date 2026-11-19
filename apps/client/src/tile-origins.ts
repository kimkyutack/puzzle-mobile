import type {GameEvent,GameState,Tile} from '@garden/contracts';
import type {VisualTiming} from './visual-timing';
import {isMatchImpact} from './tile-impact';
export type CellPoint={x:number;y:number};
export interface TileOrigin {id:number;kind:Tile['kind'];birth:number;destination:number;mode:'supply'|'formation';inlet:number;origin:CellPoint;points:CellPoint[];falls:number[];shuffled:boolean}
export interface TileDeparture {delay:number;activation:boolean;matched?:true}
/** Track old identities through intermediate falls; a later hit's cell is not its starting cell. */
export function tileDepartures(before:GameState,events:readonly GameEvent[],timing:VisualTiming){
 const live=new Map(before.cells.flatMap((cell,at)=>cell.tile?[[at,cell.tile] as const]:[])),result=new Map<number,TileDeparture>();
 for(const [index,event]of events.entries()){
  if((event.type==='swap'||event.kind==='portal-transfer')&&event.from!==undefined&&event.to!==undefined){const a=live.get(event.from),b=live.get(event.to);live.delete(event.from);live.delete(event.to);if(a)live.set(event.to,a);if(b)live.set(event.from,b);}
  else if(event.kind==='turntable-spin'){
   const moved=(event.routes??[]).map(([from,to])=>({from:from!,to:to!,tile:live.get(from!)}));
   for(const {from}of moved)live.delete(from);
   for(const {to,tile}of moved)if(tile)live.set(to,tile);
  }
  else if(event.type==='fall'&&event.from!==undefined&&event.to!==undefined){const tile=live.get(event.from);live.delete(event.from);live.delete(event.to);if(tile)live.set(event.to,tile);}
  else if(event.type==='remove')for(const at of event.cells){
   const tile=live.get(at),delay=timing.delays[index]??0,converted=tile?.kind==='normal'&&timing.conversionAt.get(at)===delay;
   if(tile&&!result.has(tile.id))result.set(tile.id,{
    delay,activation:converted||tile.kind!=='normal'&&tile.kind!=='seed'&&timing.activationAt.has(at),
    ...(tile.kind==='normal'&&!converted&&isMatchImpact(event,timing)?{matched:true}:{}),
   });
   live.delete(at);
  }
  else if(event.type==='spawn')for(const at of event.cells)live.delete(at);
  else if(event.type==='shuffle')live.clear();
 }
 return result;
}
const center=(at:number,width:number):CellPoint=>({x:at%width+.5,y:Math.floor(at/width)+.5});
function distinct(points:CellPoint[]){return points.filter((point,index)=>index===0||point.x!==points[index-1]!.x||point.y!==points[index-1]!.y);}
/** Existing pieces follow the same declared inlet lanes as new pieces. A
 * committed swap is already visible, so its destination is the path's start. */
export function tileFallPaths(before:GameState,after:GameState,events:readonly GameEvent[]){
 const live=new Map(before.cells.flatMap((cell,at)=>cell.tile?[[at,cell.tile.id] as const]:[])),paths=new Map<number,CellPoint[]>();
 const updraft=before.devices?.steps[before.devices.index]?.kind==='updraft';
 for(const event of events){
  if(event.type==='swap'&&event.from!==undefined&&event.to!==undefined){const a=live.get(event.from),b=live.get(event.to);live.delete(event.from);live.delete(event.to);if(a!==undefined){live.set(event.to,a);paths.set(a,[center(event.to,after.width)]);}if(b!==undefined){live.set(event.from,b);paths.set(b,[center(event.from,after.width)]);}}
  else if(event.kind==='portal-transfer'&&event.from!==undefined&&event.to!==undefined){
   const entry=event.from,exit=event.to,a=live.get(entry),b=live.get(exit);
   live.delete(entry);live.delete(exit);
   if(a!==undefined){live.set(exit,a);paths.set(a,[center(entry,after.width),center(exit,after.width)]);}
   if(b!==undefined){live.set(entry,b);paths.set(b,[center(exit,after.width),center(entry,after.width)]);}
  }
  else if(event.kind==='turntable-spin'){
   const moved=(event.routes??[]).map(([from,to])=>({from:from!,to:to!,id:live.get(from!)}));
   for(const {from}of moved)live.delete(from);
   for(const {from,to,id}of moved)if(id!==undefined){
    live.set(to,id);
    paths.set(id,[center(from,after.width),center(to,after.width)]);
   }
  }
  else if(event.type==='fall'&&event.from!==undefined&&event.to!==undefined){
   const id=live.get(event.from);live.delete(event.from);live.delete(event.to);
   if(id!==undefined){
    live.set(event.to,id);
    const points=paths.get(id)??[center(event.from,after.width)];
    const lane=after.gravity.find(l=>l.includes(event.from!)&&l.includes(event.to!));
    const from=lane?.indexOf(event.from)??-1,to=lane?.indexOf(event.to)??-1;
    const route=lane&&to>from?lane.slice(from+1,to+1):lane&&updraft&&to<from?lane.slice(to,from).reverse():[event.to];
    points.push(...route.map(at=>center(at,after.width)));paths.set(id,points);
   }
  }
  else if(event.type==='remove'||event.type==='spawn')for(const at of event.cells)live.delete(at);
  else if(event.type==='shuffle'){live.clear();paths.clear();}
 }
 const survivors=new Set(after.cells.flatMap(c=>c.tile?[c.tile.id]:[]));return new Map([...paths].filter(([id,p])=>survivors.has(id)&&p.length>1).map(([id,p])=>[id,distinct(p)]));
}
/** Source identity is reconstructed from the existing engine ID interval; no replay, RNG, or state mutation. */
export function tileOrigins(before:GameState,after:GameState,events:readonly GameEvent[]):Map<number,TileOrigin>{
 const previous=new Set(before.cells.flatMap(cell=>cell.tile?[cell.tile.id]:[])),newborns=after.cells.flatMap((cell,destination)=>cell.tile&&!previous.has(cell.tile.id)?[{tile:cell.tile,destination}]:[]);
 if(!newborns.length)return new Map();
 // Every logged spawn allocates one ID. Initial rainbow-combination conversions allocate
 // the preceding unlogged interval, before any cascade/seed spawn is emitted.
 let serial=after.nextTileId-events.reduce((sum,event)=>sum+(event.type==='spawn'?event.cells.length:0),0);
 const births=new Map<number,{at:number;kind:string;falls:number[];inlet?:number;localRefill?:true}>(),live=new Map<number,number>();let shuffled=false;
 for(const event of events){
  if(event.type==='spawn')for(const at of event.cells){const id=serial++;births.set(id,{at,kind:event.kind??'',falls:[at],inlet:event.inlet,localRefill:event.localRefill});live.set(at,id);}
  else if(event.type==='fall'&&event.from!==undefined&&event.to!==undefined){const id=live.get(event.from);live.delete(event.from);live.delete(event.to);if(id!==undefined){live.set(event.to,id);births.get(id)!.falls.push(event.to);}}
  else if(event.type==='remove')for(const at of event.cells)live.delete(at);
  else if(event.type==='shuffle'){shuffled=true;live.clear();}
 }
 const laneFor=(at:number,inlet?:number)=>{
  const lane=after.gravity.find(lane=>lane.includes(at))??[at];
  return inlet===lane.at(-1)?[...lane].reverse():lane;
 };
 const fromInlet=(kind:Tile['kind'],birth:{inlet?:number;localRefill?:true})=>
  !birth.localRefill&&(kind==='normal'||!!after.goldGarden&&birth.inlet!==undefined);
 const supplied=new Map<number,Array<{id:number;position:number}>>();
 for(const {tile,destination}of newborns){const birth=births.get(tile.id);if(!birth||!fromInlet(tile.kind,birth))continue;const lane=laneFor(birth.at,birth.inlet),head=lane[0]!,position=lane.includes(birth.falls.at(-1)??destination)?lane.indexOf(birth.falls.at(-1)??destination):Math.floor(destination/after.width)-Math.floor(head/after.width),group=supplied.get(head)??[];group.push({id:tile.id,position});supplied.set(head,group);}
 for(const group of supplied.values())group.sort((a,b)=>a.position-b.position||a.id-b.id);
 const result=new Map<number,TileOrigin>();
 for(const {tile,destination}of newborns){
  const birth=births.get(tile.id);if(!birth||birth.kind!==tile.kind)continue;
  const lane=laneFor(birth.at,birth.inlet),head=lane[0]!,falls=[...birth.falls],mode=fromInlet(tile.kind,birth)?'supply':'formation',points:CellPoint[]=[];let origin=center(birth.at,after.width);
  if(mode==='supply'){
   const group=supplied.get(head)!,rank=group.findIndex(item=>item.id===tile.id),spacing=group.length-rank,first=center(head,after.width),next=lane[1]!==undefined?center(lane[1],after.width):{x:first.x,y:first.y+1},length=Math.hypot(next.x-first.x,next.y-first.y)||1;
   origin={x:first.x-(next.x-first.x)/length*spacing,y:first.y-(next.y-first.y)/length*spacing};points.push(origin,...lane.slice(0,lane.indexOf(birth.at)+1).map(at=>center(at,after.width)));
  }else points.push(origin);
  // Expand every logged fall through the declared gravity path, including shaped boards.
  for(let index=1;index<falls.length;index++){const from=falls[index-1]!,to=falls[index]!,path=laneFor(from,birth.inlet),a=path.indexOf(from),b=path.indexOf(to);if(a>=0&&b>a)points.push(...path.slice(a+1,b+1).map(at=>center(at,after.width)));else points.push(center(to,after.width));}
  const movedByShuffle=shuffled&&falls.at(-1)!==destination;
  if(movedByShuffle)points.push(center(destination,after.width));
  result.set(tile.id,{id:tile.id,kind:tile.kind,birth:birth.at,destination,mode,inlet:birth.localRefill?birth.at:head,origin,points:distinct(points),falls,shuffled:movedByShuffle});
 }
 return result;
}
/** Arc-length sampling keeps a turn in a declared fall path instead of cutting across a hole. */
export function pointOnPath(points:readonly CellPoint[],progress:number):CellPoint{
 if(points.length<2)return points[0]??{x:0,y:0};const lengths=points.slice(1).map((point,index)=>Math.hypot(point.x-points[index]!.x,point.y-points[index]!.y)),total=lengths.reduce((sum,value)=>sum+value,0);let distance=Math.max(0,Math.min(1,progress))*total;
 for(let index=0;index<lengths.length;index++){const length=lengths[index]!;if(distance<=length||index===lengths.length-1){const from=points[index]!,to=points[index+1]!,t=length?Math.min(1,distance/length):1;return{x:from.x+(to.x-from.x)*t,y:from.y+(to.y-from.y)*t};}distance-=length;}
 return points.at(-1)!;
}
