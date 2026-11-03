import { z } from 'zod';
import type { AuthResponse, Player } from '@garden/contracts';
import { exchangeAppleAuthorizationCode, sealAppleRevocationToken, verifyAppleIdentityNotification, verifyIdentity } from './providers';
import { boundedText } from './validation';
import { activeRun, assertSQL, digest, ensure, mutate, newPlayer, one, operationKey, readPlayer, rows, sql, uid, type ApiEnv } from './db';

export async function authenticate(request:Request,env:ApiEnv){
  const token=request.headers.get('authorization')?.replace(/^Bearer /,'');ensure(token && token.length<300,'UNAUTHORIZED','다시 연결해 주세요.',401);
  const session=await one<{user_id:string;id:string}>(env.DB,'SELECT id,user_id FROM sessions WHERE access_hash=? AND access_expires>? AND revoked=0',await digest(token),Date.now());
  ensure(session,'UNAUTHORIZED','세션이 만료되었습니다.',401);return session;
}
async function sessionStatement(env:ApiEnv,userId:string,now:number){
  const accessToken=uid()+uid();const refreshToken=uid()+uid();
  return {accessToken,refreshToken,statement:sql(env.DB,'INSERT INTO sessions VALUES(?,?,?,?,?,?,0)',uid(),userId,await digest(accessToken),await digest(refreshToken),now+3_600_000,now+30*86_400_000)};
}
export async function guest(env:ApiEnv):Promise<AuthResponse>{
  const now=Date.now();const player=newPlayer(uid(),now);const session=await sessionStatement(env,player.id,now);
  await env.DB.batch([sql(env.DB,'INSERT INTO players(id,data,version,created_at) VALUES(?,?,1,?)',player.id,JSON.stringify(player),now),session.statement,
    sql(env.DB,'INSERT INTO ledger VALUES(?,?,?,?,?,?,?)',uid(),player.id,'coins',500,'guest:create',player.id,now),sql(env.DB,'INSERT INTO ledger VALUES(?,?,?,?,?,?,?)',uid(),player.id,'hearts',5,'guest:create',player.id,now),
    ...Object.entries(player.inventory).map(([item,count])=>sql(env.DB,'INSERT INTO ledger VALUES(?,?,?,?,?,?,?)',uid(),player.id,`item:${item}:normal`,count.normal,'tutorial:grant',player.id,now))]);
  return {player,activeRun:null,accessToken:session.accessToken,refreshToken:session.refreshToken};
}
export async function refresh(env:ApiEnv,body:Record<string,unknown>){
  const token=z.string().min(20).max(300).parse(body.refreshToken);const now=Date.now();
  const session=await one<{id:string;user_id:string}>(env.DB,'SELECT id,user_id FROM sessions WHERE refresh_hash=? AND refresh_expires>? AND revoked=0',await digest(token),now);
  ensure(session,'UNAUTHORIZED','세션이 만료되었습니다. 다시 로그인해 주세요.',401);
  const accessToken=uid()+uid();const player=await readPlayer(env.DB,session.user_id,now);
  await sql(env.DB,'UPDATE sessions SET access_hash=?,access_expires=? WHERE id=? AND revoked=0',await digest(accessToken),now+3_600_000,session.id).run();
  return {accessToken,refreshToken:token,player,activeRun:await activeRun(env.DB,player.id)};
}
export async function profile(env:ApiEnv,userId:string,body:Record<string,unknown>){
  const settings=z.object({sound:z.boolean().optional(),music:z.boolean().optional(),haptics:z.boolean().optional(),reducedMotion:z.boolean().optional(),language:z.enum(['ko','en']).optional()}).strict().optional().parse(body.settings);
  const nickname=z.string().trim().min(2).max(20).regex(/^[\p{L}\p{N} _-]+$/u).optional().parse(body.nickname);
  const tutorials=z.array(z.string().min(1).max(60)).max(100).optional().parse(body.tutorials);
  return mutate(env,userId,operationKey(body)||uid(),`profile:${JSON.stringify({settings,nickname,tutorials})}`,tx=>{
    if(nickname)tx.player.nickname=nickname;if(settings)Object.assign(tx.player.settings,settings);if(tutorials)tx.player.tutorials=[...new Set(tutorials)];return {player:tx.player};
  });
}
export async function challenge(env:ApiEnv,userId:string,body:Record<string,unknown>){
  const provider=z.enum(['google','apple']).parse(body.provider);const nonce=uid()+uid();const challengeId=uid();
  await sql(env.DB,'INSERT INTO auth_challenges(id,user_id,provider,nonce,expires_at,consumed) VALUES(?,?,?,?,?,0)',challengeId,userId,provider,nonce,Date.now()+600_000).run();return {challengeId,nonce};
}
export async function link(env:ApiEnv,userId:string,body:Record<string,unknown>){
  const provider=z.enum(['google','apple']).parse(body.provider);const idToken=z.string().min(20).max(20_000).optional().parse(body.idToken);const challengeId=z.string().uuid().parse(body.challengeId);
  const fingerprint=`auth:link:${provider}:${challengeId}`;
  const previous=await one<{fingerprint:string;response:string}>(env.DB,'SELECT fingerprint,response FROM operations WHERE user_id=? AND key=?',userId,operationKey(body)||challengeId);
  if(previous){ensure(previous.fingerprint===fingerprint,'IDEMPOTENCY_CONFLICT','이미 사용한 요청 식별자입니다.',409);return JSON.parse(previous.response) as unknown;}
  const challengeRow=await one<{nonce:string;expires_at:number;consumed:number;verified_subject:string|null;sealed_apple_token:string|null}>(env.DB,'SELECT nonce,expires_at,consumed,verified_subject,sealed_apple_token FROM auth_challenges WHERE id=? AND user_id=? AND provider=?',challengeId,userId,provider);
  ensure(challengeRow&&challengeRow.expires_at>Date.now()&&!challengeRow.consumed,'AUTH_CHALLENGE_EXPIRED','로그인을 다시 시작해 주세요.',401);
  ensure(idToken||(provider==='apple'&&challengeRow.verified_subject),'IDENTITY_REQUIRED','공급자 인증을 완료해 주세요.',401);
  const identity=idToken?await verifyIdentity(provider,idToken,challengeRow.nonce,env):{provider,subject:challengeRow.verified_subject!};
  let sealedAppleToken=challengeRow.sealed_apple_token;
  if(provider==='apple'){
    if(challengeRow.verified_subject)ensure(challengeRow.verified_subject===identity.subject,'IDENTITY_MISMATCH','인증 계정이 일치하지 않습니다.',401);
    if(!sealedAppleToken){
      const code=z.string().min(1).max(4096).parse(body.authorizationCode);z.literal('native').parse(body.appleFlow);
      const exchanged=await exchangeAppleAuthorizationCode(code,challengeRow.nonce,env,'native');
      ensure(exchanged.identity.subject===identity.subject,'IDENTITY_MISMATCH','인증 계정이 일치하지 않습니다.',401);
      sealedAppleToken=await sealAppleRevocationToken({subject:identity.subject,clientId:exchanged.clientId,refreshToken:exchanged.refreshToken},env);
      // Store before consuming the challenge: a response retry must not exchange the one-use code again.
      await env.DB.batch([assertSQL(env.DB,'SELECT consumed=0 AND expires_at>? FROM auth_challenges WHERE id=?',Date.now(),challengeId),sql(env.DB,'UPDATE auth_challenges SET verified_subject=?,sealed_apple_token=? WHERE id=?',identity.subject,sealedAppleToken,challengeId),sql(env.DB,'DELETE FROM tx_assertions')]);
    }
  }
  return mutate(env,userId,operationKey(body)||challengeId,fingerprint,async tx=>{
    tx.statements.push(assertSQL(tx.db,'SELECT consumed=0 AND expires_at>? FROM auth_challenges WHERE id=?',tx.now,challengeId),sql(tx.db,'UPDATE auth_challenges SET consumed=1,sealed_apple_token=NULL WHERE id=?',challengeId));
    const existing=await one<{user_id:string}>(tx.db,'SELECT user_id FROM auth_links WHERE provider=? AND subject=?',provider,identity.subject);
    if(existing&&existing.user_id!==userId){
      const other=await readPlayer(tx.db,existing.user_id,tx.now);tx.touch(other);const token=uid()+uid();
      if(sealedAppleToken)tx.statements.push(sql(tx.db,'INSERT INTO apple_authorizations VALUES(?,?,?,?) ON CONFLICT(subject) DO UPDATE SET user_id=excluded.user_id,sealed_token=excluded.sealed_token,updated_at=excluded.updated_at',identity.subject,other.id,sealedAppleToken,tx.now));
      tx.statements.push(sql(tx.db,'INSERT INTO account_switches VALUES(?,?,?,?,0)',await digest(token),userId,other.id,tx.now+600_000));
      return {player:tx.player,conflict:{current:{nickname:tx.player.nickname,level:tx.player.level},existing:{nickname:other.nickname,level:other.level},switchToken:token},switchToken:token};
    }
    if(!existing)tx.statements.push(sql(tx.db,'INSERT INTO auth_links VALUES(?,?,?,?)',provider,identity.subject,userId,tx.now));
    if(sealedAppleToken)tx.statements.push(sql(tx.db,'INSERT INTO apple_authorizations VALUES(?,?,?,?) ON CONFLICT(subject) DO UPDATE SET user_id=excluded.user_id,sealed_token=excluded.sealed_token,updated_at=excluded.updated_at',identity.subject,userId,sealedAppleToken,tx.now));
    return {player:tx.player,linked:provider};
  });
}
export async function switchAccount(env:ApiEnv,userId:string,body:Record<string,unknown>){
  const token=z.string().min(20).max(300).parse(body.switchToken);const hash=await digest(token);const now=Date.now();
  const row=await one<{to_user:string}>(env.DB,'SELECT to_user FROM account_switches WHERE token_hash=? AND from_user=? AND expires_at>? AND consumed=0',hash,userId,now);
  ensure(row,'SWITCH_EXPIRED','계정 전환 요청이 만료되었어요.',401);
  ensure(!await activeRun(env.DB,userId),'ACTIVE_RUN','진행 중인 퍼즐을 종료한 후 계정을 전환해 주세요.',409);
  const player=await readPlayer(env.DB,row.to_user,now);const session=await sessionStatement(env,player.id,now);
  await env.DB.batch([assertSQL(env.DB,'SELECT consumed=0 AND expires_at>? FROM account_switches WHERE token_hash=?',now,hash),sql(env.DB,'UPDATE account_switches SET consumed=1 WHERE token_hash=?',hash),session.statement,sql(env.DB,'UPDATE sessions SET revoked=1 WHERE user_id=?',userId),sql(env.DB,'DELETE FROM tx_assertions')]);
  return {player,activeRun:await activeRun(env.DB,player.id),accessToken:session.accessToken,refreshToken:session.refreshToken};
}
export async function deleteAccount(env:ApiEnv,userId:string,body:Record<string,unknown>){
  ensure(body.confirm==='DELETE'||body.confirmation==='DELETE','DELETE_CONFIRMATION','계정 삭제 확인 문구가 필요합니다.');
  return mutate(env,userId,operationKey(body)||uid(),`account:delete`,async tx=>{
    const missingApple=await one(tx.db,"SELECT 1 FROM auth_links l LEFT JOIN apple_authorizations a ON a.subject=l.subject AND a.user_id=l.user_id WHERE l.user_id=? AND l.provider='apple' AND a.subject IS NULL",userId);
    ensure(!missingApple,'APPLE_REAUTH_REQUIRED','Apple 계정을 한 번 더 연결한 뒤 삭제해 주세요. Apple 인증도 함께 해제하기 위해 필요합니다.',409);
    const tokens=await rows<{sealed_token:string}>(tx.db,'SELECT sealed_token FROM apple_authorizations WHERE user_id=? UNION ALL SELECT sealed_apple_token sealed_token FROM auth_challenges WHERE user_id=? AND sealed_apple_token IS NOT NULL',userId,userId);
    for(const token of tokens)tx.statements.push(sql(tx.db,"INSERT INTO outbox(id,topic,payload,created_at) VALUES(?,'$apple-revoke',?,?)",uid(),JSON.stringify({sealedToken:token.sealed_token}),tx.now));
    const membership=await one<{guild_id:string;role:string}>(tx.db,'SELECT guild_id,role FROM guild_members WHERE user_id=?',userId);
    if(membership?.role==='leader'){
      const successor=await one<{user_id:string}>(tx.db,'SELECT user_id FROM guild_members WHERE guild_id=? AND user_id<>? ORDER BY joined_at LIMIT 1',membership.guild_id,userId);
      if(successor)tx.statements.push(sql(tx.db,"UPDATE guild_members SET role='leader' WHERE user_id=?",successor.user_id));
    }
    tx.player.nickname='삭제된 정원사';tx.player.guildId=null;
    for(const table of ['activity_counters','activity_days','mission_claims','clear_milestones','treasure_attempts'])tx.statements.push(sql(tx.db,`DELETE FROM ${table} WHERE user_id=?`,userId));
    tx.statements.push(sql(tx.db,'DELETE FROM story_seen WHERE user_id=?',userId),sql(tx.db,'DELETE FROM garden_styles WHERE user_id=?',userId),sql(tx.db,'DELETE FROM garden_worlds WHERE user_id=?',userId));
    tx.statements.push(sql(tx.db,'DELETE FROM apple_authorizations WHERE user_id=?',userId),sql(tx.db,'DELETE FROM auth_challenges WHERE user_id=?',userId));
    tx.statements.push(sql(tx.db,'UPDATE players SET deleted_at=? WHERE id=?',tx.now,userId),sql(tx.db,'UPDATE sessions SET revoked=1 WHERE user_id=?',userId),sql(tx.db,'DELETE FROM auth_links WHERE user_id=?',userId),sql(tx.db,'DELETE FROM guild_members WHERE user_id=?',userId),sql(tx.db,'DELETE FROM guild_applications WHERE user_id=?',userId),sql(tx.db,'UPDATE support_requests SET closed=1 WHERE user_id=?',userId),sql(tx.db,"UPDATE chat_messages SET nickname='삭제된 정원사',text='삭제된 메시지' WHERE user_id=?",userId));
    return {deleted:true,identityRevocation:tokens.length?'pending':'not_needed'};
  });
}
export async function links(env:ApiEnv,userId:string){return {providers:await rows<{provider:string}>(env.DB,'SELECT provider FROM auth_links WHERE user_id=?',userId)};}

export async function appleIdentityNotification(env:ApiEnv,body:Record<string,unknown>){
  const verified=await verifyAppleIdentityNotification(z.string().min(20).max(32768).parse(body.payload),env);
  await sql(env.DB,"INSERT INTO external_events(provider,event_id,payload,created_at) VALUES('apple-identity',?,?,?) ON CONFLICT DO NOTHING",verified.eventId,JSON.stringify(verified),Date.now()).run();
  await processAppleIdentityNotification(env,verified.eventId);return {received:true};
}
export async function processAppleIdentityNotification(env:ApiEnv,eventId:string){
  const record=await one<{payload:string;processed:number}>(env.DB,"SELECT payload,processed FROM external_events WHERE provider='apple-identity' AND event_id=?",eventId);if(!record||record.processed)return;
  const event=JSON.parse(record.payload) as Awaited<ReturnType<typeof verifyAppleIdentityNotification>>;
  const statements:D1PreparedStatement[]=[];
  if(event.type==='consent-revoked'||event.type==='account-deleted'){
    // Apple event timestamps have one-second precision. A later authorization is preserved.
    const cutoff=event.eventTime+999;
    statements.push(sql(env.DB,"UPDATE sessions SET revoked=1 WHERE user_id IN (SELECT l.user_id FROM auth_links l LEFT JOIN apple_authorizations a ON a.subject=l.subject WHERE l.provider='apple' AND l.subject=? AND coalesce(a.updated_at,l.created_at)<=?)",event.subject,cutoff),sql(env.DB,"DELETE FROM auth_links WHERE provider='apple' AND subject=? AND created_at<=? AND NOT EXISTS(SELECT 1 FROM apple_authorizations a WHERE a.subject=auth_links.subject AND a.updated_at>?)",event.subject,cutoff,cutoff),sql(env.DB,'DELETE FROM apple_authorizations WHERE subject=? AND updated_at<=?',event.subject,cutoff));
  }
  statements.push(sql(env.DB,"UPDATE external_events SET processed=1 WHERE provider='apple-identity' AND event_id=?",eventId));await env.DB.batch(statements);
}

export async function appleCallback(env:ApiEnv,request:Request){
  const raw=await boundedText(request,16_384);
  const params=new URLSearchParams(raw);const state=z.string().uuid().parse(params.get('state'));const code=z.string().min(1).max(4096).parse(params.get('code'));
  const record=await one<{nonce:string}>(env.DB,"SELECT nonce FROM auth_challenges WHERE id=? AND provider='apple' AND consumed=0 AND expires_at>? AND verified_subject IS NULL",state,Date.now());ensure(record,'AUTH_CHALLENGE_EXPIRED','인증 요청이 만료되었습니다.',401);
  const exchanged=await exchangeAppleAuthorizationCode(code,record.nonce,env);const identity=exchanged.identity;
  const sealedToken=await sealAppleRevocationToken({subject:identity.subject,clientId:exchanged.clientId,refreshToken:exchanged.refreshToken},env);
  await env.DB.batch([assertSQL(env.DB,'SELECT consumed=0 AND expires_at>? AND verified_subject IS NULL FROM auth_challenges WHERE id=?',Date.now(),state),sql(env.DB,'UPDATE auth_challenges SET verified_subject=?,sealed_apple_token=? WHERE id=?',identity.subject,sealedToken,state),sql(env.DB,'DELETE FROM tx_assertions')]);
  return new Response(null,{status:303,headers:{Location:`cloudgarden://auth?success=true&state=${state}`,'Cache-Control':'no-store','Referrer-Policy':'no-referrer'}});
}
