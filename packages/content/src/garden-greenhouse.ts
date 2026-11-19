import {COLORS,GREENHOUSE_ENGINE_VERSION,type LevelDefinition,type Obstacle,type Tile} from '@garden/contracts';
import {GREENHOUSE_DEVICES,type CampaignDevice,type GreenhouseDeviceKind} from '../../contracts/src/campaign-devices';

export const GREENHOUSE_CONTENT_VERSION='garden-2026.11.16-greenhouse-v1';
const firstLevel=2401,lastLevel=3000;

export const greenhouseCopy:Record<GreenhouseDeviceKind,readonly [string,string]>={
 turntable:['회전 받침대','받침대의 일반 블록을 누르면 네 블록이 시계 방향으로 돌아요. 회전으로 매치를 만들어 보세요.'],
 keys:['짝 열쇠','열쇠가 표시된 칸의 블록을 없애면 같은 번호의 잠금 상자가 열려요.'],
 pollen:['꽃가루 표식','꽃가루가 묻은 블록을 없애세요. 블록을 옮기거나 떨어뜨려도 꽃가루가 따라가요.'],
 carrier:['운반 발사대','특수 블록을 일반 블록과 바꾸면 발사되지 않고 이동해요. 표시된 발사대에 옮긴 뒤 눌러 보세요.'],
 echo:['잔향 화단','표시된 칸에서 특수 블록을 터뜨리면 잔향이 남아요. 다음 이동에 그 주변이 한 번 더 터져요.'],
 reflector:['반사 로켓','로켓이 거울에 닿으면 한쪽 발사 경로가 직각으로 꺾여요. 거울과 같은 줄에 있는 로켓을 발사해 보세요.'],
};

export interface GreenhouseSlot {
 kind:GreenhouseDeviceKind;
 style:'lesson'|'crates'|'frost';
 variant:0|1|2;
}

export function greenhouseSlot(level:number):GreenhouseSlot|undefined{
 if(level<firstLevel||level>lastLevel)return;
 const chapter=Math.floor((level-firstLevel)/100),offset=level%100;
 const groups=[
  {start:1,style:'lesson',recap:false},
  {start:7,style:'crates',recap:false},
  {start:22,style:'frost',recap:false},
  {start:33,style:'crates',recap:true},
  {start:53,style:'crates',recap:false},
  {start:65,style:'frost',recap:true},
  {start:85,style:'frost',recap:false},
 ] as const;
 const group=groups.find(entry=>offset>=entry.start&&offset<entry.start+3);
 if(!group)return;
 const kind=GREENHOUSE_DEVICES[chapter-Number(group.recap)];
 if(!kind)return;
 return {kind,style:group.style,variant:(offset-group.start) as GreenhouseSlot['variant']};
}

export const greenhouseKey=({kind,style,variant}:GreenhouseSlot)=>`${kind}/${style}/${variant}`;
export const GREENHOUSE_PROFILES=[...new Map(Array.from({length:lastLevel-firstLevel+1},(_,i)=>
 greenhouseSlot(firstLevel+i)).flatMap(slot=>slot?[[greenhouseKey(slot),slot] as const]:[])).values()];

export function greenhouseCandidate(slot:GreenhouseSlot,seed:number):LevelDefinition{
 const {kind,style,variant}=slot,width=9,height=9;
 const at=(x:number,y:number)=>y*width+x;
 const region=(xs:number[],ys:number[])=>ys.flatMap(y=>xs.map(x=>at(x,y)));
 const colors=[...COLORS.slice(0,5)],shape=Array<boolean>(width*height).fill(true);
 const obstacles:Obstacle[]=[],frost:Record<number,number>={};
 const addCrate=(cell:number,hp:number)=>obstacles.push({id:`greenhouse-crate-${cell}`,kind:'crate',anchor:cell,footprint:[cell],hp,maxHp:hp});
 const lesson=style==='lesson',intro=lesson&&variant===0;
 const step:CampaignDevice={kind,zones:[],target:1};
 const goals:LevelDefinition['goals']=[{kind:'device',count:1,remaining:1}];
 const row=2+variant;
 let power:{cell:number;kind:'wind-row'|'wind-column'|'bomb'}|undefined;
 switch(kind){
  case 'turntable': {
   const a=at(2+variant,row);
   step.zones=[[a,a+1,a+1+width,a+width]];
   step.target=lesson?1:2;
   break;
  }
  case 'keys': {
   const unlockedColumns=lesson?[1,4,7]:[1,3,5,7];
   step.zones=[unlockedColumns.map((x,i)=>at(x,1+(i+variant)%3)),unlockedColumns.map(x=>at(x,8))];
   step.target=unlockedColumns.length;
   for(const lock of step.zones[1]!)addCrate(lock,1);
   break;
  }
  case 'pollen':
   step.zones=[region(lesson?[2,4,6]:[1,3,5,7],[1+variant,4+variant])];
   step.target=step.zones[0]!.length;
   break;
  case 'carrier':
   step.zones=[[at(2,row+1),at(4,row+1),at(6,row+1),at(4,6)]];
   step.target=lesson?1:2;
   if(intro)power={cell:at(4,row),kind:'bomb'};
   break;
  case 'echo':
   step.zones=[region([2,3,4,5,6],[row,row+1,row+2])];
   step.target=lesson?1:2;
   if(intro)power={cell:at(4,row+1),kind:'bomb'};
   break;
  case 'reflector':
   step.zones=[[at(3+variant,row+1)]];
   step.target=lesson?1:2;
   if(intro)power={cell:at(0,row+1),kind:'wind-row'};
   break;
 }
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
 const fixed:Record<number,Tile>={};
 if(power)fixed[power.cell]={id:power.cell+1,kind:power.kind};
 if(lesson&&kind==='turntable'){
  const [a,b,c,d]=step.zones[0]!;
  // The three lessons line up a match to the left, right, and below the ring.
  const [from,to,first,second]=variant===0?[d!,a!,a!-2,a!-1]:
   variant===1?[a!,b!,b!+1,b!+2]:[c!,d!,d!+width,d!+2*width];
  for(const cell of [from,first,second])fixed[cell]={id:cell+1,kind:'normal',color:colors[variant]!};
  fixed[to]={id:to+1,kind:'normal',color:colors[(variant+1)%colors.length]!};
 }
 // Seeded colors for authored starts with fixed teaching pieces. Checking both
 // assigned and fixed cells keeps the preserved pieces safe during random starts.
 const getInitial=()=>{
  let rng=seed>>>0;
  const initial=Array<Tile|null>(shape.length).fill(null),occupied=new Set(obstacles.flatMap(o=>o.footprint));
  for(const [cell,tile] of Object.entries(fixed))initial[Number(cell)]=tile;
  const matching=(cell:number,color:typeof colors[number])=>{
   const x=cell%width,y=Math.floor(cell/width);
   const same=(other:number)=>{const tile=initial[other];return tile?.kind==='normal'&&tile.color===color;};
   for(let dx=-2;dx<=0;dx++)if(x+dx>=0&&x+dx+2<width&&[0,1,2].every(i=>i+dx===0||same(cell+dx+i)))return true;
   for(let dy=-2;dy<=0;dy++)if(y+dy>=0&&y+dy+2<height&&[0,1,2].every(i=>i+dy===0||same(cell+(dy+i)*width)))return true;
   for(let dy=-1;dy<=0;dy++)for(let dx=-1;dx<=0;dx++)if(x+dx>=0&&x+dx+1<width&&y+dy>=0&&y+dy+1<height){
    const a=cell+dy*width+dx;
    if([a,a+1,a+width,a+width+1].every(other=>other===cell||same(other)))return true;
   }
   return false;
  };
  for(let cell=0;cell<initial.length;cell++){
   if(initial[cell]||occupied.has(cell))continue;
   rng^=rng<<13;rng^=rng>>>17;rng^=rng<<5;
   const start=(rng>>>0)%colors.length;
   const color=colors.map((_,i)=>colors[(start+i)%colors.length]!).find(color=>!matching(cell,color));
   if(!color)throw Error('GREENHOUSE_START_COLOR');
   initial[cell]={id:cell+1,kind:'normal',color};
  }
  return initial;
 };
 const protectedCells=Object.keys(fixed).map(Number);
 const [name,hint]=greenhouseCopy[kind];
 return {
  id:firstLevel,engineVersion:GREENHOUSE_ENGINE_VERSION,version:GREENHOUSE_CONTENT_VERSION,
  width,height,shape,colors,seed,moves:70,goals,obstacles,devices:[step],
  ...(protectedCells.length?{initial:getInitial(),protectedCells}:{}),
  frost,difficulty:'normal',strategy:{id:`greenhouse/${greenhouseKey(slot)}`,name,hint},
 };
}
