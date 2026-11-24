/** Original garden obstacles. Rules belong to engine 1.30, never older replays. */
export const VARIED_OBSTACLES=['tea-caddy','honeycomb','acorn-nest','cloud-pillow','petal-launcher','sun-gate','mushroom-cluster','crystal-geode','star-core'] as const;
export type VariedObstacleKind=typeof VARIED_OBSTACLES[number];
export const isVariedObstacle=(kind:string):kind is VariedObstacleKind=>VARIED_OBSTACLES.some(value=>value===kind);
export const variedObstacleNames:Record<VariedObstacleKind,string>={
 'tea-caddy':'꽃차 찻통',honeycomb:'황금 밀랍집','acorn-nest':'도토리 둥지','cloud-pillow':'별구름 쿠션',
 'petal-launcher':'꽃잎 발사기','sun-gate':'태양 정원문','mushroom-cluster':'통통 버섯','crystal-geode':'별수정 원석','star-core':'별수정',
};
/** Authored frames, never a scaled copy of a wooden box. */
export function variedObstacleArt(obstacle:{kind:string;hp:number;maxHp:number}):string|undefined{
 if(!isVariedObstacle(obstacle.kind))return;
 const stage=obstacle.hp===obstacle.maxHp?0:obstacle.hp<=Math.ceil(obstacle.maxHp/3)?2:1;
 return `obstacle-${obstacle.kind}-${stage}`;
}
