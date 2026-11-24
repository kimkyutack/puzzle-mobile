/** Follow-up garden rules are isolated from retained 1.31 replays. */
export const GARDEN_ASSAULT_OBSTACLES=['seed-cocoon','dandelion-turret','pottery-nest','ceramic-pot'] as const;
export type GardenAssaultObstacle=typeof GARDEN_ASSAULT_OBSTACLES[number];
export type GardenAssaultKind='dandelion'|'pottery';
export const isAssaultObstacle=(kind:string):kind is GardenAssaultObstacle=>GARDEN_ASSAULT_OBSTACLES.some(value=>value===kind);
export const ASSAULT_BEATS={seedFlight:520,seedSpacing:95,reveal:240} as const;
