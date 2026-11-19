export const CHAPTER_OBSTACLES=[
 'long-match','cascade','axis','diagonal','two-colors','guard','cooldown','window','slide',
 'landing','relay','compost','junction','fusion','thaw','swap','color-wave',
] as const;

export type ChapterObstacleKind=typeof CHAPTER_OBSTACLES[number];
export type ChapterObstacle=
 | {kind:Exclude<ChapterObstacleKind,'axis'|'slide'|'cooldown'|'window'>}
 | {kind:'axis';axis:'row'|'column'}
 | {kind:'slide';side:'left'|'right'}
 | {kind:'cooldown'|'window';turn?:number};
