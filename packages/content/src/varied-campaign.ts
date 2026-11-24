import {COLORS,supportsVariedObstacles,type CampaignBeat,type Goal,type LevelDefinition,type Obstacle} from '@garden/contracts';
import {type VariedObstacleKind} from '../../contracts/src/varied-obstacles';
import saved from './varied-campaign-recipes.json';

const families=['tea-caddy','honeycomb','acorn-nest','cloud-pillow','petal-launcher','mushroom-cluster','crystal-geode'] as const;
export type VariedFamily=typeof families[number];
export interface VariedProfile {family:VariedFamily;tier:number;layout:number;intro:boolean}
const recipes:Readonly<Partial<Record<string,readonly number[]>>>=saved;
const bands=[101,401,2001,6001,12001];
export const variedCampaignCopy:Record<VariedFamily,readonly [string,string]>={
 'tea-caddy':['꽃차 정원','찻통 옆에서 3개 이상 맞추거나 아이템으로 타격하세요. 뚜껑이 열리고 금이 커지면 한 번 더 깨세요.'],
 honeycomb:['황금 밀랍 마당','여러 겹의 밀랍을 벗겨 황금 밀랍집을 하나씩 깨세요. 매치와 모든 공격 아이템으로 타격할 수 있어요.'],
 'acorn-nest':['도토리 둥지 숲','덩굴을 벗겨 둥지를 깨면 꿀벌집이 나와요. 나온 꿀벌집으로 남은 둥지를 공략하세요.'],
 'cloud-pillow':['별구름 공방','리본을 풀고 쿠션을 깨면 잠자리가 나와요. 잠자리를 날려 남은 장애물을 깨세요.'],
 'petal-launcher':['꽃잎 공성전','발사기 옆에서 3개 이상 맞추거나 아이템으로 타격하세요. 맞을 때마다 꽃잎 원반이 연결된 태양문으로 날아가 빗장을 부숴요.'],
 'mushroom-cluster':['통통 버섯밭','버섯을 깨면 주위 8칸을 한 번씩 타격해요. 빽빽한 버섯밭에 연쇄 타격을 일으키세요.'],
 'crystal-geode':['별수정 채석장','원석을 깨면 안쪽 별수정이 드러나요. 드러난 별수정도 매치와 아이템으로 깨세요.'],
};
export function variedCampaignProfile(id:number):VariedProfile{
 const chapter=Math.floor((id-1)/100),offset=(id-1)%100;
 const available=Math.min(chapter,families.length),run=Math.floor(offset/5)*2+Number(offset%5>=3);
 const index=offset<3?(chapter-1)%families.length:(chapter-1+run)%available;
 return {family:families[index]!,tier:bands.filter(first=>id>=first).length-1,layout:Math.floor(offset/3)%3,intro:offset===0&&chapter<=families.length};
}
export const variedProfileKey=(p:VariedProfile)=>p.intro?`intro/${p.family}`:`${p.family}/${p.tier}/${p.layout}`;
export function variedProfiles():VariedProfile[]{
 return [...new Map(Array.from({length:19900},(_,i)=>variedCampaignProfile(101+i)).map(p=>[variedProfileKey(p),p])).values()];
}
export function variedCampaignCandidate(profile:VariedProfile,seed:number,engineVersion:string):LevelDefinition{
 const {family,tier,intro,layout}=profile,width=9,height=9;
 const obstacles:Obstacle[]=[],shape=Array<boolean>(81).fill(true);
 const at=(x:number,y:number)=>y*width+(layout===1?8-x:x);
 const add=(kind:VariedObstacleKind,cells:number[],hp:number,extra:Partial<Obstacle>={})=>{
  const anchor=Math.min(...cells),id=`varied-${kind}-${anchor}`;
  obstacles.push({id,kind,anchor,footprint:cells,hp,maxHp:hp,...extra});return id;
 };
 if(family==='petal-launcher'){
  const count=intro?1:Math.min(6,3+Math.floor(tier/2));
  const positions=[[0,3],[2,3],[0,5],[2,5],[0,7],[2,7]] as const;
  const sources=Array.from({length:18},(_,i)=>at(i%2===0?6:8,Math.floor(i/2)));
  for(const [index,[x,y]] of positions.slice(0,count).entries()){
   const hits=intro?2:2+Number(tier>=3);
   const link=add('sun-gate',[at(x,y),at(x+1,y),at(x,y+1),at(x+1,y+1)],hits*2);
   for(let i=0;i<2;i++)add('petal-launcher',[intro?at(6+i*2,5):sources[index*2+i]!],hits,{link});
  }
  // Fill the target bank; the entire left half must visibly open as the volley lands.
  if(!intro){const used=new Set(obstacles.flatMap(o=>o.footprint));
   for(let y=3;y<9;y++)for(let x=0;x<4;x++)if(!used.has(at(x,y)))add('honeycomb',[at(x,y)],1+Number(tier>=2));
  }
 }else{
  const count=intro?6:15+tier*3;
  const bottom=Array.from({length:36},(_,i)=>at(i%9,8-Math.floor(i/9)));
  const sides=Array.from({length:36},(_,i)=>at([0,8,1,7,2,6][i%6]!,8-Math.floor(i/6)));
  // Bottom-supported central towers leave both side inlets open. Filling a
  // whole raised row would strand open cells underneath the obstacle bank.
  const shelf=Array.from({length:48},(_,i)=>at([2,3,4,5,6,1,7,0][Math.floor(i/6)]!,8-i%6));
  const bank=intro?[at(0,7),at(1,7),at(2,7),at(6,7),at(7,7),at(8,7)]:[bottom,sides,shelf][layout]!;
  for(const [index,cell] of bank.slice(0,count).entries()){
   const hp=intro?(index===0?3:index===3?2:1):Math.min(3,1+Number(index%3===0||tier>=1)+Number(tier>=3&&index%2===0));
   add(family,[cell],hp,family==='crystal-geode'?{contents:{kind:'star-core',hp:intro?1:1+Number(tier>=2)}}:{});
  }
 }
 const counts=new Map<Goal['kind'],number>();
 for(const obstacle of obstacles){
  if(obstacle.kind==='petal-launcher')continue;
  const kind=obstacle.contents?.kind??obstacle.kind;counts.set(kind,(counts.get(kind)??0)+1);
 }
 return {id:101,version:'garden-2026.11.20-varied-v1',engineVersion,width,height,colors:[...COLORS.slice(0,5)],
  shape,obstacles,goals:[...counts].map(([kind,count])=>({kind,count,remaining:count})),seed,moves:65,difficulty:'normal'};
}
/** Last publisher pass: later legacy box normalizers must not erase this catalogue. */
export function variedCampaignLevel(source:LevelDefinition):LevelDefinition{
 if(!supportsVariedObstacles(source.engineVersion)||source.id<101||source.id>20000||source.tutorial||source.gardenStage||source.gardenPuzzle||source.devices?.length)return source;
 if(source.strategy?.id.startsWith('chain-campaign/')||source.strategy?.id.startsWith('split-wind/'))return source;
 const profile=variedCampaignProfile(source.id),offset=(source.id-1)%100;
 if(offset>=3&&source.strategy?.id.startsWith('campaign-chapters/'))return source;
 // Keep route, frost, seed and other existing mechanics between dense obstacle runs.
 const plain=source.goals.every(g=>['crate','urn','supply-crate','statue','flower-seal','starlight-lantern','windmill'].includes(g.kind));
 if(!plain&&offset>=3)return source;
 const recipe=recipes[variedProfileKey(profile)];if(!recipe)throw Error('LEVEL_CONTENT_PENDING');
 const seed=recipe[0]!,proof=recipe[1]!,board=variedCampaignCandidate(profile,seed,source.engineVersion);
 const beat:CampaignBeat=profile.intro?'introduction':source.difficulty==='super'?'super':source.difficulty==='hard'?'hard':'normal';
 const margin=profile.intro?10:beat==='super'?3:beat==='hard'?5:7;
 const [name,hint]=variedCampaignCopy[profile.family];
 return {...board,id:source.id,approved:true,moves:profile.intro?Math.max(18,proof+margin):Math.max(23,proof+margin),
  difficulty:profile.intro?'normal':source.difficulty,campaign:{...source.campaign!,beat,lesson:profile.family},
  strategy:{id:`varied-campaign/${variedProfileKey(profile)}`,name,hint}};
}
