import {COLORS,supportsObstacleGarden,type LevelDefinition,type Obstacle,type Tile} from '@garden/contracts';
import {campaignPosition} from './campaign';

export const SPLIT_WIND_VERSION='garden-2026.11.16-split-wind-v1';
export const SPLIT_WIND_NAME='하늘 바람길';
export const SPLIT_WIND_HINT='아래의 씨앗 주머니를 깨서 위쪽 풍차를 타격해요. 씨앗비행기를 날려 위쪽 상자와 항아리도 깨 보세요.';
const firstLevel=357,interval=200,width=9,height=9,gapRow=4;
const layouts=[
 {windmill:11,pods:[72,73,76,79,80],gliders:[49,50],urns:[1,7,18,26],seed:613081,moves:32},
 {windmill:5,pods:[63,71,74,76,78,80],gliders:[47,56],urns:[9,17,19,22,27,35],seed:637613,moves:36},
 {windmill:24,pods:[64,70,72,74,78,80],gliders:[51,60],urns:[1,3,7,19,23,28,34],seed:669719,moves:34},
] as const;

export function splitWindLevel(source:LevelDefinition):LevelDefinition{
 const offset=source.id-firstLevel;
 if(!supportsObstacleGarden(source.engineVersion)||!source.approved||source.tutorial||source.gardenStage||
  offset<0||offset%interval!==0||source.id>20_000)return source;
 const variant=(offset/interval)%layouts.length;
 const {windmill,pods,gliders,urns,seed,moves}=layouts[variant]!;
 const colors=[...COLORS.slice(0,5)],obstacles:Obstacle[]=[];
 const urnCells=new Set<number>(urns),gliderCells=new Set<number>(gliders);
 const shape=Array.from({length:width*height},(_,at)=>Math.floor(at/width)!==gapRow);
 const add=(kind:Obstacle['kind'],footprint:number[],hp:number,link?:string)=>{
  const anchor=footprint[0]!,id=`split-${anchor}`;
  obstacles.push({id,kind,footprint,anchor,hp,maxHp:hp,...(link?{link}:{})});
  return id;
 };
 const rotor=[windmill,windmill+1,windmill+width,windmill+width+1];
 const link=add('windmill',rotor,pods.length);
 for(const at of pods)add('wind-pod',[at],1,link);
 for(let at=0;at<gapRow*width;at++){
  if(rotor.includes(at))continue;
  const urn=urnCells.has(at);
  add(urn?'urn':'crate',[at],urn&&variant>0?2:1);
 }
 const counts=(kind:Obstacle['kind'])=>obstacles.filter(o=>o.kind===kind).length;
 const goals=(['windmill','crate','urn'] as const).map(kind=>({kind,count:counts(kind),remaining:counts(kind)}));
 const blocked=new Set(obstacles.flatMap(o=>o.footprint));
 const initial=shape.map((exists,at):Tile|null=>{
  if(!exists||blocked.has(at))return null;
  if(gliderCells.has(at))return {id:at+1,kind:'glider'};
  return {id:at+1,kind:'normal',color:colors[(at%width+2*Math.floor(at/width)+variant)%colors.length]!};
 });
 return {id:source.id,approved:true,version:SPLIT_WIND_VERSION,engineVersion:source.engineVersion,difficulty:'normal',
  width,height,shape,colors,moves:Math.max(moves,source.moves),seed,initial,goals,obstacles,
  campaign:{...campaignPosition(source.id),beat:'normal'},
  strategy:{id:`split-wind/${variant}`,name:SPLIT_WIND_NAME,hint:SPLIT_WIND_HINT}};
}
