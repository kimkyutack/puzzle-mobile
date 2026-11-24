import {GARDEN_CIRCUIT_OBSTACLES,type GardenCircuitKind} from './garden-circuit';
import {GARDEN_FRONTIER_OBSTACLES,type GardenFrontierKind} from './garden-frontier';
import {GARDEN_ASSAULT_OBSTACLES,type GardenAssaultKind} from './garden-assault';
export const GARDEN_SIEGE_OBSTACLES=[...GARDEN_CIRCUIT_OBSTACLES,...GARDEN_FRONTIER_OBSTACLES,...GARDEN_ASSAULT_OBSTACLES,'thorn-barricade','roller-pin','garden-roller','dew-cache','garden-beacon','bloom-bud'] as const;
export type GardenSiegeObstacle=typeof GARDEN_SIEGE_OBSTACLES[number];
export type GardenSiegeKind='roller'|'beacon'|'bloom'|GardenAssaultKind|GardenFrontierKind|GardenCircuitKind;
export interface GardenSiegeBoard {kind:GardenSiegeKind;/** Decorative goal-only cells never secretly contain or generate colored tiles. */bank:number[]}
export interface GardenSiegePiece {capacity?:number;shielded?:true;guard?:'beacon'}
export const isSiegeObstacle=(kind:string):kind is GardenSiegeObstacle=>GARDEN_SIEGE_OBSTACLES.some(value=>value===kind);
export const SIEGE_BEATS={collect:380,roll:780,pulse:580,unlock:420,spacing:120} as const;
export function gardenSiegeArt(o:{kind:string;hp:number;maxHp:number;charge?:number;siege?:GardenSiegePiece}):string|undefined{
 if(!isSiegeObstacle(o.kind))return;
 if(o.kind==='thorn-barricade'&&o.siege?.guard)return `siege-thorn-shield-${o.hp===o.maxHp?0:o.hp===1?2:1}`;
 if(o.kind==='bloom-bud'&&o.siege?.shielded)return 'siege-bloom-shield';
 if(o.kind==='garden-beacon'){
  const required=o.siege?.capacity??1,charge=o.charge??0;
  // Exact socket progress is drawn with authored dew-orb sprites on frame 0.
  const stage=charge<required?0:o.hp===o.maxHp?3:o.hp===1?5:4;
  return `siege-garden-beacon-${stage}`;
 }
 const stage=o.hp===o.maxHp?0:o.kind==='garden-roller'&&o.maxHp===2?1:o.hp<=Math.ceil(o.maxHp/3)?2:1;
 return `siege-${o.kind}-${stage}`;
}
