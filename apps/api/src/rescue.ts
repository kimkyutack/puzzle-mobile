import {z} from 'zod';
import {replay} from '@garden/core';
import {BRIDGE_EPISODE,bridgeLevel,bridgeDailyWindow,rescueUnlocked} from '@garden/content';
import type {DailyRescueResult} from '@garden/contracts';
import {actionSchema} from './validation';
import {ensure,mutate,one,readPlayer,sql,uid,type ApiEnv} from './db';
import {state} from './story';
const input=z.object({actions:z.array(actionSchema.refine(action=>action.type==='swap'||action.type==='tap')).min(1).max(80),periodId:z.string().regex(/^d:\d{4}-\d{2}-\d{2}$/).optional()}).strict();
/** Replay proof and one daily item commit atomically; normal runs and hearts are independent. */
export async function completeBridge(env:ApiEnv,userId:string,body:Record<string,unknown>){
 const player=await readPlayer(env.DB,userId);ensure(rescueUnlocked(player),'EPISODE_LOCKED','7판을 완료하면 구름길 구조대가 열려요.',409);
 const {actions,periodId}=input.parse(body),result=replay(bridgeLevel(),actions);
 ensure(result.accepted&&result.state.status==='won','EPISODE_NOT_COMPLETE','다리를 완성한 기록을 확인할 수 없어요.',409);
 // Older installed clients retain their completion contract, without a new reward grant.
 if(!periodId){await sql(env.DB,'INSERT INTO story_seen(user_id,scene_id,seen_at) SELECT id,?,? FROM players WHERE id=? ON CONFLICT(user_id,scene_id) DO NOTHING','rescue:'+BRIDGE_EPISODE.id,Date.now(),userId).run();return state(env,userId);}
 ensure(bridgeDailyWindow(Date.now()).periodId===periodId,'RESCUE_DAY_CHANGED','새로운 하루가 시작됐어요. 오늘의 구조 도전을 열어 주세요.',409);
 return mutate<DailyRescueResult>(env,userId,'rescue-daily:'+periodId,'rescue:daily:'+periodId,async tx=>{
  const daily=bridgeDailyWindow(tx.now);ensure(daily.periodId===periodId,'RESCUE_DAY_CHANGED','새로운 하루가 시작됐어요. 오늘의 구조 도전을 열어 주세요.',409);
  ensure(rescueUnlocked(tx.player),'EPISODE_LOCKED','7판을 완료하면 구름길 구조대가 열려요.',409);
  if(!await one(tx.db,"SELECT 1 FROM reward_claims WHERE user_id=? AND kind='rescue-daily' AND source_id=?",userId,periodId)){
   tx.touch(tx.player);const {item,quantity}=daily.reward;tx.player.inventory[item]??={normal:0,bound:0};tx.player.inventory[item].bound+=quantity;
   tx.statements.push(sql(tx.db,'INSERT INTO inventory_lots VALUES(?,?,?,?,?,?,?)',uid(),userId,item,1,quantity,tx.sourceId,tx.now));
   tx.statements.push(sql(tx.db,"INSERT INTO reward_claims VALUES(?,'rescue-daily',?,?)",userId,periodId,tx.now));
   tx.statements.push(sql(tx.db,'INSERT INTO story_seen(user_id,scene_id,seen_at) VALUES(?,?,?) ON CONFLICT(user_id,scene_id) DO NOTHING',userId,'rescue:'+BRIDGE_EPISODE.id,tx.now));
  }
  return {player:tx.player,dailyRescue:{...daily,claimed:true}};
 },{touchPlayer:false});
}
