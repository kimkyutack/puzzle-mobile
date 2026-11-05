import {describe,it,expect} from 'vitest';
import {createGame} from '@garden/core';
import {getLevel} from '@garden/content';
import {knownHelp,pendingHelp,rememberHelp,completeHelpSync,cacheHelp,resetHelpHistory} from '../apps/client/src/help-history';
import {unseenBoardFeatures} from '../apps/client/src/feature-help';
function storage(){const values=new Map<string,string>();return {getItem:(key:string)=>values.get(key)??null,setItem:(key:string,value:string)=>{values.set(key,value)},removeItem:(key:string)=>{values.delete(key)}};}
describe('per-player first discovery history',()=>{
 it('does not repeat on a later run or restart after the pending server acknowledgement has been cleared',()=>{
  const saved=storage(),first=createGame(getLevel(2),['bomb']);expect(unseenBoardFeatures(first,knownHelp('a',[],saved))).toContain('bomb');
  rememberHelp('a',['bomb'],saved);completeHelpSync('a',['bomb'],saved);expect(pendingHelp('a',saved)).toEqual([]);
  const next=createGame(getLevel(4),['bomb','rainbow']);expect(unseenBoardFeatures(next,knownHelp('a',[],saved))).not.toContain('bomb');expect(unseenBoardFeatures(next,knownHelp('a',[],saved))).toContain('rainbow');
  cacheHelp('a',[],saved);expect(knownHelp('a',[],saved)).toContain('bomb');
 });
 it('retains discoveries made offline and during an in-flight acknowledgement, with isolated account records',()=>{
  const saved=storage();rememberHelp('a',['bomb'],saved);const sent=pendingHelp('a',saved);rememberHelp('a',['rainbow','bomb'],saved);completeHelpSync('a',sent,saved);
  expect(pendingHelp('a',saved)).toEqual(['rainbow']);expect(knownHelp('a',[],saved).sort()).toEqual(['bomb','rainbow']);expect(knownHelp('b',[],saved)).toEqual([]);
 });
 it('migrates old pending records and only forgets discoveries for an explicit replay reset',()=>{
  const saved=storage();saved.setItem('garden-pending-help-a','["glider"]');cacheHelp('a',['crate'],saved);completeHelpSync('a',['glider'],saved);expect(knownHelp('a',[],saved)).toEqual(['crate','glider']);resetHelpHistory('a',saved);expect(knownHelp('a',[],saved)).toEqual([]);
 });
 it('ignores malformed storage instead of breaking a puzzle',()=>{const saved=storage();saved.setItem('garden-seen-help-a','{}');saved.setItem('garden-pending-help-a','[null,7,"bomb"]');expect(knownHelp('a',[],saved)).toEqual(['bomb']);});
});
