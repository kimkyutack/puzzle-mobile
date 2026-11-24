import {describe,it,expect} from 'vitest';
import {ENGINE_VERSION,type PreBooster} from '@garden/contracts';
import {startGiftStage,startGiftReached,startGiftPowers} from '../packages/contracts/src/start-gift';
import {prepareRunInitial} from '../apps/api/src/run-initial';
import {publishedLevel} from '../apps/api/src/level-content';
import {createGame,stateHash,legalActions,applyAction} from '@garden/core';
import {startBoosterCells} from '../apps/client/src/lumi-intro';

describe('three-stage winning gift initial boards',()=>{
 it('opens at 32, has a separate capped counter and hides on an older server',()=>{
  expect(startGiftReached({level:500})).toBe(false);
  expect(startGiftStage({level:31,startGiftStreak:3})).toBe(0);
  expect(startGiftStage({level:32,startGiftStreak:0})).toBe(0);
  expect(startGiftStage({level:32,startGiftStreak:20})).toBe(3);
  expect(startGiftStage({level:32,startGiftStreak:-2})).toBe(0);
  expect([0,1,2,3].map(startGiftPowers)).toEqual([[],['wind-row','glider'],['wind-row','glider','bomb'],['wind-row','glider','bomb','rainbow']]);
 });
 it.each([32,33,39,43,100,201,901,1201,1301,1401,1602,1802,3901,6001,20000])('adds all four free powers beside three purchased powers on published level %i and replays identically',id=>{
  const template=publishedLevel(id,ENGINE_VERSION),snapshot=structuredClone(template),pre:PreBooster[]=['wind-row','bomb','rainbow'];
  const p=prepareRunInitial(template,pre,true,123456,startGiftPowers(3)),base=createGame(template);
  expect(p.state.status).toBe('playing');expect(legalActions(p.state).length).toBeGreaterThan(0);
  expect(p.giftPlacements.map(x=>x.kind)).toEqual(startGiftPowers(3));
  expect(stateHash(p.state)).toBe(stateHash(createGame(p.level,pre)));
  expect(template).toEqual(snapshot);expect(p.level.goals).toEqual(template.goals);expect(p.level.obstacles).toEqual(template.obstacles);expect(p.level.moves).toBe(template.moves);
  const intro=startBoosterCells(p.state,pre,p.giftPlacements);expect(intro).toHaveLength(7);
  for(const {at,kind}of p.giftPlacements){expect(p.state.cells[at]!.tile?.kind).toBe(kind);expect(p.state.cells[at]!.obstacleId).toBeUndefined();expect(p.state.cells[at]!.frost??0).toBe(0);expect(template.protectedCells??[]).not.toContain(at);expect(base.cells[at]!.tile?.kind).toBe('normal');}
  expect(startBoosterCells({...p.state,turn:1},pre,p.giftPlacements)).toEqual([]);
 });
 it('delivers gifts with no selected or consumed start tools and animates exactly those gifts',()=>{
  const p=prepareRunInitial(publishedLevel(35,ENGINE_VERSION),[],false,123,startGiftPowers(2));
  expect(p.giftPlacements).toHaveLength(3);expect(startBoosterCells(p.state,[],p.giftPlacements)).toEqual(p.giftPlacements.map(x=>x.at).sort((a,b)=>a-b));
 });
 it('preserves original deterministic openings when there is no gift',()=>{
  const template=publishedLevel(32,ENGINE_VERSION),p=prepareRunInitial(template,[],false,1,[]);
  expect(p.level).toBe(template);expect(p.state).toEqual(createGame(template));expect(p.giftPlacements).toEqual([]);
 });
 it('keeps the full authored tutorial match intact, including the third matched tile',()=>{
  const template=publishedLevel(2,ENGINE_VERSION),{from,to}=template.tutorial!;
  const p=prepareRunInitial(template,[],false,777,startGiftPowers(3));
  const action={type:'swap',from,to}as const;
  expect(applyAction(createGame(template),action).accepted).toBe(true);
  expect(applyAction(p.state,action).accepted).toBe(true);
 });

});
