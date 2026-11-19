import {describe,it,expect} from 'vitest';
import {COLORS,ENGINE_VERSION,type LevelDefinition,type GameEvent,type Tile} from '@garden/contracts';
import {applyAction,createGame,findMatches,stateHash,targetCells,validateLevel} from '@garden/core';
import {getLevel} from '@garden/content';
import {progressiveLevel} from '../packages/content/src/progressive';
import {struckPipeEnd} from '../packages/game-core/src/endpoint-pipe';
import {featureHelp,unseenBoardFeatures} from '../apps/client/src/feature-help';

const firstPhase=(events:GameEvent[])=>{const end=events.findIndex(e=>e.type==='fall'||e.type==='spawn'&&e.kind==='normal');return end<0?events:events.slice(0,end);};
function fixture(center=2):LevelDefinition{
 const initial:Array<Tile|null>=Array.from({length:63},(_,i)=>({id:i+1,kind:'normal',color:COLORS[(i%9+2*Math.floor(i/9))%4]!}));
 for(const [i,color]of [[18+center-1,'berry'],[18+center,'drop'],[18+center+1,'berry'],[9+center,'berry']] as const)initial[i]={id:i+1,kind:'normal',color};
 return {id:114,engineVersion:ENGINE_VERSION,version:'endpoint-pipe-qa',width:9,height:7,shape:Array(63).fill(true),colors:[...COLORS.slice(0,4)],moves:30,seed:124,initial,obstacles:[{id:'rail',kind:'pipe',endOnly:true,anchor:29,footprint:[29,30,31,32,33],hp:5,maxHp:5}],goals:[{kind:'pipe',count:1,remaining:1}],difficulty:'normal',approved:true};
}
describe('end-sensitive retracting magnet rails',()=>{
 it('needs an endpoint, including proper row boundaries and bent paths',()=>{
  const o=fixture().obstacles[0]!;
  expect(struckPipeEnd(o,[31],9)).toBeUndefined();expect(struckPipeEnd(o,[22],9,true)).toBeUndefined();
  expect(struckPipeEnd(o,[20],9,true)).toBe('start');expect(struckPipeEnd(o,[24],9,true)).toBe('end');
  expect(struckPipeEnd({...o,footprint:[8,17,26]},[9],9,true)).toBeUndefined();
  expect(struckPipeEnd({...o,footprint:[11,12,13,22,31]},[30],9,true)).toBe('end');
 });
 for(const center of [2,6])it(`retracts the attacked ${center===2?'first':'last'} end from an adjacent natural match`,()=>{
  const state=createGame(fixture(center));expect(findMatches(state)).toEqual([]);
  const result=applyAction(state,{type:'swap',from:9+center,to:18+center}),hits=firstPhase(result.events).filter(e=>e.type==='hit'&&e.kind==='pipe');
  expect(result.accepted).toBe(true);expect(hits).toHaveLength(1);expect(hits[0]!.cells).toEqual([center===2?29:33]);
  expect(hits[0]!.obstacleAfter?.footprint).toEqual(center===2?[30,31,32,33]:[29,30,31,32]);
  const opened=result.state.cells[center===2?29:33]!;expect(opened.obstacleId).toBeUndefined();expect(opened.tile).not.toBeNull();
 });
 it('does not pass a natural match beside the middle through to an end',()=>{
  const state=createGame(fixture(4)),result=applyAction(state,{type:'swap',from:13,to:22});expect(result.accepted).toBe(true);
  expect(firstPhase(result.events).filter(e=>e.type==='hit'&&e.kind==='pipe')).toEqual([]);
 });
 it('rejects a hammer on the body without consuming a move or changing state',()=>{
  const state=createGame(fixture()),before=stateHash(state),result=applyAction(state,{type:'booster',item:'hammer',at:31});
  expect(result.accepted).toBe(false);expect(result.reason).toBe('PIPE_END_REQUIRED');expect(stateHash(result.state)).toBe(before);expect(stateHash(state)).toBe(before);
 });
 it('clears only one section per effect and collects the rail only at its final section',()=>{
  let state=createGame(fixture());
  while(state.obstacles.rail){const old=state.obstacles.rail,result=applyAction(state,{type:'booster',item:'hammer',at:old.footprint.at(-1)!}),first=result.events.find(e=>e.type==='hit'&&e.kind==='pipe')!;
   expect(result.accepted).toBe(true);expect(first.cells).toEqual([old.footprint.at(-1)]);expect(first.obstacleAfter?.footprint.length??0).toBe(old.footprint.length-1);
   expect(result.events.filter(e=>e.kind==='pipe'&&e.effectId===first.effectId)).toHaveLength(1);state=result.state;
   expect(state.goals[0]!.remaining).toBe(state.obstacles.rail?1:0);
  }
  expect(state.status).toBe('won');
 });
 it('targets exposed ends with guided power-ups and explains the distinct rule',()=>{
  const state=createGame(fixture()),targets=targetCells(state);expect(targets).toContain(29);expect(targets).toContain(33);for(const at of [30,31,32])expect(targets).not.toContain(at);
  expect(unseenBoardFeatures(state,[])).toContain('magnet-rail');expect(unseenBoardFeatures(state,[])).not.toContain('pipe');expect(featureHelp('magnet-rail','ko')).toContain('가운데');expect(featureHelp('magnet-rail','en')).toContain('middle');
 });
 it('retains old pipe mechanics and rejects the new flag on old engines',()=>{
  const level=fixture();level.engineVersion='1.8.0';expect(validateLevel(level)).toContain('ENDPOINT_PIPE_ENGINE');delete level.obstacles[0]!.endOnly;
  const result=applyAction(createGame(level),{type:'booster',item:'hammer',at:31}),first=result.events.find(e=>e.kind==='pipe')!;
  expect(result.accepted).toBe(true);expect(first.obstacleAfter?.footprint).toEqual([30,31,32,33]);
 });
 it('mixes short and bent endpoint rails with the independent crate maps',()=>{
  for(const [id,length]of [[114,3],[214,5],[414,7],[718,14]]){const level=progressiveLevel(getLevel(id)),rail=level.obstacles.find(o=>o.endOnly)!;expect(rail.footprint).toHaveLength(length);expect(level.obstacles.some(o=>o.kind==='crate'&&o.footprint.length===1)).toBe(true);expect(level.goals.length).toBeLessThanOrEqual(4);}
  for(const id of [104,204,404,708])expect(progressiveLevel(getLevel(id)).obstacles.some(o=>o.endOnly)).toBe(false);
 });
});
