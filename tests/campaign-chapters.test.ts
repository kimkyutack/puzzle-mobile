import {describe,expect,it} from 'vitest';
import {CAMPAIGN_EXPANSION_ENGINE_VERSION,CHAPTER_OBSTACLE_ENGINE_VERSION,type GameState} from '@garden/contracts';
import {CHAPTER_OBSTACLES} from '../packages/contracts/src/chapter-obstacles';
import {applyAction,createGame,findMatches,legalActions,validateLevel} from '@garden/core';
import {publishedLevel} from '../apps/api/src/level-content';
import {prepareRunInitial} from '../apps/api/src/run-initial';

const current=(id:number)=>publishedLevel(id,CHAPTER_OBSTACLE_ENGINE_VERSION);
const natural={type:'swap',from:24,to:25} as const;

function moveWithoutHitting(state:GameState,id:string):GameState{
 for(const action of legalActions(state)){
  const result=applyAction(state,action);
  if(result.state.status==='playing'&&!result.events.some(event=>event.type==='hit'&&event.obstacleId===id))return result.state;
 }
 throw Error('No legal move away from the obstacle');
}

describe('campaign chapters through level 6000',()=>{
 it('introduces 17 rules once and serves valid larger boards in the next two stages',()=>{
  for(const [index,kind] of CHAPTER_OBSTACLES.entries()){
   const first=4301+index*100,lesson=current(first);
   expect(lesson.campaign?.beat).toBe('introduction');
   expect(lesson.obstacles.some(obstacle=>obstacle.chapter?.kind===kind)).toBe(true);
   expect(prepareRunInitial(lesson,[],true,12345).level).toEqual(lesson);
   expect(validateLevel({...lesson,engineVersion:CAMPAIGN_EXPANSION_ENGINE_VERSION})).toContain('CHAPTER_OBSTACLE_ENGINE');
   for(const id of [first+1,first+2]){
    const map=current(id),retained=publishedLevel(id,CAMPAIGN_EXPANSION_ENGINE_VERSION);
    expect(map.campaign?.beat).toBe('normal');
    expect(map.obstacles.length).toBeGreaterThan(lesson.obstacles.length);
    expect(map.obstacles.some(obstacle=>obstacle.chapter?.kind===kind)).toBe(true);
    expect(map.moves).toBeGreaterThanOrEqual(retained.moves);
    expect(createGame(map).status).toBe('playing');
    expect(retained.obstacles.every(obstacle=>!obstacle.chapter)).toBe(true);
   }
  }
  expect(current(6000).id).toBe(6000);
  expect(current(6101).obstacles.every(obstacle=>!obstacle.chapter)).toBe(true);
 });

 it('shifts a struck jar into an open space with consistent obstacle and tile ownership',()=>{
  const input=createGame(current(5101));
  const result=applyAction(input,natural);
  expect(result.state.obstacles['chapter-29']).toMatchObject({hp:1,anchor:30,footprint:[30]});
  expect(result.state.cells[29]!.obstacleId).toBeUndefined();
  expect(result.state.cells[30]).toMatchObject({obstacleId:'chapter-29',tile:null});
  expect(result.events).toContainEqual(expect.objectContaining({type:'hit',obstacleId:'chapter-29',from:29,to:30}));
  expect(findMatches(result.state)).toEqual([]);
 });

 it('demonstrates falling cascades and two-color seals without a power-up in their opening action',()=>{
  for(const id of [4401,4701]){
   const result=applyAction(createGame(current(id)),natural);
   expect(result.state.obstacles['chapter-29']).toBeUndefined();
   expect(result.events.some(event=>event.type==='special')).toBe(false);
   const firstFall=result.events.findIndex(event=>event.type==='fall');
   const hit=result.events.findIndex(event=>event.type==='hit'&&event.obstacleId==='chapter-29');
   expect(firstFall).toBeGreaterThanOrEqual(0);
   expect(hit).toBeGreaterThan(firstFall);
  }
 });

 it('requires a later turn on a cooling jar and reseals a timed obstacle after two missed moves',()=>{
  const cooling=applyAction(createGame(current(4901)),natural).state;
  const hammer={type:'booster',item:'hammer',at:29} as const;
  expect(cooling.obstacles['chapter-29']).toMatchObject({hp:1,chapter:{kind:'cooldown',turn:1}});
  expect(applyAction(cooling,hammer).accepted).toBe(false);
  const ready=moveWithoutHitting(cooling,'chapter-29');
  expect(applyAction(ready,hammer).state.obstacles['chapter-29']).toBeUndefined();

  let state=applyAction(createGame(current(5001)),natural).state;
  expect(state.obstacles['chapter-29']).toMatchObject({hp:1,chapter:{kind:'window',turn:3}});
  for(let turn=2;turn<=4;turn++){
   state=moveWithoutHitting(state,'chapter-29');
   expect(state.turn).toBe(turn);
   expect(state.obstacles['chapter-29']!.hp).toBe(turn<=3?1:2);
  }
 });

 it('keeps fusion crystals intact under a single bomb and clears them through a combination',()=>{
  const state=createGame(current(5601));
  const alone=applyAction(state,{type:'tap',at:23});
  expect(alone.state.goals[0]!.remaining).toBe(3);
  const combined=applyAction(state,{type:'swap',from:23,to:24});
  expect(combined.accepted).toBe(true);
  expect(combined.state.status).toBe('won');
 });
});
