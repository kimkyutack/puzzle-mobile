import {COLORS,CONTENT_VERSION,ENGINE_VERSION,type LevelDefinition,type Obstacle,type ObstacleKind,type Goal} from '@garden/contracts';
import {createGame} from '@garden/core';
import {campaignPosition,campaignDifficulty} from './campaign';
import {pack6Candidate} from './campaign-pack6';

export const GARDEN_MECHANICS=['pipe','bud','carousel','curtain'] as const;
export const AUTHORED_CAMPAIGN_LEVEL=300;
const descriptions={
 pipe:['접이식 물관','물관 옆에서 맞추면 한 칸씩 줄어들어요. 열린 공간으로 타일이 내려와요.'],
 bud:['씨앗 꽃봉오리','꽃봉오리 옆에서 표시된 색을 맞춰요. 열린 꽃에서 나온 씨앗을 출구로 내려보내요.'],
 carousel:['회전 화분대','한 번 움직일 때마다 화분이 길을 따라 이동해요. 다음 위치를 생각하며 공략해요.'],
 curtain:['온실 차양','표시된 색의 블록을 모으면 차양이 걷히고 아래 구역이 열려요.'],
} as const;
/** Offline authoring only. The API serves approved definitions and never searches for seeds. */
export function campaignCandidate(id:number,attempt=0):LevelDefinition {
 if(id>AUTHORED_CAMPAIGN_LEVEL)throw new Error('CAMPAIGN_PACK_NOT_AUTHORED');
 if(id>=251&&id<=300)return pack6Candidate(id,attempt);
 const campaign=campaignPosition(id),kind=GARDEN_MECHANICS.includes(campaign.lesson as typeof GARDEN_MECHANICS[number])?campaign.lesson as typeof GARDEN_MECHANICS[number]:GARDEN_MECHANICS[Math.floor((id-201)/10+4_000)%4]!,
  learning=campaign.beat==='introduction'||campaign.beat==='practice',strength=campaign.beat==='super'?2:campaign.beat==='hard'?1:0,
  width=9,height=8,n=width*height,at=(x:number,y:number)=>y*width+x,shape=Array<boolean>(n).fill(true),obstacles:Obstacle[]=[],exits:number[]=[];
 // Alternating authored silhouettes, not recoloring a recycled certified board.
 const layout=Math.floor(id/10)%4;
 if(!learning&&layout===1)for(const i of [0,8,63,71])shape[i]=false;
 if(!learning&&layout===2)for(const i of [0,1,7,8])shape[i]=false;
 if(!learning&&layout===3)for(const i of [27,36])shape[i]=false;
 const colors=[...COLORS.slice(0,learning||campaign.beat==='celebration'?4:strength===2?6:5)],color=colors[id%colors.length]!;
 const add=(type:ObstacleKind,footprint:number[],hp:number,extra:Partial<Obstacle>={})=>obstacles.push({id:`${type}-${footprint[0]}`,kind:type,anchor:footprint[0]!,footprint,hp,maxHp:hp,...extra});
 if(kind==='pipe')for(const x of strength?[2,6]:[4]){const length=learning?2:3+strength;add('pipe',Array.from({length},(_,i)=>at(x,2+i)),length);}
 if(kind==='bud'){for(const x of strength?[2,6]:[4]){add('bud',[at(x,5)],learning?2:3,{color,seeds:1});exits.push(at(x,7));}}
 if(kind==='carousel'){
  const path=[at(3,3),at(4,3),at(5,3),at(5,4),at(5,5),at(4,5),at(3,5),at(3,4)];
  add('carousel',[path[id%path.length]!],learning?4:3+strength,{path});
 }
 if(kind==='curtain'){add('curtain',Array.from({length:width*(learning?1:2)},(_,i)=>at(i%width,learning?7:6+Math.floor(i/width))).filter(i=>shape[i]),learning?12:15+strength*3,{color});}
 if(!learning&&strength){
  // A familiar secondary rule first appears after the new rule has been taught.
  const occupied=new Set(obstacles.flatMap(o=>[...o.footprint,...(o.path??[])]));
  for(const x of [1,7]){const p=at(x,6);if(shape[p]&&!occupied.has(p))add('crate',[p],1+strength);}
 }
 const goals:Goal[]=[];for(const type of [...new Set(obstacles.map(o=>o.kind))]){const count=obstacles.filter(o=>o.kind===type).length;goals.push({kind:type,count,remaining:count});}
 const seeds=obstacles.reduce((sum,o)=>sum+(o.seeds??0),0);if(seeds)goals.push({kind:'seed',count:seeds,remaining:seeds});
 {const count=learning?12:campaign.beat==='celebration'?18:strength?28:24;goals.push({kind:color,count,remaining:count});}
 const gravity:number[][]=[];for(let x=0;x<width;x++){let lane:number[]=[];for(let y=0;y<height;y++){const i=at(x,y);if(shape[i])lane.push(i);else if(lane.length){gravity.push(lane);lane=[];}}if(lane.length)gravity.push(lane);}
 const [name,hint]=descriptions[kind];
 const level:LevelDefinition={id,version:CONTENT_VERSION,engineVersion:ENGINE_VERSION,width,height,shape,colors,moves:50,seed:17_071+id*7919+attempt*104729,goals,obstacles,gravity,inlets:gravity.map(l=>l[0]!),...(exits.length?{exits}:{}),difficulty:campaignDifficulty(campaign.beat),campaign,strategy:{id:kind,name,hint},approved:false};
 level.initial=createGame(level).cells.map(cell=>cell.tile);
 if(campaign.beat==='celebration'){
  // Visible starting power-ups are level content, not paid inventory consumption.
  const available=level.initial.flatMap((t,i)=>t?.kind==='normal'&&!obstacles.some(o=>o.footprint.includes(i)||o.path?.includes(i))?[i]:[]);
  for(const [k,i]of available.filter(i=>i%width===1).slice(0,3).entries())level.initial[i]={id:20_000+k,kind:k%2?'bomb':'wind-row'};
 }
 return level;
}
