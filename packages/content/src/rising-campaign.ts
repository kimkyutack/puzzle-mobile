import {COLORS,supportsRisingCampaign,type CampaignBeat,type Goal,type LevelDefinition,type Obstacle,type Tile} from '@garden/contracts';
import {campaignDifficulty,campaignPosition} from './campaign';
import {BREAKABLE_CAMPAIGN_VERSION} from './breakable-campaign-plan';
import saved from './rising-campaign-recipes.json';

export const RISING_CAMPAIGN_VERSION='garden-2026.11.16-rising-campaign-v1';
const first=401,last=20_000;
const bandStarts=[401,1001,2001,3601,6001,9001,12001,16001] as const;
const bankSizes=[9,11,13,15,18,21,24,27] as const;
const movesByBand=[23,23,24,25,26,27,28,30] as const;
const families=['crates','urns','supply','planters','shutters','regrow','shells'] as const;
type Family=typeof families[number];
const newRules=['shutters','regrow','shells'] as const;
const introAt=3601;

export const risingCampaignCopy:Record<Family,readonly [name:string,hint:string]>={
 crates:['상자밭','상자 옆에서 타일을 맞추거나, 로켓과 꽃폭탄으로 한 줄을 열어요.'],
 urns:['별빛 항아리밭','항아리와 등불을 한 칸씩 타격해요. 금이 가거나 별빛이 드러나면 한 번 더 맞혀요.'],
 supply:['항아리 창고','상자를 열고 나면 드러난 항아리를 한 칸씩 부숴요.'],
 planters:['온실 화분 마당','수문을 특수 블록으로 맞혀요. 진흙이 벗겨지면 화분을 하나씩 깨세요.'],
 shutters:['이슬 덮개','덮개가 달린 항아리는 파란 점이 켜졌을 때 타격하세요. 한 수가 끝날 때마다 덮개가 열리거나 닫혀요.'],
 regrow:['새순 항아리','잎이 달린 항아리는 타격하지 않은 수에 금이 메워져요. 연달아 맞히거나 한 수에 여러 번 맞혀요.'],
 shells:['빛결 등불','타일 표시가 뜨면 옆에서 매치하고, 폭발 표시가 뜨면 특수 블록으로 맞혀요. 맞을 때마다 표시가 바뀌어요.'],
};

type Profile={family:Family;band:number;late:boolean;layout:number;intro?:true};
const recipes:Readonly<Partial<Record<string,readonly number[]>>>=saved;
const key=({family,band,late,layout,intro}:Profile)=>intro?`intro/${family}`:`${family}/${band}/${Number(late)}/${layout}`;

function slot(id:number):Profile{
 const band=bandStarts.filter(start=>id>=start).length-1;
 const chapter=Math.floor((id-1)/100),offset=(id-1)%100;
 const lesson=id>=introAt?newRules[Math.floor((id-introAt)/100)]:undefined;
 if(lesson&&offset<3)return {family:lesson,band,late:false,layout:offset%2,...(offset===0?{intro:true}:{})};
 const available=chapter<5?1:chapter<6?2:chapter<36?4:Math.min(families.length,5+Math.floor((id-introAt)/100));
 // Rotate mechanics in runs of two or three. Repeated layouts start from
 // independently tested left/right entries rather than a cosmetic relabel.
 const run=Math.floor(offset/5)*2+Number(offset%5>=3);
 return {family:families[(chapter+run)%available]!,band,late:offset>=55,layout:(chapter+offset)%2};
}

export function risingCampaignProfiles(){
 return [...new Map(Array.from({length:last-first+1},(_,i)=>slot(i+first)).map(profile=>[key(profile),profile])).entries()];
}

function teachingBoard(family:Family,engineVersion:string,seed:number):LevelDefinition{
 const rows=[
  'blgrsbr',
  'rslbrgl',
  'lgbsgsb',
  'srrlrbg',
  '.aHB.a.',
 ];
 const width=7,height=rows.length,colors=[...COLORS.slice(0,5)];
 const colorByGlyph={r:colors[0]!,b:colors[1]!,s:colors[2]!,g:colors[3]!,l:colors[4]!};
 const obstacles:Obstacle[]=[];
 const initial=rows.join('').split('').map((glyph,at):Tile|null=>{
  if(glyph==='a'||glyph==='B'){
   const isShell=family==='shells',hp=isShell?2:family==='regrow'?2:1;
   obstacles.push({id:`lesson-${at}`,kind:isShell?'starlight-lantern':'urn',anchor:at,footprint:[at],hp,
    maxHp:isShell?3:hp,rule:isShell?'power-shell':family==='regrow'?'regrow':glyph==='a'?'shutter-open':'shutter-closed'});
   return null;
  }
  if(glyph==='.')return null;
  if(glyph==='H')return family==='shells'?{id:at+1,kind:'wind-row'}:{id:at+1,kind:'normal',color:colors[4]!};
  return {id:at+1,kind:'normal',color:colorByGlyph[glyph as keyof typeof colorByGlyph]};
 });
 const count=obstacles.length,kind=obstacles[0]!.kind;
 return {id:introAt,width,height,shape:initial.map((tile,at)=>!!tile||obstacles.some(o=>o.anchor===at)),colors,seed,initial,obstacles,
  version:RISING_CAMPAIGN_VERSION,engineVersion,moves:28,difficulty:'normal',goals:[{kind,count,remaining:count}]};
}

export function risingCampaignCandidate(profile:Profile,seed:number,engineVersion:string):LevelDefinition{
 const {family,band,late,layout,intro}=profile;
 if(intro)return teachingBoard(family,engineVersion,seed);
 const width=9,height=9,colors=[...COLORS.slice(0,5)],shape=Array<boolean>(width*height).fill(true);
 const obstacles:Obstacle[]=[], counts=new Map<Goal['kind'],number>();
 const familyOffset=families.indexOf(family),count=bankSizes[band]!+(late?3:0);
 const anchor=(x:number,y:number)=>y*width+(layout===0?x:width-1-x);
 const bottom=Array.from({length:36},(_,i)=>anchor((i%9+(i<9?0:late?2:0)+9)%9,8-Math.floor(i/9)));
 const columns=Array.from({length:36},(_,i)=>anchor([0,8,1,7,2,6][i%6]!,8-Math.floor(i/6)));
 // The middle strip remains open when both banks are on the edges.
 const bank=(familyOffset%2===layout?bottom:columns).slice(0,count);
 const add=(at:number,kind:Obstacle['kind'],hp:number,extra:Partial<Obstacle>={},target:Goal['kind']|null=kind)=>{
  obstacles.push({id:`bank-${at}`,kind,hp,maxHp:hp,anchor:at,footprint:[at],...extra});
  if(target!==null)counts.set(target,(counts.get(target)??0)+1);
 };
 if(layout===1){
  shape[anchor(0,0)]=false;
  shape[anchor(8,0)]=false;
 }
 const gates=late&&band>=4?[anchor(2,2),anchor(6,2)]:[anchor(4,2)];
 const gateId=(index:number)=>`planter-opener-${index+1}`;
 if(family==='planters')for(const [index,gate] of gates.entries())add(gate,'greenhouse-sluice',1,{id:gateId(index)},null);
 for(const [index,at] of bank.entries()){
  const outer=index>=count-(layout===0?7:6),layered=band>=3&&index%4<2;
  const armoured=band>=4?index%3!==2:index%3===0;
  if(family==='crates')add(at,'crate',armoured?(band>=6&&index%5===0?3:2):1);
  else if(family==='urns'){
   if(layered)add(at,'starlight-lantern',band>=6?3:2,{maxHp:3});
   else add(at,'urn',armoured?2:1);
  }else if(family==='supply'){
   if((outer&&index%2===0)||index%4===0)add(at,'supply-crate',band>=5?2:1,{contents:{kind:'urn',hp:band>=4?2:1}},'urn');
   else add(at,'urn',armoured?2:1);
  }else if(family==='planters'){
   const gate=gates.length===2&&at%width>=4?1:0;
   add(at,'garden-planter',armoured?2:1,index<count-(late?0:4)?{cover:{source:gateId(gate),kind:'greenhouse-sluice'}}:{});
  }else if(family==='shutters'){
   add(at,'urn',armoured?2:1,(outer||index%4===0)?{rule:index%2===0?'shutter-open':'shutter-closed'}:{});
  }else if(family==='regrow'){
   const regrows=(outer&&index%2===0)||index%5===0;
   add(at,'urn',armoured||regrows?2:1,regrows?{rule:'regrow'}:{});
  }else{
   if(outer&&index%2===0||band>=5&&index>=count-12&&index%5===0){
    const full=band>=6&&outer&&index%3===0;
    add(at,'starlight-lantern',full?3:2,{maxHp:3,rule:full||index%3===0?'match-shell':'power-shell'});
   }
   else add(at,'urn',armoured?2:1);
  }
 }
 const goals=[...counts].map(([kind,count])=>({kind,count,remaining:count}));
 return {id:first,width,height,shape,colors,seed,goals,obstacles,engineVersion,version:RISING_CAMPAIGN_VERSION,moves:60,difficulty:'normal'};
}

export function risingCampaignLevel(source:LevelDefinition):LevelDefinition{
 const {id,engineVersion,campaign}=source;
 if(!supportsRisingCampaign(engineVersion)||id<first||id>last||!source.approved||source.tutorial||source.gardenStage)return source;
 const strategy=source.strategy?.id??'';
 if(strategy.startsWith('chain-campaign/')||strategy.startsWith('split-wind/'))return source;
 const early=id<introAt;
 const placement=id%10;
 const retainedBoard=source.version.startsWith(BREAKABLE_CAMPAIGN_VERSION)||
  source.devices&&id%100>=61&&id%100<=63;
 const useBank=!retainedBoard&&(!early||strategy.startsWith('mix/')&&[2,3,5,7,9].includes(placement));
 if(!useBank){
  if(campaign?.beat!=='practice')return source;
  return {...source,version:source.version+':single-intro',campaign:{...campaign,beat:'normal'}};
 }
 const profile=slot(id),recipe=recipes[key(profile)];
 if(!recipe||recipe.length!==2)throw Error('LEVEL_CONTENT_PENDING');
 const [seed,proofMoves]=recipe;
 const board=risingCampaignCandidate(profile,seed,engineVersion);
 const beat:CampaignBeat=profile.intro?'introduction':placement===8||profile.band>=6&&placement===4?'super':
  placement===4||profile.band>=4&&[6,9].includes(placement)?'hard':'normal';
 const moves=profile.intro?Math.max(14,proofMoves+8):Math.max(source.moves,movesByBand[profile.band]!,proofMoves+(beat==='super'?3:beat==='hard'?5:7));
 const [name,hint]=risingCampaignCopy[profile.family];
 const gates=board.obstacles.filter(obstacle=>obstacle.kind==='greenhouse-sluice');
 const guide=gates.length&&(beat==='hard'||beat==='super')
  ?gates.length===2?{item:'bomb' as const,cell:(gates[0]!.anchor+gates[1]!.anchor)/2}:{item:'wind-row' as const,cell:gates[0]!.anchor-1}
  :undefined;
 return {...board,id,moves,approved:true,difficulty:campaignDifficulty(beat),
  ...(guide?{startBoosterGuide:guide}:{}),
  campaign:{...campaignPosition(id),beat},strategy:{id:`rising-campaign/${key(profile)}`,name,hint}};
}
