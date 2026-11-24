import { z } from 'zod';
import { ageBandAt, type AgeAdmission, type AgeBand } from '../../../packages/contracts/src/age-access';
import { assertSQL, digest, ensure, mutate, one, rateLimit, sql, uid, type ApiEnv, type MutationContext } from './db';
import { compareVersion } from './operations';

export const GUARDIAN_NOTICE_VERSION = 'guardian-email-v1';
const DAY = 86_400_000;
const ADMISSION_WINDOW = 7 * DAY;
const shortWindow = 24 * 3_600_000;
export type AccountAge = { band: AgeBand; verified_at: number | null };
export function publicPlayerAgeSQL(env:ApiEnv) {
  return requireAgeAccess(env)
    ? `EXISTS(SELECT 1 FROM account_age_access a WHERE a.user_id=p.id AND a.band<>'child' AND a.verified_at IS NOT NULL)`
    : `NOT EXISTS(SELECT 1 FROM account_age_access a WHERE a.user_id=p.id AND a.band='child')`;
}

export function requireAgeAccess(env: ApiEnv) {
  const mode=env.AGE_ACCESS_REQUIRED;
  return mode==='true' || (env.ENVIRONMENT==='production'&&mode!=='false'&&mode!=='new-apps');
}

export function requireAgeAccessForRequest(env:ApiEnv, request:Request) {
  if(env.AGE_ACCESS_REQUIRED!=='new-apps')return requireAgeAccess(env);
  const platform=request.headers.get('X-App-Platform'),version=request.headers.get('X-App-Version')??'';
  const minimum=platform==='ios'?'1.16':platform==='android'?'1.12':null;
  return minimum!==null&&/^\d+(?:\.\d+){0,3}$/.test(version)&&compareVersion(version,minimum)>=0;
}

interface AdmissionRow {
  id: string;
  user_id: string | null;
  result_user_id: string | null;
  retry_nonce: string | null;
  band: AgeBand;
  state: Exclude<AgeAdmission['state'], 'expired'>;
  expires_at: number;
  consumed_at: number | null;
  consent_version: string | null;
}

export async function accountAge(env: ApiEnv, userId: string) {
  return one<AccountAge>(env.DB, 'SELECT band,verified_at FROM account_age_access WHERE user_id=?', userId);
}

export function guardAgeAccess(env: ApiEnv, age: AccountAge | null, path: string, method: string, body: Record<string, unknown>, required=requireAgeAccess(env)) {
  // Existing users retain access to deletion and sign-out while approval is pending.
  if (path === '/auth/logout' || (method === 'DELETE' && (path === '/account' || path === '/me'))) return;
  ensure(age?.verified_at || (!age && !required), 'AGE_ACCESS_REQUIRED', '이용 전에 연령 확인을 완료해 주세요.', 403);
  if (path === '/ads/reward-intents' && method === 'POST') {
    ensure(age?.band === 'adult', 'AGE_ADS_UNAVAILABLE', '이 계정에서는 보상형 광고를 이용할 수 없어요.', 403);
  }
  if (age?.band !== 'child') return;
  const restricted = /^\/(guilds?|friends|rankings|players|support)(\/|$)/.test(path) ||
    path.startsWith('/garden/visits/') || path.startsWith('/garden/invite') || path.startsWith('/offers') || path === '/pass/guild-gift' ||
    path === '/purchases/prepare' || path === '/auth/challenge' || path === '/auth/link' || path === '/auth/switch' ||
    (path === '/me' && method === 'PATCH' && body.nickname !== undefined);
  ensure(!restricted, 'CHILD_FEATURE_RESTRICTED', '이 계정에서는 해당 기능을 이용할 수 없어요.', 403);
}

async function admission(env: ApiEnv, token: unknown, userId: string | null) {
  const value = z.string().regex(/^(?:[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}){2}$/).parse(token);
  const row = await one<AdmissionRow>(env.DB, 'SELECT * FROM age_admissions WHERE token_hash=?', await digest(value));
  ensure(row && row.user_id === userId, 'AGE_REQUEST_NOT_FOUND', '연령 확인 요청을 찾을 수 없어요.', 404);
  return { row, token: value };
}

const view = (row: AdmissionRow, now: number): AgeAdmission => ({band:row.band,state:row.expires_at > now ? row.state : 'expired'});

export async function startAgeAdmission(env: ApiEnv, userId: string | null, body: Record<string, unknown>) {
  const now = Date.now();
  const band = ageBandAt(z.string().max(10).parse(body.birthDate), now);
  ensure(band, 'INVALID_BIRTH_DATE', '생년월일을 확인해 주세요.');
  if (body.correctionToken !== undefined) return correctPendingBirthDate(env, userId, body.correctionToken, band, now);
  const existing = userId ? await accountAge(env, userId) : null;
  ensure(!existing?.verified_at, 'AGE_ALREADY_CONFIRMED', '이미 연령 확인을 완료했어요.', 409);
  ensure(existing?.band !== 'child' || band === 'child', 'GUARDIAN_REQUIRED', '이 계정에는 보호자 동의가 필요해요.', 403);
  return createAdmission(env, userId, band, now);
}

function canCorrectAdmission(row: AdmissionRow, now: number) {
  return row.band === 'child' && row.consumed_at === null && row.expires_at > now &&
    (row.state === 'contact' || row.state === 'waiting');
}

async function correctPendingBirthDate(env: ApiEnv, userId: string | null, oldToken: unknown, band: AgeBand, now: number) {
  const {row, token} = await admission(env, oldToken, userId);
  // A retry after a lost response can still complete the corrected admission.
  if (row.band === band && view(row, now).state === 'approved') return {token, band, state:'approved' as const};
  ensure(canCorrectAdmission(row, now), 'GUARDIAN_REQUEST_CLOSED', '이 동의 요청은 이미 종료되었어요.', 409);
  if (band === 'child') return {...view(row, now), token};

  const statements = [
    assertSQL(env.DB, `SELECT band='child' AND state IN ('contact','waiting')
      AND consumed_at IS NULL AND expires_at>? FROM age_admissions WHERE id=?`, now, row.id),
    sql(env.DB, `UPDATE age_admissions SET band=?,state='approved',expires_at=?,
      guardian_name=NULL,guardian_email=NULL,consent_version=NULL,requested_at=NULL,sent_at=NULL,
      mail_status=NULL,mail_due_at=NULL WHERE id=?`, band, now+shortWindow, row.id)
  ];
  if (userId) {
    // Only undo a provisional classification from the player's initial age check.
    const provisionalChild = `EXISTS(SELECT 1 FROM account_age_access a
      JOIN operations initial ON initial.user_id=a.user_id AND initial.key='age:child-registration'
        AND initial.fingerprint='age:child-registration'
      WHERE a.user_id=? AND a.band='child' AND a.verified_at IS NULL AND a.guardian_request_id IS NULL
        AND NOT EXISTS(SELECT 1 FROM operations o WHERE o.user_id=a.user_id AND o.fingerprint LIKE 'admin:birth-date:%')
        AND NOT EXISTS(SELECT 1 FROM age_admissions r WHERE r.user_id=a.user_id AND r.band='child' AND r.decided_at IS NOT NULL))`;
    statements.push(
      assertSQL(env.DB, provisionalChild, userId),
      sql(env.DB, 'DELETE FROM account_age_access WHERE user_id=?', userId),
      ...ageAdmissionStatements(env, {...row, band, consent_version:null}, userId, now)
    );
  } else {
    statements.push(sql(env.DB, 'DELETE FROM tx_assertions'));
  }
  try {
    await env.DB.batch(statements);
  } catch (error) {
    if (!/tx_assertions|CHECK constraint failed: ok/.test(String(error))) throw error;
    const {row: current} = await admission(env, token, userId);
    if (current.band === band && view(current, Date.now()).state === 'approved') return {token, band, state:'approved' as const};
    ensure(canCorrectAdmission(current, Date.now()), 'GUARDIAN_REQUEST_CLOSED', '이 동의 요청은 이미 종료되었어요.', 409);
    ensure(false, 'GUARDIAN_REQUIRED', '이 계정에는 보호자 동의가 필요해요.', 403);
  }
  return {token, band, state:'approved' as const};
}

async function createAdmission(env: ApiEnv, userId: string | null, band: AgeBand, now: number) {
  const id = uid(), token = uid() + uid();
  const state = band === 'child' ? 'contact' : 'approved';
  const statements = [];
  if (userId && band === 'child' && !await accountAge(env,userId)) await migrateExistingChild(env,userId);
  if (userId) {
    ensure(await one(env.DB,'SELECT 1 FROM players WHERE id=? AND deleted_at IS NULL',userId),'ACCOUNT_NOT_FOUND','계정을 찾을 수 없습니다.',401);
    statements.push(assertSQL(env.DB,`EXISTS(SELECT 1 FROM players WHERE id=? AND deleted_at IS NULL)
      AND NOT EXISTS(SELECT 1 FROM account_age_access WHERE user_id=? AND (verified_at IS NOT NULL OR band<>?))`,userId,userId,band));
    // An authenticated user can recover on another device without duplicating live guardian requests.
    statements.push(sql(env.DB,'UPDATE age_admissions SET expires_at=?,guardian_name=NULL,guardian_email=NULL WHERE user_id=? AND consumed_at IS NULL AND expires_at>?',now,userId,now));
  }
  statements.push(sql(env.DB,'INSERT INTO age_admissions(id,token_hash,user_id,band,state,created_at,expires_at) VALUES(?,?,?,?,?,?,?)',id,await digest(token),userId,band,state,now,now+(band==='child'?ADMISSION_WINDOW:shortWindow)));
  if(userId)statements.push(sql(env.DB,'DELETE FROM tx_assertions'));
  await env.DB.batch(statements);
  return {token,band,state};
}

async function migrateExistingChild(env: ApiEnv, userId: string) {
  await mutate(env,userId,'age:child-registration','age:child-registration',async tx=>{
    await restrictExistingChild(tx);
    tx.statements.push(
      assertSQL(tx.db,'NOT EXISTS(SELECT 1 FROM account_age_access WHERE user_id=?)',userId),
      sql(tx.db,"INSERT INTO account_age_access(user_id,band) VALUES(?,'child')",userId)
    );
    return {restricted:true};
  });
}

export async function restrictExistingChild(tx: MutationContext) {
    const userId=tx.player.id;
    const member=await one<{guild_id:string;role:string}>(tx.db,'SELECT guild_id,role FROM guild_members WHERE user_id=?',userId);
    if(member?.role==='leader'){
      tx.statements.push(sql(tx.db,`UPDATE guild_members SET role='leader' WHERE user_id=(SELECT user_id FROM guild_members
        WHERE guild_id=? AND user_id<>? ORDER BY joined_at LIMIT 1)`,member.guild_id,userId));
    }
    tx.player.guildId=null;
    tx.player.nickname=`정원사${userId.slice(0,4)}`;
    tx.statements.push(
      sql(tx.db,'DELETE FROM guild_members WHERE user_id=?',userId),
      sql(tx.db,'DELETE FROM guild_applications WHERE user_id=?',userId),
      sql(tx.db,'DELETE FROM friendships WHERE user_low=? OR user_high=?',userId,userId),
      sql(tx.db,'UPDATE support_requests SET closed=1 WHERE user_id=?',userId),
      sql(tx.db,'UPDATE friend_heart_requests SET expires_at=? WHERE user_id=? AND expires_at>?',tx.now,userId,tx.now),
      sql(tx.db,'DELETE FROM chat_messages WHERE user_id=? AND NOT EXISTS(SELECT 1 FROM reports WHERE message_id=chat_messages.id)',userId),
      sql(tx.db,"UPDATE chat_messages SET nickname='정원사',text='삭제된 메시지' WHERE user_id=?",userId),
      sql(tx.db,'DELETE FROM socket_tickets WHERE user_id=?',userId),
      sql(tx.db,'DELETE FROM auth_challenges WHERE user_id=?',userId),
      sql(tx.db,'DELETE FROM account_switches WHERE from_user=?',userId)
    );
}

export async function restartAgeAdmission(env: ApiEnv, userId: string | null, body: Record<string, unknown>) {
  const {row} = await admission(env, body.token, userId), now = Date.now();
  ensure(row.band === 'child' && row.consumed_at === null && (row.expires_at <= now || row.state === 'declined'), 'AGE_RESTART_UNAVAILABLE', '현재 요청의 결과를 먼저 확인해 주세요.', 409);
  return createAdmission(env, userId, 'child', now);
}

export async function ageAdmissionStatus(env: ApiEnv, userId: string | null, body: Record<string, unknown>) {
  const {row} = await admission(env, body.token, userId);
  return view(row, Date.now());
}

export async function requestGuardianConsent(env: ApiEnv, userId: string | null, body: Record<string, unknown>,queueEmail:(id:string)=>void) {
  const name = z.string().trim().min(2).max(80).regex(/^[^\r\n\u0000-\u001f]+$/u).parse(body.guardianName);
  const email = z.string().trim().email().max(254).regex(/^[a-z0-9._%+\-]+@[a-z0-9.\-]+$/i).parse(body.guardianEmail);
  z.literal(true).parse(body.contactPermission);
  const {row} = await admission(env, body.token, userId), now = Date.now();
  if (row.state === 'waiting' && row.expires_at > now) return view(row, now);
  ensure(row.band==='child'&&row.state==='contact'&&row.consumed_at===null&&row.expires_at>now,
    'GUARDIAN_REQUEST_CLOSED','이 동의 요청은 이미 종료되었어요.',409);
  const autoSend=!!env.GUARDIAN_EMAIL;
  if(autoSend)await rateLimit(env,`guardian-email:${await digest(email.toLowerCase())}`,5,3600);
  const updated = await sql(env.DB,`UPDATE age_admissions SET state='waiting',guardian_name=?,guardian_email=?,consent_version=?,requested_at=?,expires_at=?,mail_status=?,mail_due_at=?
    WHERE id=? AND band='child' AND state='contact' AND consumed_at IS NULL AND expires_at>? RETURNING id`,
    name,email,GUARDIAN_NOTICE_VERSION,now,now+ADMISSION_WINDOW,autoSend?'queued':null,autoSend?now:null,row.id,now).first();
  if (!updated) {
    const current = await ageAdmissionStatus(env,userId,body);
    ensure(current.state === 'waiting', 'GUARDIAN_REQUEST_CLOSED', '이 동의 요청은 이미 종료되었어요.', 409);
    return current;
  }
  if(autoSend)queueEmail(row.id);
  return {band:'child',state:'waiting'} satisfies AgeAdmission;
}

export async function approvedAdmission(env: ApiEnv, token: unknown, userId: string | null) {
  const entry = await admission(env, token, userId);
  ensure(entry.row.state === 'approved' && entry.row.expires_at > Date.now(), 'GUARDIAN_REQUIRED', '보호자 동의가 확인된 뒤 시작할 수 있어요.', 403);
  return entry;
}

export function ageAdmissionStatements(env: ApiEnv, row: AdmissionRow, userId: string, now: number, retryNonce: string|null=null) {
  return [
    assertSQL(env.DB,"SELECT consumed_at IS NULL AND state='approved' AND expires_at>? AND (band<>'child' OR (consent_version IS NOT NULL AND sent_at IS NOT NULL AND decided_at IS NOT NULL)) FROM age_admissions WHERE id=?",now,row.id),
    assertSQL(env.DB,`EXISTS(SELECT 1 FROM players WHERE id=? AND deleted_at IS NULL)
      AND NOT EXISTS(SELECT 1 FROM account_age_access WHERE user_id=? AND (verified_at IS NOT NULL OR band<>?))`,userId,userId,row.band),
    sql(env.DB,`INSERT INTO account_age_access(user_id,band,verified_at,consent_version,guardian_request_id) VALUES(?,?,?,?,?)
      ON CONFLICT(user_id) DO UPDATE SET verified_at=excluded.verified_at,consent_version=excluded.consent_version,guardian_request_id=excluded.guardian_request_id`,userId,row.band,now,row.consent_version,row.band==='child'?row.id:null),
    sql(env.DB,'UPDATE age_admissions SET result_user_id=?,retry_nonce=?,consumed_at=?,expires_at=?,guardian_name=NULL,guardian_email=NULL WHERE id=?',userId,retryNonce,now,now+600_000,row.id),
    sql(env.DB,'DELETE FROM tx_assertions')
  ];
}

export async function completeAgeAdmission(env: ApiEnv, userId: string, body: Record<string, unknown>) {
  const {row} = await approvedAdmission(env,body.token,userId);
  if(row.consumed_at===null){
    try{await env.DB.batch(ageAdmissionStatements(env,row,userId,Date.now()));}
    catch(error){const current=await approvedAdmission(env,body.token,userId);if(current.row.consumed_at===null)throw error;}
  }
  return {band:row.band};
}

export function clearExpiredAgeAdmissions(env: ApiEnv, now: number) {
  return [
    sql(env.DB,'UPDATE age_admissions SET guardian_name=NULL,guardian_email=NULL WHERE expires_at<=? AND guardian_email IS NOT NULL',now),
    sql(env.DB,'UPDATE age_admissions SET retry_nonce=NULL WHERE expires_at<=? AND retry_nonce IS NOT NULL',now),
    sql(env.DB,'DELETE FROM age_admissions WHERE expires_at<=?',now-30*DAY)
  ];
}
