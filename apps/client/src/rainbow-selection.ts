import type {GameEvent,Special} from '@garden/contracts';
import {combinationParts} from './special-combination';

export interface RainbowSelection {index:number;effectId:number|undefined;targets:number[];powered?:true;replacement:Special|undefined;children:Map<number,number>;replacements:Map<number,Special>}
/** The first effect group is the lantern's selection, not the explosions it subsequently causes. */
export function rainbowSelections(events:readonly GameEvent[]):Map<number,RainbowSelection>{
 const result=new Map<number,RainbowSelection>();
 for(const [index,event]of events.entries()){
  if(event.type!=='special'||!event.kind?.includes('rainbow'))continue;
  const parts=combinationParts(event.kind),replacement=parts?.find(kind=>kind!=='rainbow');
  const end=events.findIndex((next,i)=>i>index&&(next.type==='fall'||next.type==='spawn'&&next.kind==='normal'));
  const group=events.slice(index+1,end<0?undefined:end),effectId=event.effectId??group.find(next=>(next.type==='remove'||next.type==='hit')&&next.effectId!==undefined)?.effectId;
  const selected=effectId===undefined?[]:group.filter(next=>(next.type==='remove'||next.type==='hit')&&next.effectId===effectId);
  const targets=[...new Set(selected.flatMap(next=>next.cells))],children=new Map<number,number>(),replacements=new Map<number,Special>();
  if(replacement)for(let i=index+1;i<(end<0?events.length:end);i++){
   const removal=events[i]!,activation=events[i+1];
   const kind=removal.kind===replacement?replacement:
    (replacement==='wind-row'||replacement==='wind-column')&&(removal.kind==='wind-row'||removal.kind==='wind-column')?removal.kind:undefined;
   if(removal.type==='remove'&&removal.effectId===effectId&&kind&&activation?.type==='special'&&activation.kind===kind&&activation.cells[0]===removal.cells[0]){
    const at=removal.cells[0]!;children.set(i+1,at);replacements.set(at,kind);
   }
  }
  result.set(index,{index,effectId,targets,replacement,children,replacements,...(event.powered?{powered:true as const}:{})});
 }
 return result;
}
/** Short connections travel in waves; every selected tile still receives one. */
export const RAINBOW_FLIGHT=480;
export function rainbowArrival(index:number,count:number,charge:number,travel:number){
 const flight=Math.min(RAINBOW_FLIGHT,travel);
 return charge+flight+(count>1?index/(count-1):0)*(travel-flight);
}
