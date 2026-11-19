import type {GameEvent,GameState} from '@garden/contracts';
import {findMatches} from '@garden/core';
import type {VisualTiming} from './visual-timing';
import {mix,smoothStep} from './effect-motion';

export const MATCH_SQUEEZE=32;
export const MATCH_RELEASE=28;
export const isMatchImpact=(event:GameEvent,timing:VisualTiming)=>
 !timing.special||event.effectId!==undefined&&timing.directMatchImpacts.has(event.effectId);

/** Shrink in place, then fade the small remaining body as the crumbs break away. */
export function matchBreakPose(elapsed:number,anticipation=MATCH_SQUEEZE){
 const contactScale=.32;
 if(elapsed<anticipation){
  const scale=mix(1,contactScale,smoothStep(elapsed/anticipation));
  return {scaleX:scale,scaleY:scale,alpha:1};
 }
 const release=smoothStep((elapsed-anticipation)/MATCH_RELEASE);
 const scale=mix(contactScale,.12,release);
 return {scaleX:scale,scaleY:scale,alpha:1-release};
}
/** The body snaps outwards on contact, then gives way to its coloured shards. */
export function breakPose(elapsed:number,anticipation=0){
 if(elapsed<anticipation){const t=smoothStep(elapsed/anticipation);return {scaleX:1+.1*t,scaleY:1-.16*t,alpha:1};}
 const t=(elapsed-anticipation)/110;
 const rebound=smoothStep(t/.24),settle=smoothStep((t-.24)/.76);
 return {scaleX:mix(mix(anticipation?1.1:1,1.21,rebound),.86,settle),
  scaleY:mix(mix(anticipation ? .84 : 1,1.14,rebound),.86,settle),
  alpha:1-smoothStep((t-.10)/.74)};
}

export function obstacleRecoil(t:number){
 const press=smoothStep(t/.22)*(1-smoothStep((t-.22)/.39));
 const rebound=smoothStep((t-.22)/.40)*(1-smoothStep((t-.62)/.38));
 return {x:1+.10*press-.04*rebound,y:1-.13*press+.06*rebound};
}
/** Gather only an actual four/five/square/L match into its logged special spawn.
 * IDs are read before gravity, so supply pieces can never be pulled into it. */
export function tileGathering(before:GameState,events:readonly GameEvent[]){
 const cells=before.cells.map(cell=>({...cell})),state={...before,cells};let preferred:number[]=[];
 for(const event of events){if(event.type==='swap'&&event.from!==undefined&&event.to!==undefined){const a=cells[event.from]!,b=cells[event.to]!;[a.tile,b.tile]=[b.tile,a.tile];preferred=[event.to,event.from];}if(event.type==='remove'||event.type==='fall')break;}
 const formations=new Map(events.filter(e=>e.type==='spawn'&&e.kind!=='normal'&&e.kind!=='seed').map(e=>[e.cells[0],e.kind]));
 const result=new Map<number,{anchor:number;at:number}>();if(!formations.size)return result;
 for(const match of findMatches(state,preferred)){if(!match.kind||formations.get(match.anchor)!==match.kind)continue;for(const at of match.cells){const tile=cells[at]?.tile;if(tile?.kind==='normal')result.set(tile.id,{anchor:match.anchor,at});}}
 return result;
}
export interface ImpactCue {delay:number;name:'match'|'impact'|'crack';strength:'light'|'medium';shake:number;accent?:true}
/** Contacts, rather than launches, drive audio and haptics. One bounded cue per
 * contact cluster avoids an individual sound/vibration for every struck cell. */
export function impactCues(events:readonly GameEvent[],plan:VisualTiming,reduced=false):ImpactCue[]{
 const candidates=events.flatMap((e,i)=>e.type==='hit'||e.type==='remove'&&!e.cells.every(at=>plan.activationAt.has(at)||plan.conversionAt.get(at)===plan.delays[i])?[{delay:plan.delays[i]!,hit:e.type==='hit',rocket:plan.rocketContacts.has(i),count:e.type==='hit'?2:e.cells.length}]:[]).sort((a,b)=>a.delay-b.delay);
 const groups:Array<{delay:number;hit:boolean;count:number}>=[];
 for(const candidate of candidates){
  const last=groups.at(-1);
  if(last&&candidate.delay-last.delay<100){
   if(candidate.rocket&&candidate.hit&&!last.hit)last.delay=candidate.delay;
   last.hit||=candidate.hit;
   last.count+=candidate.count;
  }else groups.push({delay:candidate.delay,hit:candidate.hit,count:candidate.count});
 }
 const visible=groups.slice(0,reduced?1:4);
 const strongest=visible.reduce<(typeof visible)[number]|undefined>((best,group)=>!best||group.count>best.count?group:best,undefined);
 return visible.map((group,i)=>{
  const accent=plan.special&&!reduced&&group===strongest&&group.count>=6;
  return {delay:reduced?0:group.delay,name:group.hit?'crack':plan.special?'impact':'match',
   strength:!reduced&&(plan.special&&(i===0||accent)||group.hit&&group.count>=6)?'medium':'light',
   shake:reduced||plan.special?0:group.hit?1.15:.85,...(accent?{accent:true as const}:{})};
 });
}
