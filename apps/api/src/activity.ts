import type {Action,ActivityMetric,ActivityReward,GameEvent,Item,MissionPeriod,ProgressionResponse,TreasureAttempt} from '@garden/contracts';
import {COLORS} from '@garden/contracts';
import {MISSIONS,missionPeriod} from '@garden/content';
import {z} from 'zod';
import {events} from './economy';
import {ensure,mutate,one,operationKey,readPlayer,rows,sql,type ApiEnv,type MutationContext} from './db';

export type ActivityDelta=Partial<Record<ActivityMetric,number>>;
export function actionActivity(actions:readonly Action[],events:readonly GameEvent[]):ActivityDelta{
 const removes=events.filter(e=>e.type==='remove'&&COLORS.includes(e.kind as typeof COLORS[number]));
 return {tiles:removes.reduce((n,e)=>n+e.cells.length,0),'collect-drop':removes.filter(e=>e.kind==='drop').reduce((n,e)=>n+e.cells.length,0),'collect-berry':removes.filter(e=>e.kind==='berry').reduce((n,e)=>n+e.cells.length,0),'specials-made':events.filter(e=>e.type==='spawn'&&['wind-row','wind-column','bomb','glider','rainbow'].includes(e.kind??'')).length,'specials-used':events.filter(e=>e.type==='special'&&e.cells.length>0&&e.kind!=='glider-flight').length,combos:events.filter(e=>e.type==='special'&&e.kind?.includes('+')).length,'boosters-used':actions.filter(a=>a.type==='booster').length};
}
export function recordActivity(tx:MutationContext,delta:ActivityDelta){
 for(const period of ['daily','weekly'] as const){const window=missionPeriod(period,tx.now);for(const [metric,value]of Object.entries(delta))if(value&&value>0)tx.statements.push(sql(tx.db,'INSERT INTO activity_counters(user_id,period,metric,value) VALUES(?,?,?,?) ON CONFLICT(user_id,period,metric) DO UPDATE SET value=value+excluded.value',tx.player.id,window.id,metric,value));}
}
export function grantActivityReward(tx:MutationContext,reward:ActivityReward){
 tx.player.coins+=reward.coins;
 for(const [item,count]of Object.entries(reward.items) as Array<[Item,number]>){tx.player.inventory[item]??={normal:0,bound:0};tx.player.inventory[item].bound+=count;}
}
export async function awardClearMilestones(tx:MutationContext,total:number){
 const previous=(await one<{awarded:number}>(tx.db,'SELECT awarded FROM clear_milestones WHERE user_id=?',tx.player.id))?.awarded??0;
 const earned=Math.floor(total/10),amount=Math.max(0,earned-previous);
 if(amount){tx.touch(tx.player);grantActivityReward(tx,{coins:0,items:{'world-bomb':amount}});tx.statements.push(sql(tx.db,'INSERT INTO clear_milestones(user_id,awarded) VALUES(?,?) ON CONFLICT(user_id) DO UPDATE SET awarded=excluded.awarded',tx.player.id,earned));}
 return amount;
}
async function bootstrapActivity(env:ApiEnv,userId:string){
 const now=Date.now(),today=missionPeriod('daily',now);
 const [visits,clears,milestone]=await Promise.all([one(env.DB,'SELECT 1 FROM activity_days WHERE user_id=? AND day=?',userId,today.id),one<{n:number}>(env.DB,'SELECT count(*) n FROM level_rewards WHERE user_id=?',userId),one<{awarded:number}>(env.DB,'SELECT awarded FROM clear_milestones WHERE user_id=?',userId)]);
 if(visits&&Math.floor((clears?.n??0)/10)<=(milestone?.awarded??0))return;
 await mutate(env,userId,`activity:${today.id}:${Math.floor((clears?.n??0)/10)}`,'activity:bootstrap',async tx=>{
  const day=missionPeriod('daily',tx.now);
  if(!await one(tx.db,'SELECT 1 FROM activity_days WHERE user_id=? AND day=?',userId,day.id)){tx.touch(tx.player);tx.statements.push(sql(tx.db,'INSERT INTO activity_days VALUES(?,?)',userId,day.id));recordActivity(tx,{'active-days':1});}
  await awardClearMilestones(tx,(await one<{n:number}>(tx.db,'SELECT count(*) n FROM level_rewards WHERE user_id=?',userId))?.n??0);
  return {initialized:true};
 },{touchPlayer:false});
}
async function missionWindow(env:ApiEnv,userId:string,period:MissionPeriod,now:number){
 const window=missionPeriod(period,now),[counters,claims]=await Promise.all([rows<{metric:ActivityMetric;value:number}>(env.DB,'SELECT metric,value FROM activity_counters WHERE user_id=? AND period=?',userId,window.id),rows<{mission_id:string}>(env.DB,'SELECT mission_id FROM mission_claims WHERE user_id=? AND period=?',userId,window.id)]);
 return {id:window.id,endsAt:window.endsAt,missions:MISSIONS.filter(m=>m.period===period).map(m=>{const progress=Math.min(m.target,counters.find(c=>c.metric===m.metric)?.value??0),claimed=claims.some(c=>c.mission_id===m.id);return {...m,progress,claimed,claimable:progress>=m.target&&!claimed};})};
}
export async function progression(env:ApiEnv,userId:string):Promise<ProgressionResponse>{
 await bootstrapActivity(env,userId);const now=Date.now(),today=missionPeriod('daily',now);
 const [player,daily,weekly,clears,awards,attempts,ev,gifts,incoming,guild]=await Promise.all([
  readPlayer(env.DB,userId,now),missionWindow(env,userId,'daily',now),missionWindow(env,userId,'weekly',now),one<{n:number}>(env.DB,'SELECT count(*) n FROM level_rewards WHERE user_id=?',userId),one<{awarded:number}>(env.DB,'SELECT awarded FROM clear_milestones WHERE user_id=?',userId),rows<{data:string;status:string}>(env.DB,'SELECT data,status FROM treasure_attempts WHERE user_id=? AND day=? ORDER BY created_at DESC',userId,today.id),events(env,userId),rows<{kind:string;quantity:number}>(env.DB,'SELECT kind,quantity FROM gifts WHERE user_id=? AND quantity>0',userId),one<{n:number}>(env.DB,"SELECT count(*) n FROM friendships f JOIN players p ON p.id=CASE WHEN f.user_low=? THEN f.user_high ELSE f.user_low END WHERE (f.user_low=? OR f.user_high=?) AND f.status='pending' AND f.requested_by<>? AND p.deleted_at IS NULL",userId,userId,userId,userId),one<{n:number}>(env.DB,"SELECT count(*) n FROM guild_applications a JOIN guild_members m ON m.guild_id=a.guild_id WHERE m.user_id=? AND m.role IN ('leader','officer')",userId)
 ]);
 const fullBomb=player.inventory['world-bomb'],missions=[...daily.missions,...weekly.missions].filter(m=>m.claimable).length;
 const pass=player.level>=5?ev.pass.tiers.filter(t=>ev.pass.points>=t.points&&(!t.freeClaimed||ev.pass.premium&&!t.premiumClaimed)).length:0;
 return {player,daily,weekly,milestone:{clears:clears?.n??0,progress:(clears?.n??0)%10,target:10,awarded:awards?.awarded??0,owned:(fullBomb?.normal??0)+(fullBomb?.bound??0)},minigame:{remaining:Math.max(0,3-attempts.length),maximum:3,nextReset:today.endsAt,active:attempts.find(a=>a.status==='playing')?JSON.parse(attempts.find(a=>a.status==='playing')!.data) as TreasureAttempt:null},notifications:{missions,pass,gifts:gifts.filter(g=>g.kind!=='heart'||player.hearts<5).length,friends:incoming?.n??0,guild:guild?.n??0,events:Number(ev.daily.available)+Number(!!ev.season&&!ev.personal.claimed&&ev.personal.progress>=ev.personal.target)+Number(!!ev.season&&!!player.guildId&&!ev.guild.claimed&&ev.guild.progress>=ev.guild.target),minigame:Number(!attempts.length),shop:0}};
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
