import {CONTENT_VERSION,supportsFlowGravity,type Color,type LevelDefinition} from '@garden/contracts';
import {EARLY_BALANCE_VERSION} from './early-balance';
import {PROGRESSIVE_CONTENT_VERSION} from './progressive-plan';

export const EARLY_MID_BALANCE_VERSION='early-mid-balance-v62';
type Adjustment=readonly [movesToRemove:number,color:Color,tiles:number,mode?:'add'];
const adjustments:Readonly<Partial<Record<number,Adjustment>>>={
 6: [0,"sun",6],
 7: [0,"sprout",6],
 8: [0,"berry",6],
 9: [0,"drop",6],
 11: [0,"sprout",6],
 12: [0,"berry",6],
 13: [0,"drop",6],
 14: [0,"flower",6],
 15: [0,"berry",6],
 16: [1,"drop",9],
 17: [1,"sun",9],
 18: [1,"sun",9],
 19: [1,"flower",9],
 21: [1,"drop",9],
 22: [1,"sun",9],
 23: [1,"sprout",9],
 24: [1,"flower",9],
 25: [1,"berry",9],
 26: [1,"drop",9],
 27: [1,"sun",9],
 28: [1,"berry",9],
 29: [1,"flower",9],
 31: [2,"drop",8],
 32: [2,"sun",7],
 34: [2,"flower",7],
 35: [0,"berry",24,"add"],
 36: [2,"drop",7],
 37: [2,"sun",7],
 39: [2,"flower",7],
 41: [2,"drop",7],
 43: [2,"sprout",10],
 44: [0,"flower",7],
 45: [2,"berry",8],
 46: [2,"drop",7],
 49: [2,"sun",7],
 51: [2,"drop",7],
 52: [2,"sun",7],
 55: [2,"berry",8],
 56: [2,"drop",7],
 57: [0,"berry",8],
 59: [0,"flower",24,"add"],
 61: [2,"sun",7],
 62: [0,"sun",30,"add"],
 64: [0,"flower",7],
 65: [2,"berry",7],
 66: [0,"sun",30,"add"],
 67: [2,"sun",8],
 69: [2,"berry",8],
 71: [0,"drop",30,"add"],
 79: [2,"flower",8],
 81: [2,"berry",8],
 85: [2,"sun",7],
 89: [2,"flower",7],
 91: [2,"drop",8],
 99: [2,"flower",7]
};

/** Apply only to the boards tested for this pass. An already-started run uses its saved level. */
export function earlyMidBalancedLevel(level:LevelDefinition):LevelDefinition{
 if(!supportsFlowGravity(level.engineVersion)||level.tutorial||level.gardenStage)return level;
 const adjustment=adjustments[level.id];
 const base=level.id<=30?CONTENT_VERSION:PROGRESSIVE_CONTENT_VERSION;
 if(!adjustment||level.version!==base+':'+EARLY_BALANCE_VERSION)return level;
 const [moves,color,tiles,mode]=adjustment;
 const existing=level.goals.find(goal=>goal.kind===color);
 if(mode==='add'?existing||level.goals.length>=4:!existing)return level;
 const goals=mode==='add'
  ?[...level.goals,{kind:color,count:tiles,remaining:tiles}]
  :level.goals.map(goal=>goal===existing?{...goal,count:goal.count+tiles,remaining:goal.remaining+tiles}:goal);
 return {...level,moves:level.moves-moves,goals,version:level.version+':'+EARLY_MID_BALANCE_VERSION};
}
