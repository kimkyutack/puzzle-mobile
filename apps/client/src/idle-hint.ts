import type {Action,GameState,Special} from '@garden/contracts';
import {findMatches,legalActions} from '@garden/core';

export const IDLE_HINT_DELAY_MS=5000;
/** After a hint has played for this long, the next-best different move takes its place. */
export const HINT_ROTATE_MS=3200;
export type BoardHint=Extract<Action,{type:'swap'|'tap'}>;
/** A suggested move plus the tiles it would clear, so the board can outline the whole match. */
export interface HintPlan {action:BoardHint;group:number[];forms?:Special}

// Moves that earn an item come first, the strongest item first.
const ITEM_RANK:Record<Special,number>={rainbow:6,bomb:5,glider:4,'wind-row':3,'wind-column':3,beehive:3};

/** Pure look-ahead: swap the two tiles on a copy and read the matches it would make. No RNG, no state change. */
function preview(state:GameState,from:number,to:number){
 const cells=state.cells.map(cell=>({...cell})),a=cells[from]!,b=cells[to]!;[a.tile,b.tile]=[b.tile,a.tile];
 const matches=findMatches({...state,cells},[to,from]).filter(match=>match.cells.includes(from)||match.cells.includes(to));
 const group=[...new Set(matches.flatMap(match=>match.cells))];
 const forms=matches.map(match=>match.kind).filter((kind):kind is Special=>!!kind).sort((x,y)=>ITEM_RANK[y]-ITEM_RANK[x])[0];
 return {group,forms};
}

/** Every distinct hint, best first: item-forming matches (by item), bigger plain matches, item combos, item swaps, then item taps. */
export function rankedBoardHints(state:GameState):HintPlan[]{
 const scored:Array<HintPlan&{score:number}>=[];
 for(const action of legalActions(state)){
  if(action.type==='tap'){scored.push({action,group:[action.at],score:1});continue;}
  if(action.type!=='swap')continue;
  const a=state.cells[action.from]?.tile,b=state.cells[action.to]?.tile;
  if(a?.kind==='normal'&&b?.kind==='normal'){
   const {group,forms}=preview(state,action.from,action.to);
   if(!group.length){scored.push({action,group:[action.from,action.to],score:0});continue;}
   // Show the tile that slides into the match as the one to drag.
   const moved=group.includes(action.to)?action:{type:'swap' as const,from:action.to,to:action.from};
   scored.push({action:moved,group,forms,score:(forms?100+ITEM_RANK[forms]*10:50)+group.length});
  }else scored.push({action,group:[action.from,action.to],score:a?.kind!=='normal'&&b?.kind!=='normal'?45:40});
 }
 return scored.sort((x,y)=>y.score-x.score).map(({score:_score,...plan})=>plan);
}

/** Prefer moves that make an item, then a real normal match, then a power-piece move. Never suggest a paid tool. */
export function nextBoardHint(state:GameState,selected:number|null=null):BoardHint|null{
 const ranked=rankedBoardHints(state);
 if(selected!==null){const own=ranked.find(plan=>hintCells(plan.action).includes(selected));if(own)return own.action;}
 return ranked[0]?.action??null;
}

/** Up to `limit` hints that touch different tiles, so rotating through them shows genuinely different moves. */
export function hintRotation(state:GameState,selected:number|null=null,limit=4):HintPlan[]{
 const ranked=rankedBoardHints(state),picked:HintPlan[]=[];
 const own=selected===null?undefined:ranked.find(plan=>hintCells(plan.action).includes(selected));
 for(const plan of own?[own,...ranked]:ranked){
  if(picked.length>=limit)break;
  const cells=new Set([...plan.group,...hintCells(plan.action)]);
  if(picked.some(other=>other===plan||[...other.group,...hintCells(other.action)].some(at=>cells.has(at))))continue;
  picked.push(plan);
 }
 return picked;
}

export function hintCells(hint:BoardHint):number[]{return hint.type==='swap'?[hint.from,hint.to]:[hint.at];}
/** Only uninterrupted, playable foreground time counts toward an automatic hint. */
export function createIdleHintClock(delay=IDLE_HINT_DELAY_MS){
 let dueAt:number|null=null;
 return {reset(){dueAt=null;},due(now:number,eligible:boolean){if(!eligible){dueAt=null;return false;}dueAt??=now+delay;return now>=dueAt;}};
}
