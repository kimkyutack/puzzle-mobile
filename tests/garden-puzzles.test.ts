import {describe,expect,it} from 'vitest';
import {GARDEN_PUZZLE_ENGINE_VERSION,PLANTER_GARDEN_ENGINE_VERSION,type Action,type GameState,type LevelDefinition} from '@garden/contracts';
import {applyAction,createGame,legalActions,replay,stateHash,validateLevel} from '@garden/core';
import {publishedLevel} from '../apps/api/src/level-content';
import {prepareRunInitial} from '../apps/api/src/run-initial';
import {projectDrag} from '../apps/client/src/drag-preview';
import {effectTiming,DOMINO_BEAT} from '../apps/client/src/visual-timing';
import {GARDEN_PUZZLES_VERSION,gardenPuzzleSlot} from '../packages/content/src/garden-puzzles';
import {lightRay,stepCell} from '../packages/game-core/src/garden-puzzles';
import {solve} from '../tools/level-validation/validate';

const board=(id:number)=>publishedLevel(id,GARDEN_PUZZLE_ENGINE_VERSION);
const tap=(at:number):Action=>({type:'tap',at});
const hammer=(at:number):Action=>({type:'booster',item:'hammer',at});

function cartRoute(state:GameState,start:number):number[]{
 const queue=[[start]],seen=new Set([start]);
 for(let i=0;i<queue.length;i++){
  const path=queue[i]!,from=path.at(-1)!;
  if(state.gardenPuzzle?.cells?.includes(from))return path;
  for(const dir of ['right','left','up','down'] as const){
   const to=stepCell(from,dir,state.width,state.cells.length),dest=to===undefined?undefined:state.cells[to];
   if(to===undefined||seen.has(to)||!dest?.exists||dest.obstacleId||dest.tile&&dest.tile.kind!=='normal')continue;
   seen.add(to);queue.push([...path,to]);
  }
 }
 return [];
}

function cartPrefix(level:LevelDefinition):Action[]{
 const firstPower=level.initial!.findIndex(tile=>tile?.kind==='wind-row'&&tile.id>level.width*4&&tile.id<=level.width*5);
 const opening=tap(firstPower),actions=[opening];
 let state=applyAction(createGame(level),opening).state;
 for(let step=0;step<20&&state.goals.find(g=>g.kind==='harvest-cart')!.remaining>0;step++){
  const route=Object.values(state.obstacles).filter(o=>o.kind==='harvest-cart').map(o=>cartRoute(state,o.anchor))
   .filter(path=>path.length>=2).sort((a,b)=>a.length-b.length)[0];
  if(!route)break;
  const [from,to]=route,action:Action={type:'swap',from:from!,to:to!};
  const result=applyAction(state,action);
  if(!result.accepted||result.state.status==='error')break;
  actions.push(action);state=result.state;
 }
 return actions;
}

describe('campaign rules introduced from level 3001',()=>{
 it('schedules 72 approved boards and keeps classic and earlier engines on their previous boards',()=>{
  const slots=Array.from({length:600},(_,index)=>index+3001).filter(gardenPuzzleSlot);
  expect(slots).toHaveLength(72);
  for(const id of slots){
   const level=board(id),earlier=publishedLevel(id,PLANTER_GARDEN_ENGINE_VERSION);
   expect(level.version).toBe(GARDEN_PUZZLES_VERSION);
   expect(level.moves).toBeGreaterThanOrEqual(earlier.moves);
   expect(validateLevel(level)).toEqual([]);
   expect(legalActions(createGame(level)).length).toBeGreaterThan(0);
   expect(earlier.gardenPuzzle).toBeUndefined();
  }
  for(const id of [2999,3010,3039,3051,3100,3599,3601])expect(board(id).gardenPuzzle).toBeUndefined();
  expect(validateLevel({...board(3001),engineVersion:PLANTER_GARDEN_ENGINE_VERSION})).toContain('GARDEN_PUZZLE_ENGINE');
 });

 it('topples the first row around its bend, then stops at the gap on the third level',()=>{
  const action=tap(1),result=applyAction(createGame(board(3001)),action);
  const chain=result.events.filter(e=>e.kind==='domino-chain');
  expect(chain.map(e=>[e.from,e.to])).toEqual([[19,20],[20,21],[21,30],[30,39],[39,40]]);
  expect(result.state.goals[0]?.remaining).toBe(6);
  const timing=effectTiming(result.events,result.state,action);
  expect(timing.delays[result.events.indexOf(chain[4]!)!]-timing.delays[result.events.indexOf(chain[0]!)!]!).toBeGreaterThanOrEqual(DOMINO_BEAT*4);
  expect(applyAction(createGame(board(3003)),action).events.filter(e=>e.kind==='domino-chain')).toHaveLength(2);
 });

 it('uses an ordinary swipe to push the cart and rejects an occupied destination without charging a move',()=>{
  const level=board(3101),before=createGame(level),from=37,to=38;
  expect(projectDrag(before,from,40,0,44)).toMatchObject({to,canRelease:true});
  const pushed=applyAction(before,{type:'swap',from,to});
  expect(pushed.state.moves).toBe(before.moves-1);
  expect(pushed.events[0]).toMatchObject({kind:'cart-push',from,to});
  const second=applyAction(pushed.state,{type:'swap',from:to,to:39});
  const blocked=applyAction(second.state,{type:'swap',from:39,to:40});
  expect(blocked.accepted).toBe(false);
  expect(blocked.state).toBe(second.state);
  expect(applyAction(before,hammer(from)).accepted).toBe(false);
  expect(replay(level,cartPrefix(level)).state.status).toBe('won');
 });

 it('splits in the direction of the rocket and leaves both smaller targets to clear',()=>{
  const transverse=applyAction(createGame(board(3201)),tap(22));
  expect(transverse.events.find(e=>e.kind==='soil-split'&&e.from===20)?.cells).toEqual([19,21]);
  expect(transverse.state.goals[0]?.remaining).toBe(8);
  const vertical=applyAction(createGame(board(3202)),tap(42));
  expect(vertical.events.find(e=>e.kind==='soil-split'&&e.from===24)?.cells).toEqual([15,33]);
 });

 it('turns light on, respects a blocked ray and keeps only one row lit',()=>{
  const level=board(3361),initial=createGame(level);
  expect(applyAction(initial,hammer(21)).accepted).toBe(false);
  const first=applyAction(initial,hammer(18));
  expect(lightRay(first.state)).toEqual([19]);
  const damaged=applyAction(first.state,hammer(20));
  expect(lightRay(damaged.state)).toEqual([19]);
  const clear=applyAction(damaged.state,hammer(20));
  expect(lightRay(clear.state)).toContain(21);
  const other=applyAction(clear.state,hammer(54));
  expect(lightRay(other.state)).not.toContain(21);
 });

 it('cuts both horizontal and vertical wire with a cross-rocket but leaves the pots standing',()=>{
  const first=applyAction(createGame(board(3401)),{type:'swap',from:40,to:31});
  const cross=first.events.find(e=>e.kind==='wind-column+wind-row')!;
  const row=first.events.filter(e=>e.kind==='wire-planter'&&e.effectId===cross.effectId&&Math.floor(e.cells[0]!/9)===3);
  expect(row).toHaveLength(6);
  expect(row.every(e=>e.obstacleAfter?.wire===0&&e.obstacleAfter.hp===1)).toBe(true);
 });

 it('removes thickets when posts enclose them and leaves them standing behind an open fence',()=>{
  const first=applyAction(createGame(board(3501)),tap(9));
  expect(first.state.gardenPuzzle?.posts?.length).toBeGreaterThanOrEqual(7);
  expect(first.state.goals[0]?.remaining).toBe(6);
  const closed=applyAction(first.state,{type:'booster',item:'world-bomb'});
  expect(closed.events.some(e=>e.kind==='fence-close')).toBe(true);
  expect(closed.state.status).toBe('won');
 });

 for(const id of [3001,3003,3061,3101,3102,3163,3201,3202,3261,3301,3302,3361,3401,3462,3501,3503,3561]){
  it(`clears the authored and shuffled starts on ${id} with ordinary moves and board power-ups`,()=>{
   const original=board(id);
   for(const level of [original,prepareRunInitial(original,[],true,17347).level]){
    const prefix=level.gardenPuzzle!.kind==='cart'?cartPrefix(level):[];
    const first=solve(level,'goal',prefix),solution=first.status==='won'&&!first.shuffles?first:solve(level,'special',prefix);
    expect(solution.status).toBe('won');
    expect(solution.shuffles).toBe(0);
    expect(solution.actions.every(a=>a.type==='swap'||a.type==='tap')).toBe(true);
    const check=replay(level,solution.actions);
    expect(check.state.status).toBe('won');
    expect(stateHash(check.state)).toBe(solution.hash);
   }
  });
 }
});
