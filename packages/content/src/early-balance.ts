import type {LevelDefinition} from '@garden/contracts';
export const EARLY_BALANCE_VERSION='early-balance-v41';
/** New-attempt content only. Keep onboarding 1-5 and everything after 100 intact.
 * Fixed-board proof margins were too tight for randomized beginner attempts. */
export function earlyBalancedLevel(source:LevelDefinition):LevelDefinition {
 if(source.id<=5||source.id>100||source.version.endsWith(':'+EARLY_BALANCE_VERSION))return source;
 const early=source.id<=30,beat=source.campaign?.beat;
 const [floor,extra,cap]:[number,number,number]=source.gardenStage?[22,5,30]:source.difficulty==='super'?[25,6,32]:source.difficulty==='hard'?[22,early?4:5,30]:beat==='easy'?[22,early?3:4,30]:[20,early?3:4,30];
 const moves=Math.max(source.moves,Math.min(cap,Math.max(floor,source.moves+extra)));
 if(moves===source.moves)return source;
 return {...source,moves,version:source.version+':'+EARLY_BALANCE_VERSION};
}
