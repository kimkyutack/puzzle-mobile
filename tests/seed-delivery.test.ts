import {describe,expect,it} from 'vitest';
import {actionWithFrames,applyAction,createGame,findMatches} from '@garden/core';
import {COLORS,ENGINE_VERSION,FLOW_GRAVITY_ENGINE_VERSION,type Color,type GameState} from '@garden/contracts';
import {getLevel} from '@garden/content';

const seedRemaining=(state:GameState)=>state.goals.find(goal=>goal.kind==='seed')!.remaining;
const tileColors:Record<string,Color>={G:'sprout',Y:'sun',P:'flower',R:'berry',B:'drop'};

function videoBoard(engine:string):GameState {
 // Reproduce the saved board from before the flower-to-rail content update.
 const state=createGame(getLevel(257,engine));
 const rows=['GYPRRYPPR','GPGGPRYBB','BPGPBBRBY','PYBPRRYWY','PPGGBPGGB','RBGDRGRBY','BBSGYGYYP','GYBBRBPBB'];
 state.obstacles={};state.moves=7;state.nextTileId=73;
 state.goals.forEach(goal=>{goal.remaining=goal.kind==='seed'?1:0;});
 state.cells=Array.from(rows.join(''),(letter,at)=>({exists:true,frost:0,exit:state.cells[at]!.exit,
  tile:letter==='W'?{id:at+1,kind:'wind-row'}:letter==='D'?{id:at+1,kind:'glider'}:letter==='S'?{id:at+1,kind:'seed'}:{id:at+1,kind:'normal',color:tileColors[letter]!}}));
 return state;
}

function budBoard(engine:string):GameState {
 const state=createGame(getLevel(255,engine));
 state.obstacles['bud-20']!.hp=1;
 delete state.obstacles['pipe-38'];
 state.goals.find(goal=>goal.kind==='pipe')!.remaining=0;
 state.cells.forEach((cell,at)=>{
  if(at===38||at===47)delete cell.obstacleId;
  if(cell.exists&&!cell.obstacleId)cell.tile={id:at+1,kind:'normal',color:state.colors[(at%9+Math.floor(at/9)*2)%state.colors.length]!};
 });
 for(const at of [2,9,10,12])state.cells[at]!.tile={id:at+1,kind:'normal',color:'sprout'};
 for(const at of [11,21])state.cells[at]!.tile={id:at+1,kind:'normal',color:'berry'};
 state.nextTileId=73;
 return state;
}

describe('seed delivery',()=>{
 it('targets the blue exit tile instead of the rocket on the reported level 257 board',()=>{
  const action={type:'tap',at:48} as const;
  const old=applyAction(videoBoard(FLOW_GRAVITY_ENGINE_VERSION),action);
  expect(old.events.find(event=>event.kind==='glider-flight')?.to).toBe(34);
  expect(seedRemaining(old.state)).toBe(1);
  const before=videoBoard(ENGINE_VERSION),result=applyAction(before,action);
  expect(result.events.find(event=>event.kind==='glider-flight')?.to).toBe(65);
  expect(result.events).toContainEqual({type:'remove',kind:'seed',cells:[65]});
  expect(result.state.status).toBe('won');
  expect(actionWithFrames(before,action).state).toEqual(result.state);
 });

 it('follows the authored gravity lane when its exit is in another column',()=>{
  const before=videoBoard(ENGINE_VERSION);
  before.cells[65]!.exit=false;before.cells[66]!.exit=true;
  [before.gravity[2]![7],before.gravity[3]![7]]=[66,65];
  const result=applyAction(before,{type:'tap',at:48});
  expect(result.events.find(event=>event.kind==='glider-flight')?.to).toBe(66);
  expect(seedRemaining(result.state)).toBe(0);
 });

 it('delivers a combined rocket to the seed route as well',()=>{
  const before=videoBoard(ENGINE_VERSION);
  before.cells[49]!.tile={id:74,kind:'wind-row'};before.nextTileId=75;
  const result=applyAction(before,{type:'swap',from:48,to:49});
  expect(result.events.find(event=>event.kind==='glider-flight')?.to).toBe(65);
  expect(seedRemaining(result.state)).toBe(0);
 });

 it('keeps the pouch on an exit route when adjacent blocked columns need side feed',()=>{
  const state=createGame({id:1,version:'seed-delivery-test',engineVersion:ENGINE_VERSION,width:7,height:7,colors:[...COLORS],moves:30,seed:14121,shape:Array(49).fill(true),obstacles:[],goals:[{kind:'berry',count:999,remaining:999}],difficulty:'normal'});
  state.cells.forEach((cell,at)=>{cell.tile={id:at+1,kind:'normal',color:COLORS[(at%7+Math.floor(at/7)*2)%6]!};});
  state.goals=[{kind:'seed',count:1,remaining:1}];
  state.obstacles.lock={id:'lock',kind:'vine',anchor:17,footprint:[17],hp:5,maxHp:5};
  state.cells[17]!.obstacleId='lock';state.cells[44]!.exit=true;
  state.cells[16]!.tile={kind:'seed',id:96};state.nextTileId=100;
  const action={type:'booster',item:'hammer',at:31} as const;
  const old=applyAction({...state,engineVersion:FLOW_GRAVITY_ENGINE_VERSION},action);
  expect(old.state.cells[24]!.tile?.kind).toBe('seed');
  const result=applyAction(state,action);
  expect(result.state.cells[16]!.tile?.kind).toBe('seed');
  expect(result.state.cells[24]!.tile?.kind).toBe('normal');
 });

 it('keeps the seed and the new special when the level 255 bud opens during the same match',()=>{
  const before=budBoard(ENGINE_VERSION);
  expect(findMatches(before)).toEqual([]);
  const result=applyAction(before,{type:'swap',from:2,to:11});
  expect(result.events).toContainEqual({type:'spawn',kind:'seed',cells:[20]});
  expect(result.events).toContainEqual({type:'spawn',kind:'wind-column',cells:[11]});
  expect(result.state.goals.find(goal=>goal.kind==='bud')?.remaining).toBe(0);
  expect(result.state.cells.filter(cell=>cell.tile?.kind==='seed')).toHaveLength(1);
  expect(seedRemaining(result.state)).toBe(1);
 });

 it('restores a pouch to a stalled older save on the next valid action without marking it collected',()=>{
  const stalled=applyAction(budBoard(FLOW_GRAVITY_ENGINE_VERSION),{type:'swap',from:2,to:11}).state;
  expect(stalled.cells.some(cell=>cell.tile?.kind==='seed')).toBe(false);
  expect(seedRemaining(stalled)).toBe(1);
  const result=applyAction(stalled,{type:'booster',item:'hammer',at:0});
  expect(result.accepted).toBe(true);
  expect(result.state.engineVersion).toBe(FLOW_GRAVITY_ENGINE_VERSION);
  expect(result.state.cells[56]!.tile?.kind).toBe('seed');
  expect(result.state.moves).toBe(stalled.moves);
  expect(seedRemaining(result.state)).toBe(1);
  const completed=applyAction(result.state,{type:'booster',item:'hammer',at:65});
  expect(completed.state.status).toBe('won');
 });

 it('does not create a pouch while the source still has it',()=>{
  const before=budBoard(ENGINE_VERSION);
  const result=applyAction(before,{type:'booster',item:'hammer',at:71});
  expect(result.state.obstacles['bud-20']).toBeDefined();
  expect(result.state.cells.some(cell=>cell.tile?.kind==='seed')).toBe(false);
  expect(seedRemaining(result.state)).toBe(1);
 });
});
