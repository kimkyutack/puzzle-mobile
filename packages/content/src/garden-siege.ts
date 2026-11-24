import {COLORS,supportsGardenSiege,type LevelDefinition,type Obstacle} from '@garden/contracts';
import type {GardenSiegeObstacle} from '../../contracts/src/garden-siege';
import saved from './garden-siege-recipes.json';
const kinds=['roller','beacon','bloom'] as const;
const introductions={roller:801,beacon:901,bloom:1001};
export interface SiegeProfile {kind:typeof kinds[number];tier:number;mirror:boolean;intro:boolean}
const recipes:Readonly<Partial<Record<string,readonly number[]>>>=saved;
export const siegeCopy:Record<typeof kinds[number],readonly [string,string]>={
 roller:['정원 롤러 공성전','고정핀 옆에서 3개 이상 맞추거나 아이템으로 핀을 깨세요. 핀이 풀릴 때마다 롤러가 가시 장벽 구역을 한 겹씩 쓸고 지나가요.'],
 beacon:['대형 정원등 충전소','이슬 캡슐을 깨서 정원등의 유리 구슬을 모두 채우세요. 열린 정원등을 추가 타격하면 충격파가 보호막 가시 장벽 전체를 한 겹씩 벗겨요.'],
 bloom:['줄줄이 개화하는 온실','유리 덮개가 열린 꽃봉오리 옆에서 3개 이상 맞추거나 아이템으로 타격하세요. 꽃이 피면 다음 꽃의 덮개가 열려요.'],
};
export function gardenSiegeSlot(id:number):SiegeProfile|undefined{
 if(id<801||id>20000)return;
 const offset=(id-1)%100,chapter=Math.floor((id-1)/100)*100+1;
 const lesson=kinds.find(kind=>introductions[kind]===chapter);
 const run=Math.floor(offset/15),position=offset%15;
 const kind=lesson&&offset<3?lesson:position>=11&&position<=13?kinds[run%3]:undefined;
 if(!kind||id<introductions[kind])return;
 return {kind,tier:[801,2001,6001,12001].filter(first=>id>=first).length-1,mirror:run%2===1,intro:!!lesson&&offset===0};
}
export const siegeProfileKey=(p:SiegeProfile)=>p.intro?`intro/${p.kind}`:`${p.kind}/${p.tier}/${Number(p.mirror)}`;
export function gardenSiegeProfiles():SiegeProfile[]{
 const profiles=new Map<string,SiegeProfile>();
 for(let id=801;id<=20000;id++){const p=gardenSiegeSlot(id);if(p)profiles.set(siegeProfileKey(p),p);}
 return [...profiles.values()];
}
export function gardenSiegeCandidate(profile:SiegeProfile,seed:number,engineVersion:string):LevelDefinition{
 const {kind,tier,mirror,intro}=profile,width=9,height=9;
 const shape=Array<boolean>(81).fill(true),obstacles:Obstacle[]=[],bank:number[]=[];
 const at=(x:number,y:number)=>y*9+(mirror?8-x:x);
 const square=(x:number,y:number)=>[at(x,y),at(x+1,y),at(x,y+1),at(x+1,y+1)];
 const add=(kind:GardenSiegeObstacle,cells:number[],hp:number,extra:Partial<Obstacle>={})=>{
  const id=`siege-${kind}-${Math.min(...cells)}`;
  obstacles.push({id,kind,anchor:Math.min(...cells),footprint:cells,hp,maxHp:hp,...extra});return id;
 };
 const sources=[...Array.from({length:9},(_,y)=>at(8,y)),...[2,5,8].map(y=>at(7,y))];
 const layers=intro?1:tier>=2?3:2;
 if(kind!=='bloom'){
  for(let y=1;y<9;y++)for(let x=0;x<3;x++){
   add('thorn-barricade',[at(x,y)],kind==='beacon'?3:layers,kind==='beacon'?{siege:{guard:'beacon'}}:{});bank.push(at(x,y));
  }
 }
 if(kind==='roller'){
  let source=0;
  for(let row=1;row<9;row+=2){
   const footprint=square(3,row),path=[2,1,0].flatMap(x=>[at(x,row),at(x,row+1)]);
   const link=add('garden-roller',footprint,layers,{path});bank.push(...footprint);
   for(let n=0;n<layers;n++)add('roller-pin',[sources[source++]!],intro?1:2+Number(tier>=3),{link});
  }
 }else if(kind==='beacon'){
  const capacity=4;let source=0;
  for(const row of [1,4,7]){
   const footprint=square(3,row),link=add('garden-beacon',footprint,intro?1:tier>=1?3:2,{charge:0,siege:{capacity}});bank.push(...footprint);
   for(let n=0;n<capacity;n++)add('dew-cache',[sources[source++]!],intro?1:2+Number(tier>=3),{link});
  }
 }else{
  for(let row=1;row<9;row+=2){
   const path=[at(2,row),at(1,row),at(0,row),at(0,row+1),at(1,row+1),at(2,row+1)];
   for(const [index,cell]of path.entries()){
    const next=path[index+1];
    add('bloom-bud',[cell],intro?1:layers,{...(next!==undefined?{link:`siege-bloom-bud-${next}`} :{}),...(index>0?{siege:{shielded:true}}:{})});
   }
  }
 }
 const target=kind==='bloom'?'bloom-bud':'thorn-barricade';
 return {id:801,version:'garden-2026.11.20-siege-v1',engineVersion,width,height,shape,colors:[...COLORS.slice(0,5)],seed,moves:80,difficulty:'normal',
  obstacles,goals:[{kind:target,count:24,remaining:24}],siege:{kind,bank}};
}
export function gardenSiegeLevel(source:LevelDefinition):LevelDefinition{
 const profile=gardenSiegeSlot(source.id);
 if(!profile||!supportsGardenSiege(source.engineVersion)||source.gardenStage||source.gardenPuzzle||source.devices?.length||source.tutorial||source.strategy?.id.startsWith('chain-campaign/')||source.strategy?.id.startsWith('split-wind/'))return source;
 const recipe=recipes[siegeProfileKey(profile)];if(!recipe)throw Error('LEVEL_CONTENT_PENDING');
 const board=gardenSiegeCandidate(profile,recipe[0]!,source.engineVersion),[name,hint]=siegeCopy[profile.kind];
 const margin=profile.intro?10:source.difficulty==='super'?3:source.difficulty==='hard'?5:7;
 return {...board,id:source.id,approved:true,moves:Math.max(profile.intro?24:source.moves,recipe[1]!+margin),difficulty:profile.intro?'normal':source.difficulty,
  campaign:{...source.campaign!,beat:profile.intro?'introduction':source.campaign!.beat,lesson:profile.kind==='roller'?'garden-roller':profile.kind==='beacon'?'garden-beacon':'bloom-bud'},
  strategy:{id:`garden-siege/${siegeProfileKey(profile)}`,name,hint}};
}
