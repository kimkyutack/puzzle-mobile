import {describe,expect,it} from 'vitest';
import {CHAPTER_OBSTACLE_ENGINE_VERSION,ENGINE_VERSION,GREENHOUSE_ENGINE_VERSION,GARDEN_WORKSHOP_ENGINE_VERSION,SUPPORTED_ENGINE_VERSIONS,type Action,type GameState} from '@garden/contracts';
import {actionWithFrames,applyAction,createGame,legalActions,validateLevel} from '@garden/core';
import {engineRequest,publishedLevel} from '../apps/api/src/level-content';
import {prepareRunInitial,randomAttemptLevel} from '../apps/api/src/run-initial';
import {tileFallPaths} from '../apps/client/src/tile-origins';
import {effectTiming,REFLECTED_ROCKET_STEP,VISUAL_BEATS} from '../apps/client/src/visual-timing';
import {greenhouseCandidate,type GreenhouseSlot} from '../packages/content/src/garden-greenhouse';
import {GREENHOUSE_DEVICES,type GreenhouseDeviceKind} from '../packages/contracts/src/campaign-devices';

const start=(kind:GreenhouseDeviceKind,style:GreenhouseSlot['style']='lesson')=>createGame(greenhouseCandidate({kind,style,variant:0},174089));
const sameReplay=(state:GameState,action:Action)=>{
 const frames=actionWithFrames(state,action),result=applyAction(state,action);
 expect(frames.accepted).toBe(true);
 expect(frames.state).toEqual(result.state);
 expect(frames.events).toEqual(result.events);
 expect(result.state.status).not.toBe('error');
 return frames;
};

describe('greenhouse campaign',()=>{
 it('publishes successive introductions, remixes, and fallback boards for older apps',()=>{
  expect(engineRequest({supportedEngineVersions:SUPPORTED_ENGINE_VERSIONS}).engineVersion).toBe(ENGINE_VERSION);
  expect(engineRequest({engineVersion:GARDEN_WORKSHOP_ENGINE_VERSION}).engineVersion).toBe(GARDEN_WORKSHOP_ENGINE_VERSION);
  expect(publishedLevel(1801,CHAPTER_OBSTACLE_ENGINE_VERSION).strategy).toEqual(publishedLevel(1801,GARDEN_WORKSHOP_ENGINE_VERSION).strategy);
  let redesigned=0;
  for(let id=2401;id<=3000;id++){
   const old=publishedLevel(id,GARDEN_WORKSHOP_ENGINE_VERSION),level=publishedLevel(id,GREENHOUSE_ENGINE_VERSION);
   if(!level.strategy?.id.startsWith('greenhouse/')){
    expect({...level,engineVersion:old.engineVersion}).toEqual(old);
    continue;
   }
   redesigned++;
   expect(validateLevel(level),String(id)).toEqual([]);
   expect(level.moves).toBeGreaterThanOrEqual(old.moves);
   expect(validateLevel({...level,engineVersion:old.engineVersion})).toContain('DEVICE_ZONE');
   // Exercise the start path used by native apps with all three starting boosters.
   const prepared=prepareRunInitial(level,['wind-row','bomb','rainbow'],true,id*137);
   expect(prepared.state.status).toBe('playing');
   if(id%100<=3){
    expect(level.devices?.map(step=>step.kind)).toEqual([GREENHOUSE_DEVICES[Math.floor((id-2401)/100)]]);
    expect(level.campaign?.beat).toBe(id%100===1?'introduction':'practice');
   }
  }
  expect(redesigned).toBe(120);
 });

 it('moves all four identities clockwise and counts the match made by the rotation',()=>{
  const level=greenhouseCandidate({kind:'turntable',style:'lesson',variant:0},174089);
  for(const board of [level,randomAttemptLevel(level,4199)]){
   const state=createGame(board),[a,b,c,d]=state.devices!.steps[0]!.zones[0]!;
   const action={type:'tap',at:a!} as const;
   expect(legalActions(state)).toContainEqual(action);
   const result=sameReplay(state,action),rotation=result.frames[0]!;
   const paths=tileFallPaths(state,rotation.state,rotation.events);
   for(const [from,to] of [[a!,b!],[b!,c!],[c!,d!],[d!,a!]]){
    const id=state.cells[from!]!.tile!.id;
    expect(rotation.state.cells[to!]!.tile?.id).toBe(id);
    expect(paths.get(id)).toHaveLength(2);
   }
   expect(result.state.status).toBe('won');
   expect(result.state.moves).toBe(state.moves-1);
  }
 });

 it('opens only the matching lock from a key and protects unopened locks from a direct hammer hit',()=>{
  const state=start('keys'),[keys,locks]=state.devices!.steps[0]!.zones;
  const blocked=applyAction(state,{type:'booster',item:'hammer',at:locks![0]});
  expect(blocked.accepted).toBe(false);
  expect(blocked.state).toBe(state);
  const result=sameReplay(state,{type:'booster',item:'hammer',at:keys![0]});
  expect(result.state.cells[locks![0]!]!.obstacleId).toBeUndefined();
  expect(result.state.cells[locks![1]!]!.obstacleId).toBe(state.cells[locks![1]!]!.obstacleId);
  expect(result.state.devices?.openedLocks).toEqual([0]);
  expect(result.state.devices?.progress).toBe(1);
  expect(result.state.moves).toBe(state.moves);
 });

 it('moves pollen with the original tile as it falls and only collects it when that tile is removed',()=>{
  const state=start('pollen'),at=state.devices!.steps[0]!.zones[0]![0]!,id=state.cells[at]!.tile!.id;
  const fall=sameReplay(state,{type:'booster',item:'hammer',at:at+state.width});
  const moved=fall.state.cells.findIndex(cell=>cell.tile?.id===id);
  expect(moved).toBe(at+state.width);
  expect(fall.state.devices?.pollenIds).toContain(id);
  const clear=sameReplay(fall.state,{type:'booster',item:'hammer',at:moved});
  expect(clear.state.devices?.pollenIds).not.toContain(id);
  expect(clear.state.devices?.progress).toBeGreaterThan(fall.state.devices!.progress);
 });

 it('moves a power intact and only counts a deliberate tap on the launch pad',()=>{
  const state=start('carrier'),from=22,to=31,original=state.cells[from]!.tile;
  expect(original?.kind).toBe('bomb');
  const moved=sameReplay(state,{type:'swap',from,to});
  expect(moved.state.cells[to]!.tile).toEqual(original);
  expect(moved.events.some(event=>event.kind==='carrier-launch'||event.type==='special')).toBe(false);
  expect(moved.state.devices?.progress).toBe(0);
  const result=sameReplay(moved.state,{type:'tap',at:to});
  expect(result.events).toContainEqual({type:'mechanic',kind:'carrier-launch',cells:[to]});
  expect(result.state.status).toBe('won');
 });

 it('fires a delayed pulse on the next paid move only',()=>{
  const state=start('echo'),at=31,charged=sameReplay(state,{type:'tap',at});
  expect(charged.state.devices?.echoAt).toBe(at);
  expect(charged.events.some(event=>event.kind==='echo-pulse')).toBe(false);
  const free=sameReplay(charged.state,{type:'booster',item:'move-hourglass'});
  expect(free.state.devices?.echoAt).toBe(at);
  const action=legalActions(free.state)[0]!;
  const result=sameReplay(free.state,action);
  expect(result.events).toContainEqual({type:'mechanic',kind:'echo-pulse',cells:[21,22,23,30,31,32,39,40,41],from:at});
  expect(result.state.status).toBe('won');
 });

 it('makes the rocket strike the bent path and synchronizes the impact timing',()=>{
  const state=start('reflector'),origin=27,turn=sameReplay(state,{type:'tap',at:origin});
  const one=[27,28,29,30,21,12,3];
  expect(turn.events.find(event=>event.kind==='wind-row'&&event.type==='special')?.routes).toEqual([[27],one]);
  const removals=turn.events.filter(e=>e.type==='remove').flatMap(event=>event.cells);
  const preRefill=turn.events.slice(0,turn.events.findIndex(event=>event.type==='fall'||event.type==='spawn')).filter(e=>e.type==='remove').flatMap(event=>event.cells);
  expect(preRefill).not.toContain(31);
  expect(removals).toEqual(expect.arrayContaining(one));
  expect(effectTiming(turn.events,state).firstRemovalAt.get(21)).toBe(VISUAL_BEATS.charge+4*REFLECTED_ROCKET_STEP);
  expect(turn.state.status).toBe('won');
 });
});
