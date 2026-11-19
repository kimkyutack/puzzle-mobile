import {supportsContinuousRefill,type Cell,type LevelDefinition,type Obstacle} from '@garden/contracts';
import {createGardenStage} from '../../game-core/src/garden-stages';
import {coveredGravityInlets,gravityLanes,suppliedGravityCells} from '../../game-core/src/gravity-flow';

const movableBankPiece=(o:Obstacle)=>o.footprint.length===1&&
 ['crate','urn','starlight-lantern','flower-seal','supply-crate','wind-pod'].includes(o.kind)&&
 !o.chapter&&!o.rule&&!o.cover&&!o.color&&!o.seeds;
function boardFor(level:LevelDefinition){
 const cells:Cell[]=level.shape.map(exists=>({exists,tile:null,frost:0}));
 for(const o of level.obstacles)for(const at of o.footprint)cells[at]!.obstacleId=o.id;
 return {...level,cells,gravity:gravityLanes(level),gardenStage:level.gardenStage&&createGardenStage(level.gardenStage,level.width)};
}
export function unsuppliedTileCells(level:LevelDefinition):number[]{
 const board=boardFor(level),supplied=suppliedGravityCells(board),open=new Set(board.gardenStage?.connected);
 return board.cells.flatMap((cell,at)=>cell.exists&&!cell.obstacleId&&!supplied.has(at)&&!open.has(at)?[at]:[]);
}

/** Leave a route through a sealed bank by moving the fewest ordinary
 * blockers. Keep cutouts, total objectives and authored pieces in place. */
export function withRefillCorridors(level:LevelDefinition):LevelDefinition{
 if(!supportsContinuousRefill(level.engineVersion)||!level.obstacles.length||level.gardenStage||level.gardenPuzzle||level.devices)return level;
 const board=boardFor(level),{width,cells}=board,covered=coveredGravityInlets(board,1);
 const obstacles=new Map(level.obstacles.map(o=>[o.id,o]));
 const fixed=new Set([
  level.tutorial?.from,level.tutorial?.to,level.startBoosterGuide?.cell,
  ...(level.protectedCells??[]),...Object.keys(level.frost??{}).map(Number),
  ...board.gravity.filter(lane=>lane.some(at=>level.exits?.includes(at))).flat(),
 ]);
 level.initial?.forEach((tile,at)=>{if(tile&&tile.kind!=='normal')fixed.add(at);});
 const reserved=new Set([...fixed,...level.obstacles.flatMap(o=>o.path??[])]);
 const canMove=new Set(level.obstacles.filter(o=>movableBankPiece(o)&&!fixed.has(o.anchor)).map(o=>o.id));
 if(!canMove.size)return level;
 const moved=new Map<string,Obstacle>();
 const vertical=new Map<number,number>(),straight=new Set<number>();
 for(const lane of board.gravity){
  if(lane.every((at,i)=>i===0||at===lane[i-1]!+width))for(const at of lane)straight.add(at);
  lane.forEach((at,i)=>{if(lane[i+1]!==undefined)vertical.set(at,lane[i+1]!);});
 }
 const horizontal=(at:number)=>[...(at%width>0?[at-1]:[]),...(at%width+1<width?[at+1]:[])];
 const adjacent=(at:number)=>[...horizontal(at),at-width,at+width];
 const exists=(at:number)=>cells[at]?.exists===true;
 const sources=board.gravity.map(lane=>lane[0]!).filter(at=>!covered.has(at));

 for(let pass=0;pass<level.obstacles.length;pass++){
  const supplied=suppliedGravityCells(board);
  const target=(at:number)=>exists(at)&&!cells[at]!.obstacleId&&!supplied.has(at);
  if(!cells.some((_,at)=>target(at)))break;
  // Shortest directed path. Crossing a blocker costs more than crossing an
  // entire board of open cells; tie breaks favor a short, unobstructed lane.
  const todo=new Map<number,number>(),previous=new Map<number,number>(),seen=new Set<number>();
  const enqueue=(at:number,from:number,cost:number)=>{
   if(!exists(at)||seen.has(at))return;
   const id=cells[at]!.obstacleId;
   if(id&&!canMove.has(id))return;
   const next=cost+1+(id?cells.length+1:0);
   if(next>=(todo.get(at)??Infinity))return;
   todo.set(at,next);previous.set(at,from);
  };
  for(const at of sources)enqueue(at,-1,0);
  let end:number|undefined;
  while(todo.size){
   const [at,cost]=[...todo].reduce((a,b)=>a[1]<=b[1]?a:b);
   todo.delete(at);seen.add(at);
   if(target(at)){end=at;break;}
   const below=vertical.get(at);
   if(below!==undefined)enqueue(below,at,cost);
   if(straight.has(at))for(const side of horizontal(at))if(straight.has(side))enqueue(side,at,cost);
  }
  if(end===undefined)break;
  const path:number[]=[];
  for(let at=end;at!==-1;at=previous.get(at)!)path.push(at);
  const blockers=path.flatMap(at=>{const id=cells[at]!.obstacleId;return id?[obstacles.get(id)!]:[];});
  if(!blockers.length)break;
  const component=new Set([end]);
  for(const at of component)for(const neighbor of adjacent(at))if(exists(neighbor))component.add(neighbor);
  const keep=new Set([...path,...reserved]);
  for(const o of blockers)delete cells[o.anchor]!.obstacleId;
  let reachable=suppliedGravityCells(board);
  const relocated:Obstacle[]=[];
  for(const o of blockers){
   const score=(at:number)=>2*Math.floor(at/width)+4*adjacent(at).filter(i=>cells[i]?.obstacleId).length-
     Math.abs(at%width-o.anchor%width)-Math.abs(Math.floor(at/width)-Math.floor(o.anchor/width));
   const candidates=[...component].filter(at=>!cells[at]!.obstacleId&&!keep.has(at)).sort((a,b)=>score(b)-score(a)||a-b);
   for(const at of candidates){
    cells[at]!.obstacleId=o.id;
    const next=suppliedGravityCells(board);
    if([...reachable].every(i=>i===at||next.has(i))){
     relocated.push({...o,anchor:at,footprint:[at]});reachable=next;break;
    }
    delete cells[at]!.obstacleId;
   }
  }
  if(relocated.length!==blockers.length||!reachable.has(end)){
   for(const o of relocated)delete cells[o.anchor]!.obstacleId;
   for(const o of blockers)cells[o.anchor]!.obstacleId=o.id;
   break;
  }
  for(const o of relocated){moved.set(o.id,o);obstacles.set(o.id,o);}
 }
 if(!moved.size)return level;
 const obstaclesAfter=level.obstacles.map(o=>moved.get(o.id)??o);
 const newlyBlocked=new Set([...moved.values()].map(o=>o.anchor));
 return {...level,obstacles:obstaclesAfter,version:level.version+':refill-corridors',
  ...(level.initial?{initial:level.initial.map((tile,at)=>newlyBlocked.has(at)?null:tile)}:{})};
}
