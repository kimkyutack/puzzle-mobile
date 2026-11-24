import type {Player} from './index';

export const START_GIFT_LEVEL=32;
export const START_GIFT_STAGES=3;
export const START_GIFT_POWERS=['wind-row','glider','bomb','rainbow'] as const;
export type StartGiftPower=typeof START_GIFT_POWERS[number];
export interface StartGift {stage:1|2|3;placements:{at:number;kind:StartGiftPower}[]}

export const startGiftReached=(player:Pick<Player,'level'|'startGiftStreak'>)=>player.startGiftStreak!==undefined&&player.level>=START_GIFT_LEVEL;
export function startGiftStage(player:Pick<Player,'level'|'startGiftStreak'>){
 return startGiftReached(player)?Math.max(0,Math.min(START_GIFT_STAGES,Math.floor(player.startGiftStreak??0))):0;
}
export const startGiftPowers=(stage:number):readonly StartGiftPower[]=>START_GIFT_POWERS.slice(0,stage>0?Math.min(START_GIFT_STAGES,stage)+1:0);
