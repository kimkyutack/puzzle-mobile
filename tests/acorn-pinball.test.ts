import {expect,it} from 'vitest';
import {PINBALL_PHYSICS_VERSION} from '../packages/contracts/src/garden-games';
import {launchAcorn,pinballBoard,PINBALL_LAUNCHES,PINBALL_POCKETS,replayPinball,type PinballShot} from '../packages/content/src/acorn-pinball';

function turns({path}:PinballShot){
 let direction=0,changes=0;
 for(let index=1;index<path.length;index++){
  const drift=path[index]!.x-path[index-1]!.x;
  if(Math.abs(drift)<=.6)continue;
  const next=Math.sign(drift);
  if(direction&&next!==direction)changes++;
  direction=next;
 }
 return changes;
}

it('ricochets from every slot and lets the edge launches reach all five pockets across layouts',()=>{
 const left=new Set<number>(),right=new Set<number>();
 for(let index=1;index<=120;index++){
  const seed=Math.imul(index,3162435169)>>>0;
  const board=pinballBoard(index%10+1,seed,PINBALL_PHYSICS_VERSION);
  const shots=PINBALL_LAUNCHES.map((_,slot)=>launchAcorn(board,slot));
  for(const shot of shots){
   expect(shot.path.at(-1)!.y).toBeGreaterThanOrEqual(304);
   expect(shot.hits.length).toBeGreaterThanOrEqual(2);
   expect(turns(shot)).toBeGreaterThanOrEqual(2);
  }
  left.add(shots[0]!.pocket);
  right.add(shots.at(-1)!.pocket);
  const actions=board.targets.map(target=>shots.findIndex(shot=>shot.pocket===target));
  expect(replayPinball(board,actions).status).toBe('won');
 }
 expect(left.size).toBe(PINBALL_POCKETS);
 expect(right.size).toBe(PINBALL_POCKETS);
});
