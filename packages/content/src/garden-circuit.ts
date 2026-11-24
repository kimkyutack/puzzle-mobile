import {COLORS,supportsGardenCircuit,type LevelDefinition,type Obstacle} from '@garden/contracts';
import type {GardenCircuitKind,GardenCircuitObstacle,CircuitTrack,CrystalGroup} from '../../contracts/src/garden-circuit';
import recipes from './garden-circuit-recipes.json';
export interface CircuitProfile {kind:GardenCircuitKind;tier:number;mirror:boolean;intro:boolean}
const kinds=['rail','boomerang','crystal'] as const,introductions={rail:1601,boomerang:1701,crystal:1801};
export const circuitCopy:Record<GardenCircuitKind,readonly [string,string]>={
 rail:['화분 운반 레일','3개 이상 맞추거나 아이템으로 화분을 깨세요. 이동할 때마다 화분들이 레일을 따라 순환하고, 한 레일의 화분을 모두 수집하면 그 길이 열려요.'],
 boomerang:['꽃잎 부메랑 공성전','꽃잎 꼬투리 옆에서 3개 이상 맞추거나 아이템으로 타격하세요. 꼬투리를 깨면 부메랑이 나와 살아 있는 정원종 세 곳을 차례로 타격하고 돌아와요.'],
 crystal:['연결 꽃수정 군락','3개 이상 매치와 아이템으로 수정을 타격하세요. 군락 안의 수정 하나를 완전히 깨면 연결된 수정들이 함께 부서져요. 군락마다 따로 공략하세요.'],
};
export function gardenCircuitSlot(id:number):CircuitProfile|undefined{
 if(id<1601||id>20000)return;
 const offset=(id-1)%100,chapter=id-offset,run=Math.floor(offset/15),position=offset%15;
 const lesson=kinds.find(kind=>introductions[kind]===chapter),kind=lesson&&offset<3?lesson:position<3?kinds[run%3]:undefined;
 if(!kind||id<introductions[kind])return;
 return {kind,tier:[1601,2001,6001,12001].filter(first=>id>=first).length-1,mirror:Math.floor(run/3)%2===1,intro:!!lesson&&offset===0};
}
export const circuitProfileKey=(p:CircuitProfile)=>p.intro?`intro/${p.kind}`:`${p.kind}/${p.tier}/${Number(p.mirror)}`;
export function gardenCircuitProfiles():CircuitProfile[]{
 const profiles=new Map<string,CircuitProfile>();for(let id=1601;id<=20000;id++){const p=gardenCircuitSlot(id);if(p)profiles.set(circuitProfileKey(p),p);}return [...profiles.values()];
}
export function gardenCircuitCandidate(profile:CircuitProfile,seed:number,engineVersion:string):LevelDefinition{
 const {kind,tier,mirror,intro}=profile,width=9,height=9,shape=Array<boolean>(81).fill(true),obstacles:Obstacle[]=[],bank:number[]=[],tracks:CircuitTrack[]=[],groups:CrystalGroup[]=[];
 const at=(x:number,y:number)=>y*width+(mirror?8-x:x),layers=intro?1:tier>=2?3:2;
 const add=(kind:GardenCircuitObstacle,cell:number,hp:number,extra:Partial<Obstacle>={})=>{const id=`circuit-${kind}-${cell}`;obstacles.push({id,kind,anchor:cell,footprint:[cell],hp,maxHp:hp,...extra});return id;};
 if(kind==='rail'){
  for(const x of [0,2]){
   const track:CircuitTrack={id:`rail-${x}`,cells:[...Array.from({length:8},(_,i)=>at(x,i+1)),...Array.from({length:8},(_,i)=>at(x+1,8-i))]};tracks.push(track);
   for(const cell of track.cells){bank.push(cell);add('rail-pot',cell,intro?1:tier>=3?4:layers,{circuit:{track:track.id}});}
  }
 }else if(kind==='boomerang'){
  for(let y=1;y<9;y++)for(let x=0;x<3;x++){const cell=at(x,y);add('boomerang-bell',cell,layers);bank.push(cell);}
  for(let y=1;y<9;y++)for(let x=0;x<layers;x++)add('boomerang-pod',at(8-x,y),intro?1:tier>=3?3:2);
 }else{
  const cluster=(id:string,cells:number[])=>{groups.push({id,cells});for(const cell of cells)add('linked-crystal',cell,layers,{circuit:{group:id}});};
  if(intro)for(let y=1;y<9;y+=2)cluster(`grove-${y}`,[0,1,2].flatMap(x=>[at(x,y),at(x,y+1)]));
  else if(tier===0)for(let y=1;y<9;y++)cluster(`grove-${y}`,[0,1,2].map(x=>at(x,y)));
  else if(tier<3)for(let y=1;y<9;y+=2)for(let x=0;x<4;x+=2)cluster(`grove-${x}-${y}`,[at(x,y),at(x+1,y),at(x,y+1),at(x+1,y+1)]);
  else for(let y=1;y<9;y++)for(let x=0;x<4;x+=2)cluster(`grove-${x}-${y}`,[at(x,y),at(x+1,y)]);
 }
 const target=kind==='rail'?'rail-pot':kind==='boomerang'?'boomerang-bell':'linked-crystal',count=obstacles.filter(o=>o.kind===target).length;
 return {id:1601,version:'garden-2026.11.20-circuit-v1',engineVersion,width,height,shape,colors:[...COLORS.slice(0,5)],seed,moves:100,difficulty:'normal',
  obstacles,goals:[{kind:target,count,remaining:count}],siege:{kind,bank},circuit:{kind,tracks,groups}};
}
export function gardenCircuitLevel(source:LevelDefinition):LevelDefinition{
 const p=gardenCircuitSlot(source.id);
 if(!p||!supportsGardenCircuit(source.engineVersion)||source.siege||source.gardenStage||source.gardenPuzzle||source.devices?.length||source.tutorial||source.strategy?.id.startsWith('chain-campaign/')||source.strategy?.id.startsWith('split-wind/'))return source;
 const saved=(recipes as Partial<Record<string,readonly number[]>>)[circuitProfileKey(p)];if(!saved)throw Error('LEVEL_CONTENT_PENDING');
 const [name,hint]=circuitCopy[p.kind],margin=p.intro?10:source.difficulty==='super'?3:source.difficulty==='hard'?5:7;
 return {...gardenCircuitCandidate(p,saved[0]!,source.engineVersion),id:source.id,approved:true,moves:Math.max(p.intro?28:source.moves,saved[1]!+margin),difficulty:p.intro?'normal':source.difficulty,
  campaign:{...source.campaign!,beat:p.intro?'introduction':source.campaign!.beat,lesson:p.kind==='rail'?'rail-pot':p.kind==='boomerang'?'boomerang-pod':'linked-crystal'},
  strategy:{id:`garden-circuit/${circuitProfileKey(p)}`,name,hint}};
}
