import {describe,expect,it} from 'vitest';
import {ENGINE_VERSION,GREENHOUSE_ENGINE_VERSION,OBSTACLE_GARDEN_ENGINE_VERSION,type LevelDefinition} from '@garden/contracts';
import {createGame,isSpecial,legalActions,replay,validateLevel} from '@garden/core';
import {publishedLevel} from '../apps/api/src/level-content';
import {prepareRunInitial} from '../apps/api/src/run-initial';
import {CHAIN_CAMPAIGN_VERSION,CHAIN_LAYOUT_COUNT,chainCampaignLevel} from '../packages/content/src/chain-campaign';
import {solve} from '../tools/level-validation/validate';

const initialPowers=(level:LevelDefinition)=>level.initial!.flatMap((tile,at)=>isSpecial(tile)?[{kind:tile.kind,at}]:[]);
function proof(level:LevelDefinition){
 const special=solve(level,'special');
 return special.status==='won'&&!special.shuffles?special:solve(level,'goal');
}

describe('campaign levels with preplaced power-ups',()=>{
 it('adds one obstacle-focused board per 100 levels and serves older rules and nearby boards normally',()=>{
  const placeholder=publishedLevel(39,OBSTACLE_GARDEN_ENGINE_VERSION);
  const inserted=Array.from({length:20_000},(_,n)=>{
   const level={...placeholder,id:n+1};
   return chainCampaignLevel(level)!==level?n+1:0;
  }).filter(Boolean);
  expect(inserted).toEqual(Array.from({length:200},(_,i)=>39+i*100));
  expect(publishedLevel(39,GREENHOUSE_ENGINE_VERSION).version).not.toBe(CHAIN_CAMPAIGN_VERSION);
  for(const id of [38,40,138,140,2390,2401])expect(publishedLevel(id,ENGINE_VERSION).version).not.toBe(CHAIN_CAMPAIGN_VERSION);
  expect(publishedLevel(19939,ENGINE_VERSION).version).toBe(CHAIN_CAMPAIGN_VERSION);
 });

 for(let layout=0;layout<CHAIN_LAYOUT_COUNT;layout++)it(`clears the authored layout and random starts for variation ${layout+1} without spending a booster`,()=>{
  const level=publishedLevel(39+layout*100,OBSTACLE_GARDEN_ENGINE_VERSION);
  expect(level.moves).toBe(8);
  expect(level.campaign?.beat).toBe('celebration');
  expect(level.goals.every(goal=>level.obstacles.some(o=>o.kind===goal.kind||o.contents?.kind===goal.kind))).toBe(true);
  expect(level.obstacles.length).toBeGreaterThanOrEqual(14);
  const powers=initialPowers(level);
  expect(powers.length).toBeGreaterThanOrEqual(8);
  const attempts=[17347,89381].map(seed=>prepareRunInitial(level,[],true,seed).level);
  expect(attempts[0]?.initial).not.toEqual(attempts[1]?.initial);
  for(const board of [level,...attempts]){
   expect(validateLevel(board)).toEqual([]);
   const solution=proof(board);
   expect(solution.status).toBe('won');
   expect(solution.shuffles).toBe(0);
   expect(solution.actions.every(action=>action.type==='swap'||action.type==='tap')).toBe(true);
   expect(initialPowers(board)).toEqual(powers);
   const result=replay(board,solution.actions);
   expect(result.state.status).toBe('won');
   expect(result.events.filter(e=>e.type==='special').length).toBeGreaterThanOrEqual(3);
  }
  const withOptionalItems=prepareRunInitial(level,['wind-row','bomb','rainbow'],true,14424).state;
  for(const {at,kind}of powers)expect(withOptionalItems.cells[at]?.tile?.kind).toBe(kind);
  expect(legalActions(createGame(level)).length).toBeGreaterThanOrEqual(3);
 });

 it('starts the first arrangement with a deliberate fusion that chains into the prepared pieces',()=>{
  const level=publishedLevel(39,ENGINE_VERSION),action={type:'swap',from:22,to:31} as const;
  const result=replay(level,[action]);
  expect(result.events.some(e=>e.kind==='bomb+bomb')).toBe(true);
  expect(result.events.filter(e=>e.type==='special').length).toBeGreaterThanOrEqual(6);
  expect(result.state.status).toBe('won');
 });
});
