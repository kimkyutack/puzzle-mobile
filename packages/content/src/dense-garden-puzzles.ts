import {COLORS,type Goal,type LevelDefinition,type Obstacle,type Special,type Tile} from '@garden/contracts';
import type {GardenDirection,GardenPuzzleKind} from '../../contracts/src/garden-puzzles';
import {campaignPosition} from './campaign';

export const DENSE_GARDEN_PUZZLES_VERSION='garden-2026.11.16-garden-puzzles-v2';
export const densePuzzleHints:Partial<Record<GardenPuzzleKind,string>>={
 cart:'뒤쪽 수레를 밀면 앞에 붙은 수레도 한 줄로 움직여요. 칸을 가득 채운 수레들을 금빛 수확대로 보내세요.',
 soil:'로켓 방향으로 흙덩이가 갈라져요. 옆이 꽉 차 있으면 조각이 그 자리에 쌓여요. 작은 조각까지 전부 부수세요.',
 shadow:'위쪽 줄부터 로켓을 발사해 보세요. 첫 로켓으로 조명을 켜고, 따라 터지는 로켓으로 꽃봉오리를 맞혀요.',
};

type Point=readonly [number,number];
const range=(start:number,length:number)=>Array.from({length},(_,i)=>start+i);
const direction=([x,y]:Point,[newX,newY]:Point):GardenDirection=>newX>x?'right':newX<x?'left':newY>y?'down':'up';
const between=(line:number[],reverse:boolean)=>reverse?[...line].reverse():line;

export function denseGardenPuzzleLevel(source:LevelDefinition,kind:GardenPuzzleKind,group:number,variant:number,copy:readonly [string,string]):LevelDefinition{
 const width=9,height=9,mirror=variant===1;
 const at=(x:number,y:number)=>y*width+(mirror?width-1-x:x);
 const obstacles:Obstacle[]=[],powers=new Map<number,Special>(),cells:number[]=[];
 const add=(type:Obstacle['kind'],x:number,y:number,extra:Pick<Obstacle,'direction'|'wire'|'contents'>={})=>{
  const anchor=at(x,y),hp=type==='wire-planter'?3:1;
  if(powers.has(anchor)||obstacles.some(o=>o.anchor===anchor))throw Error('DENSE_PUZZLE_LAYOUT');
  const dir=extra.direction;
  const facing=mirror?(dir==='right'?'left':dir==='left'?'right':dir):dir;
  obstacles.push({id:`dense-${anchor}`,kind:type,anchor,footprint:[anchor],hp,maxHp:hp,...extra,...(facing?{direction:facing}:{})});
 };
 const power=(type:Special,x:number,y:number)=>{
  const anchor=at(x,y);
  if(obstacles.some(o=>o.anchor===anchor))throw Error('DENSE_PUZZLE_POWER');
  powers.set(anchor,type);
 };
 const row=(type:Obstacle['kind'],xs:number[],y:number,extra:Pick<Obstacle,'wire'>={})=>xs.forEach(x=>add(type,x,y,extra));
 let goalKind:Goal['kind'];
 switch(kind){
  case 'domino': {
   goalKind='domino-slat';
   const paths:Point[][]=variant===2
    ?[[2,3],[4,5],[6]].map(rows=>rows.flatMap((y,i)=>between(range(0,6),i%2===1).map(x=>[x,y] as const)))
    :[0,3].map(start=>range(start,3).flatMap((x,i)=>between(range(2,5),i%2===1).map(y=>[x,y] as const)));
   for(const [bank,path] of paths.entries()){
    for(const [index,[x,y]] of path.entries()){
     if(group===3&&bank===0&&index===6){add('crate',x,y);continue;}
     const next=path[index+1];
     add(goalKind,x,y,{direction:next?direction([x,y],next):variant===2?(x===0?'left':'right'):'down'});
    }
    const [x,y]=path[0]!;
    if(variant===2)power('wind-row',7,y);else power('wind-column',x,0);
   }
   if(group===3){power('wind-row',8,4);power('wind-column',2,0);}
   break;
  }
  case 'cart': {
   goalKind='harvest-cart';
   const columns=variant===2?4:3,lanes=variant===2?5:variant===1?7:6;
   const barrier=group>0,dockStart=columns+Number(barrier);
   for(const y of range(1,lanes)){
    row(goalKind,range(0,columns),y);
    for(const x of range(dockStart,columns))cells.push(at(x,y));
    if(barrier&&(y+variant)%2===0)add('crate',columns,y);
   }
   if(barrier)power('wind-column',columns,0);
   break;
  }
  case 'soil': {
   goalKind='soil-chip';
   for(const y of range(2,5)){
    row('soil-clod',range(0,variant===2?6:5),y);
    for(const x of range(6,group===3&&y%2===1?2:3))power('wind-row',x,y);
   }
   if(group===3)for(const x of range(0,6))power('wind-column',x,7);
   break;
  }
  case 'shadow': {
   goalKind='shadow-bud';
   for(const y of range(2,5)){
    const fromRight=variant===2&&y%2===1,cols=range(variant===2?2:3,5);
    add('garden-light',fromRight?8:0,y,{direction:fromRight?'left':'right'});
    row(goalKind,cols,y);
    const near=fromRight?7:1,far=cols.at(-1)===7?8:fromRight?1:7;
    if(group>0&&variant!==2)add('crate',2,y);
    power('wind-row',near,y);power('wind-row',far,y);
   }
   break;
  }
  case 'wire': {
   goalKind='wire-planter';
   const columns=variant===2?6:5;
   for(const y of range(2,5)){
    row(goalKind,range(0,columns),y,{wire:3});
    power('wind-row',6,y);power('wind-column',7,y);
    if(group<2||y%2===0)power('wind-row',8,y);
   }
   for(const x of range(0,columns))power('wind-column',x,7);
   break;
  }
  case 'fence': {
   goalKind='fence-thicket';
   const divider=variant===2;
   for(const x of range(1,7))cells.push(at(x,1),at(x,7));
   for(const y of range(2,5))cells.push(at(1,y),at(7,y));
   for(const y of range(2,5)){
    if(divider&&y===4){for(const x of range(2,5))cells.push(at(x,y));}
    else row(goalKind,range(2,5),y);
   }
   for(const y of divider?[1,4,7]:[1,7])power('wind-row',0,y);
   for(const x of [1,7])power('wind-column',x,8);
   break;
  }
 }
 if(group>0){
  const type=group===1?'crate':group===2?'urn':'supply-crate';
  for(const x of [0,8])add(type,x,8,type==='supply-crate'?{contents:{kind:'urn',hp:1}}:{});
  power('wind-row',6,8);
  if(group===3)power('wind-row',kind==='fence'?5:7,8);
 }
 const frost=group===3?{[at(0,0)]:1,[at(8,0)]:1}:undefined;
 if(frost)power('wind-row',7,0);
 const colors=[...COLORS.slice(0,5)],occupied=new Set(obstacles.map(o=>o.anchor));
 const shape=Array<boolean>(width*height).fill(true);
 const initial=shape.map((_,index):Tile|null=>{
  if(occupied.has(index))return null;
  const kind=powers.get(index),id=index+1;
  return kind?{id,kind}:{id,kind:'normal',color:colors[(index%width+2*Math.floor(index/width)+variant)%colors.length]!};
 });
 const counts=new Map<Goal['kind'],number>([[goalKind,0]]);
 for(const o of obstacles){
  const target=o.kind==='soil-clod'?'soil-chip':o.contents?.kind??o.kind;
  if(target===goalKind||['crate','urn'].includes(target))counts.set(target,(counts.get(target)??0)+(o.kind==='soil-clod'?2:1));
 }
 if(frost)counts.set('frost',Object.keys(frost).length);
 const goals=[...counts].map(([kind,count])=>({kind,count,remaining:count}));
 const [name,defaultHint]=copy,hint=densePuzzleHints[kind]??defaultHint;
 const beat=group===0?(variant===0?'introduction':'practice'):group===3?'hard':'normal';
 return {id:source.id,approved:true,version:DENSE_GARDEN_PUZZLES_VERSION,engineVersion:source.engineVersion,
  width,height,shape,colors,moves:Math.max(source.moves,kind==='cart'?56:24),seed:71839+source.id*17,
  initial,obstacles,goals,...(frost?{frost}:{}),gardenPuzzle:{kind,...(cells.length?{cells}:{})},difficulty:group===3?'hard':'normal',
  strategy:{id:`garden-puzzles/${kind}/${group}/${variant}`,name,hint},campaign:{...campaignPosition(source.id),beat}};
}
