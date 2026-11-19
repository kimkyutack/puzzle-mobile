import {COLORS,supportsCampaignExpansion,type Goal,type LevelDefinition,type Obstacle,type Tile} from '@garden/contracts';
import {campaignDifficulty,campaignPosition} from './campaign';
import saved from './campaign-expansion-recipes.json';

const VERSION='garden-2026.11.16-expansion-v1';
const FIRST=3901,END=20_000;
const rules=['twin','pigment','directional','fuse'] as const;
type Rule=typeof rules[number];
type Profile={rule:Rule;band:number;layout:number;late:boolean;intro?:true};
const recipes:Readonly<Partial<Record<string,readonly number[]>>>=saved;
const bandStarts=[FIRST,6001,9001,12001,16001] as const;
const bankSizes=[16,19,22,25,28] as const;
const moveFloors=[25,26,27,28,30] as const;
export const expansionCopy:Record<Rule,readonly [name:string,hint:string]>={
 twin:['쌍울림 석판','같은 번호의 석판 두 장을 한 수에 맞혀요. 사이에서 세로 매치를 만들거나 로켓으로 한 줄을 타격하세요.'],
 pigment:['채색 항아리','항아리는 처음 맞힌 매치의 색을 기억해요. 다른 색을 옆에서 맞추거나 특수 블록으로 마저 깨세요.'],
 directional:['해바라기 방패','화살표가 가리키는 바로 옆에서 매치하거나 특수 블록으로 맞혀요. 맞으면 열린 방향이 바뀔 수 있어요.'],
 fuse:['꽃가루 도화선','한 번 맞으면 불이 붙어요. 두 수 뒤 주변과 함께 터져요. 다시 맞히면 바로 터져요.'],
};
const key=({rule,band,layout,late,intro}:Profile)=>intro?`intro/${rule}`:`${rule}/${band}/${layout}/${Number(late)}`;

function slot(id:number):Profile|undefined{
 if(id<FIRST||id>END)return;
 const chapter=Math.floor((id-FIRST)/100),offset=(id-FIRST)%100;
 const band=bandStarts.filter(start=>id>=start).length-1;
 const lesson=rules[chapter];
 const returning=offset>=10&&offset<=12||offset>=51&&offset<=53;
 if(!(lesson&&offset<3)&&!returning)return;
 const rule=lesson??rules[(chapter+(offset>=51?1:0))%rules.length]!;
 return {rule,band,layout:(chapter+offset)%2,late:offset>=51,...(lesson&&offset===0?{intro:true}:{})};
}

export function expansionProfiles(){
 const profiles=new Map<string,Profile>();
 for(let id=FIRST;id<=END;id++){
  const profile=slot(id);
  if(profile)profiles.set(key(profile),profile);
 }
 return profiles;
}

function teachingBoard(rule:Rule,seed:number,engineVersion:string):LevelDefinition{
 const bottom={twin:'.a.H.a.',pigment:'.a.a.a.',directional:'basagal',fuse:'.acaca.'};
 const rows=['blgrsbr','rslbrgl','lgbsgsb','srrlrbg',bottom[rule]];
 const width=rows[0]!.length,height=rows.length,colors=[...COLORS.slice(0,5)],obstacles:Obstacle[]=[];
 const palette={r:colors[0]!,b:colors[1]!,s:colors[2]!,g:colors[3]!,l:colors[4]!};
 const initial=Array.from(rows.join(''),(glyph,at):Tile|null=>{
  if(glyph==='a'){obstacles.push(rulePiece(rule,at,rule==='twin'?1:undefined));return null;}
  if(glyph==='c'){obstacles.push({id:`expansion-${at}`,kind:'crate',hp:1,maxHp:1,anchor:at,footprint:[at]});return null;}
  if(glyph==='H')return {kind:'wind-row',id:at+1};
  return glyph==='.'?null:{kind:'normal',id:at+1,color:palette[glyph as keyof typeof palette]};
 });
 return {id:FIRST,width,height,colors,initial,shape:Array.from(rows.join(''),glyph=>glyph!=='.'),obstacles,goals:obstacleGoals(obstacles),
  seed,engineVersion,version:VERSION,moves:36,difficulty:'normal'};
}

function rulePiece(rule:Rule,at:number,pair?:number):Obstacle{
 const urn=rule==='pigment'||rule==='fuse';
 const hp=rule==='twin'?1:2;
 return {id:`expansion-${at}`,kind:urn?'urn':'flower-seal',hp,maxHp:hp,anchor:at,footprint:[at],rule,
  ...(rule==='twin'?{pair}:{}),...(rule==='directional'?{strikeSide:'up' as const}:{})};
}

function obstacleGoals(obstacles:readonly Obstacle[]):Goal[]{
 const counts=new Map<Goal['kind'],number>();
 for(const obstacle of obstacles){
  const target=obstacle.contents?.kind??obstacle.kind;
  counts.set(target,1+(counts.get(target)??0));
 }
 return [...counts].map(([kind,count])=>({kind,count,remaining:count}));
}

export function expansionCandidate(profile:Profile,seed:number,engineVersion:string):LevelDefinition{
 const {intro,rule,band,layout,late}=profile;
 if(intro)return teachingBoard(rule,seed,engineVersion);
 const width=9,height=9,colors=[...COLORS.slice(0,5)],shape=Array<boolean>(width*height).fill(true);
 if(layout===1){shape[0]=false;shape[8]=false;}
 const count=bankSizes[band]!+(late?3:0),obstacles:Obstacle[]=[];
 const at=(x:number,y:number)=>y*width+x;
 const lower=Array.from({length:45},(_,index)=>at(index%width,height-1-Math.floor(index/width)));
 const sides=Array.from({length:36},(_,index)=>at([0,8,1,7,2,6][index%6]!,height-1-Math.floor(index/6)));
 let bank=(layout===0?lower:sides).slice(0,count);
 if(rule==='twin'){
  // Keep the two middle columns of each flank open for a natural match
  // between the plates. On the other layout, neighboring pairs share rockets.
  const rows=layout===0?[5,8]:[4,7],shared=new Set([2,6]);
  if(band>=3&&late)rows.push(6);
  for(const y of rows){
   for(const x of [1,5]){
    const pair=obstacles.length/2+1;
    obstacles.push(rulePiece(rule,at(x,y),pair),rulePiece(rule,at(x+2,y),pair));
   }
  }
  const reserved=new Set(obstacles.map(obstacle=>obstacle.anchor));
  bank=lower.filter(cell=>!reserved.has(cell)&&!shared.has(cell%width)).slice(0,count-obstacles.length);
 }
 for(const [index,cell] of bank.entries()){
  const outer=index>=count-9;
  const isTarget=rule!=='twin'&&(outer&&index%2===0||index%6===0);
  if(isTarget){obstacles.push(rulePiece(rule,cell));continue;}
  const tough=band>=2?index%3!==2:index%3===0;
  const hp=tough?2:1,kind=late&&index%4===0?'supply-crate':'crate';
  obstacles.push({id:`expansion-${cell}`,kind,hp,maxHp:hp,anchor:cell,footprint:[cell],
   ...(kind==='supply-crate'?{contents:{kind:'urn' as const,hp:band>=2?2:1}}:{})});
 }
 return {id:FIRST,width,height,colors,shape,obstacles,goals:obstacleGoals(obstacles),seed,engineVersion,version:VERSION,moves:64,difficulty:'normal'};
}

export function expandedCampaignLevel(base:LevelDefinition):LevelDefinition{
 if(!supportsCampaignExpansion(base.engineVersion)||!base.approved||base.tutorial||base.gardenStage)return base;
 const profile=slot(base.id);
 if(!profile)return base;
 const recipe=recipes[key(profile)];
 if(!recipe||recipe.length!==2)throw Error('LEVEL_CONTENT_PENDING');
 const [seed,proofMoves]=recipe;
 const lesson=profile.intro;
 const typical=campaignPosition(base.id);
 const beat=lesson?'introduction':base.id%100<=3?'normal':typical.beat==='hard'||typical.beat==='super'?typical.beat:'normal';
 const moves=lesson?Math.max(12,proofMoves+6):Math.max(base.moves,moveFloors[profile.band]!,proofMoves+(beat==='hard'||beat==='super'?5:7));
 const [name,hint]=expansionCopy[profile.rule];
 return {...expansionCandidate(profile,seed!,base.engineVersion),id:base.id,approved:true,moves,
  difficulty:campaignDifficulty(beat),campaign:{...typical,beat},strategy:{id:`campaign-expansion/${key(profile)}`,name,hint}};
}
