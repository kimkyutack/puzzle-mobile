import type {Action,GameState,Special} from '@garden/contracts';
import {findMatches,legalActions} from '@garden/core';

export const IDLE_HINT_DELAY_MS=5000;
/** Each hint plays for this long (several nudges) before the next different move takes its place. */
export const HINT_ROTATE_MS=9000;
/** The outline fades in, and fades out before the next move appears, so hints never jump. */
export const HINT_FADE_IN_MS=350,HINT_FADE_OUT_MS=550;
/** One nudge cycle: the tile to move bumps twice toward its target, then rests. */
export const HINT_NUDGE_CYCLE_MS=1800;
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

/** How visible a hint is `ms` after it appeared: fades in, holds, and (when another move follows) fades out. */
export function hintVisibility(ms:number,rotates:boolean){
 const fadeIn=Math.min(1,Math.max(0,ms/HINT_FADE_IN_MS));
 return rotates?fadeIn*Math.min(1,Math.max(0,(HINT_ROTATE_MS-ms)/HINT_FADE_OUT_MS)):fadeIn;
}
/** How far (0..1 of the nudge reach) the tile to move leans toward its target: two quick bumps, then a rest. */
export function hintNudge(ms:number){
 const t=ms-HINT_FADE_IN_MS;if(t<0)return 0;
 const phase=t%HINT_NUDGE_CYCLE_MS,bump=320;
 if(phase>=bump*2)return 0;
 return Math.sin(Math.PI*(phase%bump)/bump)**2*(phase<bump?1:.6);
}
/**
 * The outer contour of a group of cells as closed loops of grid corners (in cell units, clockwise),
 * so the whole match can be traced with one line instead of a frame per tile.
 */
export function matchOutline(cells:readonly number[],columns:number):Array<Array<[number,number]>>{
 const inside=new Set(cells),key=(x:number,y:number)=>`${x},${y}`,next=new Map<string,[number,number]>();
 const has=(x:number,y:number)=>x>=0&&x<columns&&inside.has(y*columns+x);
 for(const at of inside){const x=at%columns,y=Math.floor(at/columns);
  if(!has(x,y-1))next.set(key(x,y),[x+1,y]);
  if(!has(x+1,y))next.set(key(x+1,y),[x+1,y+1]);
  if(!has(x,y+1))next.set(key(x+1,y+1),[x,y+1]);
  if(!has(x-1,y))next.set(key(x,y+1),[x,y]);
 }
 const loops:Array<Array<[number,number]>>=[];
 while(next.size){
  const [startKey,first]=next.entries().next().value as [string,[number,number]];next.delete(startKey);
  const start=startKey.split(',').map(Number) as [number,number],loop:Array<[number,number]>=[start];let at=first;
  while(key(...at)!==startKey){loop.push(at);const step=next.get(key(...at));if(!step)break;next.delete(key(...at));at=step;}
  // Keep only the corners: drop points that sit in the middle of a straight run.
  loops.push(loop.filter((point,i)=>{const a=loop[(i+loop.length-1)%loop.length]!,b=loop[(i+1)%loop.length]!;return (point[0]-a[0])*(b[1]-point[1])!==(point[1]-a[1])*(b[0]-point[0]);}));
 }
 return loops;
}
