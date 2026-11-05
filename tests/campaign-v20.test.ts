import {describe,it,expect} from 'vitest';
import {createGame,applyAction,replay,stateHash,validateLevel} from '@garden/core';
import {getLevel,campaignPosition,campaignPack,MAX_CAMPAIGN_LEVEL,CAMPAIGN_PACK_COUNT,CAMPAIGN_LESSONS,APPROVED_LEVEL_COUNT} from '@garden/content';
import {ENGINE_VERSION,SCULPTED_ENGINE_VERSION,type Action,type GameState} from '@garden/contracts';
import proofs from '../packages/content/src/campaign-solutions.json';
import oldProofs from '../packages/content/src/legacy-solutions-v12.json';
import {effectTiming} from '../apps/client/src/visual-timing';
import {impactOverlays} from '../apps/client/src/impact-overlays';
const logs=proofs as Record<string,{actions:Action[];hash:string}>,oldLogs=oldProofs as Record<string,{actions:Action[];hash:string}>;
describe('30,000-level campaign publication and pacing',()=>{
 it('plans every level once across 600 complete packs',()=>{
  expect(MAX_CAMPAIGN_LEVEL).toBe(30000);expect(CAMPAIGN_PACK_COUNT).toBe(600);
  for(let pack=1;pack<=600;pack++){const p=campaignPack(pack);expect(p.levels).toHaveLength(50);expect(p.start).toBe((pack-1)*50+1);expect(p.end).toBe(pack*50);expect(p.levels.every(l=>l.pack===pack)).toBe(true);}
  expect(campaignPosition(30000)).toEqual({pack:600,position:50,beat:'celebration',phase:5});
  for(const id of [0,-1,1.5,30001,NaN,Infinity])expect(()=>campaignPosition(id)).toThrow();
 });
 it('gives every new mechanic an introduction followed by two practice boards',()=>{
  for(const lesson of CAMPAIGN_LESSONS){expect(campaignPosition(lesson.level).beat).toBe('introduction');for(const offset of [1,2]){const p=campaignPosition(lesson.level+offset);expect(p.beat).toBe('practice');expect(p.lesson).toBe(lesson.kind);}}
 });
 it('releases tension after hard levels and never repeats the old sixty-board fallback',()=>{
  for(let id=301;id<=30000;id++){const p=campaignPosition(id);if(p.beat==='hard'||p.beat==='super')expect(campaignPosition(id+1).beat).toBe('easy');}
  expect(APPROVED_LEVEL_COUNT).toBeGreaterThanOrEqual(10000);for(const id of [301,1000,10000])expect(getLevel(id).id).toBe(id);for(const id of [10001,20000,30000].filter(id=>id>APPROVED_LEVEL_COUNT))expect(()=>getLevel(id)).toThrow('LEVEL_CONTENT_PENDING');
  expect(()=>getLevel(30001)).toThrow('INVALID_LEVEL_ID');
 });
 it('preserves exact old-client and saved-run replays on engine 1.2',()=>{
  for(const id of [1,13,53,141,200]){const level=getLevel(id,SCULPTED_ENGINE_VERSION),result=replay(level,oldLogs[id]!.actions);expect(level.engineVersion).toBe('1.2.0');expect(stateHash(result.state)).toBe(oldLogs[id]!.hash);}
  expect(getLevel(10000,SCULPTED_ENGINE_VERSION).engineVersion).toBe('1.2.0');
 });
});
describe('garden mechanism rules and presentation',()=>{
 it('retracts a pipe by a real cell, keeps one hit per multi-cell effect and preserves input',()=>{
  const before=createGame(getLevel(201)),pipe=Object.values(before.obstacles).find(o=>o.kind==='pipe')!,hash=stateHash(before),result=applyAction(before,{type:'booster',item:'world-bomb'}),hits=result.events.filter(e=>e.obstacleId===pipe.id&&e.type==='hit');
  expect(result.accepted).toBe(true);expect(hits[0]!.obstacleAfter?.hp).toBe(pipe.hp-1);expect(hits[0]!.obstacleAfter?.footprint).toEqual(pipe.footprint.slice(1));expect(new Set(hits.map(e=>e.effectId)).size).toBe(hits.length);expect(result.state.cells[pipe.anchor]!.obstacleId).toBeUndefined();expect(stateHash(before)).toBe(hash);
  const steps=impactOverlays(before,result.state,result.events,effectTiming(result.events,result.state,{type:'booster',item:'world-bomb'}));const first=steps.find(s=>s.kind==='obstacle'&&s.id===pipe.id);expect(first?.kind==='obstacle'?first.value?.footprint:undefined).toEqual(pipe.footprint.slice(1));
 });
 it('rejects paid tools on color-only targets without consuming a move',()=>{
  for(const id of [211,231]){const before=createGame(getLevel(id)),o=Object.values(before.obstacles)[0]!,result=applyAction(before,{type:'booster',item:'hammer',at:o.anchor});expect(result.accepted).toBe(false);expect(result.state).toBe(before);}
 });
 it('opens a bud and requires its seed delivery before completing the level',()=>{
  let before=createGame(getLevel(211)),opened=false;
  for(const action of logs[211]!.actions){const result=applyAction(before,action);expect(result.accepted).toBe(true);if(result.events.some(e=>e.type==='spawn'&&e.kind==='seed')){opened=true;expect(Object.values(result.state.obstacles).some(o=>o.kind==='bud')).toBe(false);expect(result.events.some(e=>e.type==='remove'&&e.kind==='seed')||result.state.cells.some(c=>c.tile?.kind==='seed')).toBe(true);}before=result.state;}
  expect(opened).toBe(true);expect(before.status).toBe('won');
 });
 it('moves a planter without HP loss on paid moves, never on inventory shuffle',()=>{
  let before=createGame(getLevel(221)),moved=false;
  const shuffled=applyAction(before,{type:'booster',item:'shuffle'});expect(shuffled.events.some(e=>e.type==='mechanic')).toBe(false);
  for(const action of logs[221]!.actions){const result=applyAction(before,action),event=result.events.find(e=>e.type==='mechanic');if(event){moved=true;expect(event.from).not.toBe(event.to);expect(event.obstacleAfter?.anchor).toBe(event.to);const steps=impactOverlays(before,result.state,result.events,effectTiming(result.events,result.state,action));expect(steps.some(step=>step.kind==='obstacle'&&step.id===event.obstacleId&&step.value?.anchor===event.to)).toBe(true);}before=result.state;}
  expect(moved).toBe(true);expect(before.status).toBe('won');
 });
 it('lifts a shade only after its color charge and reveals the covered supply cells',()=>{
  let before=createGame(getLevel(231)),opened=false;const shade=Object.values(before.obstacles)[0]!;
  for(const action of logs[231]!.actions){const result=applyAction(before,action);if(before.obstacles[shade.id]&&!result.state.obstacles[shade.id]){opened=true;expect(shade.footprint.every(i=>!result.state.cells[i]!.obstacleId)).toBe(true);expect(shade.footprint.every(i=>result.state.cells[i]!.tile!==null)).toBe(true);}before=result.state;}
  expect(opened).toBe(true);expect(before.status).toBe('won');
 });
 it('rejects malformed paths and prevents new mechanics from reaching old engines',()=>{
  const level=getLevel(221);level.obstacles[0]!.path=[0,3,8,9];expect(validateLevel(level)).toContain('CAROUSEL_PATH');level.engineVersion=SCULPTED_ENGINE_VERSION;expect(validateLevel(level)).toContain('MECHANIC_ENGINE');
  expect(getLevel(201).engineVersion).toBe(ENGINE_VERSION);
 });
});
