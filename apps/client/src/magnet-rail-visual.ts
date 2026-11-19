import type {Obstacle} from '@garden/contracts';
type Point={x:number;y:number};
type End={tip:Point;out:Point};
const add=(a:Point,b:Point,k:number):Point=>({x:a.x+b.x*k,y:a.y+b.y*k});
const direction=(from:Point,to:Point):Point=>({x:Math.sign(to.x-from.x),y:Math.sign(to.y-from.y)});

/** One continuous centerline; the ends stay inset within the two outer cells. */
export function magnetRailPath(o:Obstacle,position:(at:number)=>Point,cell:number){
 const points=o.footprint.map(position),first=points[0],last=points.at(-1);
 if(!first||!last)return null;
 const front=points[1]?direction(points[1],first):{x:-1,y:0};
 const back=points.length>1?direction(points.at(-2)!,last):{x:1,y:0};
 const ends:[End,End]=[{tip:add(first,front,cell*.29),out:front},{tip:add(last,back,cell*.29),out:back}];
 const corners=points.slice(1,-1).flatMap((center,k)=>{
  const inDir=direction(center,points[k]!),outDir=direction(center,points[k+2]!);
  if(inDir.x+outDir.x===0&&inDir.y+outDir.y===0)return [];
  return [{center,enter:add(center,inDir,cell*.46),leave:add(center,outDir,cell*.46)}];
 });
 return {ends,corners};
}
