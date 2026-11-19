import {
  COLORS, supportsContinuousRefill, supportsLayeredObstacles,
  type CampaignBeat, type Goal, type LevelDefinition, type Obstacle,
} from '@garden/contracts';
import {layeredObstacleCopy} from '../../contracts/src/layered-obstacle-copy';
import {campaignPosition} from './campaign';
import saved from './layered-campaign-recipes.json';

const version='garden-2026.11.17-layered-v1';
const strategyPrefix='layered-campaign/';
// Each pair stores the seed and turns in its verified clear.
const recipes:Readonly<Partial<Record<string,readonly number[][]>>>=saved;
const ordinaryKinds=new Set<Obstacle['kind']>([
  'crate','vine','cabinet','urn','statue','supply-crate','flower-seal',
  'starlight-lantern','wind-pod','windmill',
]);
const obstacleGoals=new Set<Goal['kind']>([...ordinaryKinds,'frost','seed']);

type Pattern=keyof typeof layeredObstacleCopy;
export type LayeredProfile={
  pattern:Pattern;
  tier:number;
  difficulty:LevelDefinition['difficulty'];
  layout:number;
  intro:boolean;
};

const rotation:readonly Pattern[]=['layers','cases','cabinet','layers','wind','cases','vault','layers','cabinet','wind','cases'];
const newLessons:readonly Pattern[]=[
  'layers','cases','cabinet','wind','layers','vault','cases','layers','wind',
  'cabinet','wind','cases','vault','cabinet','layers','wind','vault',
];
const tiers=[401,2001,6001,12001];
const difficultyIndex={normal:0,hard:1,super:2};
const boxLessons:Readonly<Partial<Record<number,Pattern>>>={201:'wind',401:'cabinet',501:'vault'};
const directObstacleBoard=new Set(['magnet-ends','magnet-crates','pipe-delivery','split-delivery','magnet-delivery','moss-race','carousel','carousel-crossing','moving-greenhouse']);

export function layeredCampaignProfile(source:LevelDefinition):LayeredProfile|undefined{
  if(source.gardenStage||source.tutorial||source.id<=3)return;
  const revised=supportsContinuousRefill(source.engineVersion);
  const offset=(source.id-1)%100,first=source.id-offset;
  const lesson=revised&&offset<3?boxLessons[first]:undefined;
  if(revised&&!lesson&&(directObstacleBoard.has(source.strategy?.id??'')||source.strategy?.id.startsWith('campaign-chapters/')))return;
  const specialChapter=!revised&&source.id>=4301&&source.id<=5903&&offset<3;
  const incompatible=source.devices?.length||source.gardenPuzzle||
    source.obstacles.some(obstacle=>!ordinaryKinds.has(obstacle.kind)||obstacle.cover||obstacle.color||
      obstacle.endOnly||obstacle.rule||obstacle.chapter||obstacle.contents?.kind==='crystal')||
    source.goals.some(goal=>!obstacleGoals.has(goal.kind));
  if(!lesson&&!specialChapter&&!incompatible)return;
  const chapter=Math.floor((source.id-1)/100);
  const tier=tiers.filter(first=>source.id>=first).length;
  const run=Math.floor(((source.id-1)%100)/5)*2+Number((source.id-1)%5>=3);
  const intro=revised?!!lesson&&offset===0:source.campaign?.beat==='introduction'||specialChapter&&source.id%100===1;
  let pattern=rotation[(chapter+run)%rotation.length]!;
  if(source.id<101)pattern=source.id<28?'layers':'cases';
  if(!revised&&(source.devices?.length||source.obstacles.some(obstacle=>obstacle.cover)))pattern='wind';
  if(revised&&(pattern==='wind'&&source.id<201||pattern==='cabinet'&&source.id<401||pattern==='vault'&&source.id<501))pattern='cases';
  if(lesson)pattern=lesson;
  if(specialChapter)pattern=newLessons[chapter-43]!;
  const layout=(chapter+run+source.id%2)%3;
  return {pattern,tier,layout,difficulty:source.difficulty,intro};
}

export function layeredProfileKey(profile:LayeredProfile):string{
  const {pattern,intro,tier,difficulty,layout}=profile;
  return intro?`intro/${pattern}`:`${pattern}/${tier}/${difficulty}/${layout}`;
}

function publishedProfile(profile:LayeredProfile,engineVersion:string):LayeredProfile{
 if(profile.intro||recipes[layeredProfileKey(profile)]||!supportsContinuousRefill(engineVersion))return profile;
 // The older rotation did not use every pressure/layout pair. Choose another
 // published layout for the same lesson and difficulty instead of serving a gap.
 const tierChoices=[0,1,2,3,4].sort((a,b)=>Math.abs(a-profile.tier)-Math.abs(b-profile.tier)||b-a);
 for(const tier of tierChoices)for(const distance of [0,2,1]){
  const candidate={...profile,tier,layout:(profile.layout+distance)%3};
  if(recipes[layeredProfileKey(candidate)]?.length)return candidate;
 }
 return profile;
}

function goalsFor(obstacles:Obstacle[]):Goal[]{
  const counts=new Map<Goal['kind'],number>();
  for(const obstacle of obstacles){
    if(obstacle.kind==='wind-pod')continue;
    const kind=obstacle.contents?.kind??obstacle.kind;
    const count=obstacle.contents?obstacle.footprint.length:1;
    counts.set(kind,(counts.get(kind)??0)+count);
  }
  return [...counts].map(([kind,count])=>({kind,count,remaining:count}));
}

export function layeredCampaignCandidate(profile:LayeredProfile,seed:number,engineVersion:string):LevelDefinition{
  const {pattern,intro,tier,difficulty}=profile;
  const layout=intro?0:profile.layout;
  const pressure=difficultyIndex[difficulty];
  const width=intro?7:9,height=intro?7:9;
  const at=(column:number,row:number)=>row*width+(layout===1?width-1-column:column);
  const shape=Array<boolean>(width*height).fill(true),obstacles:Obstacle[]=[];
  const occupied=new Set<number>();
  const add=(kind:Obstacle['kind'],footprint:number[],hp:number,extra:Partial<Obstacle>={}):string=>{
    const anchor=Math.min(...footprint),id=`layered-${anchor}`;
    obstacles.push({kind,hp,maxHp:hp,anchor,footprint,id,...extra});
    for(const cell of footprint)occupied.add(cell);
    return id;
  };
  const square=(x:number,y:number)=>[at(x,y),at(x+1,y),at(x,y+1),at(x+1,y+1)];

  if(pattern==='wind'){
    const sideBank=layout===2;
    const count=intro?1:Math.min(6,3+Number(sideBank)+pressure+Math.floor(tier/3));
    const walls=intro?[[0,3]]:[[0,3],[2,3],[0,5],[2,5],[0,7],[2,7]];
    const sources=[
      ...Array.from({length:height},(_,row)=>at(row%2===0?5:8,row)),
      ...[0,2,4,6,8,1,3,5,7].map(row=>at(row%2===0?7:6,row)),
    ];
    let nextSource=0;
    for(const [column,row] of walls.slice(0,count)){
      const hits=intro?2:2+Number(tier>=3&&pressure===2);
      const link=add('windmill',square(column!,row!),hits);
      for(let hit=0;hit<hits;hit++){
        const cell=intro?at(4+hit,hit===0?3:5):sources[nextSource++]!;
        add('wind-pod',[cell],intro?1:1+Number((hit+row!)%2===0||pressure===2),{link});
      }
    }
    if(sideBank){
      // A full bank opens as the remote windmills and the surrounding crates break.
      for(let y=0;y<height;y++)for(let x=0;x<4;x++){
        const cell=at(x,y);
        const layers=1+Number((x+y)%3===0&&(pressure>0||tier>=2));
        if(!occupied.has(cell))add('crate',[cell],layers);
      }
    }
  }else if(intro){
    if(pattern==='cabinet'||pattern==='vault'){
      add('supply-crate',square(3,4),1,{contents:{kind:'urn',hp:1,...(pattern==='vault'?{innerCrateHp:1}:{})}});
    }else for(const x of [1,3,5]){
      if(pattern==='layers')add('crate',[at(x,5)],x===3?2:1);
      else add('supply-crate',[at(x,5)],1,{contents:{kind:'urn',hp:1}});
    }
  }else{
    const count=12+tier*3+pressure*3;
    const bottom=Array.from({length:36},(_,i)=>at(i%width,height-1-Math.floor(i/width)));
    const flanks=Array.from({length:36},(_,i)=>at([0,8,1,7,2,6][i%6]!,height-1-Math.floor(i/6)));
    const bank=layout===0?bottom:flanks;
    if(layout===2){shape[at(0,0)]=false;shape[at(8,0)]=false;}
    if(pattern==='cabinet'||pattern==='vault'){
      const cabinets=layout===0?[[1,6],[5,6],[3,3]]:[[0,6],[7,6],[3,5]];
      const cabinetCount=pressure===0?1:pressure===1?2:3;
      for(const [column,row] of cabinets.slice(0,cabinetCount)){
        const contents={kind:'urn' as const,hp:1+Number(tier>=2),...(pattern==='vault'?{innerCrateHp:1+Number(tier>=3&&pressure>0)}:{})};
        add('supply-crate',square(column!,row!),2+Number(pressure>0)+Number(pressure===2&&tier>=3),{contents});
      }
    }
    const remaining=count-occupied.size;
    for(const [index,cell] of bank.filter(cell=>!occupied.has(cell)).slice(0,remaining).entries()){
      const layers=1+Number(index%3===0||tier>=2)+Number(pressure===2&&index%2===0||tier>=4&&index%3===0);
      if(pattern==='cases'&&index%3!==1)add('supply-crate',[cell],layers,{contents:{kind:'urn',hp:1+Number(tier>=2&&index%2===0)}});
      else if(index%5===2&&tier>0)add('starlight-lantern',[cell],Math.min(3,layers+1),{maxHp:3});
      else if(index%5===4)add('urn',[cell],Math.min(2,layers+1),{maxHp:2});
      else add('crate',[cell],layers);
    }
  }
  const colorCount=pattern==='wind'&&layout===2?4:5;
  return {id:1,version,engineVersion,width,height,colors:COLORS.slice(0,colorCount),shape,obstacles,
    goals:goalsFor(obstacles),moves:85,seed,difficulty};
}

export function layeredCampaignLevel(source:LevelDefinition):LevelDefinition{
  if(!supportsLayeredObstacles(source.engineVersion)||!source.approved)return source;
  const planned=layeredCampaignProfile(source);
  if(!planned)return source;
  const profile=publishedProfile(planned,source.engineVersion);
  const key=layeredProfileKey(profile),recipe=recipes[key];
  if(!recipe?.length)throw Error('LEVEL_CONTENT_PENDING');
  const seed=recipe[0]![0]!,steps=Math.max(...recipe.map(([,turns])=>turns!));
  const {intro,pattern,tier,difficulty}=profile;
  const [name,hint]=layeredObstacleCopy[pattern][0];
  const original=source.campaign??campaignPosition(source.id);
  const beat:CampaignBeat=intro?'introduction':original.beat==='practice'||
    supportsContinuousRefill(source.engineVersion)&&original.beat==='introduction'?'normal':original.beat;
  const margin=intro?8:7-2*difficultyIndex[difficulty];
  const moves=intro?Math.max(13,steps+margin):Math.max(source.moves,19+tier*2,steps+margin);
  return {...layeredCampaignCandidate(profile,seed,source.engineVersion),id:source.id,
    approved:true,campaign:{...original,beat,lesson:undefined},difficulty,moves,
    strategy:{id:strategyPrefix+key,name,hint}};
}

export function layeredCampaignOpening(level:LevelDefinition,entropy:number):LevelDefinition|undefined{
  const strategy=level.strategy?.id;
  if(!strategy?.startsWith(strategyPrefix))return;
  const recipe=recipes[strategy.slice(strategyPrefix.length)];
  if(!recipe?.length)return;
  return {...level,seed:recipe[(entropy>>>0)%recipe.length]![0]!};
}
