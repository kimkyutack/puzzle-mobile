import {describe,it,expect} from 'vitest';
import {createGame,applyAction,stateHash,legalActions} from '@garden/core';
import {getLevel} from '@garden/content';
import {createIdleHintClock,IDLE_HINT_DELAY_MS,HINT_ROTATE_MS,hintRotation,nextBoardHint,hintCells,rankedBoardHints} from '../apps/client/src/idle-hint';

describe('idle hint delay and playable moves',()=>{
 it('waits five uninterrupted seconds and restarts after player input',()=>{
  const clock=createIdleHintClock();expect(IDLE_HINT_DELAY_MS).toBe(5000);expect(clock.due(100,true)).toBe(false);expect(clock.due(5099,true)).toBe(false);expect(clock.due(5100,true)).toBe(true);
  clock.reset();expect(clock.due(5200,true)).toBe(false);expect(clock.due(10199,true)).toBe(false);expect(clock.due(10200,true)).toBe(true);
 });
 it('does not count time spent in a modal, animation, held gesture or background',()=>{
  const clock=createIdleHintClock();clock.due(0,true);expect(clock.due(4990,false)).toBe(false);expect(clock.due(60000,false)).toBe(false);expect(clock.due(61000,true)).toBe(false);expect(clock.due(65999,true)).toBe(false);expect(clock.due(66000,true)).toBe(true);
 });
 it('offers an accepted move on every published board without changing state or consuming RNG, moves or inventory',()=>{
  for(let level=1;level<=200;level++){const state=createGame(getLevel(level)),before=stateHash(state),hint=nextBoardHint(state);expect(hint,`level ${level}`).not.toBeNull();expect(stateHash(state)).toBe(before);if(!hint)continue;
   const cells=hintCells(hint);expect(cells.length).toBe(hint.type==='swap'?2:1);for(const index of cells){expect(state.cells[index]?.exists).toBe(true);expect(state.cells[index]?.obstacleId).toBeUndefined();expect(state.cells[index]?.tile?.kind).not.toBe('seed');}expect(applyAction(state,hint).accepted).toBe(true);
  }
 });
 it('prefers an ordinary match over using a power piece',()=>{
  const state=createGame(getLevel(1));state.cells[48]!.tile={id:500,kind:'bomb'};const hint=nextBoardHint(state);expect(hint?.type).toBe('swap');if(hint?.type==='swap'){expect(state.cells[hint.from]?.tile?.kind).toBe('normal');expect(state.cells[hint.to]?.tile?.kind).toBe('normal');}
 });
 it('helps complete a valid currently selected move',()=>{
  const state=createGame(getLevel(5)),swap=legalActions(state).find(action=>action.type==='swap');expect(swap?.type).toBe('swap');if(swap?.type!=='swap')return;const hint=nextBoardHint(state,swap.to);expect(hint).not.toBeNull();expect(hintCells(hint!)).toContain(swap.to);
 });
 it('falls back to combining powers or tapping an isolated power when no normal match is available',()=>{
  const state=createGame(getLevel(1));for(const cell of state.cells)cell.tile=null;state.cells[24]!.tile={id:500,kind:'bomb'};state.cells[25]!.tile={id:501,kind:'rainbow'};expect(nextBoardHint(state)).toEqual({type:'swap',from:24,to:25});state.cells[25]!.tile=null;expect(nextBoardHint(state)).toEqual({type:'tap',at:24});
 });
 it('shows no move on completed, failed, exhausted or empty boards',()=>{
  const state=createGame(getLevel(1));for(const status of ['won','lost','error'] as const){state.status=status;expect(nextBoardHint(state)).toBeNull();}state.status='playing';state.moves=0;expect(nextBoardHint(state)).toBeNull();state.moves=5;for(const cell of state.cells)cell.tile=null;expect(nextBoardHint(state)).toBeNull();
 });
});

describe('ranked, rotating hints',()=>{
 it('puts item-forming matches first and outlines the whole match the move would clear',()=>{
  let withItem=0;
  for(let level=1;level<=120;level++){
   const state=createGame(getLevel(level)),before=stateHash(state),ranked=rankedBoardHints(state);expect(stateHash(state)).toBe(before);
   const firstItem=ranked.findIndex(plan=>plan.forms);
   if(firstItem>=0){withItem++;expect(ranked[0]!.forms,`level ${level}`).toBeDefined();}
   for(const plan of ranked.filter(plan=>plan.action.type==='swap'&&plan.group.length>2)){
    if(plan.action.type!=='swap')continue;
    expect(plan.group).toContain(plan.action.to);
    const result=applyAction(state,plan.action),fall=result.events.findIndex(event=>event.type==='fall'||event.type==='spawn'),firstWave=result.events.slice(0,fall<0?undefined:fall).flatMap(event=>event.type==='remove'||event.type==='hit'||event.type==='special'?event.cells:[]);
    expect(result.accepted).toBe(true);// The tile where an item is born is consumed into the item rather than removed.
    const born=new Set(result.events.flatMap(event=>event.type==='spawn'&&event.kind!=='normal'?event.cells:[]));for(const at of plan.group)if(!born.has(at))expect(firstWave).toContain(at);
    break;
   }
  }
  expect(withItem).toBeGreaterThan(0);
 });
 it('rotates through different moves that never share a tile',()=>{
  let rotating=0;
  for(let level=1;level<=60;level++){
   const plans=hintRotation(createGame(getLevel(level)));if(plans.length>1)rotating++;
   const seen=new Set<number>();
   for(const plan of plans)for(const at of new Set([...plan.group,...hintCells(plan.action)])){expect(seen.has(at),`level ${level}`).toBe(false);seen.add(at);}
  }
  expect(rotating).toBeGreaterThan(30);expect(HINT_ROTATE_MS).toBeGreaterThan(2000);
 });
});
