import {describe,expect,it} from 'vitest';
import {CAMPAIGN_EXPANSION_ENGINE_VERSION,CHAPTER_OBSTACLE_ENGINE_VERSION,RISING_CAMPAIGN_ENGINE_VERSION,type Action} from '@garden/contracts';
import {applyAction,createGame,findMatches,legalActions,replay,validateLevel} from '@garden/core';
import {publishedLevel} from '../apps/api/src/level-content';
import {prepareRunInitial} from '../apps/api/src/run-initial';
import {expansionProfiles} from '../packages/content/src/campaign-expansion';
import recipes from '../packages/content/src/campaign-expansion-recipes.json';

const level=(id:number)=>publishedLevel(id,CHAPTER_OBSTACLE_ENGINE_VERSION);
const firstMatch={type:'swap',from:24,to:25} as const;
const lessons=[[3901,'twin'],[4001,'pigment'],[4101,'directional'],[4201,'fuse']] as const;

describe('campaign expansion',()=>{
 it('teaches each rule on one authored board and scales the two following boards',()=>{
  for(const [id,rule] of lessons){
   const intro=level(id),retained=publishedLevel(id,RISING_CAMPAIGN_ENGINE_VERSION);
   expect(intro.campaign?.beat).toBe('introduction');
   expect(intro.obstacles.some(obstacle=>obstacle.rule===rule)).toBe(true);
   expect(prepareRunInitial(intro,[],true,12345).level).toEqual(intro);
   expect(retained.obstacles.some(obstacle=>obstacle.rule===rule)).toBe(false);
   expect(validateLevel({...intro,engineVersion:RISING_CAMPAIGN_ENGINE_VERSION})).toContain('OBSTACLE_RULE_ENGINE');
   for(const next of [level(id+1),level(id+2)]){
    expect(next.campaign?.beat).toBe('normal');
    expect(next.obstacles.length).toBeGreaterThanOrEqual(16);
    expect(next.obstacles.some(obstacle=>obstacle.rule===rule)).toBe(true);
   }
  }
  expect(publishedLevel(4301,CAMPAIGN_EXPANSION_ENGINE_VERSION).campaign?.beat).toBe('normal');
  expect(level(19953).obstacles.length).toBe(31);
  expect(Object.keys(recipes).sort()).toEqual([...expansionProfiles().keys()].sort());
 });

 it('requires both tablets in one action and lets a shared rocket clear the pair',()=>{
  const lesson=level(3901);
  const pair=lesson.obstacles.map(obstacle=>obstacle.anchor);
  const first=applyAction(createGame(lesson),{type:'booster',item:'sweep-column',at:pair[0]!});
  expect(first.accepted).toBe(true);
  expect(first.state.goals[0]!.remaining).toBe(2);
  expect(first.events.some(event=>event.kind==='twin-prime')).toBe(true);
  const separate=applyAction(first.state,{type:'booster',item:'sweep-column',at:pair[1]!});
  expect(separate.state.goals[0]!.remaining).toBe(2);
  const together=applyAction(createGame(lesson),{type:'tap',at:31});
  expect(together.state.status).toBe('won');
  expect(together.events).toContainEqual(expect.objectContaining({kind:'twin-release',cells:pair}));
  expect(validateLevel({...lesson,obstacles:[lesson.obstacles[0]!] })).toContain('OBSTACLE_PAIR');
 });

 it('remembers a match color, rejects the same color, and accepts a direct hit',()=>{
  const initial=createGame(level(4001)),first=applyAction(initial,firstMatch);
  const jar=first.state.obstacles['expansion-29']!;
  expect(jar).toMatchObject({hp:1,lastHitColor:'berry'});
  const repeated=applyAction({...initial,obstacles:{...initial.obstacles,[jar.id]:jar}},firstMatch);
  expect(repeated.state.obstacles[jar.id]).toEqual(jar);
  const direct=applyAction(first.state,{type:'booster',item:'hammer',at:jar.anchor});
  expect(direct.state.obstacles[jar.id]).toBeUndefined();
 });

 it('rotates the open side after a valid strike and blocks a hit from the previous side',()=>{
  const initial=createGame(level(4101)),first=applyAction(initial,firstMatch);
  const shield=first.state.obstacles['expansion-29']!;
  expect(shield).toMatchObject({hp:1,strikeSide:'right'});
  const wrongSide=applyAction({...initial,obstacles:{...initial.obstacles,[shield.id]:shield}},firstMatch);
  expect(wrongSide.state.obstacles[shield.id]).toEqual(shield);
  const direct=applyAction(first.state,{type:'booster',item:'hammer',at:shield.anchor});
  expect(direct.state.obstacles[shield.id]).toBeUndefined();
 });

 it('ignites a fuse for two moves, then detonates it and affects adjacent cells',()=>{
  const map=level(4201),first=applyAction(createGame(map),firstMatch);
  const fuse=first.state.obstacles['expansion-29']!;
  expect(fuse).toMatchObject({hp:1,detonateAt:3});
  const second=applyAction(first.state,{type:'swap',from:7,to:14});
  expect(second.state.turn).toBe(2);
  expect(second.state.obstacles[fuse.id]).toEqual(fuse);
  const third=applyAction(second.state,{type:'swap',from:0,to:7});
  expect(third.state.turn).toBe(3);
  expect(third.state.obstacles[fuse.id]).toBeUndefined();
  expect(third.events).toContainEqual(expect.objectContaining({kind:'fuse-blast',from:fuse.anchor,cells:expect.arrayContaining([30])}));
 });

 it('replays each teaching board to a win with ordinary board actions',()=>{
  const winning:Action[][]=[
   [{type:'tap',at:31}],
   [[24,25],[8,15],[17,24],[10,11]].map(([from,to]):Action=>({type:'swap',from:from!,to:to!})).concat([{type:'tap',at:9},{type:'swap',from:19,to:20}]),
   [[24,25],[2,9],[8,9],[23,30],[10,17]].map(([from,to])=>({type:'swap',from:from!,to:to!})),
   [[24,25],[7,14],[0,7],[2,9],[14,21],[21,22]].map(([from,to])=>({type:'swap',from:from!,to:to!})),
  ];
  for(const [index,[id]] of lessons.entries()){
   const map=level(id),state=createGame(map);
   expect(findMatches(state)).toEqual([]);
   expect(legalActions(state).length).toBeGreaterThan(0);
   const result=replay(map,winning[index]!);
   expect(result.accepted).toBe(true);
   expect(result.state.status).toBe('won');
  }
 });
});
