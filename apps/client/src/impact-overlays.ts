import type {GameEvent,GameState,Obstacle} from '@garden/contracts';
import type {VisualTiming} from './visual-timing';
export type ImpactOverlay={delay:number;kind:'obstacle';id:string;value:Obstacle|null}|{delay:number;kind:'frost';at:number;value:number};
/** Damage display follows each authoritative hit; the logical state is never modified. */
export function impactOverlays(before:GameState,after:GameState,events:readonly GameEvent[],timing:VisualTiming):ImpactOverlay[]{
 const steps:ImpactOverlay[]=[];
 for(const [id,old]of Object.entries(before.obstacles)){
  const final=after.obstacles[id];
  // Authored mechanics carry exact per-impact geometry: a retracting pipe can
  // change its anchor several times, and a carousel can move without losing HP.
  let previousDelay=0,travelEnds=0,authoredHits=0;
  const authored=events.flatMap((event,index)=>{
   if(event.obstacleId!==id||event.obstacleAfter===undefined)return [];
   const delay=Math.max(previousDelay+(old.kind==='pipe'&&authoredHits>0?220:0),travelEnds,event.type==='mechanic'?timing.settleAt:timing.delays[index]!);authoredHits++;
   previousDelay=delay;if(event.type==='mechanic')travelEnds=delay+320;
   return [{delay,kind:'obstacle' as const,id,value:event.obstacleAfter}];
  });
  if(authored.length){steps.push(...authored);continue;}
  if(final?.hp===old.hp&&final?.anchor===old.anchor)continue;
  const hits=events.flatMap((event,index)=>event.type==='hit'&&event.kind===old.kind&&event.cells.includes(old.anchor)?[timing.delays[index]!]:[]).sort((a,b)=>a-b);
  if(!hits.length){steps.push({delay:timing.settleAt,kind:'obstacle',id,value:final??null});continue;}
  let hp=old.hp;for(const [index,delay]of hits.entries()){hp--;const value=index===hits.length-1?(final??null):hp>0?{...old,hp}:null;steps.push({delay,kind:'obstacle',id,value});}
 }
 for(const [id,value]of Object.entries(after.obstacles))if(!before.obstacles[id])steps.push({delay:timing.settleAt,kind:'obstacle',id,value});
 for(const [at,old]of before.cells.entries()){
  const final=after.cells[at]?.frost??0;if(old.frost===final)continue;
  const hits=events.flatMap((event,index)=>event.type==='hit'&&event.kind==='frost'&&event.cells.includes(at)?[timing.delays[index]!]:[]).sort((a,b)=>a-b);
  if(!hits.length)steps.push({delay:timing.settleAt,kind:'frost',at,value:final});else for(const [index,delay]of hits.entries())steps.push({delay,kind:'frost',at,value:index===hits.length-1?final:Math.max(final,old.frost-index-1)});
 }
 return steps.sort((a,b)=>a.delay-b.delay);
}
