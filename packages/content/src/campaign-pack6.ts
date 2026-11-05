import {COLORS,ENGINE_VERSION,type LevelDefinition,type Obstacle,type ObstacleKind,type Color,type Goal} from '@garden/contracts';
import {createGame} from '@garden/core';
import {campaignPosition,campaignDifficulty} from './campaign';

export const PACK6_CONTENT_VERSION='garden-2026.11.04-campaign-pack6-v21';
export const PACK6_STRATEGIES=[
 {id:'pipe-seed-route',name:'물길을 따라 씨앗 배달',hint:'씨앗 아래 물관을 줄여 출구까지 이어지는 길을 열어요.'},
 {id:'shade-seed-garden',name:'차양 아래 씨앗 정원',hint:'꽃봉오리를 열고 차양의 색을 모아 씨앗이 내려갈 공간을 만들어요.'},
 {id:'moving-pipe-court',name:'움직이는 물길 정원',hint:'화분의 다음 위치를 생각하며 양옆 물관을 줄여요.'},
 {id:'shade-carousel',name:'온실 회전 정원',hint:'차양을 걷어 공간을 넓히면서 이동하는 화분을 공략해요.'},
 {id:'greenhouse-finale',name:'온실 복원 대작전',hint:'물관으로 막힌 길과 차양을 열어요. 어려운 판에서는 꽃의 씨앗도 배달해요.'},
] as const;

/** Frozen authoring rules for pack six. Later packs get their own generator. */
export function pack6Candidate(id:number,attempt=0):LevelDefinition {
 if(!Number.isInteger(id)||id<251||id>300)throw new Error('INVALID_PACK6_LEVEL');
 const campaign=campaignPosition(id),group=Math.floor((id-251)/10),strategy=PACK6_STRATEGIES[group]!,
  strength=campaign.beat==='super'?2:campaign.beat==='hard'?1:0,easy=campaign.beat==='easy'||campaign.beat==='celebration',
  width=9,height=strength===2?9:8,n=width*height,at=(x:number,y:number)=>y*width+x,
  colors=[...COLORS.slice(0,easy?4:5)],color=colors[id%colors.length]!,otherColor=colors[(id+2)%colors.length]!,
  shape=Array<boolean>(n).fill(true),obstacles:Obstacle[]=[],exits:number[]=[],seedColumns=new Set<number>();
 const add=(kind:ObstacleKind,footprint:number[],hp:number,extra:Partial<Obstacle>={})=>{
  if(footprint.some(i=>obstacles.some(o=>o.footprint.includes(i))))throw new Error('PACK6_OBSTACLE_OVERLAP');
  obstacles.push({id:`${kind}-${footprint[0]}`,kind,anchor:footprint[0]!,footprint,hp,maxHp:hp,...extra});
 };
 const pipe=(x:number,start:number,length:number)=>add('pipe',Array.from({length},(_,i)=>at(x,start+i)),length);
 const bud=(x:number,y:number,chargeColor:Color=color)=>{add('bud',[at(x,y)],easy?2:3,{color:chargeColor,seeds:1});seedColumns.add(x);exits.push(at(x,height-1));};
 const shade=(side=false)=>{
  const footprint=side?Array.from({length:height-2},(_,y)=>[at(0,y+1),at(1,y+1)]).flat():Array.from({length:width*(strength?2:1)},(_,i)=>at(i%width,height-(strength?2:1)+Math.floor(i/width)));
  add('curtain',footprint,easy?9:12+strength*3,{color});
 };
 const carousel=()=>{
  const path=[at(3,2),at(4,2),at(5,2),at(5,3),at(5,4),at(4,4),at(3,4),at(3,3)];
  add('carousel',[path[(id-251)%path.length]!],easy?3:4,{path});
 };
 if(group===0){for(const x of strength?[2,6]:[id%2?2:6]){bud(x,2);pipe(x,height-4,easy?2:3);}}
 if(group===1){shade();for(const x of strength?[2,6]:[id%2?2:6])bud(x,3,strength?otherColor:color);}
 if(group===2){carousel();for(const x of strength?[1,7]:[id%2?1:7])pipe(x,3,easy?2:3+Number(strength===2));}
 if(group===3){shade(true);carousel();}
 if(group===4){shade();pipe(id%2?2:6,2,easy?2:3);if(strength)bud(id%2?6:2,2,otherColor);}
 // Keep delivery columns continuous and reserve all moving-object path cells.
 const reserved=new Set([...obstacles.flatMap(o=>[...o.footprint,...(o.path??[])]),...exits]);
 const silhouette=(id-251)%6;
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  const cut=silhouette===1?(y===0||y===height-1)&&(x===0||x===8)
   :silhouette===2?y<2&&(x<2-y||x>6+y)
   :silhouette===3?y>=3&&y<=4&&(x<2||x>6)
   :silhouette===4?x===4&&y===3
   :silhouette===5?(x===0&&y>=1&&y<=3)||(x===8&&y>=height-3):false;
  if(cut&&!reserved.has(at(x,y))&&!seedColumns.has(x))shape[at(x,y)]=false;
 }
 const goals:Goal[]=[];
 for(const kind of [...new Set(obstacles.map(o=>o.kind))]){const count=obstacles.filter(o=>o.kind===kind).length;goals.push({kind,count,remaining:count});}
 const seeds=obstacles.reduce((sum,o)=>sum+(o.seeds??0),0);if(seeds)goals.push({kind:'seed',count:seeds,remaining:seeds});
 // Keep the HUD readable: at most four distinct objectives in this pack.
 if(goals.length<3){const count=easy?15:22+strength*3;goals.push({kind:color,count,remaining:count});}
 const gravity:number[][]=[];
 for(let x=0;x<width;x++){let lane:number[]=[];for(let y=0;y<height;y++){const i=at(x,y);if(shape[i])lane.push(i);else if(lane.length){gravity.push(lane);lane=[];}}if(lane.length)gravity.push(lane);}
 const level:LevelDefinition={id,version:PACK6_CONTENT_VERSION,engineVersion:ENGINE_VERSION,width,height,shape,colors,moves:50,
  seed:17_071+id*7919+attempt*104729,goals,obstacles,gravity,inlets:gravity.map(l=>l[0]!),...(exits.length?{exits}:{}),
  difficulty:campaignDifficulty(campaign.beat),campaign,strategy:{...strategy},approved:false};
 level.initial=createGame(level).cells.map(cell=>cell.tile);
 if(campaign.beat==='celebration'){
  const available=level.initial.flatMap((tile,i)=>tile?.kind==='normal'&&!obstacles.some(o=>o.footprint.includes(i)||o.path?.includes(i))&&!seedColumns.has(i%width)?[i]:[]);
  for(const [k,i]of available.filter(i=>Math.floor(i/width)%2===0).slice(0,3).entries())level.initial[i]={id:20_000+k,kind:k%2?'bomb':'wind-row'};
 }
 return level;
}
