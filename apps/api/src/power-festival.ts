import {gameEventAvailable,gameEventConfig,type RuntimeSettings} from '../../../packages/contracts/src/operations';
import {z} from 'zod';
import type {GameEvent} from '@garden/contracts';
import {POWER_FESTIVAL_DURATION,POWER_FESTIVAL_STAGES,powerUses,addPowerUses,festivalStage,festivalClaimable,emptyPowerUses} from '../../../packages/content/src/power-festival';
import {missionPeriod} from '@garden/content';
import {grantActivityReward} from './activity';
import {ensure,mutate,operationKey,uid,type ApiEnv,type MutationContext} from './db';

/** Runs only after authoritative replay, in the same transaction as the action log. */
export function recordPowerFestival(tx:MutationContext,events:readonly GameEvent[]){
 const event=tx.player.powerFestival;
 if(!event||tx.now<event.startedAt||tx.now>=event.endsAt||event.claimedStages>=POWER_FESTIVAL_STAGES.length)return;
 event.counts=addPowerUses(event.counts,powerUses(events));
}
export async function startPowerFestival(env:ApiEnv,userId:string,body:Record<string,unknown>,settings?:RuntimeSettings){
 const config=gameEventConfig('powerFestival',settings);
 return mutate(env,userId,operationKey(body),'power-festival:start',tx=>{
  ensure(tx.player.level>=config.minLevel,'FESTIVAL_LOCKED',`레벨 ${config.minLevel}부터 도구 축제에 참여할 수 있어요.`,409);
  ensure(gameEventAvailable('powerFestival',settings,tx.now),'EVENT_NOT_OPEN','지금은 이벤트 참여 시간이 아니에요.',409);
  const previous=tx.player.powerFestival,day=missionPeriod('daily',tx.now);
  // A second key cannot reset the timer or overwrite earned, unclaimed rewards.
  if(previous&&previous.endsAt>tx.now&&previous.claimedStages<POWER_FESTIVAL_STAGES.length)return {player:tx.player};
  ensure(!previous||!festivalClaimable(previous),'FESTIVAL_UNCLAIMED','먼저 도구 축제 보상을 받아 주세요.',409);
  ensure(previous?.day!==day.id,'FESTIVAL_ALREADY_PLAYED','오늘의 도구 축제를 마쳤어요. 내일 다시 만나요!',409);
  tx.player.powerFestival={id:uid(),day:day.id,startedAt:tx.now,endsAt:tx.now+POWER_FESTIVAL_DURATION,counts:emptyPowerUses(),claimedStages:0};
  return {player:tx.player};
 });
}
export async function claimPowerFestival(env:ApiEnv,userId:string,body:Record<string,unknown>){
 const input=z.object({eventId:z.string().min(1).max(100),stage:z.number().int().min(1).max(POWER_FESTIVAL_STAGES.length)}).parse(body);
 return mutate(env,userId,operationKey(body),`power-festival:claim:${input.eventId}:${input.stage}`,tx=>{
  const event=tx.player.powerFestival;ensure(event&&event.id===input.eventId,'FESTIVAL_CHANGED','도구 축제 정보를 다시 확인해 주세요.',409);
  if(event.claimedStages>=input.stage)return {player:tx.player,granted:false};
  ensure(input.stage===event.claimedStages+1,'FESTIVAL_STAGE_ORDER','앞 단계 보상부터 받아 주세요.',409);
  const stage=festivalStage(event.counts,event.claimedStages);ensure(stage.ready,'FESTIVAL_NOT_READY','특수 아이템 목표를 모두 채워 주세요.',409);
  // Earned rewards remain claimable after the thirty-minute play window closes.
  grantActivityReward(tx,stage.reward);event.claimedStages++;
  return {player:tx.player,granted:true,reward:stage.reward};
 });
}
