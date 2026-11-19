import {describe,expect,it} from 'vitest';
import {COLORS,CUTOUT_REFILL_ENGINE_VERSION,ENGINE_VERSION,VISIBLE_TARGETS_ENGINE_VERSION,type LevelDefinition} from '@garden/contracts';
import {applyAction,createGame,replay,validateLevel} from '@garden/core';
import {publishedLevel} from '../apps/api/src/level-content';
import {solve} from '../tools/level-validation/validate';

function frostRow(engineVersion=VISIBLE_TARGETS_ENGINE_VERSION){
 const shape=Array<boolean>(49).fill(true);
 shape[25]=false;
 const level:LevelDefinition={id:1,version:'frost-contact-test',engineVersion,width:7,height:7,shape,colors:[...COLORS],moves:30,seed:821,
  obstacles:[{id:'test-crate',kind:'crate',hp:2,maxHp:2,anchor:26,footprint:[26]}],
  frost:{21:2,24:2,26:2,27:2},goals:[{kind:'frost',count:8,remaining:8}],difficulty:'normal'};
 const state=createGame(level);
 state.cells.forEach((cell,i)=>{
  if(cell.exists&&!cell.obstacleId)cell.tile={kind:'normal',color:COLORS[(i%7+Math.floor(i/7)*2)%6]!,id:i+1};
 });
 state.cells[21]!.tile={kind:'wind-row',id:21+1};
 state.cells[24]!.tile=null;
 state.cells[27]!.tile={kind:'seed',id:27+1};
 state.nextTileId=100;
 return state;
}

describe('board-visible goals and direct frost impacts',()=>{
 it.each([43,44])('draws the actual level %i goal as flower tablets on playable cells',id=>{
  const old=publishedLevel(id,CUTOUT_REFILL_ENGINE_VERSION);
  const level=publishedLevel(id,VISIBLE_TARGETS_ENGINE_VERSION);
  const expected=old.goals.find(goal=>goal.kind==='special')!.count;
  expect(validateLevel(level)).toEqual([]);
  expect(level.goals.some(goal=>goal.kind==='special'||goal.kind==='combo')).toBe(false);
  expect(level.goals.find(goal=>goal.kind==='flower-seal')?.count).toBe(expected);
  const board=createGame(level),tablets=Object.values(board.obstacles).filter(obstacle=>obstacle.kind==='flower-seal');
  expect(tablets).toHaveLength(expected);
  for(const tablet of tablets){
   const cell=board.cells[tablet.anchor]!;
   expect(cell.exists).toBe(true);
   expect(cell.tile).toBeNull();
   expect(cell.obstacleId).toBe(tablet.id);
  }
  const proof=solve(level);
  expect(replay(level,proof.actions).state.status).toBe('won');
 });

 it('counts a tablet hit and leaves tablets elsewhere untouched when a power fires',()=>{
  const before=createGame(publishedLevel(43,VISIBLE_TARGETS_ENGINE_VERSION)),tablet=Object.values(before.obstacles).find(obstacle=>obstacle.kind==='flower-seal')!;
  const missed=applyAction(before,{type:'booster',item:'sweep-row',at:0});
  expect(missed.events.some(event=>event.obstacleId===tablet.id)).toBe(false);
  expect(missed.state.obstacles[tablet.id]).toEqual(tablet);
  const hit=applyAction(before,{type:'booster',item:'hammer',at:tablet.anchor});
  expect(hit.events).toContainEqual(expect.objectContaining({kind:'flower-seal',obstacleId:tablet.id,obstacleAfter:null}));
  expect(hit.state.goals.find(goal=>goal.kind==='flower-seal')!.remaining).toBeLessThan(3);
 });

 it('chips a directly hit empty or covered sheet across a board gap, with one hit at the rocket itself',()=>{
  const result=applyAction(frostRow(),{type:'tap',at:21});
  const rocket=result.events.find(event=>event.type==='special'&&event.kind==='wind-row')!;
  const hits=result.events.filter(event=>event.kind==='frost'&&event.effectId===rocket.effectId).flatMap(event=>event.cells);
  expect(result.accepted).toBe(true);
  expect(hits).toEqual([24,26,27]);
  expect(result.events.filter(event=>event.kind==='frost'&&event.cells.includes(21))).toHaveLength(1);
  expect(result.state.cells[26]!.frost).toBe(1);
  expect(result.state.cells[27]!.frost).toBe(1);
  expect(result.state.obstacles['test-crate']?.hp).toBe(1);
  expect(result.state.cells.some(cell=>cell.tile?.kind==='seed')).toBe(true);
 });

 it('lets inventory tools chip ice without removing the seed while retaining legacy replay rules',()=>{
  const before=frostRow();
  const hit=applyAction(before,{type:'booster',item:'hammer',at:27});
  expect(hit.accepted).toBe(true);
  expect(hit.state.cells[27]!.frost).toBe(1);
  expect(hit.state.cells.some(cell=>cell.tile?.kind==='seed')).toBe(true);
  const again=applyAction(hit.state,{type:'booster',item:'hammer',at:27});
  expect(again.state.cells[27]!.frost).toBe(0);
  const retained=applyAction(frostRow(CUTOUT_REFILL_ENGINE_VERSION),{type:'tap',at:21});
  expect(retained.state.cells[26]!.frost).toBe(2);
 });

 it('lets a Flower Bomb and a sweep damage ice under otherwise shielded cells',()=>{
  const before=frostRow();
  before.cells[31]!.tile={id:99,kind:'bomb'};
  const bomb=applyAction(before,{type:'tap',at:31});
  const activation=bomb.events.find(event=>event.type==='special'&&event.kind==='bomb')!;
  expect(bomb.events).toContainEqual({type:'hit',kind:'frost',cells:[26],effectId:activation.effectId});
  const sweep=applyAction(frostRow(),{type:'booster',item:'sweep-column',at:27});
  expect(sweep.accepted).toBe(true);
  expect(sweep.state.cells[27]!.frost).toBe(1);
 });

 it.each([24,27])('sends a glider to chip the frost at %i even without a normal tile',at=>{
  const board=frostRow(ENGINE_VERSION);
  board.cells[0]!.tile={id:99,kind:'glider'};
  board.cells.forEach((cell,index)=>{if(index!==at)cell.frost=0;});
  board.goals=[{kind:'frost',count:2,remaining:2}];
  const result=applyAction(board,{type:'tap',at:0});
  const flight=result.events.find(event=>event.type==='special'&&event.kind==='glider-flight');
  expect(flight).toMatchObject({from:0,to:at});
  expect(result.events).toContainEqual({type:'hit',kind:'frost',cells:[at],effectId:flight!.effectId});
  expect(result.state.cells[at]!.frost).toBe(1);
  expect(result.state.goals[0]!.remaining).toBe(1);
  expect(result.state.cells.some(cell=>cell.tile?.kind==='seed')).toBe(true);
 });
});
