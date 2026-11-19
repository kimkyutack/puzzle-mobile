import {describe,it,expect} from 'vitest';
import {createGame,applyAction} from '@garden/core';
import {getLevel} from '@garden/content';
import type {GameState,Special} from '@garden/contracts';

// Boards with sturdy multi-hit obstacles next to free cells where a combo can sit.
function sturdyBoards(){
 const boards:Array<{state:GameState;at:number}>=[];
 for(let level=1;level<=400&&boards.length<6;level++){
  let state:GameState;try{state=createGame(getLevel(level));}catch{continue;}
  const sturdy=Object.values(state.obstacles).filter(o=>o.hp>=2);if(sturdy.length<2)continue;
  const at=state.cells.findIndex((c,i)=>c.tile?.kind==='normal'&&!c.obstacleId&&state.cells[i+1]?.tile?.kind==='normal'&&(i+1)%state.width!==0&&!state.cells[i+1]!.obstacleId);
  if(at>=0)boards.push({state,at});
 }
 return boards;
}
const combos:Array<[Special,Special]>=[['rainbow','bomb'],['rainbow','wind-row'],['bomb','bomb'],['wind-row','wind-column'],['wind-row','bomb']];

describe('a bomb or rocket combination strikes each obstacle once (Royal Match rule)',()=>{
 const boards=sturdyBoards();
 it('has sturdy obstacles to test against',()=>expect(boards.length).toBeGreaterThan(2));
 let struck=0;
 for(const [a,b] of combos)it(`${a}+${b} removes at most one layer from any obstacle`,()=>{
  for(const {state:base,at} of boards){
   const state=structuredClone(base);state.cells[at]!.tile={id:90000,kind:a};state.cells[at+1]!.tile={id:90001,kind:b};state.nextTileId=Math.max(state.nextTileId,90002);
   const before=Object.fromEntries(Object.values(state.obstacles).map(o=>[o.id,o.hp]));
   const result=applyAction(state,{type:'swap',from:at,to:at+1});if(!result.accepted)continue;
   // Only obstacles still standing in the first wave count: later cascades are separate matches.
   const refill=result.events.findIndex(e=>e.type==='fall'||e.type==='spawn'&&e.kind==='normal'),firstWave=refill<0?result.events:result.events.slice(0,refill);
   const hits=new Map<string,number>();for(const e of firstWave)if(e.type==='hit'&&e.obstacleId)hits.set(e.obstacleId,(hits.get(e.obstacleId)??0)+1);
   for(const [id,count] of hits){if(before[id]!>=2){struck++;expect(count,`${a}+${b} hit ${id} on level ${base.levelId}`).toBe(1);}}
  }
  });
 it('actually struck sturdy obstacles across the combinations',()=>expect(struck).toBeGreaterThan(5));
});
