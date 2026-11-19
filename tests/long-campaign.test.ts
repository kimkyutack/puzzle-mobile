import {describe,expect,it} from 'vitest';
import {CHAPTER_OBSTACLE_ENGINE_VERSION,GLIDER_SWARM_ENGINE_VERSION,SEED_DELIVERY_ENGINE_VERSION,type Color,type GameEvent,type GameState} from '@garden/contracts';
import {CAMPAIGN_DEVICES,type CampaignDeviceKind} from '../packages/contracts/src/campaign-devices';
import {applyAction,createGame,findMatches,legalActions,validateLevel} from '@garden/core';
import {advanceDevice,type DeviceMatch} from '../packages/game-core/src/campaign-devices';
import {LONG_CAMPAIGN_VERSION,longCampaignChapter,longCampaignSlot} from '../packages/content/src/long-campaign-plan';
import {publishedLevel} from '../apps/api/src/level-content';
import {breakableSlot,BREAKABLE_CAMPAIGN_VERSION} from '../packages/content/src/breakable-campaign-plan';

const match=(at:number,color:Color='berry',wave=0):DeviceMatch=>({cells:[at],color,wave});
function deviceState(kind:CampaignDeviceKind):GameState{
 return {
  goals:[{kind:'device',count:1,remaining:1}],obstacles:{},cells:[],
  devices:{index:0,progress:0,steps:[{kind,target:2,zones:[[2,3],[6,7]]}]},
 } as unknown as GameState;
}

describe('20,000-level campaign',()=>{
 it('publishes every non-story level with valid boards, preserves move budgets, and retains old clients',()=>{
  let changed=0,story=0;
  const pairs=new Set<string>(),layouts=new Set<string>(),runs=new Map<string,number>();
  for(let id=401;id<=20000;id++){
   const level=publishedLevel(id,GLIDER_SWARM_ENGINE_VERSION),old=publishedLevel(id,SEED_DELIVERY_ENGINE_VERSION);
   expect(level.moves,String(id)).toBeGreaterThanOrEqual(old.moves);
   if(id%10===0){
    expect({...level,engineVersion:old.engineVersion}).toEqual(old);story++;continue;
   }
   const breakable=breakableSlot(id);
   expect(level.version.startsWith(breakable?BREAKABLE_CAMPAIGN_VERSION:LONG_CAMPAIGN_VERSION),String(id)).toBe(true);
   expect(old.devices).toBeUndefined();changed++;
   expect(level.goals.length,String(id)).toBeLessThanOrEqual(4);
   expect(validateLevel(level),String(id)).toEqual([]);
   if(id%100===2){
    const chapter=Math.floor((id-401)/100),plan=longCampaignChapter(chapter)!;
    expect(level.campaign?.beat).toBe('practice');
    const first=publishedLevel(id-1,GLIDER_SWARM_ENGINE_VERSION);
    expect(first.campaign?.beat).toBe('introduction');
    expect(first.devices![0]!.kind).toBe(plan.first);
    expect(first.devices?.map(step=>step.kind)).toEqual(chapter<CAMPAIGN_DEVICES.length?[plan.first]:[plan.first,plan.second]);
    pairs.add(plan.first+'/'+plan.second);
   }
   const slot=longCampaignSlot(id)!,key=breakable?.key??slot.key+'/'+Number(slot.variant===2);
   const group=Math.floor((id-401)/100)+'/'+slot.run;
   runs.set(group,(runs.get(group)??0)+1);
   if(!layouts.has(key)){
    const board=createGame(level);
    expect(findMatches(board),String(id)).toEqual([]);
    expect(legalActions(board).length,String(id)).toBeGreaterThan(0);
    layouts.add(key);
   }
  }
  expect([changed,story,pairs.size]).toEqual([17640,1960,196]);
  expect([...runs.values()].every(length=>length===2||length===3)).toBe(true);
 },60000);

 it('keeps a switch gate closed until sufficient matches and rejects a hammer without spending the turn',()=>{
  const level=publishedLevel(401,CHAPTER_OBSTACLE_ENGINE_VERSION),state=createGame(level);
  const gate=level.devices![0]!.gate!;
  expect(validateLevel({...level,engineVersion:SEED_DELIVERY_ENGINE_VERSION})).toContain('DEVICE_GOAL');
  expect(applyAction(state,{type:'booster',item:'hammer',at:gate})).toMatchObject({accepted:false,reason:'DEVICE_GATE_REQUIRED',state});
  const events:GameEvent[]=[];
  const cell=state.devices!.steps[0]!.zones[0]![1]!;
  for(let i=0;i<2;i++)expect(advanceDevice(state,events,[match(cell)],false)).toBe(false);
  expect(advanceDevice(state,events,[match(cell)],false)).toBe(true);
  expect(state.cells[gate]?.obstacleId).toBeUndefined();
  expect(state.goals[0]?.remaining).toBe(0);
  expect(events.at(-1)).toMatchObject({type:'hit',cells:[gate],obstacleAfter:null});
 });

 it('distinguishes alternating, consecutive, simultaneous, relay and conveyor actions',()=>{
  const charger=deviceState('charge');
  advanceDevice(charger,[],[match(2),match(3)],false);
  expect(charger.devices!.progress).toBe(0);
  advanceDevice(charger,[],[match(2),match(3,'drop')],false);
  expect(charger.goals[0]?.remaining).toBe(0);

  const alternating=deviceState('switchback');
  advanceDevice(alternating,[],[match(2)],false);
  advanceDevice(alternating,[],[match(3)],false);
  expect(alternating.devices!.progress).toBe(1);
  advanceDevice(alternating,[],[match(6)],false);
  expect(alternating.goals[0]?.remaining).toBe(0);

  const streak=deviceState('streak');
  advanceDevice(streak,[],[match(2)],false);
  advanceDevice(streak,[],[match(6)],false);
  expect(streak.devices!.progress).toBe(0);

  const dual=deviceState('dual');
  advanceDevice(dual,[],[{cells:[2,6],color:'berry',wave:0}],false);
  expect(dual.devices!.progress).toBe(0);
  advanceDevice(dual,[],[match(2),match(6,'drop')],false);
  expect(dual.devices!.progress).toBe(1);

  const relay=deviceState('relay');
  advanceDevice(relay,[],[match(2),match(6)],false);
  advanceDevice(relay,[],[match(6,'drop')],false);
  expect(relay.devices).toMatchObject({progress:0,color:'berry'});
  advanceDevice(relay,[],[match(6)],false);
  expect(relay.devices!.progress).toBe(1);

  const conveyor=deviceState('conveyor');
  advanceDevice(conveyor,[],[match(2)],true);
  expect(conveyor.devices!.progress).toBe(0);
  advanceDevice(conveyor,[],[match(2,'drop',-1)],true);
  expect(conveyor.devices!.progress).toBe(1);
 });
});
