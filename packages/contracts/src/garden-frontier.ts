export const GARDEN_FRONTIER_OBSTACLES=['shelf-vase','canopy-orchid','awning-crank','journey-vine','journey-relic'] as const;
export type GardenFrontierObstacle=typeof GARDEN_FRONTIER_OBSTACLES[number];
export type GardenFrontierKind='shelf'|'shade'|'expedition';
export interface FrontierGroup {id:string;cells:number[];source?:string}
export interface GardenFrontierBoard {kind:GardenFrontierKind;groups:FrontierGroup[]}
export interface GardenFrontierPiece {group?:string;locked?:true}
export const isFrontierObstacle=(kind:string):kind is GardenFrontierObstacle=>GARDEN_FRONTIER_OBSTACLES.some(value=>value===kind);
export const FRONTIER_BEATS={unroll:460,shelfCollapse:420,journeySwap:340,journeyEnter:820} as const;
