import type {Obstacle} from '@garden/contracts';
import {BREAKABLE_OBSTACLES} from '../../../packages/contracts/src/breakable-obstacles';

export const OBSTACLE_IMAGE_KINDS=['crate','vine','pot','moss','cabinet','pipe','bud','carousel','curtain',...BREAKABLE_OBSTACLES] as const;
const kinds=new Set<string>(OBSTACLE_IMAGE_KINDS);
export const OBSTACLE_FRAGMENT_KINDS=[...OBSTACLE_IMAGE_KINDS,'frost','garden-gate','rack-frame'] as const;
export function mobileObstacleArt(o:Pick<Obstacle,'kind'|'hp'|'maxHp'>&Partial<Obstacle>,covered=false):string|undefined{
 if(!kinds.has(o.kind))return;
 let family:string=o.cover?.kind??o.kind;
 const stage=o.hp===o.maxHp?0:o.hp<=Math.ceil(o.maxHp/3)?2:1;
 if(o.kind==='garden-beacon'&&(o.charge??0)>=(o.siege?.capacity??Infinity))family='beacon-lit';
 if(o.kind==='thorn-barricade'&&o.siege?.guard)family='thorn-guard';
 if(o.kind==='bloom-bud'&&o.siege?.shielded)family='bloom-shield';
 if(o.kind==='shadow-bud'&&covered)family='shadow-covered';
 if(o.kind==='wire-planter')return o.wire?`mobile-wire-planter-${o.wire===3?0:o.wire===1?1:2}`:'mobile-garden-planter-0';
 return `mobile-${family}-${stage}`;
}
export function mobileObstacleFragments(kind:string):readonly string[]|undefined{
 if(!kinds.has(kind)&&kind!=='frost'&&kind!=='garden-gate'&&kind!=='rack-frame')return;
 return [0,1,2].map(i=>`mobile-${kind}-debris-${i}`);
}
/** Existing effects use semantic IDs; route their bodies to the same newly authored sprites. */
export function mobileObstacleAlias(id:string):string|undefined{
 const siege=/^siege-(.+)-(\d)$/.exec(id);
 if(siege){const family=siege[1]!,stage=Number(siege[2]);if(family==='garden-beacon')return `mobile-${stage>=3?'beacon-lit':'garden-beacon'}-${stage>=3?stage-3:0}`;
  if(family==='thorn-shield')return `mobile-thorn-guard-${stage}`;
  if(kinds.has(family))return `mobile-${family}-${Math.min(2,stage)}`;
 }
 const varied=/^obstacle-(.+)-([012])$/.exec(id);if(varied&&kinds.has(varied[1]!))return `mobile-${varied[1]}-${varied[2]}`;
 const aliases:Record<string,string>={'crate_1':'crate-2','crate_2':'crate-1','crate_3':'crate-0','frost':'frost-0','frost-thick':'frost-0','frost-cracked':'frost-2','starlight-lantern-open':'starlight-lantern-2','starlight-lantern-cracked':'starlight-lantern-1','shadow-bud-covered':'shadow-covered-0','siege-bloom-shield':'bloom-shield-0','siege-restored-bed':'bloom-bed-0','siege-rack-frame':'rack-frame-0','siege-awning-row':'awning-row-0','siege-rail-deck':'rail-deck-0','board-statue':'statue-0','board-domino-slat':'domino-slat-0','board-harvest-cart':'harvest-cart-0','board-carousel':'carousel-0','stage_mud_gate_v33':'garden-gate-0','mechanic_bud_v20':'bud-0','mechanic_carousel_v20':'carousel-0','mechanic_curtain_v20':'curtain-0','mechanic_pipe_v20':'pipe-0','magnet_rail_end_v39':'pipe-0'};
 if(aliases[id])return 'mobile-'+aliases[id];
 const damaged=id.endsWith('-damaged')?id.slice(0,-8):undefined;
 if(damaged&&kinds.has(damaged))return `mobile-${damaged}-2`;
 return kinds.has(id)?`mobile-${id}-0`:undefined;
}
