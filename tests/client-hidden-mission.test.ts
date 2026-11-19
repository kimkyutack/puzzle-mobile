import {describe,expect,it} from 'vitest';
import type {HiddenPowerMissionState} from '@garden/contracts';
import {hiddenMissionAnnouncement,predictedHiddenMission,visibleHiddenMission} from '../apps/client/src/hidden-mission-state';

const bomb:HiddenPowerMissionState={kind:'bomb',milestone:39,uses:0,claimedStages:0};
const active={...bomb,endsAt:1000,uses:1};
const powerRun=(id:string,bombUses:number)=>({id,powerUses:{bomb:bombUses,glider:0,rainbow:0,rocket:0}});

describe('hidden mission presentation',()=>{
 it('announces discoveries and new rewards while ordinary active progress stays in the play badge',()=>{
  expect(hiddenMissionAnnouncement(bomb,500)).toBe('found:39');
  expect(visibleHiddenMission(active,500)).toBe(active);
  expect(hiddenMissionAnnouncement(active,500)).toBeUndefined();
  expect(hiddenMissionAnnouncement({...active,uses:4},500)).toBe('reward:39:1');
  expect(hiddenMissionAnnouncement({...active,uses:10,claimedStages:1},500)).toBe('reward:39:2');
 });
 it('hides expired progress and keeps an unclaimed earned reward available',()=>{
  expect(visibleHiddenMission(active,1000)).toBeUndefined();
  expect(hiddenMissionAnnouncement({...active,uses:4},1000)).toBe('reward:39:1');
  expect(visibleHiddenMission({...active,uses:20,claimedStages:3},500)).toBeUndefined();
 });
 it('predicts the unsaved power activations only during the active mission and for the same run',()=>{
  const current=powerRun('same-run',5),confirmed=powerRun('same-run',2);
  expect(predictedHiddenMission(active,current,confirmed,500).uses).toBe(4);
  expect(predictedHiddenMission({...active,uses:4},current,current,500).uses).toBe(4);
  expect(predictedHiddenMission(active,current,powerRun('other-run',2),500)).toBe(active);
  expect(predictedHiddenMission(active,current,confirmed,1000)).toBe(active);
  expect(predictedHiddenMission(bomb,current,confirmed,500)).toBe(bomb);
 });
});
