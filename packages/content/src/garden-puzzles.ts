import {COLORS,supportsDenseGardenPuzzles,supportsGardenPuzzles,type Goal,type LevelDefinition,type Obstacle,type Special,type Tile} from '@garden/contracts';
import {GARDEN_PUZZLE_KINDS,type GardenDirection,type GardenPuzzleKind} from '../../contracts/src/garden-puzzles';
import {campaignPosition} from './campaign';
import {denseGardenPuzzleLevel} from './dense-garden-puzzles';

export const GARDEN_PUZZLES_VERSION='garden-2026.11.16-garden-puzzles-v1';
const firstLevel=3001,lastLevel=3600;
const groupStarts=[1,11,31,61] as const;
export const gardenPuzzleCopy:Record<GardenPuzzleKind,readonly [string,string]>={
 domino:['도미노 울타리','특수 블록으로 판자를 맞히면 화살표를 따라 넘어져요. 빈칸 다음 판자는 새로 맞혀야 해요.'],
 cart:['정원 수레','수레를 옆 칸으로 한 칸씩 밀어 수확대에 보내세요. 상자로 막힌 길은 먼저 열어요.'],
 soil:['갈라지는 흙덩이','가로 로켓은 좌우로, 세로 로켓은 위아래로 흙덩이를 가릅니다. 작은 흙 조각까지 부수세요.'],
 shadow:['그림자 화단','특수 블록으로 조명을 켜세요. 빛은 상자 앞에서 멈추고, 빛이 닿은 꽃봉오리만 타격할 수 있어요.'],
 wire:['철망 화단','가로와 세로 로켓으로 같은 방향의 철망을 끊으세요. 십자 로켓은 두 겹을 벗기고, 꽃폭탄은 한 겹을 벗겨요.'],
 fence:['울타리 화단','점선 칸에서 매치하거나 특수 블록을 맞혀요. 울타리가 고리를 완성하면 안쪽 덤불이 사라져요.'],
};
type Point=readonly [number,number];
const direction=([x,y]:Point,[toX,toY]:Point):GardenDirection=>toX>x?'right':toX<x?'left':toY>y?'down':'up';
const innerColumns=[1,2,3,5,6,7];

export function gardenPuzzleSlot(id:number){
 if(!Number.isInteger(id)||id<firstLevel||id>lastLevel)return;
 const offset=id-firstLevel,position=offset%100+1;
 const group=groupStarts.findIndex(start=>position>=start&&position<start+3);
 if(group<0)return;
 return {kind:GARDEN_PUZZLE_KINDS[Math.floor(offset/100)]!,group,variant:position-groupStarts[group]!};
}

export function gardenPuzzleLevel(source:LevelDefinition):LevelDefinition{
 if(!supportsGardenPuzzles(source.engineVersion)||!source.approved||source.gardenStage||source.tutorial)return source;
 const slot=gardenPuzzleSlot(source.id);
 if(!slot)return source;
 if(supportsDenseGardenPuzzles(source.engineVersion))return denseGardenPuzzleLevel(source,slot.kind,slot.group,slot.variant,gardenPuzzleCopy[slot.kind]);
 const {kind,group,variant}=slot,width=9,height=9;
 const mirror=variant===1,second=variant>0,practice=group===0&&second;
 const narrowCartLane=kind==='cart'&&(second||group>=2);
 const at=(x:number,y:number)=>y*width+(mirror?width-1-x:x);
 const shape=Array<boolean>(width*height).fill(true),obstacles:Obstacle[]=[],powers=new Map<number,Special>(),cells:number[]=[];
 const add=(type:Obstacle['kind'],x:number,y:number,extra:Partial<Pick<Obstacle,'direction'|'wire'|'contents'>>={},hp=type==='wire-planter'?3:1)=>{
  const anchor=at(x,y);
  if(powers.has(anchor)||obstacles.some(o=>o.anchor===anchor))throw Error('GARDEN_PUZZLE_LAYOUT');
  const direction=extra.direction&&mirror?(extra.direction==='left'?'right':extra.direction==='right'?'left':extra.direction):extra.direction;
  obstacles.push({id:`puzzle-${anchor}`,kind:type,hp,maxHp:hp,anchor,footprint:[anchor],...extra,...(direction?{direction}:{})});
 };
 const power=(type:Special,x:number,y:number)=>powers.set(at(x,y),type);
 const obstacleRow=(type:Obstacle['kind'],xs:readonly number[],y:number)=>xs.forEach(x=>add(type,x,y));
 let goalKind:Goal['kind'];
 switch(kind){
  case 'domino': {
   goalKind='domino-slat';
   const left:Point[]=[[1,2],[2,2],[3,2],[3,3],[3,4],[4,4]];
   const right:Point[]=second?[[7,6],[7,5],[7,4],[6,4],[5,4],[5,5]]:[[7,6],[6,6],[5,6],[5,5],[5,4],[5,3]];
   for(const [row,line] of [left,right].entries())for(const [index,[x,y]] of line.entries()){
    if(row===0&&index===3&&(variant===2||group===3)){
     if(group===3)add('crate',x,y);
     continue;
    }
    add(goalKind,x,y,{direction:line[index+1]?direction([x,y],line[index+1]!):'down'});
   }
   power('wind-column',1,0);
   if(second)power('wind-row',8,6);else power('wind-column',7,8);
   if(variant===2||group===3)power('wind-row',0,4);
   break;
  }
  case 'cart': {
   goalKind='harvest-cart';
   if(narrowCartLane){
    add(goalKind,2,4);add(goalKind,1,4);
    cells.push(at(7,3),at(7,5));
    // Two carts share a narrow approach before the route branches again.
    for(let y=0;y<height;y++)if(y!==4)for(const x of [3,4,5])shape[at(x,y)]=false;
   }else{add(goalKind,1,4);cells.push(at(7,4));}
   add('crate',4,4);
   power('wind-row',0,4);
   break;
  }
  case 'soil': {
   goalKind='soil-chip';
   for(const y of [2,6])obstacleRow('soil-clod',[2,6],y);
   if(second){
    for(const x of [2,6])power('wind-column',x,4);
    for(const y of [1,3,5,7])power('wind-row',4,y);
   }else{
    for(const y of [2,6])power('wind-row',4,y);
    for(const x of [1,3,5,7])power('wind-column',x,8);
   }
   if(group===3){add('soil-clod',4,4);power('wind-row',0,4);}
   break;
  }
  case 'shadow': {
   goalKind='shadow-bud';
   for(const y of [2,6]){
    add('garden-light',0,y,{direction:'right'});
    if(second||group>0)add('crate',2,y,{},group===3&&y===2?2:1);
    obstacleRow(goalKind,[3,4,5,6,7],y);
    power('wind-row',1,y);
    power('wind-row',1,y-1);
   }
   break;
  }
  case 'wire': {
   goalKind='wire-planter';
   for(const y of group===3?[1,3,5]:[3,5]){
    for(const x of innerColumns)add(goalKind,x,y,{wire:3});
    power('wind-row',4,y);
   }
   for(const x of innerColumns)power('wind-column',x,8);
   power('wind-column',4,4);
   for(const x of [2,6])power('bomb',x,4);
   if(second)for(const x of [2,6])power('bomb',x,2);
   break;
  }
  case 'fence': {
   goalKind='fence-thicket';
   for(let x=1;x<=7;x++)cells.push(at(x,1),at(x,7));
   for(let y=2;y<7;y++)cells.push(at(1,y),at(7,y));
   if(second||group>0){for(let x=2;x<7;x++)cells.push(at(x,4));power('wind-row',0,4);}
   for(const y of [3,5])obstacleRow(goalKind,[2,4,6],y);
   for(const y of [1,7])power('wind-row',0,y);
   for(const x of [1,7])power('wind-column',x,8);
   break;
  }
 }
 if(group>0){
  const type=group===1?'crate':group===2?'urn':'supply-crate';
  for(const x of [0,8])add(type,x,8,type==='supply-crate'?{contents:{kind:'urn',hp:1}}:{});
  power('wind-row',narrowCartLane?1:4,8);
  if(group===3)power('bomb',narrowCartLane?6:4,7);
 }
 const frost=group===3?Object.fromEntries([0,8].map(x=>[at(x,0),1])):undefined;
 if(frost)power('wind-row',narrowCartLane?1:4,0);
 const colors=[...COLORS.slice(0,5)],occupied=new Set(obstacles.map(o=>o.anchor));
 const initial=shape.map((exists,index):Tile|null=>{
  if(!exists||occupied.has(index))return null;
  const kind=powers.get(index),id=index+1;
  return kind?{id,kind}:{id,kind:'normal',color:colors[(index%width+2*Math.floor(index/width)+variant)%colors.length]!};
 });
 const counts=new Map<Goal['kind'],number>();
 for(const o of obstacles){
  const target=o.kind==='soil-clod'?'soil-chip':o.contents?.kind??o.kind;
  if(target===goalKind||group>0&&['crate','urn'].includes(target))counts.set(target,(counts.get(target)??0)+(o.kind==='soil-clod'?2:1));
 }
 if(frost)counts.set('frost',Object.keys(frost).length);
 const goals=[...counts].sort(([a],[b])=>Number(b===goalKind)-Number(a===goalKind)).map(([kind,count])=>({kind,count,remaining:count}));
 const [name,hint]=gardenPuzzleCopy[kind],beat=group===0?(practice?'practice':'introduction'):group===3?'hard':'normal';
 return {id:source.id,approved:true,version:GARDEN_PUZZLES_VERSION,engineVersion:source.engineVersion,
  width,height,shape,colors,moves:Math.max(source.moves,kind==='cart'?24:18),seed:63271+source.id*17,
  initial,obstacles,goals,...(frost?{frost}:{}),gardenPuzzle:{kind,...(cells.length?{cells}:{})},difficulty:group===3?'hard':'normal',
  strategy:{id:`garden-puzzles/${kind}/${group}/${variant}`,name,hint},campaign:{...campaignPosition(source.id),beat}};
}
