import {COLORS,GARDEN_WORKSHOP_ENGINE_VERSION,type LevelDefinition,type Obstacle} from '@garden/contracts';
import {WORKSHOP_DEVICES,type CampaignDevice,type WorkshopDeviceKind} from '../../contracts/src/campaign-devices';

export const WORKSHOP_CONTENT_VERSION='garden-2026.11.16-workshop-v1';
export const WORKSHOP_FIRST_LEVEL=1801;
export const WORKSHOP_LAST_LEVEL=WORKSHOP_FIRST_LEVEL+100*WORKSHOP_DEVICES.length-1;

export const workshopCopy:Record<WorkshopDeviceKind,readonly [string,string]>={
 'twin-plates':['짝빛 받침대','같은 번호의 두 받침대에 같은 색 블록을 올려요. 3개를 맞추지 않아도 교환할 수 있어요.'],
 portal:['쌍둥이 통로','통로 칸으로 옮긴 블록은 반대편으로 건너가요. 건너간 자리에서 매치를 만들어 보세요.'],
 dye:['정원 염색틀','금색 구역에서 맞춘 색이 푸른 틀의 블록으로 옮겨져요. 틀에 새 매치를 만들어요.'],
 scale:['꽃잎 저울','두 구역에서 직접 맞춘 블록을 같은 수만큼 채워요. 넘치면 그쪽 저울이 비워져요.'],
 mirror:['거울 화단','표시된 구역에서 블록을 맞추면 반대편의 대칭 칸도 깨져요.'],
 updraft:['바람 우물','블록이 아래에서 위로 올라와요. 표시된 윗칸에 블록을 올려 보내세요.'],
};

export interface WorkshopSlot {
 kind:WorkshopDeviceKind;
 style:'lesson'|'crates'|'frost';
 variant:0|1|2;
}

/** Each new rule has three opening lessons and returns in groups of three. */
export function workshopSlot(level:number):WorkshopSlot|undefined{
 if(level<WORKSHOP_FIRST_LEVEL||level>WORKSHOP_LAST_LEVEL)return;
 const chapter=Math.floor((level-WORKSHOP_FIRST_LEVEL)/100),offset=level%100;
 const groups=[
  {start:1,style:'lesson',recap:false},
  {start:6,style:'crates',recap:false},
  {start:21,style:'frost',recap:false},
  {start:31,style:'crates',recap:true},
  {start:51,style:'crates',recap:false},
  {start:61,style:'frost',recap:true},
  {start:84,style:'frost',recap:false},
 ] as const;
 const group=groups.find(entry=>offset>=entry.start&&offset<entry.start+3);
 if(!group)return;
 const kind=WORKSHOP_DEVICES[chapter-Number(group.recap)];
 if(!kind)return;
 return {kind,style:group.style,variant:(offset-group.start) as WorkshopSlot['variant']};
}

export const workshopKey=({kind,style,variant}:WorkshopSlot)=>`${kind}/${style}/${variant}`;
export const WORKSHOP_PROFILES=[...new Map(Array.from({length:WORKSHOP_LAST_LEVEL-WORKSHOP_FIRST_LEVEL+1},(_,i)=>
 workshopSlot(WORKSHOP_FIRST_LEVEL+i)).flatMap(slot=>slot?[[workshopKey(slot),slot] as const]:[])).values()];

export function workshopCandidate(slot:WorkshopSlot,seed:number):LevelDefinition{
 const {kind,style,variant}=slot,width=9,height=9;
 const at=(x:number,y:number)=>y*width+x;
 const region=(xs:number[],ys:number[])=>ys.flatMap(y=>xs.map(x=>at(x,y)));
 const shape=Array<boolean>(width*height).fill(true),obstacles:Obstacle[]=[],frost:Record<number,number>={};
 const addCrate=(cell:number,hp:number)=>obstacles.push({id:`workshop-crate-${cell}`,kind:'crate',anchor:cell,footprint:[cell],hp,maxHp:hp});
 const lesson=style==='lesson';
 const step:CampaignDevice={kind,zones:[],target:1,gate:at(4,8)};
 const row=2+variant;
 switch(kind){
  case 'twin-plates':
   step.target=lesson?2:3;
   step.zones=[[at(1,row),at(3,5),at(1,6)].slice(0,step.target),[at(7,row),at(5,5),at(7,6)].slice(0,step.target)];
   break;
  case 'portal':
   step.target=lesson||style==='frost'&&variant===2?2:3;
   // Keep this narrower frost pattern clear of the portal exits.
   step.zones=style==='frost'&&variant===2?[[at(2,3)],[at(6,5)]]:[[at(2,row)],[at(6,6-variant)]];
   break;
  case 'dye':
   step.target=lesson?2:3;
   step.zones=[region([0,1,2,3],[1,2,3,4,5]),[at(5,row),at(6,row),at(7,row)]];
   break;
  case 'scale':
   step.target=lesson?6:8;
   step.zones=[region([0,1,2,3],[1,2,3,4,5]),region([5,6,7,8],[1,2,3,4,5])];
   break;
  case 'mirror':
   step.target=lesson?3:4;
   step.zones=[region([1,2,3],[row-1,row,row+1]),region([7,6,5],[row-1,row,row+1])];
   break;
  case 'updraft':
   step.target=lesson?4:6;
   step.zones=[region(variant===0?[2,3,4,5,6]:variant===1?[0,1,2,6,7,8]:[1,2,4,6,7],[0])];
   break;
 }
 const goals:LevelDefinition['goals']=[{kind:'device',count:1,remaining:1}];
 const marked=new Set(step.zones.flat());
 if(style==='crates'){
  const cells=region(variant===0?[1,3,5,7]:variant===1?[0,2,6,8]:[1,2,6,7],[7]);
  for(const cell of cells)addCrate(cell,variant===2?2:1);
  goals.push({kind:'crate',count:cells.length,remaining:cells.length});
 }else if(style==='frost'){
  const field=region(variant===0?[0,1,2,6,7,8]:variant===1?[0,2,4,6,8]:[1,2,3,5,6,7],[6,7]);
  for(const cell of field)if(!marked.has(cell))frost[cell]=1;
  const count=Object.keys(frost).length;
  goals.push({kind:'frost',count,remaining:count});
 }
 addCrate(step.gate!,1);
 const [name,hint]=workshopCopy[kind];
 return {
  id:WORKSHOP_FIRST_LEVEL,engineVersion:GARDEN_WORKSHOP_ENGINE_VERSION,version:WORKSHOP_CONTENT_VERSION,
  width,height,shape,colors:[...COLORS.slice(0,5)],seed,moves:70,goals,obstacles,devices:[step],
  frost,difficulty:'normal',strategy:{id:`workshop/${workshopKey(slot)}`,name,hint},
 };
}
