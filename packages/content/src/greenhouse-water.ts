export const WATER_WIDTH=5;
export const WATER_CELL_COUNT=WATER_WIDTH*WATER_WIDTH;
const directions=[1,2,4,8] as const;
export const rotatePipe=(mask:number,turns=1)=>Array.from({length:turns%4}).reduce<number>(value=>((value<<1)|(value>>3))&15,mask);
const routes=[
 [[10,11,12,7,2],[12,13,14],[12,17,18,23]],
 [[20,21,16,11,6,1],[16,17,18,13,8,3],[18,19,24]],
 [[0,5,6,7,12,13,14],[7,8,3,4],[12,17,22,21,20]],
 [[2,7,12,13,18,23],[12,11,6,5],[13,14,9,4]],
 [[15,16,11,12,7,8,3,4],[12,13,18,19,24],[11,6,5,0]],
] as const;

function direction(from:number,to:number){
 return to===from-WATER_WIDTH?1:to===from+1?2:to===from+WATER_WIDTH?4:8;
}

export interface WaterBoard {pipes:number[];source:number;targets:number[];moves:number}
export function waterBoard(stage:number,seed:number):WaterBoard{
 const layout=routes[(stage-1)%routes.length]!;
 const orient=(at:number)=>stage<=routes.length?at:(at%WATER_WIDTH)*WATER_WIDTH+(WATER_WIDTH-1-Math.floor(at/WATER_WIDTH));
 const solution=Array<number>(WATER_CELL_COUNT).fill(0);
 const source=orient(layout[0][0]),targets=layout.map(path=>orient(path.at(-1)!));
 for(const path of layout)for(let i=1;i<path.length;i++){
  const from=orient(path[i-1]!),to=orient(path[i]!);
  solution[from]=solution[from]!|direction(from,to);solution[to]=solution[to]!|direction(to,from);
 }
 let rng=seed||1,required=0;
 const next=()=>{rng=(Math.imul(rng,1664525)+1013904223)>>>0;return rng>>>14;};
 const pipes=solution.map((mask,at)=>{
  if(at===source||targets.includes(at))return mask;
  if(!mask)return [3,5,6,9,10,12,7,13][next()%8]!;
  const rotated=rotatePipe(mask,1+next()%(stage<=3?2:3));
  let turns=0;while(rotatePipe(rotated,turns)!==mask)turns++;
  required+=turns;return rotated;
 });
 const board={pipes,source,targets,moves:required+(stage<=3?5:3)};
 if(targets.every(target=>flowingPipes(board,pipes).has(target))){
  const first=orient(layout[0][1]);
  while(pipes[first]!&direction(first,source))pipes[first]=rotatePipe(pipes[first]!);
  board.moves+=3;
 }
 return board;
}

export function flowingPipes(board:Pick<WaterBoard,'source'>,pipes:number[]):Set<number>{
 const wet=new Set([board.source]),queue=[board.source];
 for(const at of queue){
  const next=[at-WATER_WIDTH,at%WATER_WIDTH<WATER_WIDTH-1?at+1:-1,at+WATER_WIDTH,at%WATER_WIDTH>0?at-1:-1];
  for(const [i,dir] of directions.entries()){
   const to=next[i]!;
   if(to<0||to>=WATER_CELL_COUNT||wet.has(to))continue;
   if((pipes[at]!&dir)&&(pipes[to]!&directions[(i+2)%4]!)){wet.add(to);queue.push(to);}
  }
 }
 return wet;
}

export function replayWater(board:WaterBoard,actions:readonly number[]){
 const pipes=[...board.pipes];let wet=flowingPipes(board,pipes);
 if(actions.length>board.moves||actions.some(at=>!Number.isInteger(at)||at<0||at>=WATER_CELL_COUNT||at===board.source||board.targets.includes(at)))return {status:'invalid' as const,pipes,wet};
 for(const [index,at]of actions.entries()){
  pipes[at]=rotatePipe(pipes[at]!);wet=flowingPipes(board,pipes);
  if(board.targets.every(target=>wet.has(target)))return {status:index+1===actions.length?'won' as const:'invalid' as const,pipes,wet};
 }
 return {status:actions.length===board.moves?'lost' as const:'playing' as const,pipes,wet};
}
