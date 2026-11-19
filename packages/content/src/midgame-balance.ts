import {supportsFlowGravity,type LevelDefinition} from '@garden/contracts';
import catalogue from './midgame-catalogue-v51.json';
export const MIDGAME_BALANCE_VERSION=catalogue.version;
/** Certified new-attempt data only. Retained runs replay their original board and rules. */
export function midgameBalancedLevel(source:LevelDefinition):LevelDefinition{
 if(!supportsFlowGravity(source.engineVersion)||source.gardenStage)return source;
 const selected=(catalogue.levels as unknown as Record<string,LevelDefinition>)[source.id];
 if(!selected)return source;
 return {...structuredClone(selected),engineVersion:source.engineVersion,campaign:source.campaign?{...source.campaign}:undefined,difficulty:source.difficulty};
}
