import type {GameState} from '@garden/contracts';

/** The playable outline adjacent to the outside. Enclosed interior holes are not outer edges. */
export function perimeterCells(state:Pick<GameState,'width'|'height'|'cells'>):number[]{
 const {width,height,cells}=state,stride=width+2,rows=height+2,outside=new Set<number>([0]),queue=[0];
 for(let cursor=0;cursor<queue.length;cursor++){
  const at=queue[cursor]!,x=at%stride,y=Math.floor(at/stride);
  for(const [nx,ny] of [[x-1,y],[x+1,y],[x,y-1],[x,y+1]] as Array<[number,number]>){
   if(nx<0||ny<0||nx>=stride||ny>=rows)continue;
   const next=ny*stride+nx;
   if(outside.has(next)||nx>0&&nx<=width&&ny>0&&ny<=height&&cells[(ny-1)*width+nx-1]?.exists)continue;
   outside.add(next);queue.push(next);
  }
 }
 return cells.flatMap((cell,index)=>{
  if(!cell.exists)return [];
  const x=index%width+1,y=Math.floor(index/width)+1;
  return [y*stride+x-1,y*stride+x+1,(y-1)*stride+x,(y+1)*stride+x].some(at=>outside.has(at))?[index]:[];
 });
}
