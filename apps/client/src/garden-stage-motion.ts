import type {GameEvent} from '@garden/contracts';
export function gardenStageMotion(events:readonly GameEvent[],settleAt:number,reduced=false){
 const movement=events.filter(e=>e.type==='mechanic'&&(e.kind==='garden-water'||e.kind==='garden-route'));
 const gate=events.some(e=>e.kind==='garden-gate'),cells=movement.flatMap(e=>e.cells),duration=movement.length?reduced?110:Math.min(1900,Math.max(650,cells.length*80)):gate?reduced?110:220:0;
 return {delay:reduced?0:settleAt+100,duration,end:movement.length||gate?(reduced?110:settleAt+100+duration+350):0};
}
