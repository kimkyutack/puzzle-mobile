import type {GameState} from '@garden/contracts';

export function seedExitLanes(state:GameState):number[][] {
 return state.gravity.filter(lane=>state.cells[lane.at(-1)!]?.exit);
}

export function seedDropTargets(state:GameState):number[] {
 if(!state.goals.some(goal=>goal.kind==='seed'&&goal.remaining>0))return [];
 const routes=seedExitLanes(state).flatMap(lane=>{
  let seed=lane.length-1;
  while(seed>=0&&state.cells[lane[seed]!]!.tile?.kind!=='seed')seed--;
  if(seed<0)return [];
  const path=lane.slice(seed+1).filter(at=>!state.gardenStage?.connected.includes(at));
  const barrier=path.findIndex(at=>state.cells[at]!.obstacleId);
  return [{distance:path.length,cells:path.slice(0,barrier<0?path.length:barrier+1).reverse()}];
 });
 return routes.sort((a,b)=>a.distance-b.distance).flatMap(route=>route.cells);
}

export function missingSeedCount(state:GameState):number {
 const remaining=state.goals.find(goal=>goal.kind==='seed')?.remaining??0;
 if(!remaining)return 0;
 const visible=state.cells.filter(cell=>cell.tile?.kind==='seed').length;
 const waiting=Object.values(state.obstacles).reduce((total,obstacle)=>total+(obstacle.seeds??0),0);
 return Math.max(0,remaining-visible-waiting);
}
