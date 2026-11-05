import {describe,it,expect} from 'vitest';
import {createHash} from 'node:crypto';
import {getLevel,APPROVED_LEVEL_COUNT,BULK_BATCH_SIZE} from '@garden/content';
import {createGame,findMatches,legalActions,replay,stateHash,validateLevel,isSpecial} from '@garden/core';
import type {Action} from '@garden/contracts';
import {BULK_START,BULK_CONTENT_VERSION,bulkProfile,bulkTier,levelFromBulkEntry,type BulkCatalogue} from '../packages/content/src/bulk';
import {campaignMoveMargin} from '../packages/content/src/campaign';
import catalogueJson from '../packages/content/src/bulk-catalogue.json';
import proofsJson from '../packages/content/src/bulk-proofs.json';
import originals from '../packages/content/src/campaign-approved.json';
import originalProofs from '../packages/content/src/campaign-solutions.json';
import recipes from '../packages/content/src/campaign-recipes.json';
import baseline from './fixtures/campaign-first300-hashes.json';
const catalogue=catalogueJson as unknown as BulkCatalogue;
const proofs=proofsJson as unknown as {templates:Array<{actions:Action[];hash:string}>;stages:Array<[string,number]>};
const hash=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
describe('ten-thousand-stage batch publication',()=>{
 it('preserves the first 300 authored definitions, recipes, logs and runtime boards exactly',()=>{
  expect(hash(originals)).toBe(baseline.definitions);expect(hash(originalProofs)).toBe(baseline.proofs);expect(hash(recipes)).toBe(baseline.recipes);
  expect(hash(originals.map(l=>getLevel(l.id)))).toBe(baseline.runtime);
 });
 it('publishes a contiguous first batch and reserves later batches up to 30,000',()=>{
  expect(BULK_BATCH_SIZE).toBe(10000);expect([10000,20000,30000]).toContain(APPROVED_LEVEL_COUNT);
  expect(catalogue.entries).toHaveLength(APPROVED_LEVEL_COUNT-BULK_START+1);expect(proofs.stages).toHaveLength(catalogue.entries.length);
  for(let id=BULK_START;id<=APPROVED_LEVEL_COUNT;id++){
   const entry=catalogue.entries[id-BULK_START]!,template=catalogue.templates[entry[0]]!,profile=bulkProfile(id);
   expect(template.key).toBe(profile.key);expect(entry[1]-template.steps).toBeGreaterThanOrEqual(campaignMoveMargin(profile.beat));
   expect(proofs.stages[id-BULK_START]![0]).toMatch(/^[0-9a-f]{8,64}$/);
  }
  for(const id of [10001,20000,30000].filter(id=>id>APPROVED_LEVEL_COUNT))expect(()=>getLevel(id)).toThrow('LEVEL_CONTENT_PENDING');
  for(const id of [30001,0,NaN,1.5])expect(()=>getLevel(id)).toThrow('INVALID_LEVEL_ID');
  expect([1000,1001,3001,6001,10001,15001,20001,25001,30000].map(bulkTier)).toEqual([0,1,2,3,4,5,6,7,7]);
 });
 it('certifies all parameter variants without purchases, initial matches or compulsory reshuffles',()=>{
  expect(catalogue.templates).toHaveLength((bulkTier(APPROVED_LEVEL_COUNT)+1)*180);expect(new Set(catalogue.templates.map(t=>t.key)).size).toBe(catalogue.templates.length);expect(new Set(catalogue.templates.map(t=>t.family)).size).toBe(18);
  for(const [i,template]of catalogue.templates.entries()){
   const level=template.level,state=createGame(level),proof=proofs.templates[i]!;
   expect(validateLevel(level),template.key).toEqual([]);expect(findMatches(state),template.key).toHaveLength(0);expect(legalActions(state).length).toBeGreaterThanOrEqual(3);
   expect(proof.actions.every(a=>a.type==='swap'||a.type==='tap')).toBe(true);
   const result=replay(level,proof.actions);expect(result.accepted,template.key).toBe(true);expect(result.state.status,template.key).toBe('won');expect(stateHash(result.state),template.key).toBe(proof.hash);
   expect(result.events.some(e=>e.type==='shuffle')).toBe(false);expect(level.goals.length).toBeLessThanOrEqual(4);
   if(template.beat==='celebration')expect(state.cells.filter(c=>isSpecial(c.tile)).length).toBeGreaterThanOrEqual(3);
  }
 // Replaying every certified template can exceed 30 seconds alongside the full suite.
 },60_000);
 it('uses higher counts and layers in later tiers while retaining easy and celebration beats',()=>{
  const mean=(tier:number,pick:(l:BulkCatalogue['templates'][number]['level'])=>number)=>{const items=catalogue.templates.filter(t=>t.tier===tier);return items.reduce((n,t)=>n+pick(t.level),0)/items.length;};
  expect(mean(3,l=>l.obstacles.reduce((s,o)=>s+o.hp,0))).toBeGreaterThan(mean(0,l=>l.obstacles.reduce((s,o)=>s+o.hp,0)));
  expect(mean(3,l=>Object.values(l.frost??{}).reduce((s,hp)=>s+hp,0))).toBeGreaterThan(mean(0,l=>Object.values(l.frost??{}).reduce((s,hp)=>s+hp,0)));
  const beats=Array.from({length:10},(_,i)=>getLevel(9991+i).campaign!.beat);
  expect(beats).toEqual(['easy','normal','normal','hard','easy','normal','normal','super','easy','celebration']);
 });
 it('replays exact entry hashes at boundaries and isolates runtime copies',()=>{
  for(const id of [301,998,1000,1001,2998,3000,3001,5998,6000,6001,9998,10000]){
   const entry=catalogue.entries[id-BULK_START]!,template=catalogue.templates[entry[0]]!,level=getLevel(id),result=replay(level,proofs.templates[entry[0]]!.actions);
   expect(level).toEqual(levelFromBulkEntry(id,entry,template));expect(level.version).toBe(BULK_CONTENT_VERSION);expect(level.width).toBe(9);
   expect(result.state.status).toBe('won');expect([stateHash(result.state),result.state.moves]).toEqual(proofs.stages[id-BULK_START]);
  }
  const fresh=getLevel(9998),changed=getLevel(9998);changed.moves=1;changed.shape[0]=false;changed.goals[0]!.remaining=0;expect(getLevel(9998)).toEqual(fresh);
 });
});
