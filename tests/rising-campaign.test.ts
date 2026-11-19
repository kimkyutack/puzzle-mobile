import {describe,expect,it} from 'vitest';
import {CHAPTER_OBSTACLE_ENGINE_VERSION,MATCH_FIRST_ENGINE_VERSION,type GameState} from '@garden/contracts';
import {applyAction,createGame,legalActions,validateLevel} from '@garden/core';
import {publishedLevel} from '../apps/api/src/level-content';
import {prepareRunInitial} from '../apps/api/src/run-initial';
import {advanceObstacleRules} from '../packages/game-core/src/obstacle-rules';
import {RISING_CAMPAIGN_VERSION,risingCampaignProfiles} from '../packages/content/src/rising-campaign';
import recipes from '../packages/content/src/rising-campaign-recipes.json';

function current(id:number){
 return publishedLevel(id,CHAPTER_OBSTACLE_ENGINE_VERSION);
}

describe('rising campaign',()=>{
 it('has a saved replay budget for every scheduled board profile',()=>{
  expect(Object.keys(recipes).sort()).toEqual(risingCampaignProfiles().map(([key])=>key).sort());
 });

 it('teaches each new rule once, then expands it into a bank of obstacles',()=>{
  for(const id of [3601,3701,3801]){
   const intro=current(id);
   const rule=intro.obstacles[0]!.rule;
   expect(rule).toBeDefined();
   expect(intro.campaign?.beat).toBe('introduction');
   expect(intro.obstacles).toHaveLength(3);
   expect(validateLevel({...intro,engineVersion:MATCH_FIRST_ENGINE_VERSION})).toContain('OBSTACLE_RULE_ENGINE');
   const old=publishedLevel(id,MATCH_FIRST_ENGINE_VERSION);
   expect(old.obstacles.every(o=>o.rule===undefined)).toBe(true);
   for(const next of [current(id+1),current(id+2)]){
    expect(next.campaign?.beat).toBe('normal');
    expect(next.obstacles.length).toBeGreaterThanOrEqual(15);
    expect(next.moves).toBeGreaterThanOrEqual(intro.moves);
    expect(next.obstacles.some(o=>o.rule!==undefined)).toBe(true);
   }
  }
 });

 it('uses the authored tutorial start while replaying randomized regular attempts on the same obstacle bank',()=>{
  const intro=current(3801),regular=current(3802);
  expect(prepareRunInitial(intro,[],true,17267).level).toBe(intro);
  const attempt=prepareRunInitial(regular,[],true,17267);
  expect(attempt.level.seed).not.toBe(regular.seed);
  expect(attempt.level.obstacles).toEqual(regular.obstacles);
  expect(legalActions(attempt.state).length).toBeGreaterThan(0);
 });

 it('places a flower bomb between both sluices when a hard board has two covered sections',()=>{
  const level=Array.from({length:200},(_,offset)=>current(6001+offset))
   .find(board=>board.strategy?.id.startsWith('rising-campaign/planters/')&&board.startBoosterGuide?.item==='bomb')!;
  const guide=level.startBoosterGuide!;
  const state=createGame(level,[guide.item]);
  expect(Object.values(state.obstacles).filter(o=>o.kind==='greenhouse-sluice')).toHaveLength(2);
  const result=applyAction(state,{type:'tap',at:guide.cell});
  expect(result.accepted).toBe(true);
  expect(Object.values(result.state.obstacles).some(o=>o.cover)).toBe(false);
 });

 it('opens shutters after a played move and rejects a hammer on a closed one',()=>{
  const state=createGame(current(3601));
  const closed=Object.values(state.obstacles).find(o=>o.rule==='shutter-closed')!;
  const hammer={type:'booster',item:'hammer',at:closed.anchor} as const;
  expect(applyAction(state,hammer)).toMatchObject({accepted:false,state});
  const played=applyAction(state,legalActions(state)[0]!);
  expect(played.state.obstacles[closed.id]?.rule).toBe('shutter-open');
  expect(played.events).toContainEqual(expect.objectContaining({kind:'obstacle-rule',obstacleId:closed.id}));
  const hit=applyAction(played.state,hammer);
  expect(hit.accepted).toBe(true);
  expect(hit.state.obstacles[closed.id]).toBeUndefined();
 });

 it('heals injured jars only if a whole move goes by without a hit',()=>{
  const state=createGame(current(3701));
  const [wounded,untouched]=Object.values(state.obstacles);
  const hit=applyAction(state,{type:'booster',item:'hammer',at:wounded!.anchor});
  expect(hit.state.obstacles[wounded!.id]!.hp).toBe(1);
  const simulated:GameState=structuredClone(hit.state);
  simulated.obstacles[untouched!.id]!.hp=1;
  advanceObstacleRules(simulated,[...hit.events]);
  expect(simulated.obstacles[wounded!.id]!.hp).toBe(1);
  expect(simulated.obstacles[untouched!.id]!.hp).toBe(2);
 });

 it('flips a power-only shell after damage and requires an adjacent match next',()=>{
  const state=createGame(current(3801));
  const lantern=Object.values(state.obstacles)[0]!;
  const hammer={type:'booster',item:'hammer',at:lantern.anchor} as const;
  const hit=applyAction(state,hammer);
  expect(hit.state.obstacles[lantern.id]).toMatchObject({hp:1,rule:'match-shell'});
  expect(applyAction(hit.state,hammer)).toMatchObject({accepted:false,state:hit.state});
 });

 it('raises the target count from the front of the campaign to the final band',()=>{
  const average=(first:number)=>{
   const levels=Array.from({length:100},(_,i)=>current(first+i)).filter(level=>level.version.startsWith(RISING_CAMPAIGN_VERSION)&&level.campaign?.beat!=='introduction');
   return levels.reduce((sum,level)=>sum+level.goals.reduce((total,goal)=>total+goal.count,0),0)/levels.length;
  };
  const counts=[1001,2001,3601,6001,9001,12001,16001].map(average);
  counts.slice(1).forEach((count,index)=>expect(count).toBeGreaterThan(counts[index]!));
 });
});
