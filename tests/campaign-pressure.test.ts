import {describe,it,expect} from 'vitest';
import {COLORS,ENGINE_VERSION,LAYERED_OBSTACLE_ENGINE_VERSION,type LevelDefinition} from '@garden/contracts';
import {createGame,validateLevel} from '@garden/core';
import {campaignPressureLevel,campaignPressureProfile,CAMPAIGN_PRESSURE_VERSION} from '../packages/content/src/campaign-pressure';
import {publishedLevel} from '../apps/api/src/level-content';
import {unsuppliedTileCells} from '../packages/content/src/refill-corridors';

function bank(id=50,difficulty:LevelDefinition['difficulty']='normal'):LevelDefinition{
 const obstacles=Array.from({length:12},(_,i)=>({id:`c-${i}`,kind:'crate' as const,hp:1,maxHp:1,anchor:63+i,footprint:[63+i]}));
 return {id,difficulty,width:9,height:9,engineVersion:ENGINE_VERSION,version:'test-pressure',approved:true,
  shape:Array<boolean>(81).fill(true),colors:[...COLORS.slice(0,5)],moves:30,seed:398527,
  obstacles,goals:[{kind:'crate',count:12,remaining:12}]};
}
const hits=(l:LevelDefinition)=>l.obstacles.reduce((n,o)=>n+o.hp+(o.contents?.hp??0)*o.footprint.length,0);
describe('campaign-wide difficulty pressure',()=>{
 it('preserves onboarding, exact new-mechanic introduction boards and retained old engines',()=>{
  for(const id of [1,10,20,30]){const l=bank(id);expect(campaignPressureLevel(l)).toBe(l);}
  for(const id of [101,501,801,1001,1601,1801])expect(publishedLevel(id,ENGINE_VERSION).version).not.toContain(CAMPAIGN_PRESSURE_VERSION);
  const l={...bank(500),engineVersion:LAYERED_OBSTACLE_ENGINE_VERSION};expect(campaignPressureLevel(l)).toBe(l);
 });
 it('ramps before 50, then raises the obstacle population and tightens the move budget at 50',()=>{
  const a=campaignPressureLevel(bank(49)),b=campaignPressureLevel(bank(50));
  expect(a.obstacles).toHaveLength(12);expect(b.obstacles.length).toBeGreaterThanOrEqual(22);
  expect(b.moves).toBeLessThan(a.moves);expect(hits(b)).toBeGreaterThan(hits(a));
  expect(validateLevel(b)).toEqual([]);expect(unsuppliedTileCells(b)).toEqual([]);expect(()=>createGame(b)).not.toThrow();
 });
 it('progresses through every 100-level checkpoint instead of holding difficulty flat until 2001',()=>{
  let previous=campaignPressureLevel(bank(50));
  for(let id=150;id<=1950;id+=100){
   const next=campaignPressureLevel(bank(id));
   expect(campaignPressureProfile(id,'normal').growth).toBeGreaterThan(campaignPressureProfile(id-100,'normal').growth);
   expect(next.moves).toBeLessThanOrEqual(previous.moves);expect(hits(next)).toBeGreaterThanOrEqual(hits(previous));
   expect(next.obstacles.length).toBeGreaterThanOrEqual(previous.obstacles.length);previous=next;
  }
 });
 it('makes hard and super boards materially different from normal boards of the same family',()=>{
  const levels=(['normal','hard','super'] as const).map(d=>campaignPressureLevel(bank(554,d)));
  expect(levels[1]!.moves).toBeLessThan(levels[0]!.moves);expect(levels[2]!.moves).toBeLessThan(levels[1]!.moves);
  expect(hits(levels[1]!)).toBeGreaterThan(hits(levels[0]!));expect(hits(levels[2]!)).toBeGreaterThan(hits(levels[1]!));
 });
 it('keeps objective counts synchronized with visible added obstacles and frost layers',()=>{
  const source=bank(254,'hard');source.frost={0:1,1:2,2:1,3:2};source.goals.push({kind:'frost',count:6,remaining:6});
  const l=campaignPressureLevel(source);
  expect(l.goals.find(g=>g.kind==='crate')!.count).toBe(l.obstacles.length);
  expect(l.goals.find(g=>g.kind==='frost')!.count).toBe(Object.values(l.frost!).reduce((a,b)=>a+b,0));
  expect(validateLevel(l)).toEqual([]);
 });
 it('preserves remote ammunition equations and source/target links',()=>{
  for(const id of [551,557,812,924,1718,19997]){
   const l=publishedLevel(id,ENGINE_VERSION);expect(validateLevel(l),String(id)).toEqual([]);
   for(const gate of l.obstacles.filter(o=>o.kind==='sun-gate'))expect(gate.hp).toBe(l.obstacles.filter(o=>o.link===gate.id).reduce((n,o)=>n+o.hp,0));
  }
 });
 it('gives route stages multi-row visible gates, preserving the path and reachable destinations',()=>{
  for(const id of [50,60,100,550,1000,6000,20000]){
   const l=publishedLevel(id,ENGINE_VERSION),s=l.gardenStage!;
   expect(s.gates.length).toBeGreaterThanOrEqual(15);
   expect(new Set(s.gates.map(at=>Math.floor(at/l.width))).size).toBeGreaterThanOrEqual(4);
   expect(s.channels.every(at=>l.shape[at])).toBe(true);expect(validateLevel(l)).toEqual([]);
   expect(()=>createGame(l)).not.toThrow();
  }
 });
 it('does not stack on repeat normalization, mutate saved templates or alter a coin-only bonus',()=>{
  const source=bank(500),saved=structuredClone(source),l=campaignPressureLevel(source);
  expect(source).toEqual(saved);expect(campaignPressureLevel(l)).toBe(l);
  const gold={...source,goldGarden:true as const};expect(campaignPressureLevel(gold)).toBe(gold);
 });
 it('never weakens an already stronger retained obstacle or frost layer',()=>{
  const source=bank(500,'super');source.obstacles=source.obstacles.map(o=>({...o,hp:5,maxHp:5}));
  source.frost={0:4};source.goals.push({kind:'frost',count:4,remaining:4});
  const level=campaignPressureLevel(source);
  for(const original of source.obstacles)expect(level.obstacles.find(o=>o.id===original.id)!.hp).toBeGreaterThanOrEqual(original.hp);
  expect(level.frost![0]).toBeGreaterThanOrEqual(4);
 });
 it('retains authored special positions and leaves the same challenge for all reward states',()=>{
  const l=publishedLevel(557,ENGINE_VERSION),initial=l.initial!;
  expect(initial[47]?.kind).toBe('glider');expect(initial[56]?.kind).toBe('glider');expect(l.moves).toBe(27);
  expect(l.powerRainbow).toBeUndefined();expect(l.version).toContain(CAMPAIGN_PRESSURE_VERSION);
  expect(publishedLevel(557,ENGINE_VERSION)).toEqual(l);
 });
});
