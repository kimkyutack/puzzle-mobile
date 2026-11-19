export type GardenStageKind='water'|'animal';
/** Fixed floor beneath ordinary match-three pieces. Gates never move with tiles. */
export interface GardenStageDefinition {
 kind:GardenStageKind;source:number;channels:number[];gates:number[];destinations:number[];
}
export interface GardenStageState extends GardenStageDefinition {
 blocked:number[];connected:number[];completed:number[];animalAt?:number;
}
