import {GARDEN_SIEGE_OBSTACLES} from './garden-siege';
import {VARIED_OBSTACLES} from './varied-obstacles';
const gardenObstacles=['starlight-lantern','wind-pod','windmill'] as const;
export const GARDEN_OPENERS=['greenhouse-sluice','vine-knot','rotating-shelf'] as const;
export type GardenOpenerKind=typeof GARDEN_OPENERS[number];
export interface PlanterCover {source:string;kind:GardenOpenerKind}
export const BREAKABLE_OBSTACLES=[...GARDEN_SIEGE_OBSTACLES,...VARIED_OBSTACLES,'urn','statue','supply-crate','crystal','flower-seal',...gardenObstacles,...GARDEN_OPENERS,'garden-planter',...GARDEN_PUZZLE_OBSTACLES] as const;
export type BreakableObstacleKind=typeof BREAKABLE_OBSTACLES[number];
export type CrateContents={kind:'urn'|'crystal'|'star-core'|'ceramic-pot';hp:number;innerCrateHp?:number};

const kinds=new Set<string>(BREAKABLE_OBSTACLES);
const openers=new Set<string>(GARDEN_OPENERS);
export const isBreakableObstacle=(kind:string):kind is BreakableObstacleKind=>kinds.has(kind);

export const isObstacleGardenKind=(kind:string)=>gardenObstacles.some(entry=>entry===kind);
export const isGardenOpener=(kind:string):kind is GardenOpenerKind=>openers.has(kind);
import {GARDEN_PUZZLE_OBSTACLES} from './garden-puzzles';

