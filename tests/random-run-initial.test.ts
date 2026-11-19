import {describe,it,expect} from 'vitest';
import {getLevel} from '@garden/content';
import {createGame,findMatches,legalActions,replay,stateHash} from '@garden/core';
import {prepareRunInitial,randomAttemptLevel} from '../apps/api/src/run-initial';
describe('fresh attempt boards',()=>{
 it('varies ordinary color arrangements while preserving the authored map and reproducible replay',()=>{
  for(const id of [13,17,31,60,201,9998]){
   const template=getLevel(id),before=structuredClone(template),hashes=new Set<string>();
   for(const seed of [10001,20003,30011,40013]){
    const {level,state}=prepareRunInitial(template,[],true,seed);hashes.add(state.cells.map(c=>c.tile?.kind==='normal'?c.tile.color:c.tile?.kind??'_').join(','));
    expect(level.shape).toEqual(template.shape);expect(level.obstacles).toEqual(template.obstacles);expect(level.goals).toEqual(template.goals);expect(level.gardenStage).toEqual(template.gardenStage);expect(level.moves).toBe(template.moves);
    expect(stateHash(createGame(level))).toBe(stateHash(state));expect(findMatches(state)).toHaveLength(0);expect(legalActions(state).length).toBeGreaterThan(0);
    const actions=legalActions(state).slice(0,1);expect(replay(level,actions).accepted).toBe(true);
   }
   expect(hashes.size).toBe(4);expect(template).toEqual(before);
  }
 });
 it('preserves tutorial openings and old clients that did not opt into random starts',()=>{
  for(const id of [1,2,10,20]){const template=getLevel(id);expect(template.tutorial).toBeDefined();expect(randomAttemptLevel(template,77)).toEqual(template);}
  const level=getLevel(31,'1.6.0');expect(prepareRunInitial(level,[],false,44).level).toEqual(level);
 });
 it('retains protected cells and special-piece identities while randomizing only normal tiles',()=>{
  const base=getLevel(31),state=createGame(base);state.cells[0]!.tile={id:99999,kind:'rainbow'};
  const level={...base,tutorial:undefined,initial:state.cells.map(c=>c.tile),protectedCells:[1]},changed=randomAttemptLevel(level,12345);
  expect(changed.initial![0]).toEqual(level.initial[0]);expect(changed.initial![1]).toEqual(level.initial[1]);
  const created=createGame(changed);expect(created.cells[0]!.tile).toEqual(level.initial[0]);expect(created.cells[1]!.tile).toEqual(level.initial[1]);expect(findMatches(created)).toHaveLength(0);expect(legalActions(created).length).toBeGreaterThan(0);
 });
});
