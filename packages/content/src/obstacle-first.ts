import {COLORS,supportsMatchFirst,type Goal,type LevelDefinition,type Obstacle} from '@garden/contracts';

const colorGoals=new Set<Goal['kind']>(COLORS);
const version='obstacle-banks-v1';

export const obstacleBankCopy={
 crate:['나무 상자 둔덕','상자 옆에서 어떤 색이든 맞추거나 로켓과 꽃폭탄으로 여러 상자를 함께 부수세요.'],
 urn:['항아리 밭','항아리 옆에서 타일을 맞추거나 특수 블록을 맞혀요. 금이 간 항아리는 한 번 더 맞히면 깨져요.'],
 lantern:['별빛 등불 둔덕','등불 옆에서 타일을 맞추거나 특수 블록을 맞혀요. 별빛이 드러난 등불은 한 번 더 맞히면 깨져요.'],
} as const;

/** Pick one connected bank, preserving exits, inlets, guides, scripted paths,
 * seeded powers and existing objectives. Its upper edge remains playable. */
function obstacleBank(level:LevelDefinition,kept:readonly Obstacle[],count:number):number[]{
 const {width,height}=level;
 const exits=new Set(level.exits);
 const reserved=new Set([
  ...kept.flatMap(obstacle=>[...obstacle.footprint,...(obstacle.path??[])]),
  ...(level.inlets??[]),...exits,...(level.protectedCells??[]),level.startBoosterGuide?.cell,
  ...(level.gravity??[]).filter(lane=>lane.some(at=>exits.has(at))).flat(),
 ]);
 const open=(at:number)=>!!level.shape[at]&&!reserved.has(at)&&!level.frost?.[at]&&
  (!level.initial||level.initial[at]?.kind==='normal');
 const span=Math.min(width,Math.ceil(count/2));
 const alignment=[0,Math.floor((width-span)/2),width-span][level.id%3]!;
 let best:number[]=[],bestScore=-Infinity;
 for(let top=2;top<height-1;top++)for(let left=0;left<=width-span;left++){
  const candidates=new Set<number>();
  for(let y=top;y<Math.min(top+3,height);y++)for(let x=left;x<left+span;x++){
   const at=y*width+x;
   if(open(at))candidates.add(at);
  }
  for(const first of candidates){
   const bank=[first];candidates.delete(first);
   for(let i=0;i<bank.length;i++){
    const at=bank[i]!,x=at%width;
    const neighbors=[x<width-1?at+1:-1,x>0?at-1:-1,at+width,at-width];
    for(const next of neighbors)if(candidates.delete(next))bank.push(next);
   }
   const cells=bank.slice(0,count);
   const score=cells.length*100+top*2-Math.abs(left-alignment)*3;
   if(score>bestScore){best=cells;bestScore=score;}
  }
 }
 return best;
}

export function obstacleFirstLevel(level:LevelDefinition):LevelDefinition{
 if(!supportsMatchFirst(level.engineVersion)||level.id<=10||level.tutorial||level.gardenStage||level.gardenPuzzle||level.devices)return level;
 const colors=level.goals.filter(goal=>colorGoals.has(goal.kind));
 const goals=level.goals.filter(goal=>!colorGoals.has(goal.kind));
 if(!colors.length){
  if(!level.strategy?.id.startsWith('obstacle-garden/'))return level;
  const lanterns=level.obstacles.filter(obstacle=>obstacle.kind==='starlight-lantern');
  if(lanterns.length<8)return level;
  const kept=level.obstacles.filter(obstacle=>obstacle.kind!=='starlight-lantern');
  const bank=obstacleBank(level,kept,lanterns.length);
  if(bank.length!==lanterns.length)return level;
  const moves=Math.max(level.moves,kept.some(obstacle=>obstacle.kind==='statue')?23:16);
  return {...level,moves,version:level.version+':'+version,obstacles:[...kept,...lanterns.map((lantern,i)=>{
   const anchor=bank[i]!;
   return {...lantern,anchor,footprint:[anchor]};
  })]};
 }

 if(goals.length&&colors.every(goal=>goal.count<30))return level;
 const maxColor=Math.max(...colors.map(goal=>goal.count));
 const occupied=level.obstacles.reduce((sum,obstacle)=>sum+obstacle.footprint.length,0);
 const count=Math.max(6,Math.min(16,Math.round(maxColor/4),28-occupied));
 const bank=obstacleBank(level,level.obstacles,count);
 if(!bank.length)return level;
 const theme=level.id<51||level.id%3===0?'crate':level.id<100||level.id%3===1?'urn':'lantern';
 const kind=theme==='lantern'?'starlight-lantern':theme;
 const hasRail=level.obstacles.some(obstacle=>obstacle.kind==='pipe');
 const obstacles:Obstacle[]=bank.map((anchor,index)=>{
  const maxHp=theme==='lantern'?3:theme==='urn'||index%3===0&&level.id>=31?2:1;
  const hp=theme==='lantern'&&hasRail&&index%2===0?2:maxHp;
  return {id:'obstacle-bank-'+anchor,kind,anchor,footprint:[anchor],hp,maxHp};
 });
 // A kind already in the objective list must count both banks. The game
 // validator requires a goal to equal the number of matching board pieces.
 const existing=level.obstacles.filter(obstacle=>obstacle.kind===kind||obstacle.contents?.kind===kind).length;
 const total=existing+obstacles.length;
 const startingBank=new Set(bank);
 const [name,hint]=obstacleBankCopy[theme];
 const keepHint=level.strategy&&level.strategy.id!=='meadow'&&level.strategy.id!=='fusion-festival';
 return {...level,version:level.version+':'+version,
  goals:[...goals.filter(goal=>goal.kind!==kind),{kind,count:total,remaining:total}],
  obstacles:[...level.obstacles,...obstacles],
  ...(level.initial?{initial:level.initial.map((tile,at)=>startingBank.has(at)?null:tile)}:{}),
  strategy:keepHint?level.strategy:{id:level.strategy?.id??'obstacle-bank/'+theme,name,hint},
 };
}
