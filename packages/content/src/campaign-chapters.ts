import {COLORS,supportsChapterObstacles,supportsContinuousRefill,type Goal,type LevelDefinition,type Obstacle,type Special,type Tile} from '@garden/contracts';
import {createGame} from '@garden/core';
import {CHAPTER_OBSTACLES,type ChapterObstacleKind} from '../../contracts/src/chapter-obstacles';
import {chapterCopy} from '../../contracts/src/chapter-copy';
import {campaignDifficulty,campaignPosition} from './campaign';
import saved from './campaign-chapter-recipes.json';

const FIRST=4301,LAST=6000;
const VERSION='garden-2026.11.16-chapters-v1';
type Profile={kind:ChapterObstacleKind;layout:0|1;advanced:boolean;intro?:true};
const recipes:Readonly<Partial<Record<string,readonly number[]>>>=saved;
const key=(profile:Profile)=>profile.intro?`intro/${profile.kind}`:`${profile.kind}/${profile.layout}/${Number(profile.advanced)}`;
const directLessons=['guard','thaw','slide','compost','color-wave','relay'] as const;
const firstDirectLesson=601;

function directChapterSlot(id:number):Profile|undefined{
 const chapter=Math.floor((id-firstDirectLesson)/100),offset=(id-1)%100;
 if(chapter<0)return;
 const opens=offset<3,returning=offset>=21&&offset<24||offset>=61&&offset<64;
 if(!opens&&!returning)return;
 const lesson=opens&&chapter<directLessons.length;
 const available=Math.min(chapter+1,directLessons.length);
 const index=lesson?chapter:(chapter+Math.floor(offset/20))%available;
 return {kind:directLessons[index]!,advanced:id>=2001,layout:(id-1)%2===0?0:1,
  ...(lesson&&offset===0?{intro:true}:{})};
}

function chapterSlot(id:number):Profile|undefined{
 if(id<FIRST||id>LAST)return;
 const chapterIndex=Math.floor((id-FIRST)/100),offset=(id-FIRST)%100;
 const primary=CHAPTER_OBSTACLES[chapterIndex]!;
 const returning=offset>=31&&offset<=33||offset>=71&&offset<=73;
 const advanced=offset>=51;
 const inRun=offset<3||offset>=10&&offset<=12||offset>=51&&offset<=53||offset>=91&&offset<=93;
 if(!inRun&&!returning)return;
 const earlier=offset>=71?Math.max(0,chapterIndex-4):Math.max(0,chapterIndex-1);
 return {kind:returning?CHAPTER_OBSTACLES[earlier]!:primary,layout:(chapterIndex+offset)%2===0?0:1,advanced,
  ...(offset===0?{intro:true}:{})};
}

export function campaignChapterProfiles():Map<string,Profile>{
 const profiles=new Map<string,Profile>();
 for(let id=FIRST;id<=LAST;id++){
  const profile=chapterSlot(id);
  if(profile)profiles.set(key(profile),profile);
 }
 return profiles;
}

function chapterPiece(kind:ChapterObstacleKind,at:number,ordinal:number):Obstacle{
 const layers=['axis','cooldown','window','slide'].includes(kind)?2:1;
 const urn=['cooldown','window','slide','compost','color-wave'].includes(kind);
 return {id:`chapter-${at}`,kind:urn?'urn':kind==='relay'?'starlight-lantern':'flower-seal',hp:layers,
  maxHp:kind==='relay'?3:layers,anchor:at,footprint:[at],
  chapter:kind==='axis'?{kind,axis:ordinal%2===0?'row':'column'}:kind==='slide'?{kind,side:ordinal%2===0?'right':'left'}:{kind}};
}

function crate(at:number,hp=1):Obstacle{
 return {id:`chapter-${at}`,kind:'crate',hp,maxHp:hp,anchor:at,footprint:[at]};
}

function chapterGoals(obstacles:Obstacle[],frost:Record<number,number>):Goal[]{
 const counts=new Map<Goal['kind'],number>();
 for(const obstacle of obstacles)counts.set(obstacle.kind,1+(counts.get(obstacle.kind)??0));
 const ice=Object.values(frost).reduce((total,layer)=>total+layer,0);
 if(ice)counts.set('frost',ice);
 return [...counts].map(([kind,count])=>({kind,count,remaining:count}));
}

function tutorialBoard(kind:ChapterObstacleKind,seed:number,engineVersion:string):LevelDefinition{
 const rows=['blgrsbr','rslbrgl','lgbsgsb','srrlrbg','.a.a.a.'];
 if(kind==='long-match'){
  rows[2]='lgbrgsb';
  rows[3]='srrbrbg';
 }else if(kind==='cascade'||kind==='two-colors'){
  rows[2]='lbbsgsb';
  rows[3]='brrlrbg';
 }else if(kind==='junction'){
  rows[0]='blgbsbr';
  rows[1]='rslrrgl';
  rows[2]='lgbrgsb';
 }else if(kind==='fusion'){
  rows[3]='sr**rbg';
 }else if(kind==='guard'){
  rows[4]='.aca.a.';
 }else if(kind==='slide'){
  rows[4]='basagal';
 }else if(kind==='diagonal'||kind==='swap'){
  rows[4]='..a.a..';
 }
 const width=7,height=rows.length,colors=[...COLORS.slice(0,5)],obstacles:Obstacle[]=[];
 const palette={r:colors[0]!,b:colors[1]!,s:colors[2]!,g:colors[3]!,l:colors[4]!};
 const initial=Array.from(rows.join(''),(glyph,at):Tile|null=>{
  if(glyph==='a'){obstacles.push(chapterPiece(kind,at,obstacles.length));return null;}
  if(glyph==='c'){obstacles.push(crate(at));return null;}
  if(glyph==='*')return {kind:'bomb',id:at+1};
  return glyph==='.'?null:{kind:'normal',color:palette[glyph as keyof typeof palette],id:at+1};
 });
 const frost=kind==='thaw'?Object.fromEntries(obstacles.map(obstacle=>[obstacle.anchor-width,1])):{};
 const shape=Array.from(rows.join(''),glyph=>glyph!=='.');
 return {id:FIRST,version:VERSION,engineVersion,width,height,colors,shape,initial,seed,obstacles,goals:chapterGoals(obstacles,frost),frost,moves:40,difficulty:'normal'};
}

function seedFusionPairs(level:LevelDefinition):LevelDefinition{
 const initial=createGame(level).cells.map(cell=>cell.tile);
 const placements:readonly [row:number,column:number,kind:Special][]=[[4,3,'wind-row'],[4,4,'wind-column'],[5,4,'bomb'],[5,5,'bomb']];
 for(const [row,column,kind] of placements){
  const at=row*level.width+column,tile=initial[at];
  if(tile?.kind!=='normal')throw Error('CAMPAIGN_FUSION_LAYOUT');
  initial[at]={kind,id:tile.id};
 }
 return {...level,initial};
}

export function campaignChapterCandidate(profile:Profile,seed:number,engineVersion:string):LevelDefinition{
 const {kind,layout,advanced}=profile;
 if(profile.intro)return tutorialBoard(kind,seed,engineVersion);
 const width=9,height=9,colors=[...COLORS.slice(0,5)],shape=Array<boolean>(width*height).fill(true);
 if(layout){shape[0]=false;shape[8]=false;}
 const group=Math.floor(CHAPTER_OBSTACLES.indexOf(kind)/5);
 const count=16+group+(advanced?3:0);
 const rows=Array.from({length:36},(_,index)=>72-Math.floor(index/9)*9+index%9);
 const flanks=Array.from({length:36},(_,index)=>(8-Math.floor(index/6))*width+[0,8,1,7,2,6][index%6]!);
 const frost:Record<number,number>={};
 const obstacles:Obstacle[]=[];
 const bank=(layout?flanks:rows).slice(0,count);
 const reservedFrost=new Set<number>();
 let ruleCount=0;
 for(const [index,at] of bank.entries()){
  if(reservedFrost.has(at))continue;
  // Keep power-combination crystals near the central launch area. Other
  // pieces face the open strip so ordinary matches can start clearing them.
  const outer=index>=count-10;
  const radiating=kind==='relay'||kind==='color-wave';
  const useRule=radiating?index%4===0:outer?index%3!==1:index%5===0;
  if(useRule){
   obstacles.push(chapterPiece(kind,at,ruleCount++));
   if(kind==='thaw'&&at>=width){
    frost[at-width]=advanced&&index%3===0?2:1;
    reservedFrost.add(at-width);
    if(supportsContinuousRefill(engineVersion)){
     // Keep the frost protecting this seal connected to the supply above.
     for(let inlet=at-2*width;inlet>=0;inlet-=width)reservedFrost.add(inlet);
    }
   }
   continue;
  }
  if(advanced&&index%6===0&&kind!=='guard'&&!supportsContinuousRefill(engineVersion)){
   const mixed=['pigment','directional','fuse'] as const;
   const rule=mixed[Math.floor(index/6)%mixed.length]!;
   obstacles.push({id:`chapter-${at}`,kind:rule==='directional'?'flower-seal':'urn',hp:2,maxHp:2,anchor:at,footprint:[at],rule,
    ...(rule==='directional'?{strikeSide:'up' as const}:{})});
  }else{
   const reinforced=(radiating||kind==='fusion')&&(advanced||index%3!==0);
   const hp=reinforced?index%4===1?3:2:index%3===0||advanced&&index%2===0?2:1;
   obstacles.push(crate(at,hp));
  }
 }
 if(kind==='thaw'){
  // Fill remaining perimeter spaces independently of the ice coating.
  for(const at of layout?rows:flanks){
   if(obstacles.length===count)break;
   if(!obstacles.some(obstacle=>obstacle.anchor===at)&&!reservedFrost.has(at))obstacles.push(crate(at));
  }
 }
 const level:LevelDefinition={id:FIRST,version:VERSION,engineVersion,width,height,colors,shape,frost,seed,obstacles,
  goals:chapterGoals(obstacles,frost),moves:70,difficulty:'normal'};
 return kind==='fusion'?seedFusionPairs(level):level;
}

export function applyCampaignChapters(base:LevelDefinition):LevelDefinition{
 if(!supportsChapterObstacles(base.engineVersion)||!base.approved||base.tutorial||base.gardenStage)return base;
 const revised=supportsContinuousRefill(base.engineVersion);
 if(revised&&/^(chain-campaign|split-wind)\//.test(base.strategy?.id??''))return base;
 const profile=revised?directChapterSlot(base.id):chapterSlot(base.id);
 if(!profile)return base;
 const recipe=recipes[key(profile)];
 if(!recipe||recipe.length!==2)throw Error('LEVEL_CONTENT_PENDING');
 const [seed,proofMoves]=recipe;
 const position=campaignPosition(base.id);
 const beat=profile.intro?'introduction':position.beat==='hard'||position.beat==='super'?position.beat:'normal';
 const moves=profile.intro?Math.max(12,proofMoves+6):Math.max(base.moves,25,proofMoves+(beat==='normal'?7:5));
 const [name,hint]=chapterCopy[profile.kind][0];
 return {...campaignChapterCandidate(profile,seed!,base.engineVersion),id:base.id,approved:true,moves,difficulty:campaignDifficulty(beat),
  campaign:{...position,beat},strategy:{id:`campaign-chapters/${key(profile)}`,name,hint}};
}
