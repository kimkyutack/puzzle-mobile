import {COLORS,OBSTACLE_GARDEN_ENGINE_VERSION,type CampaignBeat,type Goal,type LevelDefinition,type Obstacle} from '@garden/contracts';
import {campaignPosition} from './campaign';

export const OBSTACLE_GARDEN_CONTENT_VERSION='garden-2026.11.16-obstacle-garden-v1';
const patterns=['lantern-grove','windmills','lantern-and-urn','relay-grove','lantern-vault','stone-grove'] as const;
export type ObstacleGardenPattern=typeof patterns[number];
export const obstacleGardenCopy:Record<ObstacleGardenPattern,readonly [string,string]>={
 'lantern-grove':['별빛 등불 정원','등불 옆에서 맞추거나 특수 블록을 맞혀요. 덮개가 깨져 별빛이 드러나면 한 번 더 타격하세요.'],
 windmills:['바람 정원','초록 주머니를 깨면 씨앗이 연결된 풍차로 날아가요. 주머니를 모두 찾아 풍차를 부수세요.'],
 'lantern-and-urn':['등불과 항아리 마당','등불은 별빛이 드러난 뒤 한 번 더 맞혀요. 항아리와 등불을 특수 블록으로 함께 공략해 보세요.'],
 'relay-grove':['별빛 바람길','등불을 깨서 길을 만들고, 주머니에서 날아가는 씨앗으로 풍차를 부수세요.'],
 'lantern-vault':['별빛 보관소','등불을 깨고 보관 상자 속 항아리와 수정도 부수세요. 수정에는 특수 블록을 직접 맞혀요.'],
 'stone-grove':['석상과 등불 정원','등불과 석상을 타격할 때마다 내구도가 줄어요. 특수 블록으로 여러 장애물을 한꺼번에 맞혀 보세요.'],
};

export function obstacleGardenSlot(id:number){
 if(!Number.isInteger(id)||id<227||id>20_000)return;
 const chapter=Math.floor((id-201)/100),position=(id-1)%100+1;
 const starts=[27,47,72];
 const group=starts.findIndex(start=>position>=start&&position<start+3);
 if(group<0)return;
 const variant=position-starts[group]!;
 const pattern=chapter===0?(group===1?'lantern-and-urn':'lantern-grove'):
  chapter===1?(group===1?'lantern-grove':'windmills'):
  chapter===2&&group===0?'relay-grove':patterns[(chapter+group*2)%patterns.length]!;
 const intro=group===0&&chapter<=2;
 const beat:CampaignBeat=intro?(variant===0?'introduction':'practice'):campaignPosition(id).beat;
 return {key:`${pattern}/${variant}`,beat};
}

export function obstacleGardenCandidate(key:string,seed:number):LevelDefinition{
 const [kind,index]=key.split('/'),pattern=kind as ObstacleGardenPattern,variant=Number(index),width=9,height=9;
 const at=(x:number,y:number)=>y*width+(variant===1?width-1-x:x);
 const shape=Array<boolean>(width*height).fill(true),obstacles:Obstacle[]=[];
 const add=(kind:Obstacle['kind'],footprint:number[],hp:number,extra:Pick<Obstacle,'contents'|'link'>={})=>{
  const anchor=footprint[0]!,id=`${kind}-${anchor}`;
  obstacles.push({id,kind,anchor,footprint,hp,maxHp:hp,...extra});
  return id;
 };
 const row=(y:number,xs:number[])=>xs.map(x=>at(x,y));
 const area=(x:number,y:number)=>[at(x,y),at(x+1,y),at(x,y+1),at(x+1,y+1)];
 const lanterns=(cells:number[])=>cells.forEach(at=>add('starlight-lantern',[at],3));
 const winds=(footprint:number[],sources:number[])=>{
  const link=add('windmill',footprint,sources.length);
  sources.forEach((at,i)=>add('wind-pod',[at],variant===2&&i%2===1?2:1,{link}));
 };
 for(const x of [0,8])for(const y of [0,8])shape[at(x,y)]=false;
 const banks=variant===2?[...row(4,[0,2,4,6,8]),...row(6,[1,2,4,6,7]),...row(7,[0,8])]:
  [...row(4,[0,1,3,5,7,8]),...row(6,[1,2,4,6,7]),...row(7,[4])];
 switch(pattern){
  case 'lantern-grove':lanterns(banks);break;
  case 'windmills':
   winds(area(6,6),variant===2?[...row(1,[1,3]),...row(3,[2,4]),...row(5,[1,3])]:
    [...row(2,[1,2,3]),...row(4,[0,2,3])]);
   winds(area(6,1),variant===2?[...row(2,[4,8]),...row(4,[5,7]),...row(7,[1,4])]:
    [...row(1,[4,8]),...row(3,[5,7]),...row(5,[5,8])]);
   break;
  case 'lantern-and-urn':
   lanterns(banks.slice(0,10));
   for(const cell of [...row(2,[0,2,6,8]),...row(7,[1,7])])add('urn',[cell],2+Number(variant===2));
   break;
  case 'relay-grove':
   lanterns(variant===2?[...row(3,[0,1,6,7]),...row(7,[1,2,3,4])]:[...row(2,[0,3,5,8]),...row(6,[0,1,3,5])]);
   winds(area(6,6),[...row(1,[2,6]),...row(4,[0,2,4,7])]);
   break;
  case 'lantern-vault':
   lanterns(banks.slice(0,8));
   for(const [i,cell]of [...row(1,[1,4,7]),...row(5,[0,3,5,8])].entries()){
    add('supply-crate',[cell],1+Number(variant===2),{contents:{kind:i%3===0?'crystal':'urn',hp:i%3===0?1:2}});
   }
   break;
  case 'stone-grove':
   lanterns(banks.slice(0,10));
   for(const cell of row(2,[0,2,6,8]))add('statue',[cell],variant===2?6:4);
   break;
 }
 const counts=new Map<Goal['kind'],number>();
 for(const o of obstacles){
  if(o.kind==='wind-pod')continue;
  const kind=o.contents?.kind??o.kind;
  counts.set(kind,(counts.get(kind)??0)+1);
 }
 const goals=[...counts].map(([kind,count])=>({kind,count,remaining:count}));
 const [name,hint]=obstacleGardenCopy[pattern];
 return {id:227,width,height,shape,colors:[...COLORS.slice(0,5)],moves:80,seed,obstacles,goals,
  engineVersion:OBSTACLE_GARDEN_ENGINE_VERSION,version:OBSTACLE_GARDEN_CONTENT_VERSION,difficulty:'normal',
  strategy:{id:`obstacle-garden/${key}`,name,hint}};
}
