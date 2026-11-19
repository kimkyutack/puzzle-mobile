import type {GameEvent,GameState,LevelDefinition} from '@garden/contracts';
import type {CampaignDevice} from '../../contracts/src/campaign-devices';
import type {DeviceMatch} from './campaign-devices';
import {currentDevice} from './workshop-devices';

export function validGreenhouseZones(level:LevelDefinition,step:CampaignDevice):boolean{
 const [first,second]=step.zones;
 const clear=(at:number)=>!level.obstacles.some(o=>o.footprint.includes(at))&&!level.exits?.includes(at);
 switch(step.kind){
  case 'turntable': {
   const at=first![0]!,width=level.width;
   return first!.length===4&&at%width<width-1&&first![1]===at+1&&
    first![2]===at+width+1&&first![3]===at+width&&first!.every(clear);
  }
  case 'keys':
   return first!.length===step.target&&second!.length===step.target&&first!.every(clear)&&
    second!.every(at=>level.obstacles.some(o=>o.kind==='crate'&&o.anchor===at&&o.footprint.length===1&&o.hp===1));
  case 'pollen':return first!.length===step.target&&first!.every(at=>clear(at)&&(!level.initial||level.initial[at]?.kind==='normal'));
  case 'carrier':
  case 'echo':return first!.every(clear);
  case 'reflector':return first!.length===1&&first!.every(clear);
  default:return true;
 }
}

export function turntableCells(state:GameState):number[]|undefined{
 const step=currentDevice(state);
 if(step?.kind!=='turntable')return;
 const ring=step.zones[0]!;
 if(ring.every(at=>state.cells[at]!.tile&&!state.cells[at]!.obstacleId&&state.cells[at]!.tile?.kind!=='seed'))return ring;
}

export function rotateTurntable(state:GameState,ring:number[],events:GameEvent[]):void{
 const tiles=ring.map(at=>state.cells[at]!.tile);
 const routes=ring.map((from,index)=>{
  const to=ring[(index+1)%ring.length]!;
  state.cells[to]!.tile=tiles[index]!;
  return [from,to];
 });
 events.push({type:'mechanic',kind:'turntable-spin',cells:ring,routes});
}

export function initializeGreenhouseStep(state:GameState):void{
 const step=currentDevice(state);
 if(step?.kind==='pollen')state.devices!.pollenIds=step.zones[0]!.flatMap(at=>{
  const tile=state.cells[at]!.tile;
  return tile&&tile.kind!=='seed'?[tile.id]:[];
 });
}

export function openDeviceCrate(state:GameState,at:number,events:GameEvent[]):boolean{
 const cell=state.cells[at]!,id=cell.obstacleId;
 if(!id)return false;
 delete cell.obstacleId;
 delete state.obstacles[id];
 events.push({type:'hit',kind:'crate',cells:[at],obstacleId:id,obstacleAfter:null});
 return true;
}

export function advanceGreenhouse(state:GameState,step:CampaignDevice,events:GameEvent[],matches:DeviceMatch[],usesMove:boolean):boolean{
 const device=state.devices!,zone=step.zones[0]!;
 switch(step.kind){
  case 'turntable':
   if(events.some(event=>event.kind==='turntable-spin')&&matches.some(match=>match.wave===0&&match.cells.some(at=>zone.includes(at))))device.progress++;
   break;
  case 'keys': {
   const opened=device.openedLocks??[],cleared=new Set(events.filter(event=>event.type==='remove'||
    event.type==='spawn'&&event.kind!=='normal'&&event.kind!=='seed').flatMap(event=>event.cells));
   let changed=false;
   for(const [index,at] of zone.entries()){
    if(opened.includes(index)||!cleared.has(at))continue;
    opened.push(index);
    changed=openDeviceCrate(state,step.zones[1]![index]!,events)||changed;
   }
   if(opened.length)device.openedLocks=opened;
   device.progress=opened.length;
   return changed;
  }
  case 'pollen': {
   const active=new Set(state.cells.flatMap(({tile})=>tile?[tile.id]:[]));
   device.pollenIds=device.pollenIds?.filter(id=>active.has(id))??[];
   device.progress=step.target-device.pollenIds.length;
   break;
  }
  case 'carrier':device.progress+=events.filter(event=>event.kind==='carrier-launch').length;break;
  case 'echo':
   if(events.some(event=>event.kind==='echo-pulse'))device.progress++;
   else if(usesMove){
    const activation=events.find(event=>event.type==='special'&&event.kind!=='glider-flight'&&
     event.kind!=='bee-flight'&&event.cells.some(at=>zone.includes(at)));
    if(activation)device.echoAt=activation.cells.find(at=>zone.includes(at));
   }
   break;
  case 'reflector':device.progress+=events.filter(event=>event.kind==='rocket-reflect').length;break;
 }
 return false;
}

export function reflectedRocket(state:GameState,origin:number,row:boolean):{mirror:number;routes:number[][]}|undefined{
 const step=currentDevice(state);
 if(step?.kind!=='reflector')return;
 const mirror=step.zones[0]![0]!,width=state.width;
 if(origin===mirror||(row?Math.floor(origin/width)!==Math.floor(mirror/width):origin%width!==mirror%width))return;
 const routes=[-1,1].map(direction=>{
  let dx=row?direction:0,dy=row?0:direction,x=origin%width,y=Math.floor(origin/width);
  const cells=[origin];
  while(true){
   x+=dx;
   y+=dy;
   if(x<0||x>=width||y<0||y>=state.height)break;
   const at=y*width+x;
   if(state.cells[at]!.exists)cells.push(at);
   if(at===mirror)[dx,dy]=[-dy,-dx];
  }
  return cells;
 });
 return {mirror,routes};
}
