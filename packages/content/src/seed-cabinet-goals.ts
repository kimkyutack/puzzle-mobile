import {supportsCutoutRefill,type LevelDefinition} from '@garden/contracts';

/** Cabinets sitting entirely on seed exits already clear the delivery when opened. */
export function removeRedundantCabinetSeeds(level:LevelDefinition):LevelDefinition{
 if(!supportsCutoutRefill(level.engineVersion)||!level.exits?.length||
    !level.goals.some(goal=>goal.kind==='cabinet')||!level.goals.some(goal=>goal.kind==='seed'))return level;
 const exits=new Set(level.exits);
 let removed=0;
 const obstacles=level.obstacles.map(obstacle=>{
  if(obstacle.kind!=='cabinet'||!obstacle.seeds||!obstacle.footprint.every(at=>exits.has(at)))return obstacle;
  removed+=obstacle.seeds;
  const {seeds:_,...cabinet}=obstacle;
  return cabinet;
 });
 if(!removed)return level;
 const goals=level.goals.flatMap(goal=>{
  if(goal.kind!=='seed')return [goal];
  const count=goal.count-removed;
  return count>0?[{...goal,count,remaining:count}]:[];
 });
 const updated={...level,obstacles,goals,version:level.version+':cabinet-goals-v1'};
 if(!goals.some(goal=>goal.kind==='seed'))delete updated.exits;
 return updated;
}
