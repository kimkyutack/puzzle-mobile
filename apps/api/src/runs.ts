import { createGame, applyAction } from '@garden/core';
import { getLevel } from '@garden/content';
import {ENGINE_VERSION,LEGACY_ENGINE_VERSION,type Action,type GameEvent,type Run} from '@garden/contracts';
import { z } from 'zod';
import { activeRun, assertSQL, consumeHeart, ensure, HttpError, mutate, operationKey, readRun, saveRun, spendCoins, spendItem, sql, uid, type ApiEnv, type MutationContext } from './db';
import { actionsSchema, boosterSchema, preSchema } from './validation';

function active(tx:MutationContext,run:Run,sequence?:number){
  ensure(run.status==='active','RUN_CLOSED','이미 종료된 퍼즐입니다.',409);
  ensure(run.expiresAt>tx.now,'RUN_EXPIRED','24시간 복구 기간이 끝났어요. 홈에서 새 퍼즐을 시작해 주세요.',409);
  if(sequence!==undefined)ensure(run.sequence===sequence,'SEQUENCE_MISMATCH','다른 기기에서 진행된 퍼즐입니다. 다시 불러와 주세요.',409);
  tx.statements.push(assertSQL(tx.db,"SELECT sequence=? AND status='active' FROM runs WHERE id=?",run.sequence,run.id));
}
export async function startRun(env:ApiEnv,userId:string,body:Record<string,unknown>){
  const clientEngine=z.enum([ENGINE_VERSION,LEGACY_ENGINE_VERSION]).default(LEGACY_ENGINE_VERSION).parse(body.engineVersion);
  const preBoosters=z.array(preSchema).max(3).default([]).parse(body.preBoosters);
  ensure(new Set(preBoosters).size===preBoosters.length,'DUPLICATE_BOOSTER','시작 부스터는 종류당 하나만 선택할 수 있어요.');
  return mutate(env,userId,operationKey(body),`run:start:${preBoosters.join(',')}`,async tx=>{
    const existing=await activeRun(tx.db,userId);
    if(existing&&existing.expiresAt>tx.now){ensure(clientEngine===ENGINE_VERSION||existing.state.engineVersion===LEGACY_ENGINE_VERSION,'UPDATE_REQUIRED','앱을 업데이트하면 진행 중인 퍼즐을 이어할 수 있어요.',409);return {player:tx.player,run:existing};}
    if(existing){existing.status='expired';tx.statements.push(saveRun(tx.db,existing));}
    const level=getLevel(tx.player.level,clientEngine===LEGACY_ENGINE_VERSION);
    ensure(level.approved,'CONTENT_NOT_READY','검증된 퍼즐을 준비 중이에요. 잠시 후 다시 시도해 주세요.',503);
    let state;try{state=createGame(level,preBoosters);}catch(e){throw new HttpError('BOOSTER_PLACEMENT',e instanceof Error?e.message:'부스터를 배치할 수 없는 퍼즐입니다.');}
    ensure(state.status==='playing','INVALID_INITIAL_BOARD','초기 퍼즐 검증에 실패했습니다.',503);
    const unlimited=tx.player.unlimitedUntil>tx.now;
    ensure(unlimited||tx.player.hearts>0,'HEARTS_EMPTY','하트가 부족해요. 다음 회복을 기다리거나 무료 보너스를 확인하세요.',409);
    for(const item of preBoosters)spendItem(tx.player,item);
    const run:Run={id:uid(),userId,level,state,sequence:0,status:'active',startedAt:tx.now,expiresAt:tx.now+86_400_000,preBoosters,heartSpent:false,heartCharge:unlimited?'protected':'failure',continues:0};
    tx.statements.push(sql(tx.db,'INSERT INTO runs VALUES(?,?,?,?,?,?,?)',run.id,userId,JSON.stringify(run),run.status,0,run.expiresAt,operationKey(body)));
    return {player:tx.player,run};
  });
}
export async function runActions(env:ApiEnv,userId:string,runId:string,body:Record<string,unknown>){
  const input=actionsSchema.parse(body);
  return mutate(env,userId,operationKey(body),`run:actions:${runId}:${JSON.stringify(input)}`,async tx=>{
    const run=await readRun(tx.db,runId,userId);active(tx,run,input.sequence);
    const events:GameEvent[]=[];
    ensure(run.sequence+input.actions.length<=2000,'TOO_MANY_ACTIONS','행동 기록 한도를 넘었어요.');
    for(const action of input.actions){
      const result=applyAction(run.state,action);
      ensure(result.accepted,'INVALID_ACTION',result.reason??'불가능한 이동입니다.');
      ensure(result.state.status!=='error','ENGINE_ERROR','퍼즐 처리 오류가 발생했어요. 보상은 검증 후 지급됩니다.',409);
      run.state=result.state;events.push(...result.events);run.sequence++;
      tx.statements.push(sql(tx.db,'INSERT INTO run_actions VALUES(?,?,?,?)',runId,run.sequence,JSON.stringify(action),tx.now));
    }
    tx.statements.push(saveRun(tx.db,run));return {player:tx.player,run,events};
  });
}
export async function useBooster(env:ApiEnv,userId:string,runId:string,body:Record<string,unknown>){
  const item=boosterSchema.parse(body.item);const at=body.at===undefined?undefined:z.number().int().min(0).max(99).parse(body.at);
  const sequence=z.number().int().min(0).parse(body.sequence);
  return mutate(env,userId,operationKey(body),`run:booster:${runId}:${sequence}:${item}:${at}`,async tx=>{
    const run=await readRun(tx.db,runId,userId);active(tx,run,sequence);
    const action:Action={type:'booster',item,...(at===undefined?{}:{at})};const result=applyAction(run.state,action);
    ensure(result.accepted && result.state.status!=='error','INVALID_TARGET',result.reason??'이 칸에는 사용할 수 없어요.');
    spendItem(tx.player,item);run.state=result.state;run.sequence++;
    tx.statements.push(sql(tx.db,'INSERT INTO run_actions VALUES(?,?,?,?)',runId,run.sequence,JSON.stringify(action),tx.now),saveRun(tx.db,run));
    return {player:tx.player,run,events:result.events};
  });
}
export async function continueRun(env:ApiEnv,userId:string,runId:string,body:Record<string,unknown>){
  const sequence=z.number().int().min(0).parse(body.sequence);
  return mutate(env,userId,operationKey(body),`run:continue:${runId}:${sequence}`,async tx=>{
    const run=await readRun(tx.db,runId,userId);active(tx,run,sequence);
    ensure(run.continues<3,'CONTINUE_LIMIT','이 판에서는 더 이어할 수 없어요.');
    const action:Action={type:'continue',moves:5};const result=applyAction(run.state,action);
    ensure(result.accepted,'INVALID_CONTINUE','이동 횟수를 모두 사용한 판만 이어할 수 있어요.');
    const cost=(run.continues+1)*300;spendCoins(tx.player,cost);run.continues++;run.sequence++;run.state=result.state;
    tx.statements.push(sql(tx.db,'INSERT INTO run_actions VALUES(?,?,?,?)',runId,run.sequence,JSON.stringify(action),tx.now),saveRun(tx.db,run));
    return {player:tx.player,run,cost};
  });
}
export async function closeRun(env:ApiEnv,userId:string,runId:string,body:Record<string,unknown>,abandon=false){
  return mutate(env,userId,operationKey(body),`run:${abandon?'abandon':'finish'}:${runId}`,async tx=>{
    const run=await readRun(tx.db,runId,userId);
    if(run.status!=='active')return {player:tx.player,run};
    tx.statements.push(assertSQL(tx.db,"SELECT sequence=? AND status='active' FROM runs WHERE id=?",run.sequence,run.id));
    if(abandon&&run.state.status!=='won'){run.status='abandoned';}
    else{
      ensure(run.expiresAt>tx.now,'RUN_EXPIRED','24시간 복구 기간이 끝났습니다.');
      ensure(run.state.status==='won'||run.state.status==='lost','RUN_NOT_FINISHED','아직 퍼즐이 끝나지 않았어요.');
      run.status=run.state.status;
      if(run.status==='won'){
        // The persisted state consists only of replayed, approved actions, never client snapshots.
        const exists=await sql(tx.db,'SELECT 1 FROM level_rewards WHERE user_id=? AND level_id=?',userId,run.level.id).first();
        if(!exists){const coins=run.level.difficulty==='super'?100:run.level.difficulty==='hard'?75:50;
          run.reward={coins,stars:1};tx.player.coins+=coins;tx.player.stars++;tx.player.level=Math.max(tx.player.level,run.level.id+1);
          if(await sql(tx.db,'SELECT 1 FROM seasons WHERE starts_at<=? AND ends_at>? LIMIT 1',tx.now,tx.now).first())tx.player.passPoints+=10;
          tx.statements.push(sql(tx.db,'INSERT INTO level_rewards VALUES(?,?,?,?,?,?)',userId,run.level.id,runId,coins,1,tx.now));
          if(tx.player.guildId)tx.notify(tx.player.guildId,{type:'progress',userId,level:run.level.id});
        }
      }
    }
    if(run.status==='won'&&!run.heartCharge&&run.heartSpent){
      // An attempt opened by the old app/server already paid at entry. A clear returns it once.
      tx.player.hearts=Math.min(5,tx.player.hearts+1);
      if(tx.player.hearts===5)tx.player.heartAt=0;
      run.heartSpent=false;
    }
    if((run.status==='lost'||run.status==='abandoned')&&run.state.status!=='error'&&run.expiresAt>tx.now&&run.heartCharge==='failure'&&!run.heartSpent&&tx.player.hearts>0){
      run.heartSpent=consumeHeart(tx.player,tx.now);
    }
    tx.statements.push(saveRun(tx.db,run));return {player:tx.player,run};
  });
}
