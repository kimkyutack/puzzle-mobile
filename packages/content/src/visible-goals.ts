import {supportsVisibleTargets,type Goal,type LevelDefinition,type Obstacle} from '@garden/contracts';
import {GREENHOUSE_DEVICES,WORKSHOP_DEVICES} from '../../contracts/src/campaign-devices';

const abstract=(goal:Goal)=>goal.kind==='special'||goal.kind==='combo';
const frostValley:Readonly<Record<number,{anchors:readonly number[];seed?:number}>>={
 43:{anchors:[21,22,23]},
 44:{anchors:[10,12,13,14,16],seed:500305},
};
const clearDeviceCells=new Set<string>(['conveyor',...WORKSHOP_DEVICES,...GREENHOUSE_DEVICES]);

/** Use breakable starting pieces in place of power activation counters. */
export function visibleGoalLevel(level:LevelDefinition):LevelDefinition{
 if(!supportsVisibleTargets(level.engineVersion))return level;
 const count=level.goals.filter(abstract).reduce((sum,goal)=>sum+goal.count,0);
 if(!count)return level;
 const {width,height,shape}=level;
 const zones=new Set(level.devices?.flatMap(device=>device.zones.flat()));
 const reserved=new Set([...level.obstacles.flatMap(obstacle=>obstacle.footprint),...(level.exits??[]),
  ...(level.protectedCells??[]),...(level.gardenStage?.channels??[]),
  ...(level.devices?.flatMap(device=>device.zones.filter(zone=>clearDeviceCells.has(device.kind)||zone.length<=9).flat())??[]),
  level.startBoosterGuide?.cell,level.tutorial?.from,level.tutorial?.to]);
 const usable=(at:number)=>shape[at]&&!reserved.has(at);
 const candidates=shape.flatMap((_,at)=>{
  if(!usable(at)||level.initial&&level.initial[at]?.kind!=='normal')return [];
  const x=at%width,y=Math.floor(at/width),neighbors=[x>0?at-1:-1,x+1<width?at+1:-1,at-width,at+width];
  const open=neighbors.filter(usable).length;
  const priority=Number(!!level.frost?.[at])*4+Number(open<2)*2+Number(zones.has(at));
  return open?[{at,priority,edge:Math.min(x,width-1-x,y,height-1-y),order:(at*43+level.seed)%97}]:[];
 }).sort((a,b)=>a.priority-b.priority||a.edge-b.edge||a.order-b.order);
 const eligible=new Set(candidates.map(({at})=>at));
 // The frost valley leaves both paths into the ice open.
 const authored=frostValley[level.id];
 const anchors=[...new Set([...(authored?.anchors??[]).filter(at=>eligible.has(at)),...eligible])].slice(0,count);
 if(!anchors.length&&level.goals.every(abstract))throw Error('VISIBLE_GOAL_LAYOUT');
 const tiles=new Set(anchors);
 const stones:Obstacle[]=anchors.map(at=>({id:`flower-seal-${at}`,kind:'flower-seal',anchor:at,footprint:[at],hp:1,maxHp:1}));
 const goals=level.goals.filter(goal=>!abstract(goal));
 if(stones.length)goals.push({kind:'flower-seal',count:stones.length,remaining:stones.length});
 const strategy=authored&&level.strategy?{...level.strategy,hint:'석판 옆에서 타일을 맞추고, 로켓으로 서리를 한 겹씩 깨세요.'}:level.strategy;
 return {...level,version:level.version+':visible-goals-v1',seed:authored?.seed??level.seed,goals,obstacles:[...level.obstacles,...stones],
  ...(strategy?{strategy}:{}),
  ...(level.initial?{initial:level.initial.map((tile,at)=>tiles.has(at)?null:tile)}:{})};
}
