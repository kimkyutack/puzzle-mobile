import {supportsDenseGardenPuzzles,supportsGardenPuzzles,type GameEvent,type GameState,type LevelDefinition,type Obstacle} from '@garden/contracts';
import {GARDEN_PUZZLE_KINDS,isGardenPuzzleObstacle,type GardenDirection,type GardenPuzzleObstacle,type WireLayers} from '../../contracts/src/garden-puzzles';

const kinds={
 'domino-slat':'domino','harvest-cart':'cart','soil-clod':'soil','soil-chip':'soil',
 'garden-light':'shadow','shadow-bud':'shadow','wire-planter':'wire','fence-thicket':'fence',
} as const;
const offsets:Record<GardenDirection,readonly [number,number]>={up:[0,-1],right:[1,0],down:[0,1],left:[-1,0]};
export function stepCell(at:number,direction:GardenDirection,width:number,length:number):number|undefined{
 const [dx,dy]=offsets[direction],x=at%width+dx,y=Math.floor(at/width)+dy;
 return x>=0&&x<width&&y>=0&&y*width+x<length?y*width+x:undefined;
}
const directions=Object.keys(offsets) as GardenDirection[];
const obstacleAt=(s:GameState,at:number)=>s.obstacles[s.cells[at]?.obstacleId??''];
const axisDirections=(vertical:boolean):readonly GardenDirection[]=>vertical?['up','down']:['left','right'];

export function validateGardenPuzzle(level:LevelDefinition):string[]{
 const puzzle=level.gardenPuzzle;
 const obstacles=level.obstacles.filter(o=>isGardenPuzzleObstacle(o.kind)||o.direction!==undefined||o.wire!==undefined);
 if(!puzzle&&!obstacles.length)return [];
 if(!puzzle||!supportsGardenPuzzles(level.engineVersion)||level.gardenStage||level.devices||!GARDEN_PUZZLE_KINDS.includes(puzzle.kind))return ['GARDEN_PUZZLE_ENGINE'];
 if(!obstacles.length||obstacles.some(o=>kinds[o.kind as GardenPuzzleObstacle]!==puzzle.kind))return ['GARDEN_PUZZLE_OBSTACLES'];
 const occupied=new Set(level.obstacles.flatMap(o=>o.footprint));
 if((puzzle.kind==='cart'||puzzle.kind==='fence')!==!!puzzle.cells?.length||
  puzzle.cells&&(new Set(puzzle.cells).size!==puzzle.cells.length||puzzle.cells.some(at=>!level.shape[at]||occupied.has(at))))return ['GARDEN_PUZZLE_CELLS'];
 for(const o of obstacles){
  const directional=o.kind==='domino-slat'||o.kind==='garden-light';
  if(directional?!(o.direction&&directions.includes(o.direction)):o.direction!==undefined)return ['GARDEN_PUZZLE_DIRECTION'];
  if(o.kind==='wire-planter'?o.wire!==3||o.hp!==3||o.maxHp!==3:o.wire!==undefined||o.hp!==1||o.maxHp!==1)return ['GARDEN_PUZZLE_LAYERS'];
  if(o.kind==='soil-clod'&&!supportsDenseGardenPuzzles(level.engineVersion)&&!directions.every(dir=>{const at=stepCell(o.anchor,dir,level.width,level.shape.length);return at!==undefined&&level.shape[at]&&!occupied.has(at)&&!level.exits?.includes(at);}))return ['GARDEN_PUZZLE_SPLIT'];
 }
 if(puzzle.kind==='cart'&&puzzle.cells!.length!==obstacles.length)return ['GARDEN_PUZZLE_DOCKS'];
 if(puzzle.kind==='shadow'&&!obstacles.some(o=>o.kind==='garden-light'))return ['GARDEN_PUZZLE_LIGHT'];
 if(puzzle.kind==='fence'){
  const outside=outsideFence(level.shape,level.width,new Set(puzzle.cells));
  if(obstacles.some(o=>outside.has(o.anchor)))return ['GARDEN_PUZZLE_FENCE'];
 }
 return [];
}

export function harvestCartPushPath(s:GameState,from:number,to:number):number[]|undefined{
 if(s.gardenPuzzle?.kind!=='cart'||obstacleAt(s,from)?.kind!=='harvest-cart')return;
 const direction=directions.find(dir=>stepCell(from,dir,s.width,s.cells.length)===to);
 if(!direction)return;
 const dense=supportsDenseGardenPuzzles(s.engineVersion),path=[from];
 for(let at:number|undefined=to;at!==undefined;at=stepCell(at,direction,s.width,s.cells.length)){
  const cell=s.cells[at];
  if(!cell?.exists)return;
  path.push(at);
  if(!cell.obstacleId){
   if(!cell.tile||cell.tile.kind==='normal'||dense&&cell.tile.kind!=='seed')return path;
   return;
  }
  if(!dense||obstacleAt(s,at)?.kind!=='harvest-cart')return;
 }
}

export function canPushHarvestCart(s:GameState,from:number,to:number):boolean{
 return !!harvestCartPushPath(s,from,to);
}

function removePuzzleObstacle(s:GameState,o:Obstacle,effectId:number|undefined,events:GameEvent[]):void{
 delete s.cells[o.anchor]!.obstacleId;
 delete s.obstacles[o.id];
 const goal=s.goals.find(entry=>entry.kind===o.kind);
 if(goal)goal.remaining=Math.max(0,goal.remaining-1);
 events.push({type:'hit',kind:o.kind,cells:[o.anchor],effectId,obstacleId:o.id,obstacleAfter:null});
}

export function pushHarvestCart(s:GameState,from:number,to:number,events:GameEvent[]):void{
 const path=harvestCartPushPath(s,from,to)!,exit=path.at(-1)!;
 const tile=s.cells[exit]!.tile,carts=path.slice(0,-1).map(at=>obstacleAt(s,at)!);
 delete s.cells[from]!.obstacleId;s.cells[from]!.tile=tile;
 for(const [index,cart] of carts.entries()){
  const source=path[index]!,dest=path[index+1]!;
  s.cells[dest]!.tile=null;s.cells[dest]!.obstacleId=cart.id;
  cart.anchor=dest;cart.footprint=[dest];
  events.push({type:'mechanic',kind:'cart-push',cells:[source,dest],from:source,to:dest,obstacleId:cart.id,obstacleAfter:{...cart}});
 }
 if(tile)events.push({type:'fall',cells:[from],from:exit,to:from});
 const puzzle=s.gardenPuzzle!,docks=new Set(puzzle.cells);
 for(const cart of carts)if(docks.delete(cart.anchor))removePuzzleObstacle(s,cart,undefined,events);
 puzzle.cells=[...docks];
}

export function lightRay(s:GameState):number[]{
 const lightAt=s.gardenPuzzle?.lightAt;
 if(lightAt===undefined)return [];
 const light=obstacleAt(s,lightAt),ray:number[]=[];
 if(!light?.direction)return ray;
 let at=lightAt;
 while(true){
  const next=stepCell(at,light.direction,s.width,s.cells.length);
  if(next===undefined||!s.cells[next]?.exists)break;
  const o=obstacleAt(s,next);
  if(o&&o.kind!=='shadow-bud')break;
  ray.push(next);at=next;
 }
 return ray;
}

function rocketAxis(kind:string):WireLayers{
 if(['wind+wind','wind+bomb','cross-firework'].includes(kind))return 3;
 if(kind==='wind-row'||kind==='sweep-row')return 1;
 if(kind==='wind-column'||kind==='sweep-column')return 2;
 return 0;
}

function splitCells(s:GameState,anchor:number,kind:string,reserved?:ReadonlySet<number>):number[]{
 const preferred=rocketAxis(kind)===2;
 const targets=(vertical:boolean)=>axisDirections(vertical).map(dir=>stepCell(anchor,dir,s.width,s.cells.length));
 const valid=(at:number|undefined):at is number=>at!==undefined&&!!s.cells[at]?.exists&&!s.cells[at]!.obstacleId&&s.cells[at]!.tile?.kind!=='seed'&&!reserved?.has(at);
 const chosen=targets(preferred);
 if(chosen.every(valid))return chosen;
 if(rocketAxis(kind)===0){const other=targets(!preferred);if(other.every(valid))return other;}
 if(supportsDenseGardenPuzzles(s.engineVersion)){
  const open=chosen.filter(valid);
  return open.length?[open[0]!,anchor]:[anchor,anchor];
 }
 return [];
}

export function canHitPuzzleObstacle(s:GameState,o:Obstacle,kind:string,lit?:ReadonlySet<number>):boolean{
 switch(o.kind){
  case 'harvest-cart':
  case 'fence-thicket':return false;
  case 'garden-light':return kind!=='match'&&o.anchor!==s.gardenPuzzle?.lightAt;
  case 'domino-slat':return kind!=='match';
  case 'soil-clod':return kind!=='match'&&splitCells(s,o.anchor,kind).length===2;
  case 'shadow-bud':return lit?.has(o.anchor)??lightRay(s).includes(o.anchor);
  case 'wire-planter':return !o.wire||kind!=='match'&&(!rocketAxis(kind)||!!(o.wire&rocketAxis(kind)));
  default:return true;
 }
}

export interface PuzzleImpact {
 lit?:ReadonlySet<number>;
 lamp?:number;
 soil?:{source:Obstacle;cells:number[]}[];
}

/** Returns the damage an effect should apply after resolving device-specific rules. */
export function puzzleDamage(s:GameState,o:Obstacle,kind:string,impact:PuzzleImpact):number{
 if(!canHitPuzzleObstacle(s,o,kind,impact.lit))return 0;
 if(o.kind==='garden-light'){
  impact.lamp??=o.anchor;
  return 0;
 }
 if(o.kind==='soil-clod'){
  const reserved=supportsDenseGardenPuzzles(s.engineVersion)&&impact.soil?new Set(impact.soil.flatMap(split=>split.cells)):undefined;
  const cells=splitCells(s,o.anchor,kind,reserved);
  if(impact.soil?.some(split=>split.cells.some(at=>cells.includes(at))))return 0;
  (impact.soil??=[]).push({source:o,cells});
 }
 if(o.kind==='wire-planter'&&o.wire){
  const previous=o.wire,axis=rocketAxis(kind)||(previous&1?1:2);
  o.wire=(previous&~axis) as WireLayers;
  return previous===3&&o.wire===0?2:1;
 }
 return 1;
}

export function dominoTarget(s:GameState,o:Obstacle):number|undefined{
 if(o.kind!=='domino-slat'||!o.direction)return;
 const at=stepCell(o.anchor,o.direction,s.width,s.cells.length);
 return at!==undefined&&obstacleAt(s,at)?.kind==='domino-slat'?at:undefined;
}

export function finishPuzzleImpact(s:GameState,impact:PuzzleImpact,cells:number[],effectId:number,events:GameEvent[]):void{
 if(impact.lamp!==undefined&&s.gardenPuzzle!.lightAt!==impact.lamp){
  s.gardenPuzzle!.lightAt=impact.lamp;
  events.push({type:'mechanic',kind:'garden-light-on',from:impact.lamp,cells:lightRay(s),effectId});
 }
 for(const {source,cells:landings} of impact.soil??[]){
  const positions=[...new Set(landings)];
  events.push({type:'mechanic',kind:'soil-split',cells:positions,from:source.anchor,effectId});
  for(const [index,at] of positions.entries()){
   // Keep an existing tile under the chip. Clearing it makes the tile playable again.
   const id=`${source.id}-chip-${index}`;
   const hp=landings.filter(cell=>cell===at).length;
   const chip:Obstacle={id,kind:'soil-chip',anchor:at,footprint:[at],hp,maxHp:hp};
   s.cells[at]!.obstacleId=id;
   s.obstacles[id]=chip;
   events.push({type:'hit',kind:'soil-chip-arrival',cells:[at],effectId,obstacleId:id,obstacleAfter:chip});
  }
 }
 if(s.gardenPuzzle?.kind==='fence')buildFence(s,cells,effectId,events);
}

/** A gap or an exterior edge is outside. Orthogonal passages remain open until the final post is placed. */
function outsideFence(shape:readonly boolean[],width:number,posts:ReadonlySet<number>):Set<number>{
 const outside=new Set<number>(),queue:number[]=[];
 const add=(at:number)=>{if(shape[at]&&!posts.has(at)&&!outside.has(at)){outside.add(at);queue.push(at);}};
 for(const [at,exists] of shape.entries())if(exists&&directions.some(dir=>{
  const next=stepCell(at,dir,width,shape.length);
  return next===undefined||!shape[next];
 }))add(at);
 for(let i=0;i<queue.length;i++)for(const dir of directions){
  const next=stepCell(queue[i]!,dir,width,shape.length);
  if(next!==undefined)add(next);
 }
 return outside;
}

function buildFence(s:GameState,cells:number[],effectId:number,events:GameEvent[]):void{
 const puzzle=s.gardenPuzzle!,posts=new Set(puzzle.posts),updated=puzzle.cells!.filter(at=>cells.includes(at)&&!posts.has(at));
 if(!updated.length)return;
 for(const at of updated)posts.add(at);
 puzzle.posts=[...posts].sort((a,b)=>a-b);
 events.push({type:'mechanic',kind:'fence-build',cells:updated,effectId});
 const outside=outsideFence(s.cells.map(c=>c.exists),s.width,posts);
 const enclosed=Object.values(s.obstacles).filter(o=>o.kind==='fence-thicket'&&!outside.has(o.anchor));
 if(enclosed.length)events.push({type:'mechanic',kind:'fence-close',cells:enclosed.map(o=>o.anchor),effectId});
 for(const o of enclosed)removePuzzleObstacle(s,o,effectId,events);
}
