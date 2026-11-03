import type { Booster, ChatMessage, Guild, GuildMember, SupportRequest } from '@garden/contracts';
import { z } from 'zod';
import { assertSQL, day, digest, ensure, mutate, one, operationKey, readPlayer, rows, spendItem, sql, uid, type ApiEnv, type MutationContext } from './db';
import { boosterSchema } from './validation';

type MemberRow={guild_id:string;role:GuildMember['role'];user_id:string;contribution:number;joined_at:number};
type GuildRow={id:string;name:string;description:string;notice:string;mode:Guild['mode'];min_level:number;emblem:number;members:number};
function mapGuild(g:GuildRow){return {id:g.id,name:g.name,description:g.description,notice:g.notice,mode:g.mode,minLevel:g.min_level,emblem:g.emblem,members:g.members};}
export async function membership(db:D1Database,userId:string){return one<MemberRow>(db,'SELECT * FROM guild_members WHERE user_id=?',userId);}
async function needGuild(tx:MutationContext){const m=await membership(tx.db,tx.player.id);ensure(m,'NOT_IN_GUILD','먼저 길드에 가입해 주세요.');tx.statements.push(assertSQL(tx.db,'SELECT guild_id=? FROM guild_members WHERE user_id=?',m.guild_id,tx.player.id));return m;}
function officer(m:MemberRow){ensure(m.role==='leader'||m.role==='officer','GUILD_PERMISSION','길드 운영진만 할 수 있어요.',403);}
export async function searchGuilds(env:ApiEnv,q:string,userId?:string){
  // D1 limits LIKE patterns to 50 bytes; a valid 24-character Hangul name exceeds that.
  // instr keeps substring search literal, including % and _, with the existing ASCII case folding.
  const list=await rows<GuildRow>(env.DB,'SELECT g.*,count(m.user_id) members FROM guilds g LEFT JOIN guild_members m ON g.id=m.guild_id WHERE instr(lower(g.name),lower(?))>0 GROUP BY g.id ORDER BY members DESC,g.created_at LIMIT 50',q.slice(0,32));
  const applications=userId?await rows<{guild_id:string}>(env.DB,'SELECT guild_id FROM guild_applications WHERE user_id=?',userId):[];
  return {guilds:list.map(mapGuild),pendingIds:applications.map(item=>item.guild_id)};
}
export async function guildView(env:ApiEnv,userId:string){
  const m=await membership(env.DB,userId);if(!m)return {guild:null,members:[],requests:[],messages:[],applications:[]};
  const g=await one<GuildRow>(env.DB,'SELECT g.*,count(m.user_id) members FROM guilds g LEFT JOIN guild_members m ON g.id=m.guild_id WHERE g.id=? GROUP BY g.id',m.guild_id);ensure(g,'GUILD_NOT_FOUND','길드를 찾을 수 없어요.',404);
  const members=await rows<{user_id:string;role:GuildMember['role'];contribution:number;data:string}>(env.DB,'SELECT m.*,p.data FROM guild_members m JOIN players p ON p.id=m.user_id WHERE m.guild_id=? ORDER BY m.joined_at',m.guild_id);
  const requests=await rows<{id:string;user_id:string;data:string;kind:SupportRequest['kind'];received:number;maximum:number;expires_at:number}>(env.DB,'SELECT r.*,p.data FROM support_requests r JOIN players p ON p.id=r.user_id WHERE r.guild_id=? AND r.closed=0 AND r.expires_at>? AND r.received<r.maximum ORDER BY r.created_at DESC',m.guild_id,Date.now());
  const messages=await rows<{id:string;user_id:string;nickname:string;text:string;created_at:number}>(env.DB,'SELECT * FROM chat_messages WHERE guild_id=? AND user_id NOT IN(SELECT blocked_id FROM blocks WHERE user_id=?) ORDER BY created_at DESC LIMIT 50',m.guild_id,userId);
  const applications=m.role==='member'?[]:await rows<{user_id:string;data:string}>(env.DB,'SELECT a.user_id,p.data FROM guild_applications a JOIN players p ON p.id=a.user_id WHERE a.guild_id=? ORDER BY a.created_at',m.guild_id);
  const donations=await rows<{request_id:string}>(env.DB,'SELECT d.request_id FROM donations d JOIN support_requests r ON r.id=d.request_id WHERE d.sender_id=? AND r.guild_id=? AND r.expires_at>?',userId,m.guild_id,Date.now());
  const now=Date.now();
  const cooldowns=await one<{heart:number|null;item:number|null}>(env.DB,"SELECT max(CASE WHEN kind='heart' THEN created_at END) heart,max(CASE WHEN kind<>'heart' THEN created_at END) item FROM support_requests WHERE user_id=?",userId);
  const counts=await one<{heartsSent:number;heartsReceived:number;itemsSent:number;itemsReceived:number}>(env.DB,"SELECT coalesce(sum(sender_id=? AND kind='heart'),0) heartsSent,coalesce(sum(recipient_id=? AND kind='heart'),0) heartsReceived,coalesce(sum(sender_id=? AND kind<>'heart'),0) itemsSent,coalesce(sum(recipient_id=? AND kind<>'heart'),0) itemsReceived FROM donations WHERE day=? AND (sender_id=? OR recipient_id=?)",userId,userId,userId,userId,day(now),userId,userId);
  const stored=await one<{n:number}>(env.DB,"SELECT coalesce(sum(quantity),0) n FROM gifts WHERE user_id=? AND kind='heart' AND bound=0",userId);
  const supportStatus={heartNextAt:cooldowns?.heart?cooldowns.heart+14_400_000:0,itemNextAt:cooldowns?.item?cooldowns.item+14_400_000:0,heartsSent:counts?.heartsSent??0,heartsReceived:counts?.heartsReceived??0,itemsSent:counts?.itemsSent??0,itemsReceived:counts?.itemsReceived??0,storedHearts:stored?.n??0,nextReset:(Math.floor(now/86_400_000)+1)*86_400_000};
  return {guild:mapGuild(g),supportStatus,members:members.map(x=>{const p=JSON.parse(x.data);return {userId:x.user_id,nickname:p.nickname,level:p.level,role:x.role,contribution:x.contribution};}),requests:requests.map(x=>({id:x.id,userId:x.user_id,nickname:JSON.parse(x.data).nickname,kind:x.kind,received:x.received,maximum:x.maximum,expiresAt:x.expires_at,helped:donations.some(d=>d.request_id===x.id)})),messages:messages.reverse().map(x=>({id:x.id,userId:x.user_id,nickname:x.nickname,text:x.text,createdAt:x.created_at})),applications:applications.map(x=>({userId:x.user_id,nickname:JSON.parse(x.data).nickname,level:JSON.parse(x.data).level}))};
}
export async function createGuild(env:ApiEnv,userId:string,body:Record<string,unknown>){
  const input=z.object({name:z.string().trim().min(2).max(24),description:z.string().trim().max(160).default('함께 정원을 가꾸어요.'),mode:z.enum(['open','approval']).default('open'),minLevel:z.number().int().min(5).max(10000).default(5),emblem:z.number().int().min(0).max(7).default(0)}).parse(body);
  return mutate(env,userId,operationKey(body),`guild:create:${JSON.stringify(input)}`,async tx=>{
    ensure(tx.player.level>=5,'LOCKED','4판을 완료하면 길드가 열려요.');ensure(!tx.player.guildId,'ALREADY_IN_GUILD','이미 길드에 가입했어요.');
    const id=uid();tx.player.guildId=id;
    tx.statements.push(sql(tx.db,'INSERT INTO guilds VALUES(?,?,?,?,?,?,?,?)',id,input.name,input.description,'',input.mode,input.minLevel,input.emblem,tx.now),sql(tx.db,'INSERT INTO guild_members VALUES(?,?,?,?,?)',userId,id,'leader',0,tx.now));
    return {player:tx.player,guild:{id,...input,members:1,notice:''}};
  });
}
export async function joinGuild(env:ApiEnv,userId:string,guildId:string,body:Record<string,unknown>){
  return mutate(env,userId,operationKey(body),`guild:join:${guildId}`,async tx=>{
    ensure(tx.player.level>=5&&!tx.player.guildId,'GUILD_JOIN_UNAVAILABLE','4판 완료 후 길드 하나에 가입할 수 있어요.');
    const g=await one<GuildRow>(tx.db,'SELECT * FROM guilds WHERE id=?',guildId);ensure(g,'GUILD_NOT_FOUND','길드를 찾을 수 없어요.');ensure(tx.player.level>=g.min_level,'GUILD_LEVEL','이 길드의 최소 레벨에 도달하지 못했어요.');
    tx.statements.push(assertSQL(tx.db,'SELECT mode=? AND min_level<=? FROM guilds WHERE id=?',g.mode,tx.player.level,guildId));
    if(g.mode==='approval'){tx.statements.push(sql(tx.db,'INSERT INTO guild_applications VALUES(?,?,?) ON CONFLICT DO NOTHING',guildId,userId,tx.now));return {player:tx.player,pending:true};}
    tx.player.guildId=guildId;tx.statements.push(sql(tx.db,'INSERT INTO guild_members VALUES(?,?,?,?,?)',userId,guildId,'member',0,tx.now),sql(tx.db,'DELETE FROM guild_applications WHERE user_id=?',userId));tx.notify(guildId,{type:'membership'});
    return {player:tx.player,pending:false};
  });
}
export async function approveMember(env:ApiEnv,userId:string,body:Record<string,unknown>){
  const target=z.string().uuid().parse(body.userId);
  return mutate(env,userId,operationKey(body),`guild:approve:${target}`,async tx=>{
    const m=await needGuild(tx);officer(m);const p=await readPlayer(tx.db,target,tx.now);ensure(!p.guildId,'ALREADY_IN_GUILD','상대가 이미 다른 길드에 가입했어요.');
    ensure(await one(tx.db,'SELECT 1 FROM guild_applications WHERE guild_id=? AND user_id=?',m.guild_id,target),'NO_APPLICATION','가입 요청을 찾을 수 없어요.');tx.touch(p);p.guildId=m.guild_id;
    tx.statements.push(assertSQL(tx.db,'SELECT min_level<=? FROM guilds WHERE id=?',p.level,m.guild_id),sql(tx.db,'INSERT INTO guild_members VALUES(?,?,?,?,?)',target,m.guild_id,'member',0,tx.now),sql(tx.db,'DELETE FROM guild_applications WHERE user_id=?',target));tx.notify(m.guild_id,{type:'membership'});return {player:tx.player,approved:true};
  });
}
export async function leaveGuild(env:ApiEnv,userId:string,body:Record<string,unknown>,kick=false){
  const target=kick?z.string().uuid().parse(body.userId):userId;
  return mutate(env,userId,operationKey(body),`guild:${kick?'kick':'leave'}:${target}`,async tx=>{
    const m=await needGuild(tx);if(kick)officer(m);const targetM=await membership(tx.db,target);ensure(targetM&&targetM.guild_id===m.guild_id,'NOT_IN_GUILD','길드 멤버가 아닙니다.');
    if(kick)ensure(targetM.role!=='leader'&&(m.role==='leader'||targetM.role==='member'),'GUILD_PERMISSION','이 멤버를 추방할 수 없어요.',403);
    const p=target===userId?tx.player:await readPlayer(tx.db,target,tx.now);tx.touch(p);p.guildId=null;
    if(targetM.role==='leader'){
      const successor=await one<{user_id:string}>(tx.db,'SELECT user_id FROM guild_members WHERE guild_id=? AND user_id<>? ORDER BY joined_at LIMIT 1',m.guild_id,target);
      if(successor)tx.statements.push(sql(tx.db,"UPDATE guild_members SET role='leader' WHERE user_id=?",successor.user_id));
    }
    tx.statements.push(sql(tx.db,'DELETE FROM guild_members WHERE user_id=?',target),sql(tx.db,'UPDATE support_requests SET closed=1 WHERE user_id=?',target),sql(tx.db,'DELETE FROM guild_applications WHERE user_id=?',target));tx.notify(m.guild_id,{type:'membership'});return {player:tx.player};
  });
}
export async function editGuild(env:ApiEnv,userId:string,body:Record<string,unknown>){
  const input=z.object({description:z.string().max(160).optional(),notice:z.string().max(240).optional(),mode:z.enum(['open','approval']).optional(),minLevel:z.number().int().min(5).max(10000).optional(),emblem:z.number().int().min(0).max(7).optional()}).parse(body);
  return mutate(env,userId,operationKey(body),`guild:edit:${JSON.stringify(input)}`,async tx=>{const m=await needGuild(tx);officer(m);const g=await one<GuildRow>(tx.db,'SELECT * FROM guilds WHERE id=?',m.guild_id);ensure(g,'GUILD_NOT_FOUND','길드를 찾을 수 없어요.');tx.statements.push(sql(tx.db,'UPDATE guilds SET description=?,notice=?,mode=?,min_level=?,emblem=? WHERE id=?',input.description??g.description,input.notice??g.notice,input.mode??g.mode,input.minLevel??g.min_level,input.emblem??g.emblem,m.guild_id));tx.notify(m.guild_id,{type:'guild'});return {player:tx.player};});
}
export async function chat(env:ApiEnv,userId:string,body:Record<string,unknown>){
  const text=z.string().trim().min(1).max(240).parse(body.text);
  return mutate(env,userId,operationKey(body),`guild:chat:${text}`,async tx=>{
    const m=await needGuild(tx);const previous=await one<{created_at:number}>(tx.db,'SELECT created_at FROM chat_messages WHERE user_id=? ORDER BY created_at DESC LIMIT 1',userId);ensure(!previous||tx.now-previous.created_at>=2000,'CHAT_RATE_LIMIT','잠시 후 메시지를 보내 주세요.',429);
    const message:ChatMessage={id:uid(),userId,nickname:tx.player.nickname,text,createdAt:tx.now};
    tx.statements.push(sql(tx.db,'INSERT INTO chat_messages VALUES(?,?,?,?,?,?)',message.id,m.guild_id,userId,message.nickname,text,tx.now));tx.notify(m.guild_id,{type:'chat'});return {message};
  });
}
export async function requestSupport(env:ApiEnv,userId:string,body:Record<string,unknown>){
  const kind=z.enum(['heart','hammer','sweep-row','sweep-column','shuffle']).parse(body.kind);
  return mutate(env,userId,operationKey(body),`guild:request:${kind}`,async tx=>{
    const m=await needGuild(tx);const isHeart=kind==='heart';
    const previous=await one<{created_at:number}>(tx.db,`SELECT created_at FROM support_requests WHERE user_id=? AND ${isHeart?"kind='heart'":"kind<>'heart'"} ORDER BY created_at DESC LIMIT 1`,userId);
    ensure(!previous||tx.now-previous.created_at>=14_400_000,'REQUEST_COOLDOWN','지원 요청은 4시간마다 할 수 있어요.',409);
    if(isHeart){const saved=await one<{n:number}>(tx.db,"SELECT coalesce(sum(quantity),0) n FROM gifts WHERE user_id=? AND kind='heart' AND bound=0",userId);ensure((saved?.n??0)<20,'MAILBOX_FULL','하트 선물함이 가득해요. 보관된 하트를 먼저 사용해 주세요.');}
    const id=uid();tx.statements.push(sql(tx.db,'INSERT INTO support_requests VALUES(?,?,?,?,0,?,?,?,0)',id,m.guild_id,userId,kind,isHeart?5:1,tx.now,tx.now+14_400_000));tx.notify(m.guild_id,{type:'support'});return {player:tx.player,requestId:id};
  });
}
export async function help(env:ApiEnv,userId:string,requestId:string,body:Record<string,unknown>){
  return mutate(env,userId,operationKey(body),`guild:help:${requestId}`,async tx=>{
    const m=await needGuild(tx);const req=await one<{user_id:string;guild_id:string;kind:'heart'|Booster;received:number;maximum:number;expires_at:number;closed:number}>(tx.db,'SELECT * FROM support_requests WHERE id=?',requestId);
    ensure(req&&req.guild_id===m.guild_id&&req.user_id!==userId&&!req.closed&&req.expires_at>tx.now&&req.received<req.maximum,'REQUEST_UNAVAILABLE','지원할 수 없는 요청이에요.',409);
    const recipient=await readPlayer(tx.db,req.user_id,tx.now);ensure(recipient.guildId===m.guild_id,'GUILD_CHANGED','상대가 길드를 떠났어요.',409);tx.touch(recipient);
    ensure(!await one(tx.db,'SELECT 1 FROM donations WHERE request_id=? AND sender_id=?',requestId,userId),'ALREADY_HELPED','이미 도왔어요.',409);
    const isHeart=req.kind==='heart';const kindCondition=isHeart?"kind='heart'":"kind<>'heart'";const today=day(tx.now);const limit=isHeart?10:3;
    const sent=await one<{n:number}>(tx.db,`SELECT count(*) n FROM donations WHERE sender_id=? AND day=? AND ${kindCondition}`,userId,today);
    const received=await one<{n:number}>(tx.db,`SELECT count(*) n FROM donations WHERE recipient_id=? AND day=? AND ${kindCondition}`,recipient.id,today);
    ensure((sent?.n??0)<limit&&(received?.n??0)<limit,'SUPPORT_DAILY_LIMIT','오늘의 지원 또는 받기 한도에 도달했어요.',409);
    if(isHeart){const stored=await one<{n:number}>(tx.db,"SELECT coalesce(sum(quantity),0) n FROM gifts WHERE user_id=? AND kind='heart' AND bound=0",recipient.id);ensure((stored?.n??0)<20,'MAILBOX_FULL','상대의 하트 선물함이 가득해요.');}else spendItem(tx.player,req.kind as Booster,true);
    tx.statements.push(assertSQL(tx.db,'SELECT closed=0 AND expires_at>? AND received<maximum FROM support_requests WHERE id=?',tx.now,requestId),assertSQL(tx.db,'SELECT guild_id=? FROM guild_members WHERE user_id=?',m.guild_id,recipient.id));
    const giftId=uid();tx.statements.push(sql(tx.db,'INSERT INTO gifts VALUES(?,?,?,?,?,1,0,?,?)',giftId,recipient.id,userId,tx.player.nickname,req.kind,`${requestId}:${userId}`,tx.now),sql(tx.db,'INSERT INTO donations VALUES(?,?,?,?,?,?)',requestId,userId,recipient.id,req.kind,today,giftId),sql(tx.db,'UPDATE support_requests SET received=received+1 WHERE id=?',requestId),sql(tx.db,'UPDATE guild_members SET contribution=contribution+1 WHERE user_id=?',userId));
    tx.notify(m.guild_id,{type:'support',giftId});return {player:tx.player,helped:true};
  });
}
export async function block(env:ApiEnv,userId:string,body:Record<string,unknown>){const target=z.string().uuid().parse(body.userId);ensure(target!==userId,'INVALID_TARGET','자신은 차단할 수 없어요.');return mutate(env,userId,operationKey(body),`guild:block:${target}`,tx=>{tx.statements.push(sql(tx.db,'INSERT INTO blocks VALUES(?,?) ON CONFLICT DO NOTHING',userId,target));return {blocked:true};});}
export async function report(env:ApiEnv,userId:string,body:Record<string,unknown>){const messageId=z.string().uuid().parse(body.messageId);const reason=z.string().min(2).max(300).parse(body.reason);return mutate(env,userId,operationKey(body),`guild:report:${messageId}`,async tx=>{const m=await needGuild(tx);ensure(await one(tx.db,'SELECT 1 FROM chat_messages WHERE id=? AND guild_id=?',messageId,m.guild_id),'MESSAGE_NOT_FOUND','메시지를 찾을 수 없어요.');tx.statements.push(sql(tx.db,'INSERT INTO reports VALUES(?,?,?,?,?)',uid(),userId,messageId,reason,tx.now));return {reported:true};});}
export async function socketTicket(env:ApiEnv,userId:string){const m=await membership(env.DB,userId);ensure(m,'NOT_IN_GUILD','길드에 가입해 주세요.');const ticket=uid()+uid();await sql(env.DB,'INSERT INTO socket_tickets VALUES(?,?,?,?,0)',await digest(ticket),userId,m.guild_id,Date.now()+30_000).run();return {ticket};}
export async function changeRole(env:ApiEnv,userId:string,body:Record<string,unknown>){
  const target=z.string().uuid().parse(body.userId);const role=z.enum(['leader','officer','member']).parse(body.role);ensure(target!==userId,'INVALID_TARGET','다른 멤버를 선택해 주세요.');
  return mutate(env,userId,operationKey(body),`guild:role:${target}:${role}`,async tx=>{const m=await needGuild(tx);ensure(m.role==='leader','GUILD_PERMISSION','길드장만 역할을 바꿀 수 있어요.',403);const targetMember=await membership(tx.db,target);ensure(targetMember?.guild_id===m.guild_id,'NOT_IN_GUILD','길드 멤버가 아닙니다.');const p=await readPlayer(tx.db,target,tx.now);tx.touch(p);tx.statements.push(sql(tx.db,'UPDATE guild_members SET role=? WHERE user_id=?',role,target));if(role==='leader')tx.statements.push(sql(tx.db,"UPDATE guild_members SET role='member' WHERE user_id=?",userId));tx.notify(m.guild_id,{type:'membership'});return {player:tx.player};});
}
