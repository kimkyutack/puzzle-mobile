import {beforeEach,describe,expect,it,vi} from 'vitest';

beforeEach(()=>{vi.resetModules();vi.unstubAllGlobals();});
describe('weekly event guide acknowledgements',()=>{
 it('shows a new guide once per account and event, retaining it across page reloads',async()=>{
  const values=new Map<string,string>();vi.stubGlobal('localStorage',{getItem:(key:string)=>values.get(key)??null,setItem:(key:string,value:string)=>values.set(key,value)});
  let guide=await import('../apps/client/src/weekly-event-guide-state');
  expect(guide.hasSeenWeeklyGuide('alice','acorn-pinball')).toBe(false);
  guide.markWeeklyGuideSeen('alice','acorn-pinball');
  expect(guide.hasSeenWeeklyGuide('alice','acorn-pinball')).toBe(true);
  expect(guide.hasSeenWeeklyGuide('bob','acorn-pinball')).toBe(false);
  expect(guide.hasSeenWeeklyGuide('alice','greenhouse-water')).toBe(false);
  vi.resetModules();guide=await import('../apps/client/src/weekly-event-guide-state');
  expect(guide.hasSeenWeeklyGuide('alice','acorn-pinball')).toBe(true);
 });
 it('keeps a dismissed guide closed in memory when device storage is blocked',async()=>{
  vi.stubGlobal('localStorage',{getItem:()=>{throw Error('blocked');},setItem:()=>{throw Error('blocked');}});
  const guide=await import('../apps/client/src/weekly-event-guide-state');
  expect(guide.hasSeenWeeklyGuide('private','animal-expedition')).toBe(false);
  expect(()=>guide.markWeeklyGuideSeen('private','animal-expedition')).not.toThrow();
  expect(guide.hasSeenWeeklyGuide('private','animal-expedition')).toBe(true);
 });
});
