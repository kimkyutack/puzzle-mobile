import {COLORS,supportsGliderSwarm,type Goal,type LevelDefinition,type Obstacle} from '@garden/contracts';
import {BREAKABLE_CAMPAIGN_VERSION,type BreakablePattern} from './breakable-campaign-plan';
export const BREAKABLE_MAGNET_VERSION=BREAKABLE_CAMPAIGN_VERSION+':magnet-rails-v1';

export const breakableCopy:Record<BreakablePattern,readonly [name:string,hint:string]>={
 urns:['항아리 작업장','옆에서 아무 색이나 맞추거나 특수 타일을 맞혀 항아리를 깨요.'],
 statues:['토끼 석상 정원','작은 석상마다 6번 타격해요. 로켓과 폭탄으로 여러 석상을 한꺼번에 공략해요.'],
 'supply-urns':['항아리 보관 상자','보관 상자를 부수면 같은 칸에 항아리가 나타나요. 항아리까지 깨야 목표가 줄어요.'],
 crystals:['수정 동굴','로켓이나 폭탄 같은 특수 타일을 직접 맞혀 수정을 깨요.'],
 'crystal-crates':['수정 보관 상자','상자를 열어 수정을 꺼낸 뒤 특수 타일로 부숴요.'],
 'statue-court':['석상과 항아리 마당','넓은 석상과 떨어진 항아리를 폭탄이나 로켓으로 함께 타격해요.'],
 warehouse:['정원 창고','상자에 든 항아리와 수정을 꺼내 각각 부숴요.'],
 'frozen-urns':['얼어붙은 항아리길','항아리를 깨서 길을 연 뒤 바닥의 서리까지 걷어내요.'],
 'magnet-yard':['석상과 자석 울타리','석상은 어느 쪽에서든 타격하고 자석 레일은 양 끝부터 줄여요.'],
 'seed-hall':['항아리 너머 씨앗 배달','항아리를 부숴 통로를 열고 씨앗을 아래 출구까지 배달해요.'],
};

export function breakableCandidate(key:string,seed:number,engineVersion:string):LevelDefinition{
 const [kind,index,pressure]=key.split('/'),pattern=kind as BreakablePattern,variant=Number(index),raised=Number(pressure);
 const width=9,height=9;
 const at=(x:number,y:number)=>y*width+(variant===1?width-1-x:x);
 const shape=Array<boolean>(width*height).fill(true),obstacles:Obstacle[]=[],frost:Record<number,number>={},exits:number[]=[];
 const colors=[...COLORS.slice(0,5)],goals:Goal[]=[];
 const add=(kind:Obstacle['kind'],cells:number[],hp:number,contents?:Obstacle['contents'])=>{
  obstacles.push({id:`${kind}-${cells[0]}`,kind,anchor:cells[0]!,footprint:cells,hp,maxHp:hp,...(contents?{contents}:{})});
 };
 const statue=(x:number,y:number)=>add('statue',[at(x,y),at(x+1,y),at(x,y+1),at(x+1,y+1)],4+raised+Number(variant===2));
 const urn=(x:number,y:number,hp=2+raised)=>add('urn',[at(x,y)],hp);
 const crystal=(x:number,y:number)=>add('crystal',[at(x,y)],1+raised);
 const crate=(x:number,y:number,kind:'urn'|'crystal')=>add('supply-crate',[at(x,y)],1+raised,{kind,hp:kind==='urn'?2:1+raised});
 const line=(xs:number[],y:number)=>xs.map(x=>[x,y] as const);
 const bands=variant===0?[...line([0,1,3,5,7,8],5),...line([1,3,5,7],7)]:
  variant===1?[...line([0,1,6,7],4),...line([0,1,6,7],5),...line([0,7],6)]:
  [...line([1,2,3,4,5,6,7],5),...line([1,4,7],7)];
 for(const x of [0,8])for(const y of [0,8])shape[at(x,y)]=false;
 switch(pattern){
  case 'urns':
   for(const [x,y] of bands)urn(x,y,3+raised*2);
   if(variant===2)for(const x of [0,8])urn(x,3,2+raised);
   break;
  case 'statues':
   for(const [x,y] of bands)add('statue',[at(x,y)],6);
   break;
  case 'supply-urns':
   for(const [x,y] of bands)crate(x,y,'urn');
   break;
  case 'crystals':
   for(const [x,y] of bands)crystal(x,y);
   break;
  case 'crystal-crates':
   for(const [x,y] of bands)crate(x,y,'crystal');
   break;
  case 'statue-court':
   statue(2,3);statue(5,5);
   for(const x of [0,1,7,8])urn(x,4+(variant+x)%3);
   break;
  case 'warehouse':
   for(const [i,[x,y]] of bands.entries())crate(x,y,i%2?'crystal':'urn');
   for(const x of [2,6])add('statue',[at(x,2)],4+raised);
   break;
  case 'frozen-urns':
   for(const [x,y] of bands)urn(x===4&&y>=6?5:x,y);
   for(const x of [0,1,2,3,5,6,7,8])for(const y of [6,7])frost[at(x,y)]=1+raised;
   for(const y of [6,7,8])shape[at(4,y)]=false;
   break;
  case 'magnet-yard': {
   statue(0,5);statue(7,2);
   const path=supportsGliderSwarm(engineVersion)
    ? [at(1,2),at(1,3),at(2,3),at(3,3),at(3,4),at(3,5),at(4,5),at(5,5),at(6,5),...(raised?[at(6,4),at(6,3)]:[])]
    : [at(1,3),at(2,3),at(3,3),at(3,4),at(3,5),at(4,5)];
   obstacles.push({id:'rail',kind:'pipe',anchor:path[0]!,footprint:path,hp:path.length,maxHp:path.length,endOnly:true});
   urn(7,7);urn(6,6);
   break;
  }
  case 'seed-hall':
   for(const x of [2,6]){
    add('cabinet',[at(x,2),at(x,3)],2);
    obstacles.at(-1)!.seeds=1;exits.push(at(x,8));
    urn(x,6);urn(x-1,5,1+raised);urn(x+1,7,1+raised);
   }
   break;
 }
 const counts=new Map<Goal['kind'],number>();
 const count=(kind:Goal['kind'],value=1)=>counts.set(kind,(counts.get(kind)??0)+value);
 for(const obstacle of obstacles){
  if(obstacle.contents)count(obstacle.contents.kind);
  else count(obstacle.kind);
 }
 if(exits.length)count('seed',exits.length);
 const frostLayers=Object.values(frost).reduce((sum,layer)=>sum+layer,0);
 if(frostLayers)count('frost',frostLayers);
 for(const [kind,count] of counts)goals.push({kind,count,remaining:count});
 const [name,hint]=breakableCopy[pattern];
 const version=pattern==='magnet-yard'&&supportsGliderSwarm(engineVersion)?BREAKABLE_MAGNET_VERSION:BREAKABLE_CAMPAIGN_VERSION;
 return {id:401,version,engineVersion,width,height,shape,colors,goals,obstacles,moves:90,seed,
  ...(frostLayers?{frost}:{}),...(exits.length?{exits}:{}),
  difficulty:'normal',strategy:{id:pattern,name,hint}};
}
