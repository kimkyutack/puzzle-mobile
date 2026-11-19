import { z } from 'zod';
import {APP_LOCALES,type AuthResponse,type Player} from '@garden/contracts';
import { exchangeAppleAuthorizationCode, sealAppleRevocationToken, verifyAppleIdentityNotification, verifyIdentity } from './providers';
import { boundedText } from './validation';
import { eraseAccount } from './account-erasure';
import {profileAppearanceSchema} from './profile-appearance';
import { accountAge, ageAdmissionStatements, approvedAdmission, requireAgeAccess } from './age-access';
import { activeRun, assertSQL, digest, ensure, mutate, newPlayer, one, operationKey, readPlayer, readState, rows, sql, uid, type ApiEnv } from './db';

import type { AgeBand } from '../../../packages/contracts/src/age-access';

export interface AppSession {id:string;user_id:string;ops_data?:string;controls_data?:string;age_band:AgeBand|null;age_verified_at:number|null}
export async function authenticate(request:Request,env:ApiEnv,limit?:{maximum:number;seconds:number}){
  const token=request.headers.get('authorization')?.replace(/^Bearer /,'');ensure(token && token.length<300,'UNAUTHORIZED','다시 연결해 주세요.',401);
  const hash=await digest(token),now=Date.now(),query=sql(env.DB,`SELECT s.id,s.user_id,o.data ops_data,c.data controls_data,a.band age_band,a.verified_at age_verified_at FROM sessions s LEFT JOIN ops_settings o ON o.key='runtime' LEFT JOIN ops_user_controls c ON c.user_id=s.user_id LEFT JOIN account_age_access a ON a.user_id=s.user_id WHERE s.access_hash=? AND s.access_expires>? AND s.revoked=0`,hash,now);
  if(limit){
    const window=Math.floor(now/(limit.seconds*1000));
    // Invalid or revoked tokens cannot increment a user's rate counter.
    const [sessionResult,rateResult]=await env.DB.batch<AppSession|{hits:number}>([query,sql(env.DB,`INSERT INTO rate_limits(key,window,hits,expires_at)
      SELECT 'user:'||user_id,?,1,? FROM sessions WHERE access_hash=? AND access_expires>? AND revoked=0
      ON CONFLICT(key,window) DO UPDATE SET hits=hits+1 RETURNING hits`,window,(window+1)*limit.seconds*1000,hash,now),sql(env.DB,`INSERT INTO player_activity(user_id,last_seen,platform,app_version) SELECT s.user_id,?,?,? FROM sessions s LEFT JOIN account_age_access a ON a.user_id=s.user_id WHERE s.access_hash=? AND s.access_expires>? AND s.revoked=0 AND (a.verified_at IS NOT NULL OR (a.user_id IS NULL AND ?=0)) ON CONFLICT(user_id) DO UPDATE SET last_seen=excluded.last_seen,platform=excluded.platform,app_version=excluded.app_version WHERE player_activity.last_seen<?`,now,(request.headers.get('x-app-platform')??'').slice(0,30),(request.headers.get('x-app-version')??'').slice(0,40),hash,now,requireAgeAccess(env)?1:0,now-300000)]);
    const session=sessionResult!.results[0],rate=rateResult!.results[0];
    ensure(session&&'user_id' in session,'UNAUTHORIZED','세션이 만료되었습니다.',401);
    ensure(rate&&'hits' in rate&&rate.hits<=limit.maximum,'RATE_LIMIT','요청이 많아요. 잠시 후 다시 시도해 주세요.',429);return session;
  }
  const session=await query.first<AppSession>();
  ensure(session,'UNAUTHORIZED','세션이 만료되었습니다.',401);return session;
}
async function sessionStatement(env:ApiEnv,userId:string,now:number,tokens={accessToken:uid()+uid(),refreshToken:uid()+uid()}){
  const {accessToken,refreshToken}=tokens;
  return {accessToken,refreshToken,statement:sql(env.DB,'INSERT INTO sessions VALUES(?,?,?,?,?,?,0)',uid(),userId,await digest(accessToken),await digest(refreshToken),now+3_600_000,now+30*86_400_000)};
}
export async function guest(env:ApiEnv,body:Record<string,unknown>={},ageRequired=requireAgeAccess(env)):Promise<AuthResponse>{
  ensure(body.ageToken!==undefined||!ageRequired,'AGE_ACCESS_REQUIRED','이용 전에 연령 확인을 완료해 주세요.',403);
  const enrollment=body.ageToken===undefined?null:await approvedAdmission(env,body.ageToken,null);
  const now=Date.now();
  const enrollmentTokens=async(token:string,nonce:string)=>({accessToken:await digest('garden:admission:access:'+token+nonce),refreshToken:await digest('garden:admission:refresh:'+token+nonce)});
  async function resumeGuest({row,token}:NonNullable<typeof enrollment>){
    const userId=row.result_user_id;
    ensure(userId&&row.retry_nonce,'AGE_REQUEST_CLOSED','이미 사용한 요청이에요. 앱을 다시 열어 주세요.',409);
    const tokens=await enrollmentTokens(token,row.retry_nonce);
    const session=await one(env.DB,'SELECT id FROM sessions WHERE user_id=? AND refresh_hash=? AND access_hash=? AND revoked=0',userId,await digest(tokens.refreshToken),await digest(tokens.accessToken));
    ensure(session,'AGE_REQUEST_CLOSED','이미 사용한 요청이에요. 앱을 다시 열어 주세요.',409);
    return {...await readState(env.DB,userId),...tokens};
  }
  if(enrollment?.row.consumed_at!=null)return resumeGuest(enrollment);
  const retryNonce=enrollment?uid():null;
  const tokens=enrollment&&retryNonce?await enrollmentTokens(enrollment.token,retryNonce):undefined;
  const player=newPlayer(uid(),now);const session=await sessionStatement(env,player.id,now,tokens);
  try{
  await env.DB.batch([sql(env.DB,'INSERT INTO players(id,data,version,created_at) VALUES(?,?,1,?)',player.id,JSON.stringify(player),now),session.statement,
    sql(env.DB,'INSERT INTO ledger VALUES(?,?,?,?,?,?,?)',uid(),player.id,'coins',500,'guest:create',player.id,now),sql(env.DB,'INSERT INTO ledger VALUES(?,?,?,?,?,?,?)',uid(),player.id,'hearts',5,'guest:create',player.id,now),
    ...Object.entries(player.inventory).map(([item,count])=>sql(env.DB,'INSERT INTO ledger VALUES(?,?,?,?,?,?,?)',uid(),player.id,`item:${item}:normal`,count.normal,'tutorial:grant',player.id,now)),
    ...(enrollment?ageAdmissionStatements(env,enrollment.row,player.id,now,retryNonce):[])]);
  }catch(error){
    if(enrollment){const retry=await approvedAdmission(env,enrollment.token,null);if(retry.row.consumed_at!==null)return resumeGuest(retry);}
    throw error;
  }
  return {player,activeRun:null,accessToken:session.accessToken,refreshToken:session.refreshToken};
}
export async function refresh(env:ApiEnv,body:Record<string,unknown>){
  const token=z.string().min(20).max(300).parse(body.refreshToken);const now=Date.now();
  const session=await one<{id:string;user_id:string}>(env.DB,'SELECT id,user_id FROM sessions WHERE refresh_hash=? AND refresh_expires>? AND revoked=0',await digest(token),now);
  ensure(session,'UNAUTHORIZED','세션이 만료되었습니다. 다시 로그인해 주세요.',401);
  const accessToken=uid()+uid();
  const age=await accountAge(env,session.user_id);
  const state=age?.verified_at||(!age&&!requireAgeAccess(env))?await readState(env.DB,session.user_id,now):null;
  await sql(env.DB,'UPDATE sessions SET access_hash=?,access_expires=? WHERE id=? AND revoked=0',await digest(accessToken),now+3_600_000,session.id).run();
  return {accessToken,refreshToken:token,...state};
}
export async function profile(env:ApiEnv,userId:string,body:Record<string,unknown>){
  const settings=z.object({sound:z.boolean().optional(),music:z.boolean().optional(),haptics:z.boolean().optional(),reducedMotion:z.boolean().optional(),language:z.enum(APP_LOCALES).optional()}).strict().optional().parse(body.settings);
  const nickname=z.string().trim().min(2).max(20).regex(/^[\p{L}\p{N} _-]+$/u).optional().parse(body.nickname);
  const tutorials=z.array(z.string().min(1).max(60)).max(100).optional().parse(body.tutorials);
  const profileAppearance=profileAppearanceSchema.optional().parse(body.profileAppearance);
  return mutate(env,userId,operationKey(body)||uid(),`profile:${JSON.stringify({settings,nickname,tutorials,profileAppearance})}`,tx=>{
    if(nickname)tx.player.nickname=nickname;if(settings)Object.assign(tx.player.settings,settings);if(tutorials)tx.player.tutorials=[...new Set(tutorials)];
    if(profileAppearance)tx.player.profileAppearance=profileAppearance;
    return {player:tx.player};
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
  const age=await accountAge(env,row.to_user);
  const state=age?.verified_at||(!age&&!requireAgeAccess(env))?await readState(env.DB,row.to_user,now):null;
  const session=await sessionStatement(env,row.to_user,now);
  await env.DB.batch([assertSQL(env.DB,'SELECT consumed=0 AND expires_at>? FROM account_switches WHERE token_hash=?',now,hash),sql(env.DB,'UPDATE account_switches SET consumed=1 WHERE token_hash=?',hash),session.statement,sql(env.DB,'UPDATE sessions SET revoked=1 WHERE user_id=?',userId),sql(env.DB,'DELETE FROM tx_assertions')]);
  return {...state,accessToken:session.accessToken,refreshToken:session.refreshToken};
}
export async function deleteAccount(env:ApiEnv,userId:string,body:Record<string,unknown>){
  ensure(body.confirm==='DELETE'||body.confirmation==='DELETE','DELETE_CONFIRMATION','계정 삭제 확인 문구가 필요합니다.');
  return eraseAccount(env,userId);
}
export async function links(env:ApiEnv,userId:string){return {providers:await rows<{provider:string}>(env.DB,'SELECT provider FROM auth_links WHERE user_id=?',userId)};}

export async function appleIdentityNotification(env:ApiEnv,body:Record<string,unknown>){
  const verified=await verifyAppleIdentityNotification(z.string().min(20).max(32768).parse(body.payload),env);
  await sql(env.DB,`INSERT INTO external_events(provider,event_id,payload,created_at) SELECT 'apple-identity',?,?,?
    WHERE EXISTS(SELECT 1 FROM auth_links WHERE provider='apple' AND subject=? UNION SELECT 1 FROM apple_authorizations WHERE subject=?)
    ON CONFLICT DO NOTHING`,verified.eventId,JSON.stringify(verified),Date.now(),verified.subject,verified.subject).run();
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
  statements.push(sql(env.DB,"UPDATE external_events SET processed=1,payload='{}' WHERE provider='apple-identity' AND event_id=?",eventId));await env.DB.batch(statements);
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
