import {supportsCampaignDevices,supportsGardenWorkshop,supportsGreenhouse,type Color,type GameEvent,type GameState,type LevelDefinition} from '@garden/contracts';
import {CAMPAIGN_DEVICES,WORKSHOP_DEVICES,GREENHOUSE_DEVICES,campaignDeviceGateCells,type CampaignDevice} from '../../contracts/src/campaign-devices';
import {validWorkshopZones} from './workshop-devices';
import {advanceGreenhouse,initializeGreenhouseStep,openDeviceCrate,validGreenhouseZones} from './greenhouse-devices';

export interface DeviceMatch {cells:number[];color:Color;wave:number}
export const deviceGates=(level:Pick<LevelDefinition,'devices'>)=>new Set(level.devices?.flatMap(campaignDeviceGateCells));
export const isDeviceGate=(steps:CampaignDevice[]|undefined,at:number)=>steps?.some(step=>step.gate===at||step.kind==='keys'&&step.zones[1]!.includes(at))??false;

export function validateDevices(level:LevelDefinition):string[]{
 const goal=level.goals.find(g=>g.kind==='device'),steps=level.devices;
 if(!steps)return goal?['DEVICE_GOAL']:[];
 if(!supportsCampaignDevices(level.engineVersion)||level.gardenStage||steps.length<1||steps.length>2||
  !goal||goal.count!==steps.length)return ['DEVICE_GOAL'];
 const gates=deviceGates(level);
 if(gates.size!==steps.flatMap(campaignDeviceGateCells).length)return ['DEVICE_GATE'];
 for(const step of steps){
  const zoneCount=['branch','dual','relay','switchback','twin-plates','portal','dye','scale','mirror','keys'].includes(step.kind)?2:1;
  const kinds:readonly string[]=supportsGreenhouse(level.engineVersion)?[...CAMPAIGN_DEVICES,...WORKSHOP_DEVICES,...GREENHOUSE_DEVICES]:
   supportsGardenWorkshop(level.engineVersion)?[...CAMPAIGN_DEVICES,...WORKSHOP_DEVICES]:CAMPAIGN_DEVICES;
  if(!kinds.includes(step.kind)||!Number.isInteger(step.target)||step.target<1||step.target>12||
   step.zones.length!==zoneCount||step.zones.some(zone=>!zone.length||new Set(zone).size!==zone.length||
   zone.some(at=>!Number.isInteger(at)||!level.shape[at]))||
   (zoneCount===2&&step.zones[0]!.some(at=>step.zones[1]!.includes(at)))||!validWorkshopZones(level,step)||!validGreenhouseZones(level,step))return ['DEVICE_ZONE'];
  if(step.gate!==undefined&&!level.obstacles.some(o=>o.kind==='crate'&&o.footprint.length===1&&o.anchor===step.gate&&o.hp===1)){
   return ['DEVICE_GATE'];
  }
  if(step.kind==='conveyor'){
   const path=step.zones[0]!;
   if(path.length<4||path.some((at,index)=>{
    const to=path[(index+1)%path.length]!;
    return Math.abs(at%level.width-to%level.width)+Math.abs(Math.floor(at/level.width)-Math.floor(to/level.width))!==1||
     level.obstacles.some(o=>o.footprint.includes(at))||level.exits?.includes(at);
   }))return ['DEVICE_CONVEYOR'];
  }
 }
 return [];
}

export function advanceConveyor(state:GameState,events:GameEvent[]):boolean{
 const devices=state.devices,step=devices?.steps[devices.index];
 if(step?.kind!=='conveyor')return false;
 const path=step.zones[0]!,tiles=path.map(at=>state.cells[at]!.tile);
 if(tiles.some(tile=>tile?.kind==='seed'))return false;
 for(const [i,from] of path.entries()){
  const to=path[(i+1)%path.length]!,tile=tiles[i]!;
  state.cells[to]!.tile=tile;
  if(tile)events.push({type:'fall',cells:[to],from,to});
 }
 return true;
}

const intersects=(zone:number[],cells:number[])=>cells.some(cell=>zone.includes(cell));
const progressOn=(step:CampaignDevice,events:GameEvent[],type:GameEvent['type'])=>
 events.filter(event=>event.type===type&&intersects(step.zones[0]!,event.cells));

/** Only the current step observes a move. The next step starts after the gate has opened. */
export function advanceDevice(state:GameState,events:GameEvent[],matches:DeviceMatch[],rotated:boolean,usesMove=true):boolean{
 const devices=state.devices,step=devices?.steps[devices.index];
 if(!devices||!step)return false;
 const [first,second]=step.zones,match=(zone:number[])=>matches.filter(group=>intersects(zone,group.cells));
 const here=match(first!),there=second?match(second):[];
 const hit=here.length>0,other=there.length>0;
 switch(step.kind){
  case 'switch': devices.progress+=Number(hit);break;
  case 'branch':
   if(devices.branch===undefined){
    if(hit||other){devices.branch=hit?0:1;devices.progress++;}
   }else if(devices.branch===0?other:hit)devices.progress++;
   break;
  case 'conveyor': devices.progress+=Number(rotated&&here.some(group=>group.wave<0));break;
  case 'charge': {
   const colors=new Set(here.map(group=>group.color));
   if(colors.size>=2)devices.progress+=colors.size;
   break;
  }
  case 'switchback':
   if(devices.progress%2===0?hit:other)devices.progress++;
   break;
  case 'fuse': devices.progress+=progressOn(step,events,'special').filter(event=>event.kind?.includes('+')).length;break;
  case 'dual': devices.progress+=Number(here.some(left=>there.some(right=>left!==right)));break;
  case 'cascade': devices.progress+=here.filter(group=>group.wave!==0).length;break;
  case 'relay':
   if(devices.color===undefined&&hit)devices.color=here[0]!.color;
   else if(there.some(group=>group.color===devices.color)){devices.progress++;delete devices.color;}
   break;
  case 'fall': devices.progress+=new Set(progressOn(step,events,'fall').map(event=>event.to)).size;break;
  case 'rocket': devices.progress+=progressOn(step,events,'special').filter(event=>event.kind==='wind-row'||event.kind==='wind-column').length;break;
  case 'forge': devices.progress+=progressOn(step,events,'spawn').filter(event=>event.kind==='bomb').length;break;
  case 'pollinate': devices.progress+=progressOn(step,events,'special').filter(event=>event.kind==='glider'||event.kind==='beehive').length;break;
  case 'streak': devices.progress=hit?devices.progress+1:0;break;
  case 'twin-plates': devices.progress=devices.chargedPlates?.length??0;break;
  case 'portal': {
   const exit=events.find(event=>event.kind==='portal-transfer')?.to;
   devices.progress+=Number(exit!==undefined&&matches.some(group=>group.wave===0&&group.cells.includes(exit)));
   break;
  }
  case 'dye': devices.progress+=Number(events.some(event=>event.kind==='dye-stencil')&&there.some(group=>group.wave<0));break;
  case 'scale': {
   const [left,right]=devices.pans??[0,0];
   const directlyMatched=(zone:number[])=>new Set(matches.filter(group=>group.wave===0)
    .flatMap(group=>group.cells.filter(at=>zone.includes(at)))).size;
   const fill=(weight:number,zone:number[])=>{
    const next=weight+directlyMatched(zone);
    return next>step.target?0:next;
   };
   devices.pans=[fill(left,first!),fill(right,second!)];
   devices.progress=Math.min(...devices.pans);
   break;
  }
  case 'mirror': devices.progress+=Number(events.some(event=>event.kind==='mirror-pulse'));break;
  case 'updraft': {
   const arrivals=new Set(progressOn(step,events,'fall')
    .filter(event=>event.from!==undefined&&event.to!==undefined&&event.from>=event.to+state.width).map(event=>event.to));
   devices.progress+=arrivals.size;
   break;
  }
 }
 const opened=advanceGreenhouse(state,step,events,matches,usesMove);
 if(devices.progress<step.target)return opened;
 devices.index++;devices.progress=0;delete devices.branch;delete devices.color;
 delete devices.chargedPlates;delete devices.pans;delete devices.openedLocks;delete devices.pollenIds;delete devices.echoAt;
 const goal=state.goals.find(g=>g.kind==='device')!;
 goal.remaining=devices.steps.length-devices.index;
 initializeGreenhouseStep(state);
 return (step.gate!==undefined&&openDeviceCrate(state,step.gate,events))||opened;
}
