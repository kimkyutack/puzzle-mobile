import {describe,expect,it} from 'vitest';
import {DENSE_GARDEN_PUZZLE_ENGINE_VERSION,GARDEN_PUZZLE_ENGINE_VERSION,type Action,type LevelDefinition} from '@garden/contracts';
import {applyAction,createGame,replay,validateLevel} from '@garden/core';
import {publishedLevel} from '../apps/api/src/level-content';
import {prepareRunInitial} from '../apps/api/src/run-initial';
import {projectDrag} from '../apps/client/src/drag-preview';
import {DENSE_GARDEN_PUZZLES_VERSION} from '../packages/content/src/dense-garden-puzzles';
import {gardenPuzzleSlot} from '../packages/content/src/garden-puzzles';
import {harvestCartPushPath} from '../packages/game-core/src/garden-puzzles';
import {solve} from '../tools/level-validation/validate';

const board=(id:number)=>publishedLevel(id,DENSE_GARDEN_PUZZLE_ENGINE_VERSION);

function cartPrefix(level:LevelDefinition):Action[]{
 const {width}=level,barrier=level.obstacles.some(o=>o.kind==='crate'&&Math.floor(o.anchor/width)>0&&Math.floor(o.anchor/width)<8);
 const actions:Action[]=[];
 let state=createGame(level);
 if(barrier){
  const action:Action={type:'tap',at:level.initial!.findIndex(tile=>tile?.kind==='wind-column')};
  state=applyAction(state,action).state;actions.push(action);
 }
 for(let step=0;step<52&&state.status==='playing';step++){
  const carts=Object.values(state.obstacles).filter(o=>o.kind==='harvest-cart');
  if(!carts.length)break;
  const y=Math.floor(carts[0]!.anchor/width);
  const docks=state.gardenPuzzle!.cells!.filter(at=>Math.floor(at/width)===y);
  const row=carts.filter(cart=>Math.floor(cart.anchor/width)===y).map(cart=>cart.anchor).sort((a,b)=>a-b);
  const sign=docks.at(-1)!>row[0]!?1:-1;
  const from=sign===1?row[0]!:row.at(-1)!,to=from+sign;
  const action:Action={type:'swap',from,to};
  const next=applyAction(state,action);
  if(!next.accepted||next.state.status==='error')break;
  state=next.state;actions.push(action);
 }
 return actions;
}

function shadowPrefix(level:LevelDefinition):Action[]{
 const actions:Action[]=[];
 let state=createGame(level);
 for(let step=0;step<10&&state.status==='playing';step++){
  const buds=Object.values(state.obstacles).filter(o=>o.kind==='shadow-bud');
  if(!buds.length)break;
  const row=Math.floor(Math.min(...buds.map(o=>o.anchor))/state.width);
  const at=state.cells.findIndex((cell,index)=>Math.floor(index/state.width)===row&&cell.tile?.kind==='wind-row');
  if(at<0)break;
  const action:Action={type:'tap',at};
  const result=applyAction(state,action);
  if(!result.accepted)break;
  actions.push(action);state=result.state;
 }
 return actions;
}

function proofPrefix(level:LevelDefinition):Action[]{
 if(level.gardenPuzzle?.kind==='cart')return cartPrefix(level);
 if(level.gardenPuzzle?.kind==='shadow')return shadowPrefix(level);
 if(level.gardenPuzzle?.kind==='fence'){
  const actions:Action[]=[];
  let state=createGame(level);
  const tap=(kind:'wind-row'|'wind-column',line:number)=>{
   if(state.status!=='playing')return;
   const at=state.cells.findIndex((cell,index)=>cell.tile?.kind===kind&&
    (kind==='wind-row'?Math.floor(index/level.width):index%level.width)===line);
   if(at<0)return;
   const action:Action={type:'tap',at};
   const result=applyAction(state,action);
   if(result.accepted){actions.push(action);state=result.state;}
  };
  for(const row of [1,7])tap('wind-row',row);
  for(const column of [1,7])tap('wind-column',column);
  return actions;
 }
 return [];
}

describe('full obstacle areas in levels 3001–3600',()=>{
 it('serves all 72 dense boards only to the new engine',()=>{
  const ids=Array.from({length:600},(_,index)=>index+3001).filter(gardenPuzzleSlot);
  expect(ids).toHaveLength(72);
  for(const id of ids){
   const level=board(id),older=publishedLevel(id,GARDEN_PUZZLE_ENGINE_VERSION);
   expect(level.version).toBe(DENSE_GARDEN_PUZZLES_VERSION);
   expect(older.version).not.toBe(level.version);
   expect(level.moves).toBeGreaterThanOrEqual(older.moves);
   expect(level.obstacles.filter(o=>o.kind==='soil-clod'||o.kind===level.goals[0]!.kind).length).toBeGreaterThanOrEqual(18);
   expect(validateLevel(level)).toEqual([]);
   expect(createGame(level).status).toBe('playing');
  }
 });

 it('fills a region with 21 carts and moves a full row for a single swipe',()=>{
  const initial=createGame(board(3102));
  expect(initial.goals[0]?.remaining).toBe(21);
  expect(harvestCartPushPath(initial,17,16)).toEqual([17,16,15,14]);
  expect(projectDrag(initial,17,-45,0,44)).toMatchObject({to:16,canRelease:true});
  const result=applyAction(initial,{type:'swap',from:17,to:16});
  expect(result.state.moves).toBe(initial.moves-1);
  expect(result.events.filter(e=>e.kind==='cart-push')).toHaveLength(3);
  expect(result.state.goals[0]?.remaining).toBe(20);
  expect(result.state.gardenPuzzle?.cells).not.toContain(14);
  expect(result.state.cells[16]?.obstacleId).toBe('dense-17');
 });

 it('keeps both pieces when there is no place to spread a packed clod',()=>{
  const initial=createGame(board(3201));
  const hit=(state:ReturnType<typeof createGame>)=>applyAction(state,{type:'booster',item:'hammer',at:20});
  const split=hit(initial);
  expect(split.state.obstacles[split.state.cells[20]!.obstacleId!]).toMatchObject({kind:'soil-chip',hp:2});
  expect(split.state.goals[0]?.remaining).toBe(50);
  const first=hit(split.state),second=hit(first.state);
  expect(first.state.goals[0]?.remaining).toBe(49);
  expect(second.state.goals[0]?.remaining).toBe(48);
 });

 for(const id of [3001,3003,3062,3101,3102,3163,3201,3263,3301,3363,3401,3463,3501,3512,3563]){
  it(`clears dense level ${id} on fixed and randomized starts`,()=>{
   const level=board(id);
   for(const start of [level,prepareRunInitial(level,[],true,17347).level]){
    const prefix=proofPrefix(start);
    const preferred=solve(start,'goal',prefix),proof=preferred.status==='won'&&!preferred.shuffles?preferred:solve(start,'special',prefix);
    expect(proof.status).toBe('won');
    expect(proof.shuffles).toBe(0);
    expect(proof.actions.every(action=>action.type==='swap'||action.type==='tap')).toBe(true);
    expect(replay(start,proof.actions).state.status).toBe('won');
   }
  });
 }
});
