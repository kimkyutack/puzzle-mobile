import {startBoosterWindow} from '../../../packages/contracts/src/start-booster-rush';
import {defaultOperationsRuntime,type RuntimeSettings} from '../../../packages/contracts/src/operations';
import { createGame, applyAction } from '@garden/core';
import type {Action,GameEvent,Run} from '@garden/contracts';
import {CONTINUE_COSTS,freeStartTrialItem,levelClearCoins,POWER_RAINBOW_WINS,powerRainbowReached,powerRainbowUnlocked,supportsPowerRainbow} from '@garden/contracts';
import { z } from 'zod';
import { activeRun, assertSQL, consumeHeart, digest, ensure, HttpError, mutate, operationKey, readRun, saveRun, spendCoins, spendItem, sql, uid, type ApiEnv, type MutationContext } from './db';
import {engineRequest,publishedLevel} from './level-content';
import {actionActivity,recordActivity} from './activity';
import { actionsSchema, boosterSchema, preSchema } from './validation';
import {powerUses,addPowerUses} from '../../../packages/content/src/power-festival';
import {recordPowerFestival} from './power-festival';
import {discoverHiddenPowerMission,recordHiddenPowerMission} from './hidden-power-missions';
import {recordFlowerlightClear} from './content-events';
import {recordGardenGameClear} from './garden-games';
import {prepareRunInitial} from './run-initial';
import {startGiftPowers,startGiftReached,startGiftStage,START_GIFT_STAGES} from '../../../packages/contracts/src/start-gift';

function active(tx:MutationContext,run:Run,sequence?:number){
  ensure(run.status==='active','RUN_CLOSED','이미 종료된 퍼즐입니다.',409);
  ensure(run.expiresAt>tx.now,'RUN_EXPIRED','24시간 복구 기간이 끝났어요. 홈에서 새 퍼즐을 시작해 주세요.',409);
  if(sequence!==undefined)ensure(run.sequence===sequence,'SEQUENCE_MISMATCH','다른 기기에서 진행된 퍼즐입니다. 다시 불러와 주세요.',409);
  tx.statements.push(assertSQL(tx.db,"SELECT sequence=? AND status='active' FROM runs WHERE id=?",run.sequence,run.id));
}
export async function startRun(env:ApiEnv,userId:string,body:Record<string,unknown>,settings:RuntimeSettings=defaultOperationsRuntime()){
  const capabilities=engineRequest(body),clientEngine=capabilities.engineVersion;
  const preBoosters=z.array(preSchema).max(3).default([]).parse(body.preBoosters);
  const requireFree=z.boolean().default(false).parse(body.freeStartBoosters);
  const requireTrial=z.boolean().default(false).parse(body.useFreeStartTrial);
  const randomStart=z.boolean().default(false).parse(body.randomStart);
  ensure(new Set(preBoosters).size===preBoosters.length,'DUPLICATE_BOOSTER','시작 부스터는 종류당 하나만 선택할 수 있어요.');
  return mutate(env,userId,operationKey(body),`run:start:${preBoosters.join(',')}${requireFree?':free':''}${requireTrial?':trial':''}`,async tx=>{
    const existing=await activeRun(tx.db,userId);
    if(existing&&existing.expiresAt>tx.now){ensure(capabilities.supportedEngineVersions.some(version=>version===existing.state.engineVersion),'UPDATE_REQUIRED','앱을 업데이트하면 진행 중인 퍼즐을 이어할 수 있어요.',409);return {player:tx.player,run:existing};}
    if(existing){
      existing.status='expired';
      if(existing.state.status!=='won'&&existing.state.status!=='error'){tx.player.winStreak=0;tx.player.startGiftStreak=0;}
      tx.statements.push(saveRun(tx.db,existing));
    }
    const template=publishedLevel(tx.player.level,clientEngine);
    ensure(!capabilities.levelHash||capabilities.levelHash===await digest(JSON.stringify(template)),'CONTENT_CHANGED','퍼즐 구성이 바뀌었어요. 새 목표를 확인한 뒤 다시 시작해 주세요.',409);
    const learned=randomStart&&template.tutorial&&tx.player.tutorials?.includes(template.tutorial.feature);
    const playable=learned?{...template,tutorial:undefined}:template;
    const attemptTemplate=supportsPowerRainbow(clientEngine)&&powerRainbowUnlocked(tx.player)?{...playable,powerRainbow:true as const}:playable;
    const giftStage=startGiftStage(tx.player);
    let prepared;try{prepared=prepareRunInitial(attemptTemplate,preBoosters,randomStart,crypto.getRandomValues(new Uint32Array(1))[0]||1,startGiftPowers(giftStage));}catch(e){throw new HttpError('BOOSTER_PLACEMENT',e instanceof Error?e.message:'부스터를 배치할 수 없는 퍼즐입니다.');}
    const {level,state,giftPlacements}=prepared;
    ensure(state.status==='playing','INVALID_INITIAL_BOARD','초기 퍼즐 검증에 실패했습니다.',503);
    const unlimited=tx.player.unlimitedUntil>tx.now;
    ensure(unlimited||tx.player.hearts>0,'HEARTS_EMPTY','하트가 부족해요. 다음 회복을 기다리거나 무료 보너스를 확인하세요.',409);
    const rush=startBoosterWindow(settings.startBoosterRush,tx.now);
    ensure(!requireFree||preBoosters.length===0||rush.active,'START_BOOSTER_EVENT_ENDED','시작 아이템 무제한 시간이 끝났어요. 도구를 다시 선택해 주세요.',409);
    const freeTrial=freeStartTrialItem(level,tx.player);
    const usesTrial=!rush.active&&freeTrial!==undefined&&preBoosters.includes(freeTrial);
    ensure(!requireTrial||usesTrial||rush.active,'START_BOOSTER_TRIAL_USED','무료 체험을 사용할 수 없어요. 시작 도구를 다시 선택해 주세요.',409);
    if(!rush.active)for(const item of preBoosters)if(!usesTrial||item!==freeTrial)spendItem(tx.player,item);
    if(usesTrial)tx.player.usedStartBoosterTrial=true;
    const run:Run={id:uid(),userId,level,state,sequence:0,status:'active',startedAt:tx.now,expiresAt:tx.now+86_400_000,preBoosters,...(rush.active&&preBoosters.length?{startBoosterFreeUntil:rush.endsAt!}:{}),...(usesTrial?{usedStartBoosterTrial:true}:{}),heartSpent:false,heartCharge:unlimited?'protected':'failure',continues:0};
    if(giftStage>0&&giftPlacements.length)run.startGift={stage:giftStage as 1|2|3,placements:giftPlacements};
    tx.statements.push(sql(tx.db,'INSERT INTO runs VALUES(?,?,?,?,?,?,?)',run.id,userId,JSON.stringify(run),run.status,0,run.expiresAt,operationKey(body)));
    return {player:tx.player,run};
  });
}
export async function runActions(env:ApiEnv,userId:string,runId:string,body:Record<string,unknown>,settings?:RuntimeSettings){
  const input=actionsSchema.parse(body);
  return mutate(env,userId,operationKey(body),`run:actions:${runId}:${JSON.stringify(input)}`,async tx=>{
    const run=await readRun(tx.db,runId,userId);active(tx,run,input.sequence);
    const events:GameEvent[]=[];
    ensure(run.sequence+input.actions.length<=2000,'TOO_MANY_ACTIONS','행동 기록 한도를 넘었어요.');
    for(const action of input.actions){
      const result=applyAction(run.state,action);
      ensure(result.accepted,'INVALID_ACTION',result.reason??'불가능한 이동입니다.');
      ensure(result.state.status!=='error','ENGINE_ERROR','퍼즐 처리 오류가 발생했어요. 보상은 검증 후 지급됩니다.',409);
      // Predicted consumables are replayed and charged in the same atomic batch.
      // Never trust the client's inventory, result, or a claimed item deduction.
      if(action.type==='booster')spendItem(tx.player,action.item);
      run.state=result.state;events.push(...result.events);run.sequence++;
      tx.statements.push(sql(tx.db,'INSERT INTO run_actions VALUES(?,?,?,?)',runId,run.sequence,JSON.stringify(action),tx.now));
    }
    recordActivity(tx,actionActivity(input.actions,events));
    const counts=powerUses(events);
    run.powerUses=addPowerUses(run.powerUses,counts);recordPowerFestival(tx,events);
    if(settings?.features.missions!==false)recordHiddenPowerMission(tx,counts);
    if(input.finishOnWin&&run.state.status==='won')await rewardWonRun(tx,run,settings);
    tx.statements.push(saveRun(tx.db,run));return {player:tx.player,run,events};
  });
}
export async function useBooster(env:ApiEnv,userId:string,runId:string,body:Record<string,unknown>,settings?:RuntimeSettings){
  const item=boosterSchema.parse(body.item);const at=body.at===undefined?undefined:z.number().int().min(0).max(99).parse(body.at);
  const sequence=z.number().int().min(0).parse(body.sequence);
  return mutate(env,userId,operationKey(body),`run:booster:${runId}:${sequence}:${item}:${at}`,async tx=>{
    const run=await readRun(tx.db,runId,userId);active(tx,run,sequence);
    const action:Action={type:'booster',item,...(at===undefined?{}:{at})};const result=applyAction(run.state,action);
    ensure(result.accepted && result.state.status!=='error','INVALID_TARGET',result.reason??'이 칸에는 사용할 수 없어요.');
    spendItem(tx.player,item);recordActivity(tx,actionActivity([action],result.events));run.state=result.state;run.sequence++;
    const counts=powerUses(result.events);
    run.powerUses=addPowerUses(run.powerUses,counts);recordPowerFestival(tx,result.events);
    if(settings?.features.missions!==false)recordHiddenPowerMission(tx,counts);
    tx.statements.push(sql(tx.db,'INSERT INTO run_actions VALUES(?,?,?,?)',runId,run.sequence,JSON.stringify(action),tx.now),saveRun(tx.db,run));
    return {player:tx.player,run,events:result.events};
  });
}
export async function continueRun(env:ApiEnv,userId:string,runId:string,body:Record<string,unknown>){
  const sequence=z.number().int().min(0).parse(body.sequence);
  const expectedCost=z.number().int().positive().optional().parse(body.expectedCost);
  return mutate(env,userId,operationKey(body),`run:continue:${runId}:${sequence}${expectedCost===undefined?'':':'+expectedCost}`,async tx=>{
    const run=await readRun(tx.db,runId,userId);active(tx,run,sequence);
    const cost=CONTINUE_COSTS[run.continues];
    ensure(cost!==undefined,'CONTINUE_LIMIT','이 판에서는 더 이어할 수 없어요.');
    ensure(expectedCost===cost,'CONTINUE_PRICE_CHANGED',`이어하기 비용이 ${cost}코인으로 바뀌었어요. 앱을 업데이트한 뒤 다시 시도해 주세요.`,409);
    const action:Action={type:'continue',moves:5};const result=applyAction(run.state,action);
    ensure(result.accepted,'INVALID_CONTINUE','이동 횟수를 모두 사용한 판만 이어할 수 있어요.');
    spendCoins(tx.player,cost);run.continues++;run.sequence++;run.state=result.state;
    tx.statements.push(sql(tx.db,'INSERT INTO run_actions VALUES(?,?,?,?)',runId,run.sequence,JSON.stringify(action),tx.now),saveRun(tx.db,run));
    return {player:tx.player,run,cost};
  });
}
export async function closeRun(env:ApiEnv,userId:string,runId:string,body:Record<string,unknown>,abandon=false,settings?:RuntimeSettings){
  return mutate(env,userId,operationKey(body),`run:${abandon?'abandon':'finish'}:${runId}`,async tx=>{
    const snapshot=await sql(tx.db,`SELECT r.data,
      EXISTS(SELECT 1 FROM level_rewards WHERE user_id=r.user_id AND level_id=json_extract(r.data,'$.level.id')) rewarded
      FROM runs r WHERE r.id=? AND r.user_id=?`,runId,userId).first<{data:string;rewarded:number}>();
    ensure(snapshot,'RUN_NOT_FOUND','진행 중인 퍼즐을 찾을 수 없어요.',404);const run=JSON.parse(snapshot.data) as Run;
    if(run.status!=='active')return {player:tx.player,run};
    tx.statements.push(assertSQL(tx.db,"SELECT sequence=? AND status='active' FROM runs WHERE id=?",run.sequence,run.id));
    if(abandon&&run.state.status!=='won'){run.status='abandoned';}
    else{
      ensure(run.expiresAt>tx.now,'RUN_EXPIRED','24시간 복구 기간이 끝났습니다.');
      ensure(run.state.status==='won'||run.state.status==='lost','RUN_NOT_FINISHED','아직 퍼즐이 끝나지 않았어요.');
      run.status=run.state.status;
      if(run.status==='won'){
        await rewardWonRun(tx,run,settings,snapshot);
      }
    }
    if(run.status==='won'&&!run.heartCharge&&run.heartSpent){
      // An attempt opened by the old app/server already paid at entry. A clear returns it once.
      tx.player.hearts=Math.min(5,tx.player.hearts+1);
      if(tx.player.hearts===5)tx.player.heartAt=0;
      run.heartSpent=false;
    }
    if((run.status==='lost'||run.status==='abandoned')&&run.state.status!=='error'){
      tx.player.winStreak=0;
      tx.player.startGiftStreak=0;
      if(run.expiresAt>tx.now&&run.heartCharge==='failure'&&!run.heartSpent&&tx.player.hearts>0)run.heartSpent=consumeHeart(tx.player,tx.now);
    }
    tx.statements.push(saveRun(tx.db,run));return {player:tx.player,run};
  });
}

interface ClearSnapshot {rewarded:number}
/** Runs only after authoritative action replay. All effects share its guarded D1 batch. */
async function rewardWonRun(tx:MutationContext,run:Run,settings?:RuntimeSettings,snapshot?:ClearSnapshot){
 if(run.reward)return;
 ensure(run.state.status==='won','RUN_NOT_FINISHED','아직 퍼즐이 끝나지 않았어요.');
 snapshot??=await sql(tx.db,'SELECT EXISTS(SELECT 1 FROM level_rewards WHERE user_id=? AND level_id=?) rewarded',run.userId,run.level.id).first<ClearSnapshot>()??undefined;
 ensure(snapshot,'RUN_NOT_FOUND','진행 중인 퍼즐을 찾을 수 없어요.',404);
 if(!snapshot.rewarded){
  const coins=levelClearCoins(run.level),wasUnlocked=powerRainbowUnlocked(tx.player);
  if(startGiftReached(tx.player))tx.player.startGiftStreak=Math.min(START_GIFT_STAGES,startGiftStage(tx.player)+1);
  if(powerRainbowReached(tx.player))tx.player.winStreak=Math.min(POWER_RAINBOW_WINS,(tx.player.winStreak??0)+1);
  run.reward={coins,stars:1,...(!wasUnlocked&&powerRainbowUnlocked(tx.player)?{powerRainbowUnlocked:true as const}:{})};
  if(startGiftReached(tx.player))run.reward.startGiftStage=startGiftStage(tx.player);
  if(recordFlowerlightClear(tx,run))run.reward.flowerPetals=1;
  recordActivity(tx,{clears:1,'hard-clears':run.level.difficulty==='normal'?0:1});
  if(settings?.features.missions!==false&&tx.player.level===run.level.id)discoverHiddenPowerMission(tx,run.level.id);
  tx.player.coins+=coins;tx.player.stars++;tx.player.level=Math.max(tx.player.level,run.level.id+1);
  if(settings)recordGardenGameClear(tx,settings);
  if(tx.seasonActive)tx.player.passPoints+=10;
  tx.statements.push(sql(tx.db,'INSERT INTO level_rewards VALUES(?,?,?,?,?,?)',run.userId,run.level.id,run.id,coins,1,tx.now));
  if(tx.player.guildId)tx.notify(tx.player.guildId,{type:'progress',userId:run.userId,level:run.level.id});
 }
 run.status='won';
 if(!run.heartCharge&&run.heartSpent){tx.player.hearts=Math.min(5,tx.player.hearts+1);if(tx.player.hearts===5)tx.player.heartAt=0;run.heartSpent=false;}
}
