import { describe,it,expect } from 'vitest';
import { createGame,applyAction,findMatches,legalActions,replay,stateHash,validateLevel } from '@garden/core';
import { getLevel,APPROVED_LEVEL_COUNT } from '@garden/content';
import type { Action } from '@garden/contracts';
import solutions from '../packages/content/src/campaign-solutions.json';
const logs=solutions as Record<string,{actions:Action[];hash:string;status:string}>;
describe('published certified content',()=>{
 it('preserves 300 version-pinned authored levels with valid starting boards',()=>{expect(APPROVED_LEVEL_COUNT).toBeGreaterThanOrEqual(10000);for(let id=1;id<=300;id++){const level=getLevel(id);expect(level.approved,`level ${id}`).toBe(true);expect(validateLevel(level),`level ${id}`).toEqual([]);const state=createGame(level);expect(findMatches(state),`level ${id}`).toHaveLength(0);expect(legalActions(state).length,`level ${id}`).toBeGreaterThan(0);}});
 it('replays all 300 stored no-purchase winning proofs exactly',()=>{for(let id=1;id<=300;id++){const solution=logs[String(id)]!;expect(solution.actions.every(a=>a.type==='swap'||a.type==='tap'),`level ${id}`).toBe(true);const result=replay(getLevel(id),solution.actions);expect(result.accepted,`level ${id}`).toBe(true);expect(result.state.status,`level ${id}`).toBe('won');expect(stateHash(result.state),`level ${id}`).toBe(solution.hash);}});
 it('generates the promised guided special on tutorial levels 2–5',()=>{for(let id=2;id<=5;id++){const level=getLevel(id),t=level.tutorial!;const result=applyAction(createGame(level),{type:'swap',from:t.from,to:t.to});expect(result.accepted).toBe(true);expect(result.events.filter(e=>e.type==='spawn'&&e.kind!=='normal')[0]?.kind).toBe(t.feature);}});
 it('preserves authored packs and gates the next bulk release',()=>{for(const id of [201,211,221,231,250,251,268,300]){const level=getLevel(id);expect(level.id).toBe(id);expect(level.approved).toBe(true);expect(replay(level,logs[id]!.actions).state.status).toBe('won');}for(const id of [10001,20000,30000].filter(id=>id>APPROVED_LEVEL_COUNT))expect(()=>getLevel(id)).toThrow('LEVEL_CONTENT_PENDING');});
 it('returns isolated copies and rejects invalid level identifiers',()=>{const first=getLevel(1);first.moves=1;first.shape[0]=false;expect(getLevel(1).moves).not.toBe(1);expect(getLevel(1).shape[0]).toBe(true);for(const id of [0,-1,1.5,NaN,Infinity])expect(()=>getLevel(id)).toThrow('INVALID_LEVEL_ID');});
});
