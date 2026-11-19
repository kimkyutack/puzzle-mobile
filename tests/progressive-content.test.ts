import {earlyBalancedLevel} from '../packages/content/src/early-balance';
import {earlyMidBalancedLevel} from '../packages/content/src/early-mid-balance';
import {describe,it,expect} from 'vitest';
import {getLevel,APPROVED_LEVEL_COUNT,campaignPosition} from '@garden/content';
import {createGame,applyAction,findMatches,legalActions,replay,stateHash,validateLevel} from '@garden/core';
import {ENGINE_VERSION,FLOW_GRAVITY_ENGINE_VERSION,type LevelDefinition} from '@garden/contracts';
import {progressiveLevel,progressionLayout,progressionBand,progressionSelection,PROGRESSIVE_CONTENT_VERSION} from '../packages/content/src/progressive';
import catalogueJson from '../packages/content/src/progressive-catalogue.json';
import proofsJson from '../packages/content/src/progressive-proofs.json';
import retainedJson from '../packages/content/src/progressive-cell-catalogue-v38.json';
import retainedProofsJson from '../packages/content/src/progressive-cell-proofs-v38.json';
import {prepareRunInitial} from '../apps/api/src/run-initial';
import {publishedLevel} from '../apps/api/src/level-content';
import type {Solution} from '../tools/level-validation/validate';
const catalogue=catalogueJson as unknown as {early:Record<string,LevelDefinition>;bank:Record<string,LevelDefinition>},proofs=proofsJson as Record<string,Solution>;
describe('progressive difficulty and compartment layouts',()=>{
 it('preserves onboarding, story stages and all older engine catalogues',()=>{
  for(let id=1;id<=30;id++){const base=getLevel(id);expect(progressiveLevel(base)).toBe(base);}
  for(const id of [40,50,100,200,700,1000]){const base=getLevel(id);expect(progressiveLevel(base)).toBe(base);}
  for(const rules of ['1.0.0','1.2.0','1.3.0','1.6.0','1.7.0'])for(const id of [31,104,204,404,708]){const base=getLevel(id,rules),before=structuredClone(base);expect(progressiveLevel(base)).toEqual(before);}
 });
 it('serves certified independent-cell maps to 1.8 clients without the new endpoint rule',()=>{
  const retained=retainedJson as unknown as typeof catalogue,oldProofs=retainedProofsJson as Record<string,Solution>;
  for(const [key,level]of [...Object.entries(retained.early).map(([id,l])=>['early/'+id,l] as const),...Object.entries(retained.bank)]){const result=replay(level,oldProofs[key]!.actions);expect(result.accepted).toBe(true);expect(result.state.status).toBe('won');expect(stateHash(result.state)).toBe(oldProofs[key]!.hash);expect(level.obstacles.some(o=>o.endOnly)).toBe(false);}
  for(const id of [31,104,114,214,414,718]){const base=getLevel(id,'1.8.0'),level=progressiveLevel(base);expect(level.version).toBe('garden-2026.11.06-progression-v38');expect(level.engineVersion).toBe('1.8.0');expect(level.obstacles.some(o=>o.endOnly)).toBe(false);}
 });
 it('starts compartments after 100, grows their frequency, and keeps rest beats clear',()=>{
  expect(progressionBand(100)).toBe(0);expect(progressionBand(101)).toBe(1);expect(progressionBand(201)).toBe(2);expect(progressionBand(401)).toBe(3);expect(progressionBand(701)).toBe(4);
  for(const [start,count]of [[111,2],[301,4],[501,5],[801,6]]){
   const selected=Array.from({length:10},(_,i)=>start+i).filter(id=>progressionLayout(id,campaignPosition(id).beat));expect(selected).toHaveLength(count);
   for(const id of selected)expect(['easy','celebration']).not.toContain(campaignPosition(id).beat);
  }
  for(let id=31;id<=100;id++)expect(progressionLayout(id,campaignPosition(id).beat)).toBeNull();
 });
 it('reduces early surplus while maintaining non-purchase winning paths',()=>{
  let oldBudget=0,newBudget=0;
  expect(Object.keys(catalogue.early)).toHaveLength(63);
  for(const [id,level]of Object.entries(catalogue.early)){const base=getLevel(Number(id));oldBudget+=base.moves;newBudget+=level.moves;expect(level.shape).toEqual(base.shape);expect(level.colors).toEqual(base.colors);expect(level.moves).toBeGreaterThanOrEqual(proofs['early/'+id]!.actions.length+1);}
  expect(newBudget).toBeLessThan(oldBudget-63);
 });
 it('certifies every new map with real rules, no forced shuffle and at most four HUD objectives',()=>{
  const all=Object.entries(catalogue.early).map(([id,l])=>['early/'+id,l] as const).concat(Object.entries(catalogue.bank));
  expect(Object.keys(catalogue.bank).length).toBeGreaterThan(35);
  for(const [key,level]of all){expect(validateLevel(level)).toEqual([]);const before=createGame(level),result=replay(level,proofs[key]!.actions);expect(findMatches(before)).toEqual([]);expect(legalActions(before).length).toBeGreaterThanOrEqual(3);expect(result.accepted).toBe(true);expect(result.state.status).toBe('won');expect(stateHash(result.state)).toBe(proofs[key]!.hash);expect(result.events.some(e=>e.type==='shuffle')).toBe(false);expect(level.goals.length).toBeLessThanOrEqual(4);}
 });
 it('builds increasingly complex barriers from separate, readable one-cell pieces',()=>{
  const first=progressiveLevel(getLevel(104)),second=progressiveLevel(getLevel(204)),third=progressiveLevel(getLevel(404)),late=progressiveLevel(getLevel(708));
  expect(first.obstacles.every(o=>o.kind==='crate')).toBe(true);expect(first.goals.map(g=>g.kind)).toEqual(['crate']);
  expect(second.goals.some(g=>g.kind==='frost')).toBe(true);expect(third.obstacles.some(o=>o.kind==='vine')).toBe(true);
  for(const level of Object.values(catalogue.bank))for(const o of level.obstacles){if(o.endOnly){expect(o.kind).toBe('pipe');expect(o.hp).toBe(o.footprint.length);expect(o.hp).toBeLessThanOrEqual(14);}else{expect(o.footprint).toEqual([o.anchor]);expect(['crate','vine']).toContain(o.kind);expect(o.hp).toBeLessThanOrEqual(2);}expect(o.color).toBeUndefined();}
  const density=(l:LevelDefinition)=>l.obstacles.reduce((n,o)=>n+o.footprint.length,0)/l.shape.length;
  expect(density(late)).toBeGreaterThan(density(third));expect(density(third)).toBeGreaterThan(density(first));
 });
 it('a direct hit opens one individual cell rather than charging or removing a whole region',()=>{
  for(const level of Object.values(catalogue.bank)){
   const before=createGame(level),target=Object.values(before.obstacles).find(o=>o.kind==='crate'&&o.hp===1)!,result=applyAction(before,{type:'booster',item:'hammer',at:target.anchor});
   expect(result.accepted).toBe(true);const first=result.events.find(e=>e.type==='hit'&&e.kind==='crate')!;
   expect(first.cells).toEqual([target.anchor]);expect(result.events.filter(e=>e.type==='hit'&&e.effectId===first.effectId)).toHaveLength(1);
   expect(result.state.obstacles[target.id]).toBeUndefined();
   expect(result.state.goals.find(g=>g.kind==='crate')!.remaining).toBe(Object.values(result.state.obstacles).filter(o=>o.kind==='crate').length);
  }
 });
 it('covers every scheduled slot through the published limit and serializes downloaded maps exactly',()=>{
  for(let id=101;id<=APPROVED_LEVEL_COUNT;id++){const profile=progressionSelection(getLevel(id));if(profile)expect(catalogue.bank[profile.key],String(id)).toBeDefined();}
  for(const id of [31,101,204,404,708,9998,19998]){
   const engine=FLOW_GRAVITY_ENGINE_VERSION,base=getLevel(id,engine),saved=structuredClone(base),level=progressiveLevel(base);
   expect(base).toEqual(saved);expect(level.id).toBe(id);expect(level.engineVersion).toBe(engine);expect(level.version).toBe(PROGRESSIVE_CONTENT_VERSION);
   const expected=earlyMidBalancedLevel(earlyBalancedLevel(level));
   const published=publishedLevel(id,engine),{startBoosterGuide,version,...board}=published;
   expect({...board,version:expected.version}).toEqual(expected);
   expect(version).toBe(expected.version+(startBoosterGuide?':start-booster-v1':''));
   const items=startBoosterGuide?[startBoosterGuide.item]:[];
   expect(createGame(JSON.parse(JSON.stringify(published)),items)).toEqual(createGame(published,items));
  }
 });
 it('replaces earlier large-curtain families too, without mutating their stored definitions',()=>{
  for(const id of [231,232,233,234,235,281,291,1235,9995]){
   const base=getLevel(id,'1.9.0');if(!base.obstacles.some(o=>o.kind==='curtain'))continue;
   const saved=structuredClone(base),level=progressiveLevel(base),selection=progressionSelection(base)!;
   expect(level.obstacles.every(o=>o.footprint.length===1||o.endOnly)).toBe(true);expect(level.goals.some(g=>g.kind==='curtain')).toBe(false);
   const result=replay(level,proofs[selection.key]!.actions);expect(result.accepted).toBe(true);expect(result.state.status).toBe('won');expect(base).toEqual(saved);
  }
 });
 it('replaces published flower buds with rails that can be hit using inventory tools',()=>{
  for(let id=1;id<=APPROVED_LEVEL_COUNT;id++){
   const previous=progressiveLevel(getLevel(id,FLOW_GRAVITY_ENGINE_VERSION));
   if(!previous.obstacles.some(obstacle=>obstacle.kind==='bud'))continue;
   const level=publishedLevel(id,FLOW_GRAVITY_ENGINE_VERSION);
   expect(level.goals.some(goal=>goal.kind==='bud')).toBe(false);
   expect(level.obstacles.some(obstacle=>obstacle.kind==='bud')).toBe(false);
   expect(level.obstacles.some(obstacle=>obstacle.kind==='pipe'&&obstacle.endOnly)).toBe(true);
  }
  for(const engine of [FLOW_GRAVITY_ENGINE_VERSION,'1.8.0','1.3.0']){
   const level=publishedLevel(211,engine),rail=level.obstacles.find(obstacle=>obstacle.kind==='pipe')!;
   expect(level.campaign?.lesson).toBe('pipe');
   expect(validateLevel(level)).toEqual([]);
   const before=createGame(level);
   const hit=applyAction(before,{type:'booster',item:'hammer',at:rail.footprint.at(-1)!});
   expect(hit.accepted).toBe(true);
   expect(hit.state.obstacles[rail.id]?.hp).toBe(rail.hp-1);
  }
 });
 it('keeps random-start geometry and goals fixed and gives a valid initial board',()=>{
  for(const id of [31,104,204,404,708])for(const seed of [1234,77891,987654]){const level=progressiveLevel(getLevel(id)),result=prepareRunInitial(level,[],true,seed);expect(result.level.obstacles).toEqual(level.obstacles);expect(result.level.goals).toEqual(level.goals);expect(result.level.shape).toEqual(level.shape);expect(findMatches(result.state)).toEqual([]);expect(legalActions(result.state).length).toBeGreaterThan(0);}
 });
 it('teaches opening an individual crate cell through a legal move and preserves a saved definition',()=>{
  const original=getLevel(101),saved={level:original,state:createGame(original)},snapshot=structuredClone(saved),lesson=progressiveLevel(original);
  expect(lesson.tutorial?.feature).toBe('crate');expect(lesson.campaign?.beat).toBe('introduction');expect(legalActions(createGame(lesson))).toContainEqual({type:'swap',from:lesson.tutorial!.from,to:lesson.tutorial!.to});expect(saved).toEqual(snapshot);expect(lesson).not.toEqual(saved.level);
 });
});
