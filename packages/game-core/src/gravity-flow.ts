import {supportsCutoutRefill,supportsSeedDelivery,type GameState,type LevelDefinition} from '@garden/contracts';
import {seedExitLanes} from './seed-delivery';

const straight=(lane:number[],step:number)=>lane.every((at,index)=>index===0||at===lane[index-1]!+step);
type GravityBoard=Pick<GameState,'cells'|'width'|'height'|'gravity'|'engineVersion'|'gardenStage'|'siege'>;

export function gravityLanes(level:Pick<LevelDefinition,'gravity'|'width'|'height'|'shape'>):number[][]{
 if(level.gravity)return level.gravity.map(lane=>[...lane]);
 const lanes:number[][]=[];
 for(let x=0;x<level.width;x++){
  let lane:number[]=[];
  for(let y=0;y<level.height;y++){
   const at=y*level.width+x;
   if(level.shape[at])lane.push(at);
   else if(lane.length){lanes.push(lane);lane=[];}
  }
  if(lane.length)lanes.push(lane);
 }
 return lanes;
}

/** In a split column, only the segment exposed to the edge can create tiles. */
export function coveredGravityInlets(s:GravityBoard,direction:1|-1):Set<number>{
 const covered=new Set<number>(),step=s.width*direction;
 if(!supportsCutoutRefill(s.engineVersion)||s.cells.every(cell=>cell.exists))return covered;
 const candidates:Array<[number,number]>=[];
 for(const lane of s.gravity){
  if(!straight(lane,step))continue;
  const head=lane[0]!;
  const before=head-step;
  if(before<0||before>=s.cells.length||s.cells[before]?.exists)continue;
  for(let at=before-step;at>=0&&at<s.cells.length;at-=step){
   if(s.cells[at]!.exists){candidates.push([head,at]);break;}
  }
 }
 if(!candidates.length)return covered;
 // A fully separated island still needs its own supply edge.
 const region=new Uint8Array(s.cells.length);
 let id=0;
 for(const [start,cell] of s.cells.entries()){
  if(!cell.exists||region[start])continue;
  const queue=[start];
  region[start]=++id;
  for(let index=0;index<queue.length;index++){
   const at=queue[index]!,column=at%s.width;
   const neighbors=[at-s.width,at+s.width];
   if(column>0)neighbors.push(at-1);
   if(column+1<s.width)neighbors.push(at+1);
   for(const next of neighbors)if(s.cells[next]?.exists&&!region[next]){
    region[next]=id;queue.push(next);
   }
  }
 }
 for(const [head,above] of candidates)if(region[head]===region[above])covered.add(head);
 return covered;
}
function flowRoutes(s:GravityBoard,direction:1|-1,covered:ReadonlySet<number>){
 const vertical=s.width*direction;
 const eligible=new Set<number>();
 for(const lane of s.gravity)if(straight(lane,vertical))for(const at of lane)eligible.add(at);
 const open=new Set([...(s.gardenStage?.connected??[]),...(s.siege?.bank??[])]);
 const passable=(at:number)=>eligible.has(at)&&!!s.cells[at]?.exists&&!s.cells[at]!.obstacleId&&!open.has(at);
 const diagonal=(from:number,to:number)=>passable(from)&&passable(to)&&(passable(from+vertical)||passable(to-vertical));
 // All cells in an uninterrupted inlet segment already have direct supply.
 // A shortest-route gradient lets a tile slide the last step beneath a wide
 // roof without oscillating sideways or spawning through the locked roof.
 const distance=new Map<number,number>(),queue:number[]=[],direct=new Set<number>();
 for(const lane of s.gravity){if(covered.has(lane[0]!))continue;for(const at of lane){if(s.cells[at]!.obstacleId||s.siege?.bank.includes(at))break;if(open.has(at))continue;direct.add(at);if(passable(at)){distance.set(at,0);queue.push(at);}}}
 for(let cursor=0;cursor<queue.length;cursor++){
  const from=queue[cursor]!,x=from%s.width,targets=[...(x>0?[from-1]:[]),...(x+1<s.width?[from+1]:[]),from+vertical,...(x>0?[from+vertical-1]:[]),...(x+1<s.width?[from+vertical+1]:[])];
  for(const to of targets){if(!passable(to)||distance.has(to))continue;const dx=Math.abs(to%s.width-x),dy=Math.floor(to/s.width)-Math.floor(from/s.width);if(dx&&dy&&!diagonal(from,to))continue;distance.set(to,distance.get(from)!+1);queue.push(to);}
 }
 return {passable,diagonal,distance,direct};
}

export function suppliedGravityCells(s:GravityBoard):Set<number>{
 const {distance,direct}=flowRoutes(s,1,coveredGravityInlets(s,1));
 return new Set([...direct,...distance.keys()]);
}

/** Flow only adds routes between ordinary vertical lanes. Authored bent/portal
 * lanes keep their explicit topology, and fixed obstacles never become sources. */
export function gravityFlow(s:GameState,direction:1|-1=1,covered=coveredGravityInlets(s,direction)){
 const vertical=s.width*direction;
 const {passable,diagonal,distance}=flowRoutes(s,direction,covered);
 const seedRoutes=new Set(supportsSeedDelivery(s.engineVersion)?seedExitLanes(s).flat():[]);
 const canFeed=(from:number,to:number)=>{
  const tile=s.cells[from]!.tile;
  return !!tile&&(tile.kind!=='seed'||!seedRoutes.has(from)||seedRoutes.has(to));
 };
 return {next():{from:number;to:number}|null{
  for(let row=0;row<s.height;row++)for(let x=0;x<s.width;x++){
   const y=direction===1?s.height-1-row:row;
   const to=y*s.width+x;if(!passable(to)||s.cells[to]!.tile||!distance.has(to))continue;
   const order=(x+y+s.turn)%2?[1,-1]:[-1,1];
   if(y-direction>=0&&y-direction<s.height)for(const dx of order){const from=to-vertical+dx;if(x+dx>=0&&x+dx<s.width&&diagonal(from,to)&&distance.has(from)&&canFeed(from,to))return {from,to};}
   for(const dx of order){const from=to+dx;if(x+dx>=0&&x+dx<s.width&&passable(from)&&canFeed(from,to)&&distance.has(from)&&distance.get(from)!<distance.get(to)!)return {from,to};}
  }
  return null;
 }};
}
