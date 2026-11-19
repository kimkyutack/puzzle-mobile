import {z} from 'zod';
import type {PowerUseCounts} from '@garden/contracts';
import {
 HIDDEN_MISSION_DURATION,hiddenMissionKind,hiddenMissionLimit,hiddenMissionStage,
} from '../../../packages/content/src/hidden-power-missions';
import {grantActivityReward} from './activity';
import {ensure,mutate,operationKey,type ApiEnv,type MutationContext} from './db';

export function discoverHiddenPowerMission(tx:MutationContext,clearedLevel:number){
 const kind=hiddenMissionKind(clearedLevel);
 if(!kind)return;
 const previous=tx.player.hiddenPowerMission;
 if(previous){
  if(previous.milestone>=clearedLevel)return;
  const stage=hiddenMissionStage(previous);
  if(stage&&(stage.ready||(previous.endsAt!==undefined&&tx.now<previous.endsAt)))return;
 }
 tx.player.hiddenPowerMission={milestone:clearedLevel,kind,uses:0,claimedStages:0};
}

export function recordHiddenPowerMission(tx:MutationContext,counts:PowerUseCounts){
 const mission=tx.player.hiddenPowerMission;
 if(!mission||mission.endsAt===undefined||tx.now>=mission.endsAt)return;
 mission.uses=Math.min(hiddenMissionLimit(mission.kind),mission.uses+counts[mission.kind]);
}

const milestone=z.number().int().positive();
const hiddenMissionAction=z.discriminatedUnion('action',[
 z.object({action:z.literal('start'),milestone}),
 z.object({action:z.literal('claim'),milestone,stage:z.number().int().positive()}),
]);

export async function updateHiddenPowerMission(env:ApiEnv,userId:string,body:Record<string,unknown>){
 const input=hiddenMissionAction.parse(body);
 const stageNumber=input.action==='claim'?input.stage:0;
 return mutate(env,userId,operationKey(body),`hidden-mission:${input.action}:${input.milestone}:${stageNumber}`,tx=>{
  const mission=tx.player.hiddenPowerMission;
  ensure(mission?.milestone===input.milestone,'HIDDEN_MISSION_CHANGED','히든 미션 정보를 다시 확인해 주세요.',409);
  if(input.action==='start'){
   mission.endsAt??=tx.now+HIDDEN_MISSION_DURATION;
   return {player:tx.player};
  }
  if(mission.claimedStages>=input.stage)return {player:tx.player};
  const stage=hiddenMissionStage(mission);
  ensure(stage?.number===input.stage&&stage.ready,'HIDDEN_MISSION_NOT_READY','현재 단계의 목표를 먼저 채워 주세요.',409);
  grantActivityReward(tx,stage.reward);
  mission.claimedStages++;
  return {player:tx.player};
 });
}
