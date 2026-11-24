import {GARDEN_INVITE_STAGES} from '../../../packages/contracts/src/garden-invite';
import {gameEventAvailable,gameEventConfig,type RuntimeSettings} from '../../../packages/contracts/src/operations';
import type {Action,ActivityMetric,ActivityReward,GameEvent,Item,MissionPeriod,ProgressionResponse,TreasureAttempt} from '@garden/contracts';
import {COLORS} from '@garden/contracts';
import {MISSIONS,missionPeriod} from '@garden/content';
import {flowerlightAttention,expeditionAttention,powerFestivalAttention,passClaimable,seasonClaimable,treasureAttention} from '../../../packages/content/src/attention';
import {z} from 'zod';
import {events} from './economy';
import {ensure,mutate,one,operationKey,readPlayer,rows,sql,type ApiEnv,type MutationContext} from './db';

export type ActivityDelta=Partial<Record<ActivityMetric,number>>;
export function actionActivity(actions:readonly Action[],events:readonly GameEvent[]):ActivityDelta{
 const removes=events.filter(e=>e.type==='remove'&&COLORS.includes(e.kind as typeof COLORS[number]));
 return {tiles:removes.reduce((n,e)=>n+e.cells.length,0),'collect-drop':removes.filter(e=>e.kind==='drop').reduce((n,e)=>n+e.cells.length,0),'collect-berry':removes.filter(e=>e.kind==='berry').reduce((n,e)=>n+e.cells.length,0),'specials-made':events.filter(e=>e.type==='spawn'&&['wind-row','wind-column','bomb','glider','rainbow','beehive'].includes(e.kind??'')).length,'specials-used':events.filter(e=>e.type==='special'&&e.cells.length>0&&e.kind!=='glider-flight'&&e.kind!=='bee-flight').length,combos:events.filter(e=>e.type==='special'&&e.kind?.includes('+')).length,'boosters-used':actions.filter(a=>a.type==='booster').length};
}
export function recordActivity(tx:MutationContext,delta:ActivityDelta){
 for(const period of ['daily','weekly'] as const){const window=missionPeriod(period,tx.now);for(const [metric,value]of Object.entries(delta))if(value&&value>0)tx.statements.push(sql(tx.db,'INSERT INTO activity_counters(user_id,period,metric,value) VALUES(?,?,?,?) ON CONFLICT(user_id,period,metric) DO UPDATE SET value=value+excluded.value',tx.player.id,window.id,metric,value));}
}
export function grantActivityReward(tx:MutationContext,reward:ActivityReward){
 tx.player.coins+=reward.coins;
 for(const [item,count]of Object.entries(reward.items) as Array<[Item,number]>){tx.player.inventory[item]??={normal:0,bound:0};tx.player.inventory[item].bound+=count;}
}
async function bootstrapActivity(env:ApiEnv,userId:string){
 const today=missionPeriod('daily',Date.now());
 if(await one(env.DB,'SELECT 1 FROM activity_days WHERE user_id=? AND day=?',userId,today.id))return;
 await mutate(env,userId,`activity:day:${today.id}`,'activity:bootstrap',async tx=>{
  const day=missionPeriod('daily',tx.now);
  if(!await one(tx.db,'SELECT 1 FROM activity_days WHERE user_id=? AND day=?',userId,day.id)){
   tx.touch(tx.player);
   tx.statements.push(sql(tx.db,'INSERT INTO activity_days VALUES(?,?)',userId,day.id));
   recordActivity(tx,{'active-days':1});
  }
  return {initialized:true};
 },{touchPlayer:false});
}
async function missionWindow(env:ApiEnv,userId:string,period:MissionPeriod,now:number){
 const window=missionPeriod(period,now),[counters,claims]=await Promise.all([rows<{metric:ActivityMetric;value:number}>(env.DB,'SELECT metric,value FROM activity_counters WHERE user_id=? AND period=?',userId,window.id),rows<{mission_id:string}>(env.DB,'SELECT mission_id FROM mission_claims WHERE user_id=? AND period=?',userId,window.id)]);
 return {id:window.id,endsAt:window.endsAt,missions:MISSIONS.filter(m=>m.period===period).map(m=>{const progress=Math.min(m.target,counters.find(c=>c.metric===m.metric)?.value??0),claimed=claims.some(c=>c.mission_id===m.id);return {...m,progress,claimed,claimable:progress>=m.target&&!claimed};})};
}
export async function progression(env:ApiEnv,userId:string,settings?:RuntimeSettings):Promise<ProgressionResponse>{
 await bootstrapActivity(env,userId);const now=Date.now(),today=missionPeriod('daily',now);
 const [player,daily,weekly,clears,awards,attempts,ev,gifts,incoming,guild,invitation]=await Promise.all([
  readPlayer(env.DB,userId,now),missionWindow(env,userId,'daily',now),missionWindow(env,userId,'weekly',now),one<{n:number}>(env.DB,'SELECT count(*) n FROM level_rewards WHERE user_id=?',userId),one<{awarded:number}>(env.DB,'SELECT awarded FROM clear_milestones WHERE user_id=?',userId),rows<{data:string;status:string}>(env.DB,'SELECT data,status FROM treasure_attempts WHERE user_id=? AND day=? ORDER BY created_at DESC',userId,today.id),events(env,userId),rows<{kind:string;quantity:number}>(env.DB,'SELECT kind,quantity FROM gifts WHERE user_id=? AND quantity>0',userId),one<{n:number}>(env.DB,"SELECT count(*) n FROM friendships f JOIN players p ON p.id=CASE WHEN f.user_low=? THEN f.user_high ELSE f.user_low END WHERE (f.user_low=? OR f.user_high=?) AND f.status='pending' AND f.requested_by<>? AND p.deleted_at IS NULL AND NOT EXISTS(SELECT 1 FROM blocks b WHERE (b.user_id=? AND b.blocked_id=p.id) OR (b.user_id=p.id AND b.blocked_id=?))",userId,userId,userId,userId,userId,userId),one<{n:number}>(env.DB,"SELECT count(*) n FROM guild_applications a JOIN guild_members m ON m.guild_id=a.guild_id WHERE m.user_id=? AND m.role IN ('leader','officer') AND (SELECT count(*) FROM guild_members capacity WHERE capacity.guild_id=m.guild_id)<30",userId),
  one<{visitors:number;claimed_stages:number}>(env.DB,'SELECT visitors,claimed_stages FROM garden_invitations WHERE owner_id=?',userId)
 ]);
 const invitationPrize=GARDEN_INVITE_STAGES[invitation?.claimed_stages??0];
 const invitationReady=Number(!!invitation&&!!invitationPrize&&invitation.visitors>=invitationPrize.visitors);
 const fullBomb=player.inventory['world-bomb'],missions=[...daily.missions,...weekly.missions].filter(m=>m.claimable).length;
 const eventRewards={daily:ev.daily,season:ev.season,personal:ev.personal,guild:ev.guild,pass:{points:ev.pass.points,premium:ev.pass.premium,tiers:ev.pass.tiers.map(({tier,points,freeClaimed,premiumClaimed})=>({tier,points,freeClaimed,premiumClaimed})),guildGifts:ev.pass.guildGifts}},giftCounts={hearts:gifts.filter(g=>g.kind==='heart').length,items:gifts.filter(g=>g.kind!=='heart').length};
 const minigame={remaining:Math.max(0,3-attempts.length),maximum:3 as const,nextReset:today.endsAt,active:attempts.find(a=>a.status==='playing')?JSON.parse(attempts.find(a=>a.status==='playing')!.data) as TreasureAttempt:null};
 return {player,daily,weekly,eventRewards,giftCounts,milestone:{clears:clears?.n??0,progress:(clears?.n??0)%10,target:10,awarded:awards?.awarded??0,owned:(fullBomb?.normal??0)+(fullBomb?.bound??0)},minigame,notifications:{invitation:invitationReady,flowerlight:Number(flowerlightAttention(player,now,settings)),expedition:Number(expeditionAttention(player,now,settings)),festival:Number(powerFestivalAttention(player,now,settings)),missions,pass:passClaimable(eventRewards,player,now),gifts:giftCounts.items+(player.hearts<5?giftCounts.hearts:0),friends:incoming?.n??0,guild:guild?.n??0,events:Number(ev.daily.available)+seasonClaimable(ev,!!player.guildId,now),minigame:Number(settings?.features.treasure!==false&&treasureAttention(minigame,now)&&(!!minigame.active||player.level>=gameEventConfig('treasure',settings).minLevel&&gameEventAvailable('treasure',settings,now))),shop:0}};
}
export async function claimMissions(env:ApiEnv,userId:string,body:Record<string,unknown>){
 const input=z.object({period:z.enum(['daily','weekly']),periodId:z.string().max(32),ids:z.array(z.string().max(40)).max(10).optional()}).parse(body);
 return mutate(env,userId,operationKey(body),`missions:${JSON.stringify(input)}`,async tx=>{
  const window=await missionWindow(env,userId,input.period,tx.now);ensure(window.id===input.periodId,'MISSION_PERIOD_CHANGED','미션 기간이 바뀌었어요. 새 미션을 확인해 주세요.',409);
  if(input.ids)ensure(input.ids.every(id=>window.missions.some(m=>m.id===id)),'UNKNOWN_MISSION','미션을 찾을 수 없어요.');
  const eligible=window.missions.filter(m=>m.claimable&&(!input.ids||input.ids.includes(m.id)));
  if(eligible.length)tx.touch(tx.player);
  for(const mission of eligible){grantActivityReward(tx,mission.reward);tx.statements.push(sql(tx.db,'INSERT INTO mission_claims VALUES(?,?,?,?,?)',userId,window.id,mission.id,JSON.stringify(mission.reward),tx.now));}
  return {player:tx.player,claimed:eligible.map(m=>m.id)};
 },{touchPlayer:false});
}
