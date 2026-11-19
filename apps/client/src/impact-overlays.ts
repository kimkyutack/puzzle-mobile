import type {GameEvent,GameState,Obstacle} from '@garden/contracts';
import type {VisualTiming} from './visual-timing';
import {isBreakableObstacle} from '../../../packages/contracts/src/breakable-obstacles';
import {lightRay} from '../../../packages/game-core/src/garden-puzzles';
import {chapterBadgeChanged} from './chapter-obstacle-art';
export type ImpactOverlay={delay:number;kind:'obstacle';id:string;value:Obstacle|null;fallFrom?:number}|{delay:number;kind:'frost';at:number;value:number};
export type ObstacleImpact={eventIndex:number;delay:number;at:number;kind:Obstacle['kind']|'frost'|'garden-gate';broken:boolean};
function goldRefillOrigins(before:GameState,after:GameState){
 const {width}=after;
 const fresh=new Set(Object.values(after.obstacles).filter(coin=>!before.obstacles[coin.id]).map(coin=>coin.anchor));
 const origins=new Map<number,number>();
 for(const first of fresh){
  if(fresh.has(first-width))continue;
  let inlet=first;
  while(fresh.has(inlet))inlet+=width;
  // A stack of new coins enters above its top cell with its spacing intact.
  const distance=inlet-first;
  for(let at=first;at<inlet;at+=width)origins.set(at,at-distance);
 }
 return origins;
}
/** Damage display follows each authoritative hit; the logical state is never modified. */
export function impactOverlays(before:GameState,after:GameState,events:readonly GameEvent[],timing:Pick<VisualTiming,'delays'|'settleAt'>,onHit?:(impact:ObstacleImpact)=>void):ImpactOverlay[]{
 const steps:ImpactOverlay[]=[];
 function reportDamage(eventIndex:number,delay:number,previous:Obstacle|null,value:Obstacle|null){
  if(!onHit||!previous)return;
  const event=events[eventIndex]!;
  if(event.type!=='hit'||event.kind!==previous.kind)return;
  const broken=value?.kind!==previous.kind;
  const shrank=previous.kind==='pipe'&&value!==null&&value.footprint.length<previous.footprint.length;
  if(broken||shrank||value!.hp<previous.hp)onHit({eventIndex,delay,at:event.cells[0]??previous.anchor,kind:previous.kind,broken:broken||shrank});
 }
 const oldRay=new Set(lightRay(before)),newRay=new Set(lightRay(after));
 const swarmEffects=new Set(events.flatMap(event=>event.type==='special'&&(event.kind==='glider-flight'||event.kind==='glider')&&event.effectId!==undefined?[event.effectId]:[]));
 for(const [id,old]of Object.entries(before.obstacles)){
  const final=after.obstacles[id];
  // Authored mechanics carry exact per-impact geometry: a retracting pipe can
  // change its anchor several times, and a carousel can move without losing HP.
  let previousDelay=0,travelEnds=0,authoredHits=0,previous:Obstacle|null=old;
  const authored=events.flatMap((event,index)=>{
   if(event.obstacleId!==id||event.obstacleAfter===undefined)return [];
   const phaseGap=old.kind==='pipe'?(event.effectId!==undefined&&swarmEffects.has(event.effectId)?16:220):isBreakableObstacle(old.kind)?85:0;
   const reseal=event.kind==='chapter-reseal',fall=event.kind==='crate-fall';
   const startsNow=reseal||event.kind==='cart-push';
   const delay=Math.max(previousDelay+(authoredHits>0?phaseGap:0),travelEnds,startsNow?0:event.type==='mechanic'?timing.settleAt:timing.delays[index]!);authoredHits++;
   previousDelay=delay;if(event.type==='mechanic'&&!reseal)travelEnds=delay+(fall?220:event.kind==='cart-push'?220:320);
   reportDamage(index,delay,previous,event.obstacleAfter);previous=event.obstacleAfter;
   return [{delay,kind:'obstacle' as const,id,value:event.obstacleAfter,...(fall?{fallFrom:event.from}:{})}];
  });
  if(authored.length){steps.push(...authored);continue;}
  if(final?.kind===old.kind&&final.hp===old.hp&&final.anchor===old.anchor){
   if(old.kind==='shadow-bud'&&oldRay.has(old.anchor)!==newRay.has(old.anchor)||old.kind==='garden-light'&&before.gardenPuzzle?.lightAt!==after.gardenPuzzle?.lightAt||
    old.detonateAt!==undefined&&before.turn!==after.turn||chapterBadgeChanged(old,final,before,after)){
    steps.push({delay:timing.settleAt,kind:'obstacle',id,value:final});
   }
   continue;
  }
  const hits=events.flatMap((event,index)=>event.type==='hit'&&event.kind===old.kind&&event.cells.includes(old.anchor)?[index]:[]).sort((a,b)=>timing.delays[a]!-timing.delays[b]!);
  if(!hits.length){steps.push({delay:timing.settleAt,kind:'obstacle',id,value:final??null});continue;}
  let hp=old.hp;
  for(const [index,eventIndex]of hits.entries()){
   hp--;
   const delay=timing.delays[eventIndex]!,value=index===hits.length-1?(final??null):hp>0?{...old,hp}:null;
   reportDamage(eventIndex,delay,previous,value);previous=value;
   steps.push({delay,kind:'obstacle',id,value});
  }
 }
 const emerging=new Set(events.flatMap(event=>
  (event.kind==='soil-chip-arrival'||event.kind==='crate-pieces-reveal')&&event.obstacleId?[event.obstacleId]:[]));
 const pieceDelays=new Map<string,number>(),pieces=new Map<string,Obstacle|null>();
 for(const [index,event] of events.entries()){
  const id=event.obstacleId;
  if(!id||!emerging.has(id)||event.obstacleAfter===undefined)continue;
  const delay=Math.max(timing.delays[index]!,(pieceDelays.get(id)??-85)+85);
  reportDamage(index,delay,pieces.get(id)??null,event.obstacleAfter);pieces.set(id,event.obstacleAfter);
  steps.push({delay,kind:'obstacle',id,value:event.obstacleAfter,...(event.kind==='crate-fall'?{fallFrom:event.from}:{})});pieceDelays.set(id,delay);
 }
 const coinOrigins=after.goldGarden?goldRefillOrigins(before,after):undefined;
 for(const [id,value]of Object.entries(after.obstacles))if(!before.obstacles[id]&&!emerging.has(id)){
  const source=coinOrigins?.get(value.anchor);
  steps.push({delay:timing.settleAt,kind:'obstacle',id,value,...(source!==undefined?{fallFrom:source}:{})});
 }
 for(const [at,old]of before.cells.entries()){
  const final=after.cells[at]?.frost??0;if(old.frost===final)continue;
  const hits=events.flatMap((event,index)=>event.type==='hit'&&event.kind==='frost'&&event.cells.includes(at)?[index]:[]).sort((a,b)=>timing.delays[a]!-timing.delays[b]!);
  if(!hits.length){steps.push({delay:timing.settleAt,kind:'frost',at,value:final});continue;}
  let previous=old.frost;
  for(const [index,eventIndex]of hits.entries()){
   const delay=timing.delays[eventIndex]!,value=index===hits.length-1?final:Math.max(final,old.frost-index-1);
   if(value<previous)onHit?.({eventIndex,delay,at,kind:'frost',broken:value===0});
   previous=value;
   steps.push({delay,kind:'frost',at,value});
  }
 }
 return steps.sort((a,b)=>a.delay-b.delay);
}
