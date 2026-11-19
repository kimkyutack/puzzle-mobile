import {supportsGardenStages,supportsOpenGardenStages,type GameState,type LevelDefinition,type GardenStageDefinition,type GardenStageState,type GameEvent} from '@garden/contracts';
const adjacent=(a:number,b:number,width:number)=>Math.abs(a%width-b%width)+Math.abs(Math.floor(a/width)-Math.floor(b/width))===1;
export const gardenStageGoal=(kind:GardenStageDefinition['kind'])=>kind==='water'?'garden-water' as const:'garden-route' as const;
/** Deterministic flood fill; ordinary pieces and refills do not block a cleared floor. */
export function connectedGardenCells(stage:GardenStageDefinition,blocked:readonly number[],width:number):number[]{
 const gates=new Set(blocked),channels=new Set(stage.channels),queue=gates.has(stage.source)?[]:[stage.source],seen=new Set(queue);
 for(let at=0;at<queue.length;at++)for(const cell of stage.channels)if(!seen.has(cell)&&!gates.has(cell)&&channels.has(cell)&&adjacent(queue[at]!,cell,width)){seen.add(cell);queue.push(cell);}
 return queue;
}
export function validateGardenStage(level:LevelDefinition):string[]{
 const s=level.gardenStage;if(!s)return level.goals.some(g=>g.kind==='garden-water'||g.kind==='garden-route')?['MISSING_GARDEN_STAGE']:[];
 if(!supportsGardenStages(level.engineVersion))return ['GARDEN_STAGE_ENGINE'];
 if(!['water','animal'].includes(s.kind)||![s.channels,s.gates,s.destinations].every(Array.isArray))return ['GARDEN_STAGE_SHAPE'];
 const valid=(i:number)=>Number.isInteger(i)&&!!level.shape[i],unique=(cells:number[])=>new Set(cells).size===cells.length;
 if(s.channels.length<3||!s.gates.length||!s.destinations.length||!unique(s.channels)||!unique(s.gates)||!unique(s.destinations)||!s.channels.every(valid)||!s.channels.includes(s.source)||s.gates.some(i=>!s.channels.includes(i)||i===s.source)||s.destinations.some(i=>!s.channels.includes(i)||s.gates.includes(i)||i===s.source)||level.obstacles.some(o=>o.footprint.some(i=>s.channels.includes(i))))return ['GARDEN_STAGE_SHAPE'];
 const full=connectedGardenCells(s,[],level.width),initial=connectedGardenCells(s,s.gates,level.width);
 if(full.length!==s.channels.length||s.destinations.some(i=>initial.includes(i)))return ['GARDEN_STAGE_CONNECTION'];
 if(s.kind==='animal'&&(s.source!==s.channels[0]||s.channels.some((cell,i)=>i>0&&!adjacent(s.channels[i-1]!,cell,level.width))))return ['GARDEN_STAGE_ROUTE'];
 const goal=level.goals.find(g=>g.kind===gardenStageGoal(s.kind));
 return !goal||goal.count!==s.destinations.length||level.goals.some(g=>g.kind===gardenStageGoal(s.kind==='water'?'animal':'water'))?['GARDEN_STAGE_GOAL']:[];
}
export function createGardenStage(stage:GardenStageDefinition,width:number):GardenStageState {
 return {...structuredClone(stage),blocked:[...stage.gates],connected:connectedGardenCells(stage,stage.gates,width),completed:[],...(stage.kind==='animal'?{animalAt:stage.source}:{})};
}
/** Floor damage is derived exclusively from accepted simulation events, never client counters. */
export function advanceGardenStage(state:GameState,events:GameEvent[]):void {
 const stage=state.gardenStage;if(!stage)return;
 const hits=new Set(events.flatMap(e=>e.type==='remove'||e.type==='spawn'&&e.kind!=='normal'?e.cells:[]));
 const cleared=stage.blocked.filter(at=>hits.has(at));if(!cleared.length)return;
 stage.blocked=stage.blocked.filter(at=>!hits.has(at));
 for(const at of cleared)events.push({type:'hit',kind:'garden-gate',cells:[at]});
 const before=new Set(stage.connected);stage.connected=connectedGardenCells(stage,stage.blocked,state.width);
 const fresh=stage.connected.filter(at=>!before.has(at));
 // v1.7 opens real floor cells. They stay empty on later refills so the water
 // and the walking animal are visible; retained v1.6 runs keep their old rules.
 if(supportsOpenGardenStages(state.engineVersion))for(const at of stage.connected){
  const tile=state.cells[at]!.tile;if(!tile)continue;
  state.cells[at]!.tile=null;events.push({type:'remove',cells:[at],kind:tile.kind==='normal'?tile.color:tile.kind});
 }
 if(stage.kind==='animal'){
  const old=stage.animalAt!,route:number[]=[];let index=stage.channels.indexOf(old)+1;
  while(index<stage.channels.length&&stage.connected.includes(stage.channels[index]!))route.push(stage.channels[index++]!);
  if(route.length){stage.animalAt=route.at(-1)!;events.push({type:'mechanic',kind:'garden-route',cells:[old,...route],from:old,to:stage.animalAt});}
 }else if(fresh.length)events.push({type:'mechanic',kind:'garden-water',cells:fresh,from:stage.source,to:fresh.at(-1)});
 const completed=stage.destinations.filter(at=>stage.kind==='water'?stage.connected.includes(at):stage.channels.indexOf(at)<=stage.channels.indexOf(stage.animalAt!));
 stage.completed=completed;
 const goal=state.goals.find(g=>g.kind===gardenStageGoal(stage.kind));if(goal)goal.remaining=Math.max(0,goal.count-completed.length);
}
