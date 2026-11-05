import {describe,it,expect} from 'vitest';
import {createHash} from 'node:crypto';
import {getLevel,APPROVED_LEVEL_COUNT,campaignPosition} from '@garden/content';
import {createGame,applyAction,replay,stateHash,isSpecial} from '@garden/core';
import type {Action,ObstacleKind} from '@garden/contracts';
import {PACK6_CONTENT_VERSION,PACK6_STRATEGIES} from '../packages/content/src/campaign-pack6';
import {campaignCandidate} from '../packages/content/src/campaign-candidates';
import definitions from '../packages/content/src/campaign-approved.json';
import proofs from '../packages/content/src/campaign-solutions.json';
import recipes from '../packages/content/src/campaign-recipes.json';
import previous from './fixtures/campaign-pack5-hashes.json';

const logs=proofs as Record<string,{actions:Action[];hash:string;movesLeft:number}>;
const hash=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const mechanics=(id:number)=>[...new Set(getLevel(id).obstacles.map(o=>o.kind))];
describe('sixth campaign pack, levels 251–300',()=>{
 it('preserves the exact first 250 definitions, recipes, runtime boards and winning logs',()=>{
  expect(hash(definitions.slice(0,250))).toBe(previous.definitions);
  expect(hash(recipes.slice(0,250))).toBe(previous.recipes);
  expect(hash(Array.from({length:250},(_,i)=>getLevel(i+1)))).toBe(previous.runtime);
  expect(hash(Object.fromEntries(Array.from({length:250},(_,i)=>[i+1,logs[i+1]])))).toBe(previous.proofs);
 });
 it('contains five distinct combinations and at least six board silhouettes',()=>{
  const levels=Array.from({length:50},(_,i)=>getLevel(i+251));
  expect(APPROVED_LEVEL_COUNT).toBeGreaterThanOrEqual(10000);
  expect(new Set(levels.map(l=>l.strategy?.id))).toEqual(new Set(PACK6_STRATEGIES.map(s=>s.id)));
  expect(new Set(levels.map(l=>l.shape.join(','))).size).toBeGreaterThanOrEqual(6);
  for(const level of levels){expect(level.version).toBe(PACK6_CONTENT_VERSION);expect(level.width).toBe(9);expect(level.campaign?.pack).toBe(6);expect(level.goals.length).toBeLessThanOrEqual(4);expect(new Set(level.obstacles.map(o=>o.kind)).size).toBeGreaterThanOrEqual(2);}
  const examples:Record<number,ObstacleKind[]>={251:['bud','pipe'],261:['curtain','bud'],271:['carousel','pipe'],281:['curtain','carousel'],294:['curtain','pipe','bud']};
  for(const [id,expected]of Object.entries(examples))expect(mechanics(Number(id))).toEqual(expect.arrayContaining(expected));
 });
 it('retains the ten-level breathing rhythm and supplies five free chain boards',()=>{
  const beats=Array.from({length:50},(_,i)=>campaignPosition(i+251).beat);
  expect(beats.filter(b=>b==='easy')).toHaveLength(15);expect(beats.filter(b=>b==='normal')).toHaveLength(20);
  expect(beats.filter(b=>b==='hard')).toHaveLength(5);expect(beats.filter(b=>b==='super')).toHaveLength(5);expect(beats.filter(b=>b==='celebration')).toHaveLength(5);
  for(const id of [260,270,280,290,300])expect(createGame(getLevel(id)).cells.filter(c=>isSpecial(c.tile)).length).toBeGreaterThanOrEqual(3);
 });
 it('replays all fifty deterministic no-purchase solutions with the authored move margins',()=>{
  const margin={easy:10,normal:7,hard:4,super:2,celebration:12};
  for(let id=251;id<=300;id++){
   const level=getLevel(id),log=logs[id]!,result=replay(level,log.actions);
   expect(log.actions.every(a=>a.type==='swap'||a.type==='tap'),`paid action ${id}`).toBe(true);
   expect(result.accepted,`accepted ${id}`).toBe(true);expect(result.state.status,`win ${id}`).toBe('won');expect(stateHash(result.state)).toBe(log.hash);
   expect(result.events.some(e=>e.type==='shuffle'),`shuffle ${id}`).toBe(false);
   expect(result.state.moves).toBeGreaterThanOrEqual(margin[level.campaign!.beat as keyof typeof margin]);
  }
 });
 it('keeps every seed route continuous and prevents delivery while its bottom shade is closed',()=>{
  let observedBlockedSeed=false;
  for(let id=251;id<=300;id++){
   const level=getLevel(id),buds=level.obstacles.filter(o=>o.kind==='bud');
   for(const bud of buds){const lane=level.gravity!.find(l=>l.includes(bud.anchor))!;expect(level.exits).toContain(lane.at(-1));}
   const curtain=level.obstacles.find(o=>o.kind==='curtain');if(!buds.length||!curtain)continue;
   let state=createGame(level);
   for(const action of logs[id]!.actions){
    const result=applyAction(state,action);if(result.state.obstacles[curtain.id]){expect(result.events.some(e=>e.type==='remove'&&e.kind==='seed')).toBe(false);if(result.state.cells.some(c=>c.tile?.kind==='seed'))observedBlockedSeed=true;}state=result.state;
   }
  }
  expect(observedBlockedSeed).toBe(true);
 });
 it('isolates returned boards and freezes the original authored generator',()=>{
  const level=getLevel(251),initial=getLevel(251);level.obstacles[0]!.hp=99;level.shape[0]=false;
  expect(getLevel(251)).toEqual(initial);expect(getLevel(301).approved).toBe(true);
  expect(()=>campaignCandidate(301)).toThrow('CAMPAIGN_PACK_NOT_AUTHORED');
 });
});
