import type {GameEvent,GameState,LevelDefinition} from '@garden/contracts';
import type {CampaignDevice} from '../../contracts/src/campaign-devices';
import type {DeviceMatch} from './campaign-devices';

export const currentDevice=(state:GameState)=>state.devices?.steps[state.devices.index];

function distance(a:number,b:number,width:number){
 return Math.abs(a%width-b%width)+Math.abs(Math.floor(a/width)-Math.floor(b/width));
}

export function validWorkshopZones(level:LevelDefinition,step:CampaignDevice):boolean{
 const [first,second]=step.zones;
 const occupied=new Set(level.obstacles.flatMap(obstacle=>obstacle.footprint));
 switch(step.kind){
  case 'twin-plates':
   return first!.length===second!.length&&first!.length===step.target&&
    [...first!,...second!].every(at=>!occupied.has(at));
  case 'portal':
   return first!.length===1&&second!.length===1&&distance(first![0]!,second![0]!,level.width)>2&&
    [...first!,...second!].every(at=>!occupied.has(at)&&!level.exits?.includes(at));
  case 'dye':
   return second!.length===3&&second!.every(at=>!occupied.has(at))&&
    (second!.every(at=>Math.floor(at/level.width)===Math.floor(second![0]!/level.width))&&second![2]===second![0]!+2&&second![1]===second![0]!+1||
     second![2]===second![0]!+2*level.width&&second![1]===second![0]!+level.width);
  case 'mirror':
   return first!.length===second!.length&&first!.every((at,i)=>
    second![i]===Math.floor(at/level.width)*level.width+level.width-1-at%level.width);
  case 'scale':
   return first!.length>=3&&second!.length>=3;
  case 'updraft':
   return !level.gravity&&!level.exits?.length&&first!.every(at=>at<level.width&&!occupied.has(at));
  default:return true;
 }
}

/** Both a real swap and its legality preview use the same normal-tile portal. */
export function portalTransfer(state:GameState,from:number,to:number):[number,number]|undefined{
 const step=currentDevice(state);
 if(step?.kind!=='portal')return;
 const [left,right]=step.zones.map(zone=>zone[0]!);
 const entry=[from,to].find(at=>at===left||at===right);
 if(entry===undefined)return;
 const exit=entry===left?right!:left!;
 const destination=state.cells[exit]!;
 if(destination.tile?.kind==='normal'&&!destination.obstacleId)return [entry,exit];
}

export function pairedPlates(state:GameState,from:number,to:number):number[]{
 const step=currentDevice(state);
 if(step?.kind!=='twin-plates')return [];
 const [left,right]=step.zones;
 return left!.flatMap((a,index)=>{
  const b=right![index]!;
  if(state.devices?.chargedPlates?.includes(index)||![a,b].some(at=>at===from||at===to))return [];
  const first=state.cells[a]!.tile,second=state.cells[b]!.tile;
  return first?.kind==='normal'&&second?.kind==='normal'&&first.color===second.color?[index]:[];
 });
}

export function paintTiles(state:GameState,matches:DeviceMatch[],events:GameEvent[]):boolean{
 const step=currentDevice(state);
 if(step?.kind!=='dye')return false;
 const [palette,stencil]=step.zones;
 const color=matches.find(match=>match.wave===0&&match.cells.some(at=>palette!.includes(at)))?.color;
 if(!color)return false;
 const painted=stencil!.filter(at=>{
  const cell=state.cells[at]!;
  if(cell.tile?.kind!=='normal'||cell.obstacleId||cell.tile.color===color)return false;
  cell.tile.color=color;
  return true;
 });
 if(!painted.length)return false;
 events.push({type:'mechanic',kind:'dye-stencil',cells:painted});
 return true;
}

export function mirrorTargets(state:GameState,matches:DeviceMatch[]):number[]{
 const step=currentDevice(state);
 if(step?.kind!=='mirror')return [];
 const [left,right]=step.zones;
 const cleared=new Set(matches.filter(match=>match.wave===0).flatMap(match=>match.cells));
 const targets=new Set<number>();
 for(const [i,at] of left!.entries()){
  const opposite=right![i]!;
  if(cleared.has(at))targets.add(opposite);
  if(cleared.has(opposite))targets.add(at);
 }
 return [...targets].filter(at=>state.cells[at]!.obstacleId||
  state.cells[at]!.tile&&state.cells[at]!.tile?.kind!=='seed');
}
