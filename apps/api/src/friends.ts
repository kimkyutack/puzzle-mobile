import type {FriendProfile,FriendRelation,FriendsResponse,Gift,FriendHeartRequest} from '@garden/contracts';
import {z} from 'zod';
import {assertSQL,day,ensure,mutate,one,operationKey,readPlayer,rows,sql,uid,type ApiEnv,type MutationContext} from './db';

const COOLDOWN=14_400_000,DAILY_HEARTS=10,MAX_FRIENDS=200;
const pair=(a:string,b:string)=>a<b?[a,b]:[b,a];
export const unblockedSQL=`NOT EXISTS(SELECT 1 FROM blocks b WHERE (b.user_id=? AND b.blocked_id=?) OR (b.user_id=? AND b.blocked_id=?))`;
const targetSchema=z.string().uuid();
async function relation(db:D1Database,me:string,target:string):Promise<FriendRelation>{
 if(me===target)return 'self';
 if(await one(db,'SELECT 1 FROM blocks WHERE (user_id=? AND blocked_id=?) OR (user_id=? AND blocked_id=?)',me,target,target,me))return 'blocked';
 const row=await one<{status:string;requested_by:string}>(db,'SELECT status,requested_by FROM friendships WHERE user_low=? AND user_high=?',...pair(me,target));
 return !row?'none':row.status==='accepted'?'friend':row.requested_by===me?'outgoing':'incoming';
}
const profileSelect=`SELECT p.id userId,json_extract(p.data,'$.nickname') nickname,p.level,COALESCE(s.highest_level,0) highestClear,g.name guildName
 FROM players p LEFT JOIN ranking_scores s ON s.user_id=p.id LEFT JOIN guilds g ON g.id=p.guild_id`;
export async function publicProfile(env:ApiEnv,userId:string,target:string){
 target=targetSchema.parse(target);
 const profile=await one<Omit<FriendProfile,'relation'>>(env.DB,profileSelect+' WHERE p.id=? AND p.deleted_at IS NULL',target);
 ensure(profile,'PLAYER_NOT_FOUND','정원사를 찾을 수 없어요.',404);
 const state=await relation(env.DB,userId,target);ensure(state!=='blocked','PLAYER_UNAVAILABLE','이 정원사와 교류할 수 없어요.',403);
 return {profile:{...profile,relation:state} satisfies FriendProfile};
}
async function allowed(tx:MutationContext,target:string){
 ensure(target!==tx.player.id,'INVALID_TARGET','자신에게 친구 요청을 보낼 수 없어요.');
 const other=await readPlayer(tx.db,target,tx.now);
 ensure(await relation(tx.db,tx.player.id,target)!=='blocked','PLAYER_UNAVAILABLE','이 정원사와 교류할 수 없어요.',403);
 tx.touch(other); // Both endpoints serialize pair changes and support limits.
 tx.statements.push(assertSQL(tx.db,unblockedSQL,tx.player.id,target,target,tx.player.id));
 return other;
}
export async function requestFriend(env:ApiEnv,userId:string,body:Record<string,unknown>){
 const target=targetSchema.parse(body.userId);
 return mutate(env,userId,operationKey(body),'friend:request:'+target,async tx=>{
  await allowed(tx,target);const state=await relation(tx.db,userId,target);
  if(state==='friend'||state==='outgoing')return {relation:state};
  ensure(state==='none','FRIEND_REQUEST_EXISTS','받은 친구 요청을 먼저 확인해 주세요.',409);
  for(const id of [userId,target]){const count=await one<{n:number}>(tx.db,'SELECT COUNT(*) n FROM friendships WHERE user_low=? OR user_high=?',id,id);ensure((count?.n??0)<MAX_FRIENDS,'FRIENDS_FULL','친구와 대기 중인 요청은 최대 200명까지예요.',409);}
  const sent=await one<{n:number}>(tx.db,"SELECT COUNT(*) n FROM operations WHERE user_id=? AND fingerprint LIKE 'friend:request:%' AND created_at>=?",userId,day(tx.now)*86_400_000);
  ensure((sent?.n??0)<20,'FRIEND_REQUEST_LIMIT','오늘의 친구 요청을 모두 보냈어요.',409);
  tx.statements.push(sql(tx.db,"INSERT INTO friendships VALUES(?,?,?,'pending',?,NULL)",...pair(userId,target),userId,tx.now));
  return {relation:'outgoing' as const};
 });
}
export async function respondFriend(env:ApiEnv,userId:string,body:Record<string,unknown>){
 const target=targetSchema.parse(body.userId),accept=z.boolean().parse(body.accept);
 return mutate(env,userId,operationKey(body),`friend:respond:${target}:${accept}`,async tx=>{
  await allowed(tx,target);const state=await relation(tx.db,userId,target);
  if(state==='friend'&&accept)return {relation:'friend' as const};
  ensure(state==='incoming','NO_FRIEND_REQUEST','받은 친구 요청이 없어요.',409);
  tx.statements.push(assertSQL(tx.db,"SELECT status='pending' AND requested_by=? FROM friendships WHERE user_low=? AND user_high=?",target,...pair(userId,target)));
  if(accept)tx.statements.push(sql(tx.db,"UPDATE friendships SET status='accepted',accepted_at=? WHERE user_low=? AND user_high=?",tx.now,...pair(userId,target)));
  else tx.statements.push(sql(tx.db,'DELETE FROM friendships WHERE user_low=? AND user_high=?',...pair(userId,target)));
  return {relation:accept?'friend' as const:'none' as const};
 });
}
export async function friends(env:ApiEnv,userId:string):Promise<FriendsResponse>{
 const now=Date.now(),today=day(now);
 const pairs=await rows<Omit<FriendProfile,'relation'>&{status:string;requested_by:string}>(env.DB,profileSelect.replace(' FROM players p',',f.status,f.requested_by FROM players p')+` JOIN friendships f ON p.id=CASE WHEN f.user_low=? THEN f.user_high ELSE f.user_low END
 WHERE (f.user_low=? OR f.user_high=?) AND p.deleted_at IS NULL
 AND NOT EXISTS(SELECT 1 FROM blocks b WHERE (b.user_id=? AND b.blocked_id=p.id) OR (b.user_id=p.id AND b.blocked_id=?)) ORDER BY p.level DESC,p.id`,userId,userId,userId,userId,userId);
 const mapped=pairs.map(p=>({userId:p.userId,nickname:p.nickname,level:p.level,highestClear:p.highestClear,guildName:p.guildName,relation:(p.status==='accepted'?'friend':p.requested_by===userId?'outgoing':'incoming') as FriendRelation}));
 const recs=await rows<Omit<FriendProfile,'relation'>>(env.DB,profileSelect+` WHERE p.deleted_at IS NULL AND p.id<>?
 AND NOT EXISTS(SELECT 1 FROM friendships f WHERE (f.user_low=? AND f.user_high=p.id) OR (f.user_high=? AND f.user_low=p.id))
 AND NOT EXISTS(SELECT 1 FROM blocks b WHERE (b.user_id=? AND b.blocked_id=p.id) OR (b.user_id=p.id AND b.blocked_id=?))
 ORDER BY (p.guild_id IS NOT NULL AND p.guild_id=(SELECT guild_id FROM players WHERE id=?)) DESC,ABS(p.level-(SELECT level FROM players WHERE id=?)),p.created_at DESC,p.id LIMIT 12`,userId,userId,userId,userId,userId,userId,userId);
 const latest=await one<{id:string;created_at:number}>(env.DB,'SELECT id,created_at FROM friend_heart_requests WHERE user_id=? ORDER BY created_at DESC LIMIT 1',userId);
 const requests=await rows<FriendHeartRequest>(env.DB,`SELECT r.id,r.user_id userId,json_extract(p.data,'$.nickname') nickname,r.received,5 maximum,r.expires_at expiresAt,
 EXISTS(SELECT 1 FROM friend_heart_help h WHERE h.request_id=r.id AND h.sender_id=?) helped
 FROM friend_heart_requests r JOIN players p ON p.id=r.user_id AND p.deleted_at IS NULL
 WHERE r.expires_at>? AND (r.user_id=? OR (r.received<5 AND EXISTS(SELECT 1 FROM friendships f WHERE f.status='accepted' AND ((f.user_low=? AND f.user_high=r.user_id) OR (f.user_high=? AND f.user_low=r.user_id)))
 AND NOT EXISTS(SELECT 1 FROM blocks b WHERE (b.user_id=? AND b.blocked_id=r.user_id) OR (b.user_id=r.user_id AND b.blocked_id=?)))) ORDER BY r.created_at DESC`,userId,now,userId,userId,userId,userId,userId);
 const counts=await one<{sent:number;received:number}>(env.DB,'SELECT COALESCE(SUM(sender_id=?),0) sent,COALESCE(SUM(recipient_id=?),0) received FROM friend_heart_help WHERE day=? AND (sender_id=? OR recipient_id=?)',userId,userId,today,userId,userId);
 const gifts=await rows<Gift>(env.DB,"SELECT id,sender_name senderName,kind,quantity,bound,created_at createdAt FROM gifts WHERE user_id=? AND quantity>0 AND source_id LIKE 'friend-heart:%' ORDER BY created_at DESC LIMIT 20",userId);
 const stored=await one<{n:number}>(env.DB,"SELECT COALESCE(SUM(quantity),0) n FROM gifts WHERE user_id=? AND kind='heart' AND bound=0",userId);
 return {friends:mapped.filter(p=>p.relation==='friend'),incoming:mapped.filter(p=>p.relation==='incoming'),outgoing:mapped.filter(p=>p.relation==='outgoing'),recommendations:recs.map(p=>({...p,relation:'none'})),heartRequests:requests.filter(r=>r.userId!==userId).map(r=>({...r,helped:!!r.helped})),myRequest:requests.find(r=>r.userId===userId)??null,gifts,heartNextAt:latest?latest.created_at+COOLDOWN:0,heartsSent:counts?.sent??0,heartsReceived:counts?.received??0,storedHearts:stored?.n??0,nextReset:(today+1)*86_400_000};
}
export async function requestHearts(env:ApiEnv,userId:string,body:Record<string,unknown>){
 return mutate(env,userId,operationKey(body),'friend:hearts:request',async tx=>{
  const friend=await one(tx.db,`SELECT 1 FROM friendships f JOIN players p ON p.id=CASE WHEN f.user_low=? THEN f.user_high ELSE f.user_low END WHERE (f.user_low=? OR f.user_high=?) AND f.status='accepted' AND p.deleted_at IS NULL AND NOT EXISTS(SELECT 1 FROM blocks b WHERE (b.user_id=? AND b.blocked_id=p.id) OR (b.user_id=p.id AND b.blocked_id=?)) LIMIT 1`,userId,userId,userId,userId,userId);
  ensure(friend,'NO_FRIENDS','친구를 추가한 뒤 하트를 요청해 주세요.',409);
  const latest=await one<{created_at:number}>(tx.db,'SELECT created_at FROM friend_heart_requests WHERE user_id=? ORDER BY created_at DESC LIMIT 1',userId);
  const stored=await one<{n:number}>(tx.db,"SELECT COALESCE(SUM(quantity),0) n FROM gifts WHERE user_id=? AND kind='heart' AND bound=0",userId);
  ensure(!latest||tx.now>=latest.created_at+COOLDOWN,'REQUEST_COOLDOWN','하트 요청은 4시간마다 할 수 있어요.',409);ensure((stored?.n??0)<20,'MAILBOX_FULL','보관된 하트를 먼저 사용해 주세요.',409);
  const id=uid();tx.statements.push(sql(tx.db,'INSERT INTO friend_heart_requests VALUES(?,?,0,?,?)',id,userId,tx.now,tx.now+COOLDOWN));return {requestId:id};
 });
}
export async function helpHearts(env:ApiEnv,userId:string,requestId:string,body:Record<string,unknown>){
 requestId=targetSchema.parse(requestId);
 return mutate(env,userId,operationKey(body),'friend:hearts:help:'+requestId,async tx=>{
  const req=await one<{user_id:string;received:number;expires_at:number}>(tx.db,'SELECT * FROM friend_heart_requests WHERE id=?',requestId);
  ensure(req&&req.user_id!==userId&&req.expires_at>tx.now&&req.received<5,'REQUEST_UNAVAILABLE','도울 수 없는 요청이에요.',409);
  await allowed(tx,req.user_id);ensure(await relation(tx.db,userId,req.user_id)==='friend','NOT_FRIENDS','친구의 하트 요청만 도울 수 있어요.',403);
  ensure(!await one(tx.db,'SELECT 1 FROM friend_heart_help WHERE request_id=? AND sender_id=?',requestId,userId),'ALREADY_HELPED','이미 하트를 보냈어요.',409);
  for(const [column,id]of [['sender_id',userId],['recipient_id',req.user_id]]){const count=await one<{n:number}>(tx.db,`SELECT COUNT(*) n FROM friend_heart_help WHERE ${column}=? AND day=?`,id,day(tx.now));ensure((count?.n??0)<DAILY_HEARTS,'SUPPORT_DAILY_LIMIT','오늘 친구에게 주거나 받을 하트 한도에 도달했어요.',409);}
  const stored=await one<{n:number}>(tx.db,"SELECT COALESCE(SUM(quantity),0) n FROM gifts WHERE user_id=? AND kind='heart' AND bound=0",req.user_id);ensure((stored?.n??0)<20,'MAILBOX_FULL','친구의 하트 보관함이 가득해요.',409);
  const giftId=uid();tx.statements.push(assertSQL(tx.db,'SELECT received<5 AND expires_at>? FROM friend_heart_requests WHERE id=?',tx.now,requestId),assertSQL(tx.db,"SELECT status='accepted' FROM friendships WHERE user_low=? AND user_high=?",...pair(userId,req.user_id)),sql(tx.db,"INSERT INTO gifts VALUES(?,?,?,?, 'heart',1,0,?,?)",giftId,req.user_id,userId,tx.player.nickname,`friend-heart:${requestId}:${userId}`,tx.now),sql(tx.db,'INSERT INTO friend_heart_help VALUES(?,?,?,?,?)',requestId,userId,req.user_id,day(tx.now),giftId),sql(tx.db,'UPDATE friend_heart_requests SET received=received+1 WHERE id=?',requestId));
  return {helped:true}; // Helping never consumes the sender's own hearts.
 });
}
