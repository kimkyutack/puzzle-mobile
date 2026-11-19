import {z} from 'zod';
import {replay} from '@garden/core';
import {APPROVED_LEVEL_COUNT} from '@garden/content';
import type {Player} from '@garden/contracts';
import {GOLD_GARDEN_INTERVAL,GOLD_GARDEN_MOVES,GOLD_GARDEN_VERSION,LEGACY_GOLD_GARDEN_VERSION,REFILL_GOLD_GARDEN_VERSION,goldGardenCoins,goldGardenLevel,isGoldGardenMilestone} from '../../../packages/content/src/gold-garden';
import {ensure,mutate,one,rows,sql,type ApiEnv} from './db';
import {actionSchema} from './validation';

const completion=z.object({
 milestone:z.number().int().max(APPROVED_LEVEL_COUNT).refine(isGoldGardenMilestone),
 actions:z.array(actionSchema.refine(action=>action.type==='swap'||action.type==='tap')).min(1).max(GOLD_GARDEN_MOVES),
 version:z.union([z.literal(REFILL_GOLD_GARDEN_VERSION),z.literal(GOLD_GARDEN_VERSION)]).optional(),
}).strict();

export async function goldGardenStatus(env:ApiEnv,userId:string,requestedVersion?:string|null){
 const pending=await rows<{level_id:number}>(env.DB,`SELECT r.level_id FROM level_rewards r
  WHERE r.user_id=? AND r.level_id>=? AND r.level_id % ?=0
   AND NOT EXISTS(SELECT 1 FROM reward_claims c WHERE c.user_id=r.user_id AND c.kind='gold-garden' AND c.source_id=CAST(r.level_id AS TEXT))
  ORDER BY r.level_id DESC`,userId,GOLD_GARDEN_INTERVAL,GOLD_GARDEN_INTERVAL);
 const version=requestedVersion===String(GOLD_GARDEN_VERSION)?GOLD_GARDEN_VERSION:REFILL_GOLD_GARDEN_VERSION;
 return {milestones:pending.map(item=>item.level_id),version};
}

export async function finishGoldGarden(env:ApiEnv,userId:string,body:Record<string,unknown>){
 const {milestone,actions,version=LEGACY_GOLD_GARDEN_VERSION}=completion.parse(body),id=String(milestone);
 return mutate<{player:Player;coins:number|null}>(env,userId,'gold-garden:'+id,'gold-garden:claim:'+id,async tx=>{
  const eligible=await one<{claimed:number}>(tx.db,`SELECT EXISTS(SELECT 1 FROM reward_claims
   WHERE user_id=? AND kind='gold-garden' AND source_id=?) claimed
   FROM level_rewards WHERE user_id=? AND level_id=?`,userId,id,userId,milestone);
  ensure(eligible&&tx.player.level>milestone,'GOLD_GARDEN_LOCKED','해당 레벨을 클리어하면 황금 정원이 열려요.',409);
  if(eligible.claimed)return {player:tx.player,coins:null};
  const result=replay(goldGardenLevel(milestone,version),actions);
  const complete=version!==LEGACY_GOLD_GARDEN_VERSION?result.state.status==='won'&&result.state.moves===0:
   result.state.status==='won'||result.state.status==='lost'&&result.state.moves===0;
  ensure(result.accepted&&complete,'GOLD_GARDEN_INCOMPLETE',
   version!==LEGACY_GOLD_GARDEN_VERSION?'남은 이동을 모두 써 주세요.':'이동을 모두 쓰거나 금화를 전부 모아 주세요.',409);
  const coins=goldGardenCoins(result.state);
  if(coins>0){tx.touch(tx.player);tx.player.coins+=coins;}
  tx.statements.push(sql(tx.db,"INSERT INTO reward_claims VALUES(?,'gold-garden',?,?)",userId,id,tx.now));
  return {player:tx.player,coins};
 },{touchPlayer:false});
}
