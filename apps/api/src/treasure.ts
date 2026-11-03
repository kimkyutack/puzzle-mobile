import {z} from 'zod';
import {treasureDeck,replayTreasure,TREASURE_MAX_TURNS,missionPeriod} from '@garden/content';
import type {ActivityReward,TreasureAttempt} from '@garden/contracts';
import {ensure,mutate,one,operationKey,rows,sql,uid,type ApiEnv} from './db';
import {grantActivityReward,recordActivity} from './activity';
export async function startTreasure(env:ApiEnv,userId:string,body:Record<string,unknown>){
 return mutate(env,userId,operationKey(body),'treasure:start',async tx=>{
  const period=missionPeriod('daily',tx.now),attempts=await rows<{data:string;status:string}>(tx.db,'SELECT data,status FROM treasure_attempts WHERE user_id=? AND day=? ORDER BY created_at DESC',userId,period.id),active=attempts.find(a=>a.status==='playing');
  if(active)return {player:tx.player,attempt:JSON.parse(active.data) as TreasureAttempt};
  ensure(attempts.length<3,'MINIGAME_LIMIT','오늘의 보물 카드를 모두 열었어요. 내일 다시 만나요.',409);
  const seed=new Uint32Array(1);crypto.getRandomValues(seed);const attempt:TreasureAttempt={id:uid(),day:period.id,deck:treasureDeck(seed[0]!),maxTurns:TREASURE_MAX_TURNS,startedAt:tx.now,expiresAt:period.endsAt,status:'playing'};
  tx.statements.push(sql(tx.db,'INSERT INTO treasure_attempts VALUES(?,?,?,?,?,?)',attempt.id,userId,attempt.day,JSON.stringify(attempt),attempt.status,tx.now));return {player:tx.player,attempt};
 });
}
export async function finishTreasure(env:ApiEnv,userId:string,id:string,body:Record<string,unknown>){
 const pairs=z.array(z.object({first:z.number().int().min(0).max(11),second:z.number().int().min(0).max(11)}).strict()).max(12).parse(body.pairs);
 return mutate(env,userId,operationKey(body),`treasure:finish:${id}:${JSON.stringify(pairs)}`,async tx=>{
  const row=await one<{data:string}>(tx.db,'SELECT data FROM treasure_attempts WHERE id=? AND user_id=?',id,userId);ensure(row,'MINIGAME_NOT_FOUND','보물 카드를 찾을 수 없어요.',404);const attempt=JSON.parse(row.data) as TreasureAttempt;
  if(attempt.status!=='playing')return {player:tx.player,attempt};
  ensure(attempt.expiresAt>tx.now,'MINIGAME_EXPIRED','새로운 하루의 보물 카드가 준비됐어요.',409);
  const result=replayTreasure(attempt.deck,pairs,attempt.maxTurns);ensure(result.valid&&result.status!=='playing','MINIGAME_NOT_FINISHED','짝을 모두 찾거나 남은 도전을 마친 뒤 확인해 주세요.',409);attempt.status=result.status;
  if(result.status==='won'){
   const items=['hammer','sweep-row','sweep-column','shuffle','cross-firework','color-magnet','move-hourglass'] as const;
   const choice=(attempt.deck.reduce((n,color)=>n+color.charCodeAt(0),0)+Number.parseInt(id.replaceAll('-','').slice(-4),16))%items.length;
   const reward:ActivityReward={coins:25,items:{[items[choice]!]:1}};attempt.reward=reward;grantActivityReward(tx,reward);recordActivity(tx,{'minigame-wins':1});
  }
  tx.statements.push(sql(tx.db,'UPDATE treasure_attempts SET data=?,status=? WHERE id=? AND status=?',JSON.stringify(attempt),attempt.status,id,'playing'));return {player:tx.player,attempt};
 });
}
