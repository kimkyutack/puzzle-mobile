import { COLORS, CONTENT_VERSION, ENGINE_VERSION, type Color, type Goal, type LevelDefinition, type Obstacle, type Tile } from '@garden/contracts';
import { createGame, findMatches, legalActions } from '@garden/core';
const goal=(kind:Goal['kind'],count:number):Goal=>({kind,count,remaining:count});
function obstacle(kind:Obstacle['kind'],anchor:number,hp=1,footprint=[anchor],color?:Color,seeds?:number):Obstacle {return {id:`${kind}-${anchor}`,kind,hp,maxHp:hp,anchor,footprint,...(color?{color}:{}),...(seeds?{seeds}:{})};}
export function candidate(id:number,attempt=0):LevelDefinition {
 const form=id<6?0:id%5,width=id<=8||form===3?7:8,height=width,n=width*height;
 const shape=Array<boolean>(n).fill(true),tier=Math.floor((id-1)/25),at=(x:number,y:number)=>y*width+x;
 if(form===1){[[0,0],[1,0],[width-2,0],[width-1,0],[0,1],[width-1,1],[0,height-2],[width-1,height-2],[0,height-1],[1,height-1],[width-2,height-1],[width-1,height-1]].forEach(([x,y])=>shape[at(x!,y!)]=false);}
 if(form===2){[0,width-1,at(Math.floor(width/2),Math.floor(height/2)),at(0,height-1),n-1].forEach(i=>shape[i]=false);}
 if(form===3)for(let y=0;y<height;y++)shape[at(3,y)]=false;
 if(form===4){[[0,0],[1,0],[2,0],[width-1,0],[0,1],[1,1],[width-1,1],[0,2],[width-1,2]].forEach(([x,y])=>shape[at(x!,y!)]=false);}
 // Compact split boards keep four colors. Six colors require a broad open board.
 const colors=[...COLORS.slice(0,id<=12||form===3?4:id>=75&&form===0?6:5)];
 const difficulty=id<6?'normal':id%10===8?'super':id%5===3?'hard':'normal';
 const moves=id<=5?24:difficulty==='super'?32:difficulty==='hard'?30:28;
 const definition:LevelDefinition={id,version:CONTENT_VERSION,engineVersion:ENGINE_VERSION,width,height,colors,moves,seed:1009+id*7919+attempt*104729,shape,goals:[],obstacles:[],difficulty};
 if(id===1)definition.goals=[goal('berry',12)];
 else if(id===2)definition.goals=[goal('drop',22)];
 else if(id===3||id===4){definition.obstacles=[43,45,47].map(i=>obstacle('crate',i,1));definition.goals=[goal('crate',3),goal(id===3?'berry':'drop',12)];}
 else if(id===5)definition.goals=[goal('sun',25)];
 else {
  const available=shape.flatMap((exists,i)=>exists?[i]:[]);
  const bottom=available.filter(i=>i>=(height-2)*width),middle=available.filter(i=>i>=2*width&&i<(height-2)*width);
  const primary=colors[id%colors.length]!;definition.goals=[goal(primary,16+Math.min(tier,5)*3)];
  if(id>=7&&id%3!==0){const spots=bottom.filter((_,k)=>k%3===0).slice(0,Math.min(2+Math.floor(tier/2),4));definition.obstacles.push(...spots.map(i=>obstacle('crate',i,Math.min(1+Math.floor(tier/3),3))));if(spots.length)definition.goals.push(goal('crate',spots.length));}
  if(id>=10&&id%7===3){const spots=middle.filter((_,k)=>k%8===0).slice(0,3);definition.obstacles.push(...spots.map(i=>obstacle('vine',i,1)));definition.goals.push(goal('vine',spots.length));}
  if(id>=13&&id%4===1){const spots=middle.filter((_,k)=>k%4===0).slice(0,5);definition.frost=Object.fromEntries(spots.map(i=>[i,tier>2?2:1]));definition.goals.push(goal('frost',spots.length*(tier>2?2:1)));}
  if(id>=18&&id%9===0){const at=bottom.find(i=>!definition.obstacles.some(o=>o.footprint.includes(i)))!;definition.obstacles.push(obstacle('pot',at,4+Math.min(tier,2),[at],primary));definition.goals.push(goal('pot',1));}
  if(id>=28&&id%13===0){const at=bottom.find(i=>!definition.obstacles.some(o=>o.footprint.includes(i)))!;definition.obstacles.push(obstacle('moss',at));definition.goals.push(goal('moss',1));}
  if(id>=34&&id%11===0&&form!==3){const anchor=Array.from({length:width-1},(_,x)=>(height-1)*width+x).find(i=>shape[i]&&shape[i+1]&&!definition.obstacles.some(o=>o.footprint.includes(i)||o.footprint.includes(i+1)));if(anchor!==undefined){definition.obstacles.push(obstacle('cabinet',anchor,2,[anchor,anchor+1],undefined,1));definition.exits=[anchor,anchor+1];definition.goals.push(goal('cabinet',1),goal('seed',1));}}
  if(id>=16&&id%10===6){const x=2,exit=(height-1)*width+x;const already=definition.obstacles.some(o=>o.footprint.includes(exit));if(shape[exit]&&!already){definition.exits=[...(definition.exits??[]),exit];definition.goals.push(goal('seed',1));}}
 }
 // Every disconnected shape segment has an explicit supply inlet and falling lane.
 const gravity:number[][]=[];for(let x=0;x<width;x++){let lane:number[]=[];for(let y=0;y<height;y++){const i=y*width+x;if(shape[i])lane.push(i);else if(lane.length){gravity.push(lane);lane=[];}}if(lane.length)gravity.push(lane);}definition.gravity=gravity;definition.inlets=gravity.map(l=>l[0]!);
 // createGame validates seed-goal cardinality; temporarily remove the physical-seed goal while laying ordinary tiles.
 const seedGoal=definition.goals.find(g=>g.kind==='seed'),cabinetSeeds=definition.obstacles.reduce((sum,o)=>sum+(o.seeds??0),0);const physicalSeed=seedGoal&&seedGoal.count>cabinetSeeds;
 const base={...definition,goals:definition.goals.filter(g=>g.kind!=='seed'||!physicalSeed)};
 const initial=createGame(base).cells.map(c=>c.tile);
 if(physicalSeed){const x=(definition.exits??[])[0]!%width;const top=gravity.find(l=>l.includes((definition.exits??[])[0]!))?.[0];if(top!==undefined)initial[top]={id:10000,kind:'seed'};}
 if(id<=5){let nextId=20000;const set=(at:number,color:Color)=>initial[at]={id:nextId++,kind:'normal',color};let from=0,to=0,feature='',text='';
  if(id===1){set(16,'berry');set(17,'berry');set(18,'drop');set(25,'berry');from=25;to=18;feature='swap';text='열매를 옮겨 같은 모양 3개를 이어요!';}
  if(id===2){[15,16,18].forEach(i=>set(i,'drop'));set(14,'berry');set(19,'sun');set(17,'sun');set(24,'drop');from=24;to=17;feature='wind-row';text='물방울 4개를 이으면 줄바람이 생겨요!';}
  if(id===3){[17,24,32,33,30].forEach(i=>set(i,'berry'));set(31,'drop');from=30;to=31;feature='bomb';text='꺾인 모양으로 5개를 이으면 꽃폭탄!';}
  if(id===4){[16,17,23,25].forEach(i=>set(i,'drop'));set(24,'sun');from=25;to=24;feature='glider';text='네모로 모으면 씨앗비행기가 날아가요!';}
  if(id===5){[15,16,18,19,24].forEach(i=>set(i,'sun'));set(17,'drop');from=24;to=17;feature='rainbow';text='일렬로 5개! 무지개등을 만들어 보세요.';}
  definition.tutorial={from,to,feature,text};definition.protectedCells=Array.from(new Set([from,to,...(id===1?[16,17]:id===2?[15,16,17]:id===3?[17,24,32,33]:id===4?[16,17,23]:[15,16,18,19])]));
 }
 definition.initial=initial as Array<Tile|null>;
 // Reject crafted boards with unintended starting matches rather than silently resolving them.
 const initialState=createGame(definition);if(findMatches(initialState).length||!legalActions(initialState).length)throw new Error('CANDIDATE_NOT_STATIC_VALID');
 if(definition.tutorial){const t=definition.tutorial;[initialState.cells[t.from]!.tile,initialState.cells[t.to]!.tile]=[initialState.cells[t.to]!.tile,initialState.cells[t.from]!.tile];const match=findMatches(initialState,[t.to,t.from]).find(m=>m.cells.includes(t.to));if(!match||(id===1?!!match.kind:match.kind!==t.feature))throw new Error('TUTORIAL_PATTERN_MISMATCH');}
 return definition;
}
