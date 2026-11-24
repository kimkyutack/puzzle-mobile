import {describe,it,expect} from 'vitest';
import {getLevel} from '@garden/content';
import {createGame} from '@garden/core';
import {firstGardenStep,firstPuzzleResult,FIRST_GARDEN_RESTORATION} from '../apps/client/src/first-garden-tutorial';

describe('first puzzle to first restoration onboarding',()=>{
 const one={level:1,restored:[] as string[]},two={level:2,restored:[] as string[]};
 it('starts and resumes the first puzzle without an optional local completion flag',()=>{
  expect(firstGardenStep(null)).toBeNull();expect(firstGardenStep(one)).toBe('puzzle');
  const level=getLevel(1),state=createGame(level);
  expect(firstGardenStep(two,{level,state,status:'active'})).toBe('puzzle');
  expect(firstGardenStep(two,{level,state:{...state,status:'lost'},status:'active'})).toBe('puzzle');
 });
 it('resumes restoration after the clear, including a reload without a retained run',()=>{
  const level=getLevel(1),state=createGame(level);
  expect(firstGardenStep(two)).toBe('restore');
  expect(firstGardenStep(two,{level,state:{...state,status:'won'},status:'won'})).toBe('restore');
  expect(firstPuzzleResult(two,{level})).toBe(true);
  expect(FIRST_GARDEN_RESTORATION.cost).toBe(1);
 });
 it('ends after a saved restoration and leaves established accounts alone',()=>{
  expect(firstGardenStep({...two,restored:[FIRST_GARDEN_RESTORATION.id]})).toBeNull();
  expect(firstGardenStep({level:500,restored:[]})).toBeNull();
  expect(firstGardenStep({level:3,restored:[]})).toBeNull();
  expect(firstPuzzleResult({...two,restored:[FIRST_GARDEN_RESTORATION.id]},{level:getLevel(1)})).toBe(false);
  expect(firstPuzzleResult(two,{level:getLevel(2)})).toBe(false);
 });
});
