import {COLORS,CONTENT_VERSION,ENGINE_VERSION,type Goal,type LevelDefinition,type Obstacle,type Tile} from '@garden/contracts';
import {createGame,findMatches,legalActions} from '@garden/core';
import previous from './legacy-approved-v11.json';
export const STRATEGIES=[
 ['meadow','보석 정원','두 색상의 목표를 번갈아 모아요.'],
 ['frost-terraces','얼음 계단','얼음 위에서 맞추거나 특수 타일로 층을 걷어내요.'],
 ['split-streams','갈라진 물길','분리된 두 구역의 목표를 함께 정리해요.'],
 ['ring-court','고리 정원','비어 있는 가운데를 피해 바깥 고리를 공략해요.'],
 ['seed-delivery','씨앗 배달','씨앗 아래 타일을 없애 출구로 내려보내요.'],
 ['color-pots','색상 온실','화분과 같은 색의 타일로 충전해요.'],
 ['moss-race','이끼 추격','번지는 이끼를 먼저 막아 주세요.'],
 ['seed-vaults','씨앗 저장고','저장함을 연 뒤 나온 씨앗을 배달해요.'],
 ['vine-pass','덩굴 협곡','좁은 구간의 덩굴부터 풀어 공간을 넓혀요.'],
 ['crate-wall','상자 성벽','여러 층의 상자를 줄바람과 조합으로 무너뜨려요.'],
 ['frozen-greenhouse','얼어붙은 온실','화분 충전과 얼음 제거를 함께 진행해요.'],
 ['fusion-festival','조합 축제','특수 타일 두 개를 바꿔 조합 목표를 완성해요.']
] as const;
const goal=(kind:Goal['kind'],count:number):Goal=>({kind,count,remaining:count});
export function expandedCandidate(id:number,attempt=0):LevelDefinition{
 if(id<=30){const level=structuredClone(previous[id-1]) as LevelDefinition;return {...level,engineVersion:ENGINE_VERSION,version:CONTENT_VERSION};}
 const mode=(id-31)%STRATEGIES.length,[strategy,name,hint]=STRATEGIES[mode]!,difficulty=id%10===8?'super':id%5===3?'hard':'normal',strength=difficulty==='super'?2:difficulty==='hard'?1:0;
 const width=mode===2?8:mode===3?8:mode===8?7:9,height=mode===8?9:8,n=width*height,shape=Array<boolean>(n).fill(true),at=(x:number,y:number)=>y*width+x;
 if(mode===1)for(let y=0;y<height;y++)for(let x=0;x<width;x++)if(y<2&&(x<2-y||x>=width-(2-y)))shape[at(x,y)]=false;
 if(mode===2)for(let y=0;y<height;y++){shape[at(3,y)]=false;shape[at(4,y)]=false;}
 if(mode===3)for(let y=3;y<=4;y++)for(let x=3;x<=4;x++)shape[at(x,y)]=false;
 if(mode===8)for(let y=2;y<=6;y++)for(const x of [0,1,width-2,width-1])shape[at(x,y)]=false;
 const colors=[...COLORS.slice(0,mode===2||mode===11?4:strength===2?6:5)],obstacles:Obstacle[]=[],frost:Record<number,number>={},exits:number[]=[],goals:Goal[]=[];
 const occupied=new Set<number>(),add=(kind:Obstacle['kind'],anchor:number,hp:number,footprint=[anchor],color?:typeof COLORS[number],seeds?:number)=>{
  if(footprint.some(i=>!shape[i]||occupied.has(i)))return false;footprint.forEach(i=>occupied.add(i));obstacles.push({id:kind+'-'+anchor,kind,anchor,hp,maxHp:hp,footprint,...(color?{color}:{}),...(seeds?{seeds}:{})});return true;
 };
 if(mode===0){goals.push(goal(colors[id%colors.length]!,28+strength*7),goal(colors[(id+2)%colors.length]!,24+strength*5));for(const x of [2,4,6])add('crate',at(x,height-1),1+strength);}
 if(mode===1||mode===3){for(let y=height-3;y<height;y++)for(let x=0;x<width;x++)if(shape[at(x,y)]&&(x+y)%2===0)frost[at(x,y)]=1+Number(strength>0);}
 if(mode===2){goals.push(goal('berry',28+strength*5),goal('drop',28+strength*5));for(const x of [0,2,5,7])add('crate',at(x,height-1),1+Number(strength>0));}
 if(mode===4){exits.push(at(1,height-1),at(4,height-1),at(7,height-1));goals.push(goal('seed',3));for(const x of [2,3,5,6])add('crate',at(x,height-2),1+Number(strength>0));}
 if(mode===5||mode===10){for(const [index,x]of [2,6].entries())add('pot',at(x,height-2),4+strength,[at(x,height-2)],colors[(id+index)%colors.length]);}
 if(mode===6){for(const x of [2,6])add('moss',at(x,height-2),1);goals.push(goal('sun',22+strength*5));}
 if(mode===7){for(const x of [1,6]){const anchor=at(x,height-1);add('cabinet',anchor,2+Number(strength>0),[anchor,anchor+1],undefined,1);exits.push(anchor,anchor+1);}goals.push(goal('seed',2));}
 if(mode===8){for(let y=3;y<=6;y++)for(const x of [2,4])add('vine',at(x,y),1+Number(strength>1));}
 if(mode===9){for(let x=0;x<width;x++)add('crate',at(x,height-1),2+Number(strength>0));}
 if(mode===10){for(let y=height-3;y<height;y++)for(let x=0;x<width;x++)if(!occupied.has(at(x,y))&&(x+y)%2===0)frost[at(x,y)]=1+Number(strength>0);}
 if(mode===11){goals.push(goal('combo',1+strength),goal('special',4+strength*2));for(const x of [1,4,7])add('crate',at(x,height-1),1+strength);}
 for(const kind of ['crate','vine','pot','moss','cabinet'] as const){const count=obstacles.filter(o=>o.kind===kind).length;if(count)goals.push(goal(kind,count));}
 const layers=Object.values(frost).reduce((sum,v)=>sum+v,0);if(layers)goals.push(goal('frost',layers));
 if(!goals.some(g=>COLORS.includes(g.kind as typeof COLORS[number]))&&mode!==11&&mode!==4&&mode!==7)goals.push(goal(colors[id%colors.length]!,20+strength*5));
 const gravity:number[][]=[];for(let x=0;x<width;x++){let lane:number[]=[];for(let y=0;y<height;y++){const i=at(x,y);if(shape[i])lane.push(i);else if(lane.length){gravity.push(lane);lane=[];}}if(lane.length)gravity.push(lane);}
 const definition:LevelDefinition={id,version:CONTENT_VERSION,engineVersion:ENGINE_VERSION,width,height,shape,colors,moves:strength===2?28:strength===1?28:30,seed:13007+id*7919+attempt*104729,goals,obstacles,gravity,inlets:gravity.map(l=>l[0]!),difficulty,strategy:{id:strategy,name,hint},...(layers?{frost}:{}),...(exits.length?{exits}:{}),approved:false};
 const base={...definition,goals:goals.filter(g=>g.kind!=='seed')};
 const initial=createGame(base).cells.map(cell=>cell.tile);
 if(mode===4)for(const x of [1,4,7])initial[at(x,0)]={id:10000+x,kind:'seed'};
 if(mode===11)for(let pair=0;pair<=strength;pair++){const index=at(1+pair*3,2);initial[index]={id:20000+pair*2,kind:'wind-row'};initial[index+1]={id:20001+pair*2,kind:pair%2?'glider':'bomb'};}
 definition.initial=initial as Array<Tile|null>;
 const state=createGame(definition);if(findMatches(state).length||legalActions(state).length<3)throw new Error('NOT_STATIC_VALID');
 return definition;
}
