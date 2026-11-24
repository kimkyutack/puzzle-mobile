export const GARDEN_CIRCUIT_OBSTACLES=['rail-pot','boomerang-pod','boomerang-bell','linked-crystal'] as const;
export type GardenCircuitObstacle=typeof GARDEN_CIRCUIT_OBSTACLES[number];
export type GardenCircuitKind='rail'|'boomerang'|'crystal';
export interface CircuitTrack {id:string;cells:number[]}
export interface CrystalGroup {id:string;cells:number[]}
export interface GardenCircuitBoard {kind:GardenCircuitKind;tracks:CircuitTrack[];groups:CrystalGroup[]}
export interface GardenCircuitPiece {track?:string;group?:string}
export const isCircuitObstacle=(kind:string):kind is GardenCircuitObstacle=>GARDEN_CIRCUIT_OBSTACLES.some(value=>value===kind);
export const CIRCUIT_BEATS={railMove:320,firstFlight:520,nextFlight:340,returnFlight:300,pause:60,spacing:95,crystalStep:85} as const;
