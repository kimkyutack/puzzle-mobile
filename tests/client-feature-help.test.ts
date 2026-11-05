import {describe,it,expect} from 'vitest';
import {getLevel} from '@garden/content';
import {createGame,stateHash} from '@garden/core';
import {featureHelp,unseenBoardFeatures} from '../apps/client/src/feature-help';

describe('first appearance goal help',()=>{
 it('covers every published obstacle and drop goal in both languages without modifying the board',()=>{
  const observed=new Set<string>();
  for(let id=1;id<=200;id++){
   const state=createGame(getLevel(id)),before=stateHash(state);
   for(const feature of unseenBoardFeatures(state,[])){observed.add(feature);expect(featureHelp(feature,'ko')).not.toBe('');expect(featureHelp(feature,'en')).not.toBe('');}
   expect(stateHash(state)).toBe(before);
  }
  expect([...observed].sort()).toEqual(['bomb','cabinet','combo','crate','frost','glider','moss','pot','seed','special','vine','wind-row']);
 });
 it('does not repeat acknowledged lessons and leaves unknown text for the caller',()=>{
  const state=createGame(getLevel(18));expect(unseenBoardFeatures(state,['pot'])).not.toContain('pot');expect(featureHelp('unknown')).toBe('');
 });
 it('recovers special-piece discovery from a saved board after reload',()=>{
  const state=createGame(getLevel(2),['wind-row','bomb','rainbow']);
  const saved=JSON.parse(JSON.stringify(state)),before=stateHash(saved);
  expect(unseenBoardFeatures(saved,[])).toEqual(expect.arrayContaining(['wind-row','bomb','rainbow']));
  const acknowledged=unseenBoardFeatures(saved,['wind-row','bomb','rainbow']);
  expect(acknowledged).not.toContain('bomb');
  expect(acknowledged).not.toContain('rainbow');
  expect(stateHash(saved)).toBe(before);
 });
});
