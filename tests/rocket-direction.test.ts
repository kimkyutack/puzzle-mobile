import {describe,it,expect} from 'vitest';
import {PERPENDICULAR_ROCKET_ENGINE_VERSION as ENGINE_VERSION,perpendicularRockets,SUPPORTED_ENGINE_VERSIONS,type Color} from '@garden/contracts';
import {createGame,findMatches,applyAction,stateHash,replay} from '@garden/core';
import {getLevel} from '@garden/content';
function board(engine=ENGINE_VERSION){const state=createGame(getLevel(2,engine));state.cells.forEach((cell,i)=>{cell.tile={id:i+1,kind:'normal',color:['berry','drop','sun','sprout','flower','acorn'][(i%7+Math.floor(i/7)*2)%6] as Color};});state.nextTileId=1000;return state;}
describe('versioned perpendicular rocket creation',()=>{
 for(const engine of SUPPORTED_ENGINE_VERSIONS)it(`keeps the agreed creation direction on rules ${engine}`,()=>{
  for(const [cells,latest,retained]of [[[15,16,17,18],'wind-column','wind-row'],[[3,10,17,24],'wind-row','wind-column']] as const){
   const state=board(engine);for(const at of cells)state.cells[at]!.tile={id:100+at,kind:'normal',color:'drop'};
   expect(findMatches(state).find(match=>match.cells.includes(cells[0]))?.kind).toBe(perpendicularRockets(engine)?latest:retained);
  }
 });
 it('creates the vertical rocket at the moved tile and actually fires down its column',()=>{
  const level=getLevel(2,ENGINE_VERSION),action={type:'swap',from:level.tutorial!.from,to:level.tutorial!.to} as const,before=createGame(level),formed=applyAction(before,action);
  expect(formed.events).toContainEqual({type:'spawn',cells:[17],kind:'wind-column'});expect(level.tutorial!.feature).toBe('wind-column');
  const at=formed.state.cells.findIndex(cell=>cell.tile?.kind==='wind-column'),fired=applyAction(formed.state,{type:'tap',at}),hit=fired.events.find(e=>e.type==='remove'&&e.effectId);
  expect(fired.accepted).toBe(true);expect(fired.events.filter(e=>e.type==='remove'&&e.effectId===hit!.effectId).every(e=>e.cells.every(i=>i%7===at%7))).toBe(true);
  const again=replay(level,[action,{type:'tap',at}]);expect(stateHash(again.state)).toBe(stateHash(fired.state));
 });
});
