import {COLORS,supportsGliderSwarm,type Goal,type LevelDefinition,type Obstacle} from '@garden/contracts';
import {type CampaignDevice,type CampaignDeviceKind,CAMPAIGN_DEVICES} from '../../contracts/src/campaign-devices';
import {LONG_CAMPAIGN_VERSION,LONG_CAMPAIGN_STYLES,longCampaignChapter,type LongCampaignStyle} from './long-campaign-plan';
import {greenhouseCopy} from './garden-greenhouse';
import {workshopCopy} from './garden-workshop';

type Copy=readonly [name:string,how:string];
export const deviceCopy:Record<CampaignDeviceKind,Copy>={
 ...workshopCopy,
 ...greenhouseCopy,
 switch:['연결 스위치','표시된 구역에서 매치를 만들어 문을 열어요.'],
 branch:['분기 밸브','어느 구역이든 먼저 맞춘 뒤 반대편 구역에서 맞춰요.'],
 conveyor:['컨베이어','매 수 화살표 방향으로 타일이 한 칸 이동해요. 이동으로 이어질 매치를 노려요.'],
 charge:['색상 충전기','표시된 구역에서 한 수에 두 가지 이상 색을 맞춰야 충전돼요.'],
 switchback:['교대 스위치','두 구역을 번갈아 맞춰요. 밝은 쪽이 이번 순서예요.'],
 fuse:['합성 회로','표시된 구역에서 특수 타일 두 개를 서로 바꿔요.'],
 dual:['동시 스위치','한 수 안에 양쪽 구역에서 각각 매치를 만들어요.'],
 cascade:['연쇄 감지기','타일이 내려온 뒤 이어지는 매치로 구역을 맞춰요.'],
 relay:['색상 릴레이','첫 구역에서 맞춘 색을 기억해 반대편에서 같은 색을 맞춰요.'],
 fall:['낙하 감지기','표시된 구역으로 타일이 떨어지도록 아래를 비워요.'],
 rocket:['로켓 발사대','표시된 구역에서 가로나 세로 로켓을 발동해요.'],
 forge:['꽃폭탄 공방','표시된 구역 안에 ㄱ자나 T자 매치로 꽃폭탄을 만들어요.'],
 pollinate:['공중 정원','표시된 구역에서 씨앗 글라이더나 꿀벌집을 발동해요.'],
 streak:['연속 스위치','표시된 구역을 여러 수 연달아 맞춰요. 한 수 놓치면 다시 시작해요.'],
};
export const LONG_MAGNET_VERSION=LONG_CAMPAIGN_VERSION+':magnet-rails-v1';
type OriginalDeviceKind=(typeof CAMPAIGN_DEVICES)[number];
const targets:Record<OriginalDeviceKind,number>={
 switch:3,branch:2,conveyor:2,charge:4,switchback:3,fuse:1,dual:1,cascade:2,
 relay:1,fall:9,rocket:1,forge:1,pollinate:1,streak:2,
};

function parseBoardKey(key:string){
 const [mode,subject,style,pressure]=key.split('/');
 if(mode==='pair'){
  const chapter=longCampaignChapter(Number(subject))!;
  return {steps:[chapter.first,chapter.second],style:undefined,pressure:0,layout:Number(subject)};
 }
 return {steps:[subject as OriginalDeviceKind],style:mode==='mix'?style as LongCampaignStyle:undefined,
  pressure:Number(pressure??0),layout:CAMPAIGN_DEVICES.indexOf(subject as OriginalDeviceKind)+LONG_CAMPAIGN_STYLES.indexOf(style as LongCampaignStyle)};
}

export function longCampaignCandidate(key:string,seed:number,engineVersion:string):LevelDefinition{
 const {steps,style,pressure,layout}=parseBoardKey(key),width=9,height=9;
 const flip=layout%2!==0;
 const at=(x:number,y:number)=>y*width+(flip?8-x:x);
 const rect=(left:number,top:number,right:number,bottom:number)=>Array.from({length:bottom-top+1},(_,dy)=>
  Array.from({length:right-left+1},(_,dx)=>at(left+dx,top+dy))).flat();
 const shape=Array<boolean>(width*height).fill(true),obstacles:Obstacle[]=[],frost:Record<number,number>={},exits:number[]=[];
 const colors=[...COLORS.slice(0,5)];
 const goals:Goal[]=[];
 const goal=(kind:Goal['kind'],count:number)=>goals.push({kind,count,remaining:count});
 const add=(kind:Obstacle['kind'],footprint:number[],hp:number,details:Partial<Obstacle>={})=>
  obstacles.push({kind,id:`${kind}-${footprint[0]}`,hp,maxHp:hp,anchor:footprint[0]!,footprint,...details});
 const corners=[at(0,0),at(8,0),at(0,8),at(8,8)];
 const longMagnet=style==='magnets'&&supportsGliderSwarm(engineVersion);
 if(style!=='planters')for(const cell of corners)shape[cell]=false;
 if(style==='frost'||style==='seed')for(const cell of rect(4,6,4,8))shape[cell]=false;
 if(style==='magnets')for(const cell of [at(0,3),at(8,3),at(0,4),at(8,4)])shape[cell]=false;
 if(style==='special')for(const cell of [at(0,1),at(8,1),at(0,7),at(8,7)])shape[cell]=false;
 const valid=(cells:number[])=>cells.filter(cell=>shape[cell]);
 let gateSlots=[at(1,7),at(7,7)];
 switch(style){
  case 'crates':
   for(const x of [0,1,2,6,7,8])add('crate',[at(x,5)],1+pressure);
   break;
  case 'frost':
   for(const cell of valid(rect(0,6,3,8).concat(rect(5,6,8,8))))frost[cell]=1+Number(pressure>0);
   for(const x of [0,2,6,8])add('crate',[at(x,5)],1);
   break;
  case 'magnets':
   if(longMagnet){
    // Preserve open left and right play areas and the separate device gate.
    const path=layout%3===0
     ? [[2,3],[2,4],[2,5],[3,5],[4,5],[5,5],[6,5],[6,6],[6,7],...(pressure?[[5,7],[4,7],[3,7]]:[])]
     : layout%3===1
      ? [[1,3],[1,4],[1,5],[2,5],[3,5],[4,5],[5,5],[6,5],[7,5],...(pressure?[[7,4],[7,3]]:[])]
      : [[2,5],[3,5],[3,4],[4,4],[5,4],[5,5],[6,5],[7,5],...(pressure?[[7,6],[6,6],[5,6]]:[])];
    const cells=path.map(([x,y])=>at(x!,y!));add('pipe',cells,cells.length,{endOnly:true});
   }else{
    add('pipe',[at(1,5),at(2,5),at(3,5),at(3,6)],4,{endOnly:true});
    if(pressure>0)add('pipe',[at(5,6),at(6,6),at(7,6),at(7,5)],4,{endOnly:true});
   }
   break;
  case 'pots':
   for(const x of [1,7])add('pot',[at(x,6)],4+pressure,{color:colors[(x+layout+colors.length)%colors.length]});
   for(const x of [2,3,5,6])add('vine',[at(x,7)],1+Number(pressure>0));
   break;
  case 'seed':
   for(const x of pressure===0?[2]:[2,6]){
    add('cabinet',[at(x,4),at(x,5)],2,{seeds:1});
    add('crate',[at(x,7)],1+pressure);
    exits.push(at(x,8));
   }
   goal('seed',exits.length);
   break;
  case 'moss':
   for(const x of [1,7])for(const y of [4,6])add('moss',[at(x,y)],1+Number(pressure>0));
   break;
  case 'planters': {
   const path=[at(0,5),at(1,5),at(1,6),at(0,6)];
   add('carousel',[path[0]!],3+pressure,{path});
   if(pressure>0){
    const right=[at(7,5),at(8,5),at(8,6),at(7,6)];
    add('carousel',[right[0]!],3,{path:right});
   }
   break;
  }
  case 'special': goal('special',4+pressure);gateSlots=[at(2,7),at(6,7)];break;
 }
 if(steps.length===2){
  // Closed gates guard pockets whose frost survives the opening animation.
  // Each chapter places its pockets differently through the middle rows.
  const center=2+layout%5;
  gateSlots=[at(center,5),at(8-center,7)];
  for(const [x,y] of [[center,5],[8-center,7]]){
   for(const cell of valid(rect(Math.max(0,x-1),y,Math.min(8,x+1),y+1)))frost[cell]=1;
  }
  for(const x of [0,1,7,8])add('crate',[at(x,4)],1);
  goal('special',8);
 }else if(style&&style!=='special'&&style!=='seed'&&style!=='frost'){
  goal('special',4+pressure*3);
 }
 for(const kind of new Set(obstacles.map(o=>o.kind)))goal(kind,obstacles.filter(o=>o.kind===kind).length);
 const frostLayers=Object.values(frost).reduce((sum,layers)=>sum+layers,0);
 if(frostLayers)goal('frost',frostLayers);
 const laneTop=style==='magnets'?1:0;
 const devices=steps.map((kind,index):CampaignDevice=>{
  const left=valid(rect(0,laneTop,3,8)),right=valid(rect(5,laneTop,8,8));
  const field=valid(rect(0,0,8,8)),shift=layout%3===0?2:3;
  const conveyor=[at(shift,1),at(shift+1,1),at(shift+2,1),at(shift+2,2),at(shift+2,3),at(shift+1,3),at(shift,3),at(shift,2)];
  const wide=['fuse','rocket','forge','pollinate','cascade'].includes(kind);
  const zone=steps.length===2?valid(rect(index===0?0:2,0,index===0?6:8,8)):(index===0?left:right);
  const zones=['dual','relay','branch','switchback'].includes(kind)?[left,right]:kind==='conveyor'?[conveyor]:[wide&&steps.length===1?field:zone];
  const gate=gateSlots[index]!;
  add('crate',[gate],1);
  const target=targets[kind]+(pressure>0&&['switch','cascade','charge'].includes(kind)?pressure:0);
  return {kind,zones,gate,target};
 });
 goals.unshift({kind:'device',count:devices.length,remaining:devices.length});
 const [name,hint]=deviceCopy[devices[0]!.kind];
 return {
  id:401,version:longMagnet?LONG_MAGNET_VERSION:LONG_CAMPAIGN_VERSION,engineVersion,width,height,colors,moves:90,seed,shape,goals,obstacles,devices,
  ...(frostLayers?{frost}:{}),...(exits.length?{exits}:{}),
  difficulty:'normal',strategy:{id:key,name,hint},
 };
}

export function mirrorCampaignBoard(level:LevelDefinition):LevelDefinition{
 const mirror=(at:number)=>Math.floor(at/level.width)*level.width+level.width-1-at%level.width;
 return {...level,shape:level.shape.map((_,at)=>level.shape[mirror(at)]!),
  obstacles:level.obstacles.map(o=>({...o,anchor:mirror(o.anchor),footprint:o.footprint.map(mirror),...(o.path?{path:o.path.map(mirror)}:{})})),
  ...(level.frost?{frost:Object.fromEntries(Object.entries(level.frost).map(([at,layers])=>[mirror(Number(at)),layers]))}:{}),
  ...(level.exits?{exits:level.exits.map(mirror)}:{}),
  devices:level.devices?.map(step=>({...step,zones:step.zones.map(zone=>zone.map(mirror)),...(step.gate===undefined?{}:{gate:mirror(step.gate)})})),
 };
}
