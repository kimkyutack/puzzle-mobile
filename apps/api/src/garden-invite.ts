import {z} from 'zod';
import {GARDEN_INVITE_ID,GARDEN_INVITE_LEVEL,GARDEN_INVITE_SHARE_COOLDOWN,GARDEN_INVITE_STAGES,gardenInviteObjectives,type GardenInviteState} from '../../../packages/contracts/src/garden-invite';
import {projectLiveGarden} from '../../../packages/garden-world/src/live';
import {stored,visitGarden,grantEventDecoration} from './garden-world';
import {assertSQL,day,ensure,mutate,one,operationKey,readPlayer,sql,uid,type ApiEnv} from './db';
import {membership} from './guild';

interface InviteRow {ready_at:number;shared_at:number|null;visitors:number;claimed_stages:number}
const inviteRow=(env:ApiEnv,userId:string)=>one<InviteRow>(env.DB,'SELECT ready_at,shared_at,visitors,claimed_stages FROM garden_invitations WHERE owner_id=?',userId);
export async function gardenInvite(env:ApiEnv,userId:string):Promise<GardenInviteState>{
 const [player,row,garden]=await Promise.all([readPlayer(env.DB,userId),inviteRow(env,userId),stored(env,userId)]);
 return {id:GARDEN_INVITE_ID,eligible:player.level>=GARDEN_INVITE_LEVEL,ready:!!row,readyAt:row?.ready_at??null,sharedAt:row?.shared_at??null,nextShareAt:row?.shared_at?row.shared_at+GARDEN_INVITE_SHARE_COOLDOWN:0,visitors:row?.visitors??0,claimedStages:row?.claimed_stages??0,objectives:gardenInviteObjectives(player,projectLiveGarden(player,garden?JSON.parse(garden.data):null))};
}
export async function prepareGardenInvite(env:ApiEnv,userId:string,body:Record<string,unknown>){
 z.object({key:z.string().min(8).max(100)}).strict().parse(body);
 return mutate(env,userId,operationKey(body),'garden-invite:prepare',async tx=>{
  ensure(tx.player.level>=GARDEN_INVITE_LEVEL,'GARDEN_INVITE_LOCKED','레벨 5부터 정원에 초대할 수 있어요.',403);
  if(await inviteRow(env,userId))return {player:tx.player,ready:true};
  const garden=await stored(env,userId),world=projectLiveGarden(tx.player,garden?JSON.parse(garden.data):null);
  ensure(gardenInviteObjectives(tx.player,world).every(goal=>goal.complete),'GARDEN_INVITE_PREPARATION','벤치와 나무를 놓고 건물 하나를 복원해 주세요.',409);
  tx.statements.push(assertSQL(tx.db,garden?'SELECT revision=? FROM garden_worlds WHERE user_id=?':'SELECT NOT EXISTS(SELECT 1 FROM garden_worlds WHERE user_id=?)',...(garden?[garden.revision,userId]:[userId])));
  tx.statements.push(sql(tx.db,'INSERT INTO garden_invitations(owner_id,ready_at) VALUES(?,?) ON CONFLICT(owner_id) DO NOTHING',userId,tx.now));
  return {player:tx.player,ready:true};
 });
}
export async function shareGardenInvite(env:ApiEnv,userId:string,body:Record<string,unknown>){
 z.object({key:z.string().min(8).max(100)}).strict().parse(body);
 return mutate(env,userId,operationKey(body),'garden-invite:share',async tx=>{
  const [event,member]=await Promise.all([inviteRow(env,userId),membership(tx.db,userId)]);
  ensure(event,'GARDEN_INVITE_PREPARATION','먼저 정원 초대 준비를 완료해 주세요.',409);
  ensure(member,'NOT_IN_GUILD','길드에 가입하면 채팅에 정원을 공유할 수 있어요.',409);
  ensure(!event.shared_at||tx.now-event.shared_at>=GARDEN_INVITE_SHARE_COOLDOWN,'GARDEN_INVITE_SHARE_COOLDOWN','정원 초대장은 1분에 한 번 보낼 수 있어요.',429);
  const message={id:uid(),userId,nickname:tx.player.nickname,text:'내 정원에 놀러 와!',createdAt:tx.now,gardenInvite:{ownerId:userId}};
  tx.statements.push(assertSQL(tx.db,'SELECT guild_id=? FROM guild_members WHERE user_id=?',member.guild_id,userId),assertSQL(tx.db,'SELECT shared_at IS ? FROM garden_invitations WHERE owner_id=?',event.shared_at,userId));
  tx.statements.push(sql(tx.db,'INSERT INTO chat_messages VALUES(?,?,?,?,?,?)',message.id,member.guild_id,userId,message.nickname,message.text,tx.now),sql(tx.db,'INSERT INTO garden_invitation_shares VALUES(?,?)',message.id,userId),sql(tx.db,'UPDATE garden_invitations SET shared_at=? WHERE owner_id=?',tx.now,userId));
  tx.notify(member.guild_id,{type:'chat'});return {player:tx.player,message,sharedAt:tx.now};
 });
}
/** A separate acknowledgement is sent only after the real map has rendered visibly. */
export async function recordGardenInviteVisit(env:ApiEnv,visitorId:string,body:Record<string,unknown>){
 const {ownerId}=z.object({ownerId:z.string().uuid()}).strict().parse(body);
 if(ownerId===visitorId)return {counted:false};
 await visitGarden(env,visitorId,ownerId); // Reuse the existing privacy, block and age checks.
 const now=Date.now(),results=await env.DB.batch([
  sql(env.DB,`INSERT INTO garden_invitation_visits(owner_id,visitor_id,day,created_at)
   SELECT owner_id,?,?,? FROM garden_invitations WHERE owner_id=? AND shared_at IS NOT NULL
   AND EXISTS(SELECT 1 FROM players WHERE id=? AND deleted_at IS NULL)
   AND NOT EXISTS(SELECT 1 FROM blocks WHERE (user_id=? AND blocked_id=?) OR (user_id=? AND blocked_id=?))
   ON CONFLICT(owner_id,visitor_id,day) DO NOTHING`,visitorId,day(now+9*3_600_000),now,ownerId,ownerId,ownerId,visitorId,visitorId,ownerId),
  sql(env.DB,'UPDATE garden_invitations SET visitors=visitors+1 WHERE owner_id=? AND changes()=1 RETURNING visitors',ownerId)
 ]);
 return {counted:results[1]!.results.length>0};
}
export async function claimGardenInvite(env:ApiEnv,userId:string,body:Record<string,unknown>){
 const {stage,key}=z.object({stage:z.number().int().min(1).max(GARDEN_INVITE_STAGES.length),key:z.string().min(8).max(100)}).strict().parse(body);
 return mutate(env,userId,key,'garden-invite:claim:'+stage,async tx=>{
  const event=await inviteRow(env,userId),prize=GARDEN_INVITE_STAGES[stage-1]!;
  ensure(event,'GARDEN_INVITE_PREPARATION','먼저 정원 초대 준비를 완료해 주세요.',409);
  if(event.claimed_stages>=stage)return {player:tx.player,granted:false,stage};
  ensure(event.claimed_stages===stage-1,'GARDEN_INVITE_STAGE_ORDER','앞 단계의 선물부터 받아 주세요.',409);
  ensure(event.visitors>=prize.visitors,'GARDEN_INVITE_NOT_READY','아직 방문객이 부족해요.',409);
  tx.statements.push(assertSQL(tx.db,'SELECT claimed_stages=? AND visitors>=? FROM garden_invitations WHERE owner_id=?',stage-1,prize.visitors,userId),sql(tx.db,'UPDATE garden_invitations SET claimed_stages=? WHERE owner_id=?',stage,userId));
  tx.player.coins+=prize.reward.coins;
  for(const [id,n]of Object.entries(prize.reward.items))tx.player.inventory[id as keyof typeof tx.player.inventory].normal+=n!;
  if(prize.decoration)await grantEventDecoration(tx,prize.decoration,'invite-starlight-v1');
  return {player:tx.player,granted:true,stage,reward:prize.reward,decoration:prize.decoration};
 });
}
