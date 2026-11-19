export const GARDEN_PUZZLE_OBSTACLES=['domino-slat','harvest-cart','soil-clod','soil-chip','garden-light','shadow-bud','wire-planter','fence-thicket'] as const;
export type GardenPuzzleObstacle=typeof GARDEN_PUZZLE_OBSTACLES[number];
export const GARDEN_PUZZLE_KINDS=['domino','cart','soil','shadow','wire','fence'] as const;
export type GardenPuzzleKind=typeof GARDEN_PUZZLE_KINDS[number];
export type GardenDirection='up'|'right'|'down'|'left';
export type WireLayers=0|1|2|3;
export interface GardenPuzzle {
 kind:GardenPuzzleKind;
 cells?:number[];
}
export interface GardenPuzzleState extends GardenPuzzle {
 lightAt?:number;
 posts?:number[];
}
const obstacleKinds=new Set<string>(GARDEN_PUZZLE_OBSTACLES);
export const isGardenPuzzleObstacle=(kind:string):kind is GardenPuzzleObstacle=>obstacleKinds.has(kind);
