import type {ActivityReward,GameEvent,PowerUseCounts,PowerUseKind,PowerFestivalState} from '@garden/contracts';

export const POWER_FESTIVAL_MIN_LEVEL=5;
export const POWER_FESTIVAL_DURATION=30*60*1000;
export const POWER_USE_KINDS=['rainbow','glider','bomb','rocket'] as const;
export const POWER_FESTIVAL_STAGES:ReadonlyArray<{targets:PowerUseCounts;reward:ActivityReward}>=[
 {targets:{rainbow:1,glider:4,bomb:3,rocket:6},reward:{coins:100,items:{}}},
 {targets:{rainbow:1,glider:5,bomb:4,rocket:8},reward:{coins:150,items:{'sweep-row':1}}},
 {targets:{rainbow:2,glider:6,bomb:5,rocket:10},reward:{coins:0,items:{hammer:1}}},
 {targets:{rainbow:2,glider:8,bomb:6,rocket:12},reward:{coins:250,items:{rainbow:1}}},
 {targets:{rainbow:3,glider:10,bomb:8,rocket:15},reward:{coins:500,items:{rainbow:1}}},
];
export const emptyPowerUses=():PowerUseCounts=>({rocket:0,bomb:0,glider:0,rainbow:0});
export function addPowerUses(a:PowerUseCounts=emptyPowerUses(),b:PowerUseCounts=emptyPowerUses()):PowerUseCounts{return Object.fromEntries(POWER_USE_KINDS.map(kind=>[kind,a[kind]+b[kind]])) as PowerUseCounts;}
const powerKind=(kind:string):PowerUseKind|undefined=>kind==='wind-row'||kind==='wind-column'?'rocket':kind==='bomb'||kind==='glider'||kind==='rainbow'?kind:undefined;
/** Count real activations, including combo ingredients and cascade-created tiles.
 * A carried glider payload is already counted in the combo; its impact is not a second item.
 */
export function powerUses(events:readonly GameEvent[]):PowerUseCounts{
 const counts=emptyPowerUses();let payload:string|undefined;
 for(const event of events){
  if(event.type!=='special'||!event.cells.length||event.kind==='glider-flight')continue;
  const kind=event.kind??'',parts=kind.split('+');
  if(payload&&kind===payload){payload=undefined;continue;}
  if(parts.length===2&&parts.some(part=>!!powerKind(part))){
   for(const part of parts){const key=powerKind(part);if(key)counts[key]++;}
   if(parts.every(part=>!!powerKind(part))&&parts.includes('glider')&&!parts.includes('rainbow')&&parts.some(part=>part!=='glider'))payload=parts.find(part=>part!=='glider');
  }else{const key=powerKind(kind);if(key)counts[key]++;}
 }
 return counts;
}
export function festivalStage(counts:PowerUseCounts,claimed:number){
 const index=Math.max(0,Math.min(POWER_FESTIVAL_STAGES.length-1,claimed)),stage=POWER_FESTIVAL_STAGES[index]!;
 const prior=POWER_FESTIVAL_STAGES.slice(0,index).reduce((sum,item)=>addPowerUses(sum,item.targets),emptyPowerUses());
 const progress=Object.fromEntries(POWER_USE_KINDS.map(kind=>[kind,Math.min(stage.targets[kind],Math.max(0,counts[kind]-prior[kind]))])) as PowerUseCounts;
 return {index,targets:stage.targets,progress,reward:stage.reward,ready:claimed<POWER_FESTIVAL_STAGES.length&&POWER_USE_KINDS.every(kind=>progress[kind]>=stage.targets[kind])};
}
export function festivalClaimable(event:PowerFestivalState):number{
 let count=0;for(let index=event.claimedStages;index<POWER_FESTIVAL_STAGES.length;index++){if(!festivalStage(event.counts,index).ready)break;count++;}return count;
}
