import type {Player,Run} from '@garden/contracts';
import {RESTORATIONS} from '@garden/content';

export const FIRST_GARDEN_RESTORATION=RESTORATIONS[0]!;
export type FirstGardenStep='puzzle'|'restore';
/** Account progression is authoritative, so the guide also survives another device or a reload. */
export function firstGardenStep(player:Pick<Player,'level'|'restored'>|null,run?:Pick<Run,'level'|'state'|'status'>|null):FirstGardenStep|null{
 if(!player||player.restored.length||player.level>2)return null;
 if(player.level===1)return 'puzzle';
 if(run?.level.id===1&&run.status==='active'&&run.state.status!=='won')return 'puzzle';
 return 'restore';
}
export function firstPuzzleResult(player:Pick<Player,'level'|'restored'>,run:Pick<Run,'level'>){
 return player.level<=2&&!player.restored.length&&run.level.id===1;
}
