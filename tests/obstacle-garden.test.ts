import {describe,expect,it} from 'vitest';
import {COLORS,ENGINE_VERSION,GREENHOUSE_ENGINE_VERSION,OBSTACLE_GARDEN_ENGINE_VERSION,SUPPORTED_ENGINE_VERSIONS,type Action,type GameState,type LevelDefinition,type Obstacle} from '@garden/contracts';
import {actionWithFrames,applyAction,createGame,targetCells,validateLevel} from '@garden/core';
import {impactOverlays} from '../apps/client/src/impact-overlays';
import {effectTiming,WIND_SEED_FLIGHT} from '../apps/client/src/visual-timing';
import {engineRequest,publishedLevel} from '../apps/api/src/level-content';
import {prepareRunInitial} from '../apps/api/src/run-initial';
import {obstacleGardenSlot} from '../packages/content/src/obstacle-garden';

const obstacle=(kind:Obstacle['kind'],id:string,footprint:number[],hp:number,link?:string):Obstacle=>
 ({kind,id,footprint,anchor:footprint[0]!,hp,maxHp:hp,...(link?{link}:{})});
const layout=(obstacles:Obstacle[],target:Obstacle['kind']):LevelDefinition=>({
 id:227,version:'test',engineVersion:OBSTACLE_GARDEN_ENGINE_VERSION,width:7,height:7,moves:30,
 colors:[...COLORS.slice(0,5)],shape:Array<boolean>(49).fill(true),seed:374921,
 obstacles,goals:[{kind:target,count:1,remaining:1}],difficulty:'normal',
});
const windmill=obstacle('windmill','mill',[33,34,40,41],2);
const pods=[obstacle('wind-pod','left',[0],1,'mill'),obstacle('wind-pod','right',[2],1,'mill')];
const windLevel=layout([windmill,...pods],'windmill');
const lanternLevel=layout([obstacle('starlight-lantern','lamp',[25],3)],'starlight-lantern');

function checkReplay(before:GameState,action:Action){
 const presented=actionWithFrames(before,action),worker=applyAction(before,action);
 expect(presented.state).toEqual(worker.state);
 expect(presented.events).toEqual(worker.events);
 expect(presented.accepted).toBe(true);
 return presented;
}

describe('obstacle garden',()=>{
 it('adds obstacle-only goals across the campaign while allowing old apps to use the original boards',()=>{
  let count=0;
  expect(engineRequest({engineVersion:ENGINE_VERSION,supportedEngineVersions:SUPPORTED_ENGINE_VERSIONS}).engineVersion).toBe(ENGINE_VERSION);
  for(let id=1;id<=20_000;id++){
   if(!obstacleGardenSlot(id))continue;
   const level=publishedLevel(id,OBSTACLE_GARDEN_ENGINE_VERSION),fallback=publishedLevel(id,GREENHOUSE_ENGINE_VERSION);
   expect(validateLevel(level),`level ${id}`).toEqual([]);
   expect(level.strategy?.id).toMatch(/^obstacle-garden\//);
   expect(level.goals.every(goal=>level.obstacles.some(o=>o.kind===goal.kind||o.contents?.kind===goal.kind))).toBe(true);
   expect(level.obstacles.length).toBeGreaterThanOrEqual(12);
   expect(level.moves).toBeGreaterThanOrEqual(fallback.moves);
   expect(fallback.strategy?.id).not.toMatch(/^obstacle-garden\//);
   count++;
  }
  expect(count).toBe(1782);
  for(const id of [227,327,427]){
   const level=publishedLevel(id,ENGINE_VERSION),prepared=prepareRunInitial(level,['wind-row','bomb','rainbow'],true,4211+id);
   expect(level.campaign?.beat).toBe('introduction');
   expect(prepared.state.status).toBe('playing');
  }
  for(const id of [220,414,1801,2401,2910]){
   const before=publishedLevel(id,GREENHOUSE_ENGINE_VERSION);
   expect(publishedLevel(id,OBSTACLE_GARDEN_ENGINE_VERSION)).toEqual({...before,engineVersion:OBSTACLE_GARDEN_ENGINE_VERSION});
  }
 });

 it('keeps the lantern goal until the third hit and preserves the two intermediate renders',()=>{
  const state=createGame(lanternLevel),at=25;
  const hit=(before:GameState)=>checkReplay(before,{type:'booster',item:'hammer',at});
  const cracked=hit(state),open=hit(cracked.state),broken=hit(open.state);
  expect(cracked.state.obstacles.lamp?.hp).toBe(2);
  expect(open.state.obstacles.lamp?.hp).toBe(1);
  expect([cracked.state.goals[0]!.remaining,open.state.goals[0]!.remaining,broken.state.goals[0]!.remaining]).toEqual([1,1,0]);
  expect(broken.state.obstacles.lamp).toBeUndefined();
  expect(broken.state.status).toBe('won');
  expect(impactOverlays(cracked.state,open.state,open.events,effectTiming(open.events,open.state))
   .some(step=>step.kind==='obstacle'&&step.id==='lamp'&&step.value?.hp===1)).toBe(true);
 });

 it('deduplicates a hit across four windmill cells and requires the linked seeds',()=>{
  const start=createGame(windLevel);
  const blocked=applyAction(start,{type:'booster',item:'hammer',at:34});
  expect(blocked.accepted).toBe(false);
  expect(blocked.reason).toBe('WIND_SEED_REQUIRED');
  expect(targetCells(start)).not.toContain(34);
  const action={type:'booster',item:'world-bomb'} as const;
  const result=checkReplay(start,action);
  const seeds=result.events.filter(e=>e.kind==='wind-seed-flight');
  const hits=result.events.filter(e=>e.kind==='windmill'&&e.type==='hit');
  expect(seeds.map(e=>e.from)).toEqual([0,2]);
  expect(hits.map(e=>e.effectId)).toEqual(seeds.map(e=>e.effectId));
  expect(hits.map(e=>e.obstacleAfter?.hp??0)).toEqual([1,0]);
  expect(hits.every(e=>e.cells.length===4)).toBe(true);
  expect(result.state.status).toBe('won');
  const timing=effectTiming(result.events,start,action);
  const firstHit=timing.delays[result.events.indexOf(hits[0]!)]!;
  expect(firstHit-timing.delays[result.events.indexOf(seeds[0]!)]!).toBe(WIND_SEED_FLIGHT);
  const secondHit=timing.delays[result.events.indexOf(hits[1]!)]!;
  expect(secondHit).toBeGreaterThan(firstHit);
  expect(timing.settleAt).toBeGreaterThan(secondHit);
  expect(impactOverlays(start,result.state,result.events,timing).filter(s=>s.kind==='obstacle'&&s.id==='mill').map(s=>s.delay)).toEqual([firstHit,secondHit]);
 });

 it('rejects missing seed links and keeps the new obstacle rules out of old engines',()=>{
  expect(validateLevel({...windLevel,obstacles:[windmill,pods[0]!]})).toContain('WIND_LINK');
  expect(validateLevel({...windLevel,obstacles:[windmill,{...pods[0]!,link:'missing'},pods[1]!]})).toContain('WIND_LINK');
  expect(validateLevel({...lanternLevel,engineVersion:GREENHOUSE_ENGINE_VERSION})).toContain('BREAKABLE_ENGINE');
 });
});
