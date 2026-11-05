import type {Action,GameEvent,GameState} from '@garden/contracts';
import {combinationParts} from './special-combination';
export const VISUAL_BEATS={fusion:520,charge:360,rainbowCharge:900,gliderFlight:740,windTravel:620,rainbowTravel:650,pop:180,fall:320,maxChainStart:1100} as const;
export const specialCharge=(kind:string)=>kind.includes('rainbow')?VISUAL_BEATS.rainbowCharge:VISUAL_BEATS.charge;
function smoothArrival(progress:number){let low=0,high=1;for(let i=0;i<12;i++){const mid=(low+high)/2;if(mid*mid*(3-2*mid)<progress)low=mid;else high=mid;}return (low+high)/2;}
export interface VisualTiming {delays:number[];firstRemovalAt:Map<number,number>;activationAt:Map<number,number>;fusionAt:Map<number,number>;settleAt:number;special:boolean;toolImpact:number;primaryImpactAt:number}
/** Pure presentation schedule. Chain launches overlap after 1.1 s; each flight/impact keeps its full duration. */
export function effectTiming(events:readonly GameEvent[],state?:Pick<GameState,'width'|'height'|'cells'>,action?:Action):VisualTiming{
 const width=state?.width??7,height=state?.height??7,cellCount=state?.cells.length??width*height;
 const special=events.some(event=>event.type==='special')||action?.type==='booster'&&action.item!=='shuffle';
 const toolImpact=action?.type==='booster'?({hammer:760,shuffle:0,'sweep-border':1150,'world-bomb':1400,'cross-firework':900,'color-magnet':1000,'move-hourglass':0,'sweep-row':930,'sweep-column':930}[action.item]):0;
 const waves:number[]=[];let wave=0,gravity=false;
 for(const event of events){if(event.type==='fall'||event.type==='spawn'&&event.kind==='normal')gravity=true;if(gravity&&['remove','hit','special'].includes(event.type)){wave++;gravity=false;}waves.push(wave);}
 const base=(index:number)=>Math.min(special?700:100,waves[index]!*(special?180:35));
 const damage=new Map<number,number>(),activationAt=new Map<number,number>(),starts=new Map<number,number>(),launchAt=new Map<number,number>(),fusionAt=new Map<number,number>();
 const fusionLead=events.some(event=>event.type==='special'&&event.cells.length===2&&combinationParts(event.kind??''))?VISUAL_BEATS.fusion:0;
 const mark=(at:number,time:number)=>damage.set(at,Math.max(damage.get(at)??0,time));
 if(toolImpact)for(const event of events)if(event.type==='remove'||event.type==='hit')for(const at of event.cells)mark(at,toolImpact+base(events.indexOf(event)));
 for(const [index,event] of events.entries()){
  if(event.type!=='special')continue;const kind=event.kind??'',at=event.from??event.cells.at(-1);if(at===undefined)continue;
  // Flight events share their launch's preparation instead of charging a second time.
  const parts=event.cells.length===2?combinationParts(kind):null,preparation=kind==='glider-flight'?(launchAt.get(at)??base(index)):Math.min(Math.max(VISUAL_BEATS.maxChainStart+fusionLead,toolImpact),Math.max(base(index),damage.get(at)??0)),start=preparation+(parts?VISUAL_BEATS.fusion:0);starts.set(index,start);
  if(parts){fusionAt.set(index,preparation);for(const cell of event.cells)activationAt.set(cell,Math.min(activationAt.get(cell)??Infinity,preparation));}
  if(kind!=='glider-flight'){launchAt.set(at,start);if(!parts)activationAt.set(at,Math.min(activationAt.get(at)??Infinity,start));}
  if(kind==='glider-flight'&&event.to!==undefined){mark(event.to,start+VISUAL_BEATS.charge+VISUAL_BEATS.gliderFlight);continue;}
  const x=at%width,y=Math.floor(at/width);
  if(kind.includes('glider')&&!kind.includes('rainbow')){for(let target=0;target<cellCount;target++)if(Math.abs(target%width-x)+Math.abs(Math.floor(target/width)-y)<=1)mark(target,start+VISUAL_BEATS.charge);continue;}
  if(kind.includes('rainbow')){
   const end=events.findIndex((next,i)=>i>index&&(next.type==='fall'||next.type==='spawn'&&next.kind==='normal'));
   for(const next of events.slice(index+1,end<0?undefined:end))if(next.type==='remove'||next.type==='hit')for(const target of next.cells)mark(target,start+VISUAL_BEATS.rainbowCharge+VISUAL_BEATS.rainbowTravel);
  }else for(let target=0;target<cellCount;target++){
   const dx=Math.abs(target%width-x),dy=Math.abs(Math.floor(target/width)-y);
   if(kind.includes('bomb')){const radius=kind==='bomb+bomb'?4:2;if(Math.max(dx,dy)<=radius)mark(target,start+VISUAL_BEATS.charge+90+Math.max(dx,dy)*75);}
   if(kind.includes('wind')){const both=kind.includes('+'),span=kind.includes('bomb')?1:0,row=(both||kind!=='wind-column')&&dy<=span,column=(both||kind==='wind-column')&&dx<=span;
    const across=target%width<x?x+.5:width-x-.5,down=Math.floor(target/width)<y?y+.5:height-y-.5;
    if(row||column){const progress=Math.min(row?dx/across:Infinity,column?dy/down:Infinity);mark(target,start+VISUAL_BEATS.charge+Math.round(smoothArrival(Math.min(1,progress))*VISUAL_BEATS.windTravel));}}
  }
 }
 // The renderer presents the final cascade in one refill. Later normal matches
 // must not leave holes while the initial rainbow is still visibly charging.
 const rainbowImpacts=events.flatMap((event,index)=>event.type==='special'&&event.kind?.includes('rainbow')?[(starts.get(index)??0)+VISUAL_BEATS.rainbowCharge+VISUAL_BEATS.rainbowTravel]:[]);
 const rainbowBarrier=rainbowImpacts.length?Math.min(...rainbowImpacts):0;
 const firstRemovalAt=new Map<number,number>();let lastImpact=0;
 const delays=events.map((event,index)=>{
  if(event.type==='special')return starts.get(index)??base(index);
  let delay=base(index);
  if(event.type==='remove'||event.type==='hit')for(const at of event.cells)delay=Math.max(delay,activationAt.has(at)&&event.type==='remove'?activationAt.get(at)!:damage.get(at)??0);
  if((event.type==='remove'||event.type==='hit')&&!(event.type==='remove'&&event.cells.every(at=>activationAt.has(at))))delay=Math.max(delay,rainbowBarrier);
  if(action?.type==='booster'&&action.item==='color-magnet'&&event.type==='remove'&&waves[index]===0)delay=350;
  if(event.type==='remove'||event.type==='hit'){lastImpact=Math.max(lastImpact,delay);if(event.type==='remove')for(const at of event.cells)if(!firstRemovalAt.has(at))firstRemovalAt.set(at,delay);}
  return delay;
 });
 const settleAt=events.some(event=>event.type==='remove'||event.type==='hit')?lastImpact+VISUAL_BEATS.pop:0;
 const firstSpecial=events.findIndex(event=>event.type==='special'&&event.kind!=='glider-flight');let primaryImpactAt=toolImpact;
 if(!primaryImpactAt&&firstSpecial>=0){const kind=events[firstSpecial]!.kind??'',start=delays[firstSpecial]!;primaryImpactAt=start+specialCharge(kind)+(kind.includes('rainbow')?VISUAL_BEATS.rainbowTravel:kind.includes('glider')?VISUAL_BEATS.gliderFlight:kind.includes('bomb')?90:0);}
 return {delays,firstRemovalAt,activationAt,fusionAt,settleAt,special,toolImpact,primaryImpactAt};
}
