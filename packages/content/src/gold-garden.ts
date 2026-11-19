import {COLORS,CONTINUOUS_REFILL_ENGINE_VERSION,POWER_RAINBOW_ENGINE_VERSION,type GameState,type LevelDefinition,type Obstacle} from '@garden/contracts';

export const GOLD_GARDEN_INTERVAL=100;
export const GOLD_GARDEN_MOVES=20;
export const LEGACY_GOLD_GARDEN_VERSION=1;
export const REFILL_GOLD_GARDEN_VERSION=2;
export const GOLD_GARDEN_VERSION=3;
export type GoldGardenVersion=typeof LEGACY_GOLD_GARDEN_VERSION|typeof REFILL_GOLD_GARDEN_VERSION|typeof GOLD_GARDEN_VERSION;
export const isGoldGardenMilestone=(level:number)=>Number.isSafeInteger(level)&&level>=GOLD_GARDEN_INTERVAL&&level%GOLD_GARDEN_INTERVAL===0;

const legacyPatterns=[
 [1,2,5,6,8,15,16,23,24,31,32,39,40,47,48,55,57,58,61,62],
 [0,1,2,5,6,7,8,15,16,23,32,39,40,47,56,57,58,61,62,63],
 [0,1,8,9,16,17,24,25,32,33,30,31,38,39,46,47,54,55,62,63],
] as const;

const width=9,height=9,center=4;
const lowDensity=(at:number)=>{
 const column=at%width,row=Math.floor(at/width);
 if(row===4||column===3||column===5)return false;
 return column!==1&&column!==7||row===0||row===3||row===5||row===8;
};
function goldGardenShape(milestone:number,version:GoldGardenVersion){
 if(version===REFILL_GOLD_GARDEN_VERSION||milestone<500)return Array.from({length:width*height},(_,at)=>lowDensity(at));
 return Array.from({length:width*height},(_,at)=>{
  if(milestone>=2000)return true;
  const column=at%width,row=Math.floor(at/width);
  return column!==3&&column!==5&&(row!==4||milestone>=1000);
 });
}
const startingCoin=(anchor:number):Obstacle=>({id:'gold-'+anchor,kind:'crate',anchor,footprint:[anchor],hp:1,maxHp:1});

/** The milestone fixes the layout and seed so the Worker can replay an interrupted round. */
export function goldGardenLevel(milestone:number,version:GoldGardenVersion=GOLD_GARDEN_VERSION):LevelDefinition{
 if(!isGoldGardenMilestone(milestone))throw new Error('GOLD_GARDEN_LEVEL');
 const round=milestone/GOLD_GARDEN_INTERVAL;
 const common={
  id:4_000_000+milestone,version:`gold-garden-v${version}`,colors:[...COLORS],
  moves:GOLD_GARDEN_MOVES,seed:(347281+round*23719)>>>0||1,difficulty:'normal' as const,
 };
 if(version===LEGACY_GOLD_GARDEN_VERSION){
  const coins=legacyPatterns[(round-1)%legacyPatterns.length]!;
  return {...common,engineVersion:POWER_RAINBOW_ENGINE_VERSION,width:8,height:8,shape:Array<boolean>(64).fill(true),
   goals:[{kind:'crate',count:coins.length,remaining:coins.length}],obstacles:coins.map(startingCoin)};
 }
 const shape=goldGardenShape(milestone,version);
 const coinCells=shape.flatMap((exists,at)=>exists&&at%width!==center?[at]:[]);
 const maximum=coinCells.length*GOLD_GARDEN_MOVES;
 const difficulty=version===REFILL_GOLD_GARDEN_VERSION||milestone<500?'normal':milestone<2000?'hard':'super';
 return {...common,engineVersion:CONTINUOUS_REFILL_ENGINE_VERSION,goldGarden:true,width,height,shape,difficulty,
  goals:[{kind:'crate',count:maximum,remaining:maximum}],obstacles:coinCells.map(startingCoin)};
}

export function goldGardenCoins(state:Pick<GameState,'goals'|'goldGarden'>){
 const coins=state.goals.find(goal=>goal.kind==='crate');
 return coins?(coins.count-coins.remaining)*(state.goldGarden?1:10):0;
}
