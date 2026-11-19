import {describe,expect,it} from 'vitest';
import {CHAPTER_OBSTACLE_ENGINE_VERSION,ENGINE_VERSION,GREENHOUSE_ENGINE_VERSION,FLOW_GRAVITY_ENGINE_VERSION,SEED_DELIVERY_ENGINE_VERSION} from '@garden/contracts';
import {getLevel} from '@garden/content';
import {applyAction,createGame,findMatches,legalActions,replay,validateLevel} from '@garden/core';
import {publishedLevel} from '../apps/api/src/level-content';
import {prepareRunInitial} from '../apps/api/src/run-initial';
import {earlyBalancedLevel} from '../packages/content/src/early-balance';
import {earlyMidBalancedLevel} from '../packages/content/src/early-mid-balance';
import {midgameBalancedLevel} from '../packages/content/src/midgame-balance';
import {progressiveLevel,replaceFlowerObstacle} from '../packages/content/src/progressive';
import {startBoosterChallenge} from '../packages/content/src/start-booster-challenges';
import {ROTATION_CONTENT_VERSION,ROTATION_FAMILIES} from '../packages/content/src/campaign-rotation';
import {solve} from '../tools/level-validation/validate';

function previousBoard(id:number,engine=ENGINE_VERSION){
 const progressive=progressiveLevel(getLevel(id,engine));
 const balanced=earlyMidBalancedLevel(midgameBalancedLevel(earlyBalancedLevel(progressive)));
 return startBoosterChallenge(replaceFlowerObstacle(balanced));
}

describe('campaign mechanic rotation',()=>{
 it('teaches one mechanic then rotates between groups of two or three boards',()=>{
  const seen=new Set<string>();
  for(const [start,intro] of [[101,'magnet-ends'],[201,'pipe-delivery'],[301,'carousel']] as const){
   const groups:{family:string;length:number}[]=[];
   for(let id=start;id<start+100;id++){
    if(id%10===0)continue;
    const level=publishedLevel(id,GREENHOUSE_ENGINE_VERSION);
    expect(level.version.startsWith(ROTATION_CONTENT_VERSION),String(id)).toBe(true);
    const family=level.strategy!.id,last=groups.at(-1);
    if(last?.family===family)last.length++;
    else groups.push({family,length:1});
    seen.add(family);
    if(id<start+3)expect(level.campaign?.beat).toBe(id===start?'introduction':'practice');
   }
   expect(groups[0]).toEqual({family:intro,length:3});
   expect(groups.every(group=>group.length===2||group.length===3)).toBe(true);
  }
  expect([...seen].sort()).toEqual([...ROTATION_FAMILIES].sort());
 });

 it('keeps original move budgets as a floor and preserves story boards and retained engines',()=>{
  const changed=[];
  for(let id=1;id<=400;id++){
   const level=publishedLevel(id,GREENHOUSE_ENGINE_VERSION),previous=previousBoard(id,GREENHOUSE_ENGINE_VERSION);
   expect(level.moves,String(id)).toBeGreaterThanOrEqual(previous.moves);
   if(id<=30||id%10===0)expect(level).toEqual(previous);
   if(level.version.startsWith(ROTATION_CONTENT_VERSION)){
    changed.push(id);
    expect(validateLevel(level),String(id)).toEqual([]);
    expect(level.goals.length).toBeLessThanOrEqual(4);
   }
  }
  expect(changed).toHaveLength(280);
  for(const id of [41,55,67,101,201,257,301,398]){
   expect(publishedLevel(id,FLOW_GRAVITY_ENGINE_VERSION)).toEqual(previousBoard(id,FLOW_GRAVITY_ENGINE_VERSION));
  }
  expect(publishedLevel(401,SEED_DELIVERY_ENGINE_VERSION)).toEqual(previousBoard(401,SEED_DELIVERY_ENGINE_VERSION));
 });

 it('supports random starts, deterministic replay and clearing with board-created specials',()=>{
  for(const id of [104,201,207,211,301,308]){
   const level=publishedLevel(id,ENGINE_VERSION);
   const {level:attempt,state}=prepareRunInitial(level,[],true,17347);
   expect(attempt.obstacles).toEqual(level.obstacles);
   expect(attempt.exits).toEqual(level.exits);
   expect(findMatches(state)).toEqual([]);
   expect(legalActions(state).length).toBeGreaterThan(0);
   const solution=solve(attempt,'special');
   expect(solution.status,String(id)).toBe('won');
   expect(replay(attempt,solution.actions).state.status).toBe('won');
  }
  const level=publishedLevel(104,ENGINE_VERSION),guide=level.startBoosterGuide!;
  const start=createGame(level,[guide.item]);
  const hit=applyAction(start,{type:'tap',at:guide.cell});
  const first=hit.events.find(event=>event.type==='hit');
  expect(hit.accepted).toBe(true);
  expect(hit.events.filter(event=>event.type==='hit'&&event.effectId===first?.effectId).length).toBeGreaterThanOrEqual(3);
 },20000);

 it('requires players to approach rails from the ends, deliver seeds and follow moving planters',()=>{
  const magnet=createGame(publishedLevel(101,CHAPTER_OBSTACLE_ENGINE_VERSION));
  const rail=Object.values(magnet.obstacles).find(obstacle=>obstacle.endOnly)!;
  expect(applyAction(magnet,{type:'booster',item:'hammer',at:rail.footprint[1]!}).reason).toBe('PIPE_END_REQUIRED');
  const endHit=applyAction(magnet,{type:'booster',item:'hammer',at:rail.footprint[0]!});
  expect(endHit.state.obstacles[rail.id]?.footprint.length).toBe(rail.footprint.length-1);

  const delivery=publishedLevel(201,CHAPTER_OBSTACLE_ENGINE_VERSION),solution=solve(delivery,'special');
  const delivered=replay(delivery,solution.actions).state;
  expect(delivered.status).toBe('won');
  expect(delivered.goals.find(goal=>goal.kind==='seed')?.remaining).toBe(0);

  const rotating=createGame(publishedLevel(301,CHAPTER_OBSTACLE_ENGINE_VERSION));
  const planter=Object.values(rotating.obstacles).find(obstacle=>obstacle.kind==='carousel')!;
  const to=planter.path![(planter.path!.indexOf(planter.anchor)+1)%planter.path!.length];
  expect(legalActions(rotating).some(action=>applyAction(rotating,action).state.obstacles[planter.id]?.anchor===to)).toBe(true);
 });
});
