import {describe,expect,it} from 'vitest';
import {ENGINE_VERSION,FLOW_GRAVITY_ENGINE_VERSION,SEED_DELIVERY_ENGINE_VERSION,type LevelDefinition} from '@garden/contracts';
import {applyAction,createGame,validateLevel} from '@garden/core';
import {publishedLevel} from '../apps/api/src/level-content';
import {prepareRunInitial} from '../apps/api/src/run-initial';

const trial=14,earlyChallenges=[34,53,58,64,74,87,88,94];

function openWithGuide(level:LevelDefinition){
 const guide=level.startBoosterGuide!;
 const state=createGame(level,[guide.item]);
 expect(state.cells[guide.cell]?.tile?.kind).toBe(guide.item);
 const result=applyAction(state,{type:'tap',at:guide.cell});
 expect(result.accepted).toBe(true);
 const firstHit=result.events.find(event=>event.type==='hit');
 const directHits=result.events.filter(event=>event.type==='hit'&&event.effectId===firstHit?.effectId);
 return {result,directHits};
}

describe('campaign start booster challenges',()=>{
 it('adds a single trial and eight early challenge boards across both compatible rulesets',()=>{
  for(const engine of [FLOW_GRAVITY_ENGINE_VERSION,ENGINE_VERSION]){
   const guided=Array.from({length:100},(_,i)=>publishedLevel(i+1,engine)).filter(level=>level.startBoosterGuide);
   expect(guided.map(level=>level.id)).toEqual([trial,...earlyChallenges]);
   expect(guided.filter(level=>level.startBoosterGuide?.trial).map(level=>level.id)).toEqual([trial]);
   for(const level of guided)expect(validateLevel(level)).toEqual([]);
  }
  const old=publishedLevel(trial,'1.9.0');
  expect(old.startBoosterGuide).toBeUndefined();
  expect(old.goals.find(goal=>goal.kind==='crate')?.count).toBe(2);
 });

 it('keeps the recommended opening useful across random boards and optional item selections',()=>{
  for(const id of [trial,...earlyChallenges,104,114,208,404,1004,9998,19998]){
   const level=publishedLevel(id,id>400?SEED_DELIVERY_ENGINE_VERSION:ENGINE_VERSION);
   for(const seed of [2047,78497,84656]){
    const {level:attempt}=prepareRunInitial(level,[],true,seed);
    const {result,directHits}=openWithGuide(attempt);
    expect(directHits.length,`level ${id}, seed ${seed}`).toBeGreaterThanOrEqual(3);
    if(id===trial)expect(result.state.goals.find(goal=>goal.kind==='crate')!.remaining).toBeLessThan(attempt.goals.find(goal=>goal.kind==='crate')!.count);
    const guide=attempt.startBoosterGuide!;
    const mixed=createGame(attempt,['rainbow',guide.item]);
    expect(mixed.cells[guide.cell]?.tile?.kind).toBe(guide.item);
    expect(mixed.cells.filter(cell=>cell.tile?.kind==='rainbow')).toHaveLength(1);
   }
  }
  for(const id of [101,105,109,110,115,20000])expect(publishedLevel(id,ENGINE_VERSION).startBoosterGuide).toBeUndefined();
 });
});
