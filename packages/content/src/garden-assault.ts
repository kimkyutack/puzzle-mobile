import {COLORS,supportsGardenAssault,type LevelDefinition,type Obstacle} from '@garden/contracts';
import type {GardenAssaultKind,GardenAssaultObstacle} from '../../contracts/src/garden-assault';
import recipes from './garden-assault-recipes.json';
export interface AssaultProfile {kind:GardenAssaultKind;tier:number;mirror:boolean;intro:boolean}
const introductions={dandelion:1101,pottery:1201} as const;
const copy:Record<GardenAssaultKind,readonly [string,string]>={
 dandelion:['민들레 연발 공성전','민들레 발사대 옆에서 3개 이상 맞추거나 아이템으로 타격하세요. 타격할 때마다 씨앗이 날아가 반대편 꽃고치의 실을 한 겹씩 벗겨요.'],
 pottery:['겹항아리 공방','유리 덮개 옆에서 3개 이상 맞추거나 아이템으로 타격하세요. 덮개가 깨지면 안에 보이던 꽃항아리 네 개를 각각 깨서 수집해요.'],
};
export function gardenAssaultSlot(id:number):AssaultProfile|undefined{
 if(id<1101||id>20000)return;
 const offset=(id-1)%100,chapter=id-offset,run=Math.floor(offset/15),position=offset%15;
 const lesson=(Object.keys(introductions) as GardenAssaultKind[]).find(kind=>introductions[kind]===chapter);
 const kind=lesson&&offset<3?lesson:position>=4&&position<=6?run%2===0?'dandelion':'pottery':undefined;
 if(!kind||id<introductions[kind])return;
 return {kind,tier:[1101,2001,6001,12001].filter(first=>id>=first).length-1,mirror:Math.floor(run/2)%2===1,intro:!!lesson&&offset===0};
}
export const assaultProfileKey=(p:AssaultProfile)=>p.intro?`intro/${p.kind}`:`${p.kind}/${p.tier}/${Number(p.mirror)}`;
export function gardenAssaultProfiles():AssaultProfile[]{
 const profiles=new Map<string,AssaultProfile>();
 for(let id=1101;id<=20000;id++){const p=gardenAssaultSlot(id);if(p)profiles.set(assaultProfileKey(p),p);}
 return [...profiles.values()];
}
export function gardenAssaultCandidate(profile:AssaultProfile,seed:number,engineVersion:string):LevelDefinition{
 const {kind,tier,mirror,intro}=profile,width=9,height=9,shape=Array<boolean>(81).fill(true),obstacles:Obstacle[]=[],bank:number[]=[];
 const at=(x:number,y:number)=>y*width+(mirror?8-x:x);
 const add=(kind:GardenAssaultObstacle,cells:number[],hp:number,extra:Partial<Obstacle>={})=>{
  obstacles.push({id:`assault-${kind}-${Math.min(...cells)}`,kind,anchor:Math.min(...cells),footprint:cells,hp,maxHp:hp,...extra});
 };
 const layers=intro?1:tier>=2?3:2;
 if(kind==='dandelion'){
  for(let y=1;y<9;y++)for(let x=0;x<3;x++){const cell=at(x,y);add('seed-cocoon',[cell],layers);bank.push(cell);}
  const sources=[...Array.from({length:9},(_,y)=>at(8,y)),...[2,5,8].map(y=>at(7,y))];
  for(const cell of sources)add('dandelion-turret',[cell],layers*2);
 }else{
  for(let y=1;y<9;y+=2)for(let x=0;x<4;x+=2){
   add('pottery-nest',[at(x,y),at(x+1,y),at(x,y+1),at(x+1,y+1)],intro?1:tier>=3?3:2,{contents:{kind:'ceramic-pot',hp:layers}});
  }
 }
 const target=kind==='dandelion'?'seed-cocoon':'ceramic-pot',count=kind==='dandelion'?24:32;
 return {id:1101,version:'garden-2026.11.20-assault-v1',engineVersion,width,height,shape,colors:[...COLORS.slice(0,5)],seed,moves:90,difficulty:'normal',
  obstacles,goals:[{kind:target,count,remaining:count}],siege:{kind,bank}};
}
export function gardenAssaultLevel(source:LevelDefinition):LevelDefinition{
 const profile=gardenAssaultSlot(source.id);
 if(!profile||!supportsGardenAssault(source.engineVersion)||source.siege||source.gardenStage||source.gardenPuzzle||source.devices?.length||source.tutorial||source.strategy?.id.startsWith('chain-campaign/')||source.strategy?.id.startsWith('split-wind/'))return source;
 const saved=(recipes as Partial<Record<string,readonly number[]>>)[assaultProfileKey(profile)];if(!saved)throw Error('LEVEL_CONTENT_PENDING');
 const [name,hint]=copy[profile.kind],margin=profile.intro?10:source.difficulty==='super'?3:source.difficulty==='hard'?5:7;
 return {...gardenAssaultCandidate(profile,saved[0]!,source.engineVersion),id:source.id,approved:true,moves:Math.max(profile.intro?24:source.moves,saved[1]!+margin),difficulty:profile.intro?'normal':source.difficulty,
  campaign:{...source.campaign!,beat:profile.intro?'introduction':source.campaign!.beat,lesson:profile.kind==='dandelion'?'dandelion-turret':'pottery-nest'},
  strategy:{id:`garden-assault/${assaultProfileKey(profile)}`,name,hint}};
}
