import {COLORS,supportsGardenFrontier,type LevelDefinition,type Obstacle} from '@garden/contracts';
import type {FrontierGroup,GardenFrontierKind,GardenFrontierObstacle} from '../../contracts/src/garden-frontier';
import recipes from './garden-frontier-recipes.json';
export interface FrontierProfile {kind:GardenFrontierKind;tier:number;mirror:boolean;intro:boolean}
const kinds=['shelf','shade','expedition'] as const,introductions={shelf:1301,shade:1401,expedition:1501};
export const frontierCopy:Record<GardenFrontierKind,readonly [string,string]>={
 shelf:['꽃병 선반','선반의 꽃병 옆에서 3개 이상 맞추거나 아이템으로 타격하세요. 여덟 꽃병을 모두 수집하면 선반이 무너지며 넓은 길이 열려요.'],
 shade:['온실 차양','태엽 손잡이를 깨면 연결된 차양 한 줄이 걷혀요. 처음부터 비쳐 보이는 난초를 차양이 열린 뒤 3개 이상 매치와 아이템으로 수집하세요.'],
 expedition:['2단계 정원 원정','입구의 꽃덩굴을 모두 걷어내면 온실 안으로 이동해요. 남은 이동 횟수로 두 번째 구역의 호박 연꽃을 모두 수집하세요.'],
};
export function gardenFrontierSlot(id:number):FrontierProfile|undefined{
 if(id<1301||id>20000)return;
 const offset=(id-1)%100,chapter=id-offset,run=Math.floor(offset/15),position=offset%15;
 const lesson=kinds.find(kind=>introductions[kind]===chapter);
 const kind=lesson&&offset<3?lesson:position>=7&&position<=9?kinds[run%3]:undefined;
 if(!kind||id<introductions[kind])return;
 return {kind,tier:[1301,2001,6001,12001].filter(first=>id>=first).length-1,mirror:Math.floor(run/3)%2===1,intro:!!lesson&&offset===0};
}
export const frontierProfileKey=(p:FrontierProfile)=>p.intro?`intro/${p.kind}`:`${p.kind}/${p.tier}/${Number(p.mirror)}`;
export function gardenFrontierProfiles():FrontierProfile[]{
 const profiles=new Map<string,FrontierProfile>();for(let id=1301;id<=20000;id++){const p=gardenFrontierSlot(id);if(p)profiles.set(frontierProfileKey(p),p);}return [...profiles.values()];
}
export function gardenFrontierCandidate(profile:FrontierProfile,seed:number,engineVersion:string):LevelDefinition{
 const {kind,tier,mirror,intro}=profile,width=9,height=9,shape=Array<boolean>(81).fill(true),obstacles:Obstacle[]=[],bank:number[]=[],groups:FrontierGroup[]=[];
 const at=(x:number,y:number)=>y*width+(mirror?8-x:x),layers=intro?1:tier>=2?3:2;
 const add=(kind:GardenFrontierObstacle,cell:number,hp:number,extra:Partial<Obstacle>={})=>{
  const id=`frontier-${kind}-${cell}`;obstacles.push({id,kind,anchor:cell,footprint:[cell],hp,maxHp:hp,...extra});return id;
 };
 if(kind==='shelf'){
  for(let row=1;row<9;row+=2){const group:FrontierGroup={id:`rack-${row}`,cells:[]};
   for(let y=row;y<row+2;y++)for(let x=0;x<4;x++){const cell=at(x,y);group.cells.push(cell);bank.push(cell);add('shelf-vase',cell,layers,{frontier:{group:group.id}});}
   groups.push(group);
  }
 }else if(kind==='shade'){
  for(let row=1;row<9;row++){const group:FrontierGroup={id:`canopy-${row}`,cells:[]};
   for(let x=0;x<3;x++){const cell=at(x,row);group.cells.push(cell);add('canopy-orchid',cell,layers,{frontier:{group:group.id,locked:true}});}
   group.source=add('awning-crank',at(8,row),intro?1:tier>=3?3:2,{frontier:{group:group.id}});groups.push(group);
  }
 }else{
  for(let y=1;y<9;y++)for(let x=0;x<3;x++)add('journey-vine',at(x,y),layers);
 }
 const target=kind==='shelf'?'shelf-vase':kind==='shade'?'canopy-orchid':'journey-vine',count=kind==='shelf'?32:24;
 const level:LevelDefinition={id:1501,version:'garden-2026.11.20-frontier-v1',engineVersion,width,height,shape,colors:[...COLORS.slice(0,5)],seed,moves:100,difficulty:'normal',
  obstacles,goals:[{kind:target,count,remaining:count}],siege:{kind,bank},frontier:{kind,groups}};
 if(kind==='expedition'){
  const inside:LevelDefinition={...level,seed:(seed+15739)>>>0,obstacles:[],goals:[{kind:'journey-relic',count:32,remaining:32}],siege:{kind,bank:[]},frontier:{kind,groups:[]},journey:{stage:2}};
  for(let y=1;y<9;y++)for(let x=0;x<4;x++){
   const cell=y*width+(mirror?x:8-x);inside.obstacles.push({id:`inside-relic-${cell}`,kind:'journey-relic',anchor:cell,footprint:[cell],hp:layers,maxHp:layers});
  }
  level.journey={stage:1,next:inside};
 }
 return level;
}
export function gardenFrontierLevel(source:LevelDefinition):LevelDefinition{
 const profile=gardenFrontierSlot(source.id);
 if(!profile||!supportsGardenFrontier(source.engineVersion)||source.siege||source.gardenStage||source.gardenPuzzle||source.devices?.length||source.tutorial||source.strategy?.id.startsWith('chain-campaign/')||source.strategy?.id.startsWith('split-wind/'))return source;
 const saved=(recipes as Partial<Record<string,readonly number[]>>)[frontierProfileKey(profile)];if(!saved)throw Error('LEVEL_CONTENT_PENDING');
 const board=gardenFrontierCandidate(profile,saved[0]!,source.engineVersion),[name,hint]=frontierCopy[profile.kind],margin=profile.intro?10:source.difficulty==='super'?3:source.difficulty==='hard'?5:7;
 if(board.journey?.next)board.journey.next.id=source.id;
 return {...board,id:source.id,approved:true,moves:Math.max(profile.intro?28:source.moves,saved[1]!+margin),difficulty:profile.intro?'normal':source.difficulty,
  campaign:{...source.campaign!,beat:profile.intro?'introduction':source.campaign!.beat,lesson:profile.kind==='shelf'?'shelf-vase':profile.kind==='shade'?'awning-crank':'journey-vine'},
  strategy:{id:`garden-frontier/${frontierProfileKey(profile)}`,name,hint}};
}
