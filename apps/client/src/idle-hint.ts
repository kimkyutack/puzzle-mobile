import type {Action,GameState} from '@garden/contracts';
import {legalActions} from '@garden/core';

export const IDLE_HINT_DELAY_MS=5000;
export type BoardHint=Extract<Action,{type:'swap'|'tap'}>;
/** Prefer a real normal match, then a power-piece move. Never suggest a paid tool. */
export function nextBoardHint(state:GameState,selected:number|null=null):BoardHint|null{
 const actions=legalActions(state),swaps=actions.filter((action):action is Extract<Action,{type:'swap'}>=>action.type==='swap');
 return (selected===null?undefined:swaps.find(action=>action.from===selected||action.to===selected))
  ??swaps.find(action=>state.cells[action.from]?.tile?.kind==='normal'&&state.cells[action.to]?.tile?.kind==='normal')
  ??swaps[0]??actions.find((action):action is Extract<Action,{type:'tap'}>=>action.type==='tap')??null;
}
export function hintCells(hint:BoardHint):number[]{return hint.type==='swap'?[hint.from,hint.to]:[hint.at];}
/** Only uninterrupted, playable foreground time counts toward an automatic hint. */
export function createIdleHintClock(delay=IDLE_HINT_DELAY_MS){
 let dueAt:number|null=null;
 return {reset(){dueAt=null;},due(now:number,eligible:boolean){if(!eligible){dueAt=null;return false;}dueAt??=now+delay;return now>=dueAt;}};
}
