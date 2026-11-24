import type {Action,GameEvent,GameState,Special} from '@garden/contracts';
import {supportsBeehive} from '@garden/contracts';
import {applyAction,findMatches,legalActions} from '@garden/core';

export interface ItemGuide {kind:Special;phase:'make'|'use';action:Extract<Action,{type:'swap'|'tap'}>;cells:number[]}
const powers:readonly Special[]=['wind-row','wind-column','glider','bomb','rainbow','beehive'];
const family=(kind:Special)=>kind==='wind-row'||kind==='wind-column'?'rocket':kind;
export const itemGuideKey=(kind:Special,phase:'made'|'used')=>`lumi-item-v1:${family(kind)}:${phase}`;


/** Read-only inspection of the actual settled board. No inserted tiles, refill
 * manipulation or level-specific practice boards. Native simulation confirms
 * that the highlighted swap really produces the item under this run's rules. */
export function contextualItemGuide(state:GameState,seen:readonly string[]):ItemGuide|null{
 if(state.levelId>100||state.status!=='playing'||state.goldGarden)return null;
 for(const kind of powers){
  if(!seen.includes(itemGuideKey(kind,'made'))||seen.includes(itemGuideKey(kind,'used')))continue;
  const at=state.cells.findIndex(cell=>cell.tile?.kind===kind&&!cell.obstacleId);
  if(at>=0)return {kind,phase:'use',action:{type:'tap',at},cells:[at]};
 }
 // Device-only boards can relocate a swap through portals/conveyors. Their
 // separate mechanic tutorials retain control instead of guessing a pattern.
 if(state.devices||state.gardenPuzzle?.kind==='cart')return null;
 for(const action of legalActions(state)){
  if(action.type!=='swap')continue;
  const a=state.cells[action.from]?.tile,b=state.cells[action.to]?.tile;
  if(a?.kind!=='normal'||b?.kind!=='normal'||a.color===b.color)continue;
  const cells=[...state.cells];cells[action.from]={...cells[action.from]!,tile:b};cells[action.to]={...cells[action.to]!,tile:a};
  const matches=findMatches({...state,cells},[action.to,action.from]);
  if(supportsBeehive(state.engineVersion)){
   const source=matches.find(m=>m.cells.includes(action.from)),destination=matches.find(m=>m.cells.includes(action.to));
   if(source&&destination&&source!==destination&&source.cells.length===3&&destination.cells.length===3&&!source.kind&&!destination.kind)destination.kind='beehive';
  }
  for(const match of matches){
   const kind=match.kind;if(!kind||seen.includes(itemGuideKey(kind,'made')))continue;
   const result=applyAction(state,action);
   if(!result.accepted||result.state.status==='error'||!result.events.some(event=>event.type==='spawn'&&event.kind===kind))continue;
   const group=kind==='beehive'?matches.flatMap(m=>m.cells):match.cells;
   return {kind,phase:'make',action,cells:[...new Set([...group,action.from,action.to])]};
  }
 }
 return null;
}
export function itemGuideAllows(guide:ItemGuide,action:Action):boolean{
 const expected=guide.action;
 if(expected.type==='tap')return action.type==='tap'&&expected.at===action.at;
 return action.type==='swap'&&(expected.from===action.from&&expected.to===action.to||expected.from===action.to&&expected.to===action.from);
}
export function learnedItemGuidance(guide:ItemGuide|null,events:readonly GameEvent[],seen:readonly string[]):string[]{
 const learned:string[]=[];
 if(guide?.phase==='make'&&events.some(event=>event.type==='spawn'&&event.kind===guide.kind))learned.push(itemGuideKey(guide.kind,'made'),guide.kind);
 for(const kind of powers)if((seen.includes(itemGuideKey(kind,'made'))||learned.includes(itemGuideKey(kind,'made')))&&events.some(event=>event.type==='special'&&event.kind===kind))learned.push(itemGuideKey(kind,'used'));
 return [...new Set(learned)];
}
