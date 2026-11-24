import {describe,it,expect} from 'vitest';
import {getLevel} from '@garden/content';
import {applyAction,stateHash} from '@garden/core';
import {contextualItemGuide,itemGuideAllows,itemGuideKey,learnedItemGuidance} from '../apps/client/src/item-guidance';
import {guideFixture,powers} from '../tools/fixtures/contextual-item-guide';

const learnedOthers=(target:string)=>powers.filter(kind=>kind!==target).flatMap(kind=>[itemGuideKey(kind,'made'),itemGuideKey(kind,'used')]);
describe('first opportunity item guidance on real campaign boards',()=>{
 for(const kind of powers)it(`guides ${kind} creation and use during early levels, with persistent one-time acknowledgement`,()=>{
  const {state}=guideFixture(kind,37),before=stateHash(state),seen=learnedOthers(kind),guide=contextualItemGuide(state,seen)!;
  expect(guide?.kind).toBe(kind);expect(guide.phase).toBe('make');expect(stateHash(state)).toBe(before);
  expect(itemGuideAllows(guide,{type:'booster',item:'hammer',at:0})).toBe(false);
  const made=applyAction(state,guide.action);expect(made.accepted).toBe(true);
  const ack=learnedItemGuidance(guide,made.events,seen);expect(ack).toContain(itemGuideKey(kind,'made'));
  const savedSeen=JSON.parse(JSON.stringify([...seen,...ack]));
  const use=contextualItemGuide(JSON.parse(JSON.stringify(made.state)),savedSeen)!;
  expect(use.kind).toBe(kind);expect(use.phase).toBe('use');expect(use.action.type).toBe('tap');
  const used=applyAction(made.state,use.action);expect(used.accepted).toBe(true);
  const done=learnedItemGuidance(use,used.events,savedSeen);expect(done).toContain(itemGuideKey(kind,'used'));
  expect(contextualItemGuide(state,[...savedSeen,...done])).toBeNull();
 });
 it('never forces new maps, replays old level 2, or offers an impossible action',()=>{
  expect(getLevel(2).tutorial).toBeDefined();
  for(const level of [2,3,15,38,99,100]){
   const state=guideFixture('glider',level).state,guide=contextualItemGuide(state,[])!;
   expect(guide).not.toBeNull();expect(applyAction(state,guide.action).accepted).toBe(true);
  }
 });
 it('shares rocket acknowledgements across directions and avoids completed/bonus/device boards',()=>{
  const {state}=guideFixture('wind-column',37);
  expect(contextualItemGuide(state,[...learnedOthers('wind-column'),itemGuideKey('wind-row','made'),itemGuideKey('wind-row','used')])).toBeNull();
  expect(contextualItemGuide({...state,status:'won'},[])).toBeNull();
  expect(contextualItemGuide({...state,goldGarden:{coinCells:[]}},[])).toBeNull();
  expect(contextualItemGuide({...state,devices:{steps:[],index:0,progress:0}},[])).toBeNull();
 });
 it('teaches creation even if an earlier pre-placed gift already introduced the item icon',()=>{
  const {state}=guideFixture('glider',37);
  expect(contextualItemGuide(state,[...learnedOthers('glider'),'glider'])?.kind).toBe('glider');
 });
 it('stops both creation and unfinished usage guidance after level 100',()=>{
  const {state}=guideFixture('glider',100),seen=learnedOthers('glider');
  const guide=contextualItemGuide(state,seen)!;
  expect(guide.phase).toBe('make');
  const made=applyAction(state,guide.action);
  const learned=[...seen,...learnedItemGuidance(guide,made.events,seen)];
  expect(contextualItemGuide(made.state,learned)?.phase).toBe('use');
  for(const levelId of [101,102,543]){
   expect(contextualItemGuide({...state,levelId},seen)).toBeNull();
   expect(contextualItemGuide({...made.state,levelId},learned)).toBeNull();
  }
 });
});
