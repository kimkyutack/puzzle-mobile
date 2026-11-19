import {COLORS,ENDPOINT_PIPE_ENGINE_VERSION,type Goal,type LevelDefinition,type Obstacle,type ObstacleKind} from '@garden/contracts';
import {PROGRESSIVE_CONTENT_VERSION} from './progressive-plan';

/** Barriers are arrangements of independent one-cell pieces, never one large
 * picture with shared durability. Opening one cell cannot remove its neighbours. */
export function progressiveCandidate(band:number,challenge:string,variant:number,attempt=0):LevelDefinition{
 const width=9,height=band===1?8:9,n=width*height,at=(x:number,y:number)=>y*width+x;
 const hard=challenge==='hard'||challenge==='super',strength=challenge==='super'?2:hard?1:0;
 const colors=[...COLORS.slice(0,challenge==='intro'?4:5)],obstacles:Obstacle[]=[],shape=Array<boolean>(n).fill(true),frost:Record<number,number>={};
 const occupied=new Set<number>();
 const addCell=(kind:ObstacleKind,cell:number,hp=1)=>{
  if(occupied.has(cell))return;occupied.add(cell);
  obstacles.push({id:`progression-${kind}-${cell}`,kind,anchor:cell,footprint:[cell],hp,maxHp:hp});
 };
 const row=(y:number,left=0,right=8)=>Array.from({length:right-left+1},(_,i)=>at(left+i,y));
 const wall=(cells:number[],reinforced=false)=>{for(const cell of cells){const x=cell%width,y=Math.floor(cell/width),hp=reinforced&&(x+y+variant)%5===0?2:1;addCell('crate',cell,hp);}};
 if(band===1){
  wall(row(5),hard);for(const x of variant%2?[2,6]:[1,4,7])addCell('crate',at(x,7),strength===2?2:1);
 }else if(band===2){
  wall(row(3),hard);wall([at(2,4),at(2,5),at(3,5),at(4,5)]);
  for(const x of hard?[1,4,7]:[1,7])addCell('crate',at(x,8),hard?2:1);
 }else if(band===3||!hard){
  wall(row(3),hard);wall(row(6),hard);
  if(hard||band===4)wall([at(6,4),at(7,4),at(7,5)]);
  // A rectangular patch still contains four separately breakable cells.
  wall([at(1,7),at(2,7),at(1,8),at(2,8)],hard);
 }else{
  wall([3,4,5,6].flatMap(y=>[at(0,y),at(1,y)]),true);
  wall([6,7].flatMap(y=>row(y,5,8)),true);
  wall([...row(2,0,3),at(3,3),at(3,4),at(3,5),at(4,5),at(5,5)]);
  wall([at(6,3),at(7,3),at(6,4),at(7,4)],true);
  wall([0,1,2,3].map(x=>at(x,8)),true);
 }
 // Alternate some layouts with an end-sensitive rail. Every other profile
 // stays a cell-by-cell crate layout; the two strategies coexist.
 if(variant%2===1&&challenge!=='intro'){
  const path=band===1?row(5,3,5):band===2?row(3,2,6):band===3||!hard?[...row(3,1,5),at(5,4),at(5,5)]:[...row(2,0,3),at(3,3),at(3,4),at(3,5),at(4,5),at(5,5),at(5,6),at(5,7),at(6,7),at(7,7),at(8,7)];
  const cells=new Set(path);for(let i=obstacles.length-1;i>=0;i--)if(cells.has(obstacles[i]!.anchor)){occupied.delete(obstacles[i]!.anchor);obstacles.splice(i,1);}
  for(const cell of path)occupied.add(cell);
  obstacles.push({id:'progression-magnet-rail',kind:'pipe',endOnly:true,anchor:path[0]!,footprint:path,hp:path.length,maxHp:path.length});
 }
 // Existing single-cell locks and frost add tactics after the first simple wall.
 // They never share a cell with a crate, keeping the target readable.
 if(band>=3){for(const cell of [at(4,4),at(4,5),at(2,6),at(8,4)].slice(0,band===3?2:3))if(!occupied.has(cell))addCell('vine',cell);}
 const frostCount=band===1?0:band===2?4:band===3?6:hard?8:6;
 for(const cell of Array.from({length:n},(_,i)=>n-1-i)){
  if(Object.keys(frost).length>=frostCount)break;
  if(!occupied.has(cell)&&(cell%width+Math.floor(cell/width)+variant)%3===0)frost[cell]=1;
 }
 const goals:Goal[]=[...new Set(obstacles.map(o=>o.kind))].map(kind=>{const count=obstacles.filter(o=>o.kind===kind).length;return {kind,count,remaining:count};});
 if(frostCount){const count=Object.values(frost).reduce((sum,v)=>sum+v,0);goals.push({kind:'frost',count,remaining:count});}
 const gravity=Array.from({length:width},(_,x)=>Array.from({length:height},(_,y)=>at(x,y)));
 const level:LevelDefinition={id:701,version:PROGRESSIVE_CONTENT_VERSION,engineVersion:ENDPOINT_PIPE_ENGINE_VERSION,width,height,shape,colors,obstacles,goals,moves:80,seed:817_331+band*7919+variant*65537+attempt*104729,gravity,inlets:gravity.map(l=>l[0]!),...(frostCount?{frost}:{}),difficulty:challenge==='super'?'super':hard?'hard':'normal',approved:false,
  strategy:{id:`progression-cells-${band}`,name:band===1?'상자 너머 화단':band===2?'갈림길 화단':band===3?'정원 구역 잇기':'복합 정원 공략',hint:obstacles.some(o=>o.endOnly)?'상자는 한 칸씩 열고, 자석 레일은 양 끝을 맞춰 줄여요.':band===1?'상자 옆에서 타일을 맞춰 한 칸씩 길을 열어요.':'상자를 한 칸씩 깨고 덩굴과 서리를 걷어 정원을 넓혀요.'}};
 if(variant>=2){const mirror=(i:number)=>Math.floor(i/width)*width+width-1-i%width;level.obstacles=obstacles.map(o=>({...o,anchor:mirror(o.anchor),footprint:o.footprint.map(mirror)}));if(level.frost)level.frost=Object.fromEntries(Object.entries(level.frost).map(([cell,layers])=>[mirror(Number(cell)),layers]));level.gravity=gravity.map(l=>l.map(mirror));level.inlets=level.gravity.map(l=>l[0]!);}
 return level;
}
