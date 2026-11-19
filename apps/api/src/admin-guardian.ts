import { z } from 'zod';
import type {GuardianMailStatus} from '../../../packages/content/src/guardian-consent-email';
import { auditStatement, requireRole, type AdminSession } from './admin-auth';
import { assertSQL, ensure, one, rows, sql, type ApiEnv } from './db';

export async function listGuardianRequests(env: ApiEnv, admin: AdminSession) {
  requireRole(admin, ['owner','support','operator']);
  return {items:await rows(env.DB,`SELECT id,guardian_name,guardian_email,consent_version,requested_at,sent_at,expires_at,mail_status
    FROM age_admissions WHERE band='child' AND state='waiting' AND expires_at>? ORDER BY requested_at LIMIT 100`,Date.now())};
}

export async function reviewGuardianRequest(env: ApiEnv, admin: AdminSession, id: string, body: Record<string, unknown>) {
  requireRole(admin, ['owner','support','operator']);
  z.string().uuid().parse(id);
  const input = z.object({action:z.enum(['sent','approve','decline']),key:z.string().uuid()}).strict().parse(body);
  const action = 'guardian.'+input.action;
  const prior = await one<{action:string;target:string}>(env.DB,'SELECT action,target FROM admin_audit WHERE operation_key=?',input.key);
  if(prior){
    ensure(prior.action===action&&prior.target===id,'IDEMPOTENCY_CONFLICT','이미 사용한 요청 식별자입니다.',409);
    return {ok:true};
  }
  const now=Date.now();
  const row=await one<{sent_at:number|null;consent_version:string;mail_status:GuardianMailStatus|null}>(env.DB,"SELECT sent_at,consent_version,mail_status FROM age_admissions WHERE id=? AND band='child' AND state='waiting' AND expires_at>?",id,now);
  ensure(row,'GUARDIAN_REQUEST_CLOSED','이 동의 요청은 이미 종료되었어요.',409);
  ensure(input.action==='sent'?!row.sent_at:row.sent_at,'GUARDIAN_EMAIL_REQUIRED','동의 안내 발송부터 확인해 주세요.',409);
  ensure(input.action!=='sent'||(row.mail_status!=='queued'&&row.mail_status!=='sending'),
    'GUARDIAN_EMAIL_IN_PROGRESS','자동 발송 결과를 먼저 확인해 주세요.',409);
  const state=input.action==='approve'?'approved':input.action==='decline'?'declined':'waiting';
  const update=input.action==='sent'
    ? sql(env.DB,'UPDATE age_admissions SET sent_at=?,mail_status=NULL,mail_due_at=NULL WHERE id=?',now,id)
    : sql(env.DB,'UPDATE age_admissions SET state=?,decided_at=?,guardian_name=NULL,guardian_email=NULL WHERE id=?',state,now,id);
  await env.DB.batch([
    assertSQL(env.DB,`SELECT state='waiting' AND sent_at IS ? AND mail_status IS ? AND expires_at>? FROM age_admissions WHERE id=?`,row.sent_at,row.mail_status,now,id),
    update,
    auditStatement(env,admin.email,action,id,input.action==='sent'?'법정대리인에게 동의 내용 발송':'등록된 이메일의 법정대리인 회신 확인',undefined,{state,version:row.consent_version},input.key),
    sql(env.DB,'DELETE FROM tx_assertions')
  ]);
  return {ok:true};
}

export async function withdrawGuardianConsent(env: ApiEnv, admin: AdminSession, body: Record<string, unknown>) {
  requireRole(admin, ['owner','support','operator']);
  const input=z.object({requestId:z.string().uuid(),key:z.string().uuid()}).strict().parse(body);
  const action='guardian.withdraw';
  const prior=await one<{action:string;target:string}>(env.DB,'SELECT action,target FROM admin_audit WHERE operation_key=?',input.key);
  if(prior){
    ensure(prior.action===action&&prior.target===input.requestId,'IDEMPOTENCY_CONFLICT','이미 사용한 요청 식별자입니다.',409);
    return {ok:true};
  }
  const now=Date.now();
  const account=await one<{user_id:string}>(env.DB,"SELECT user_id FROM account_age_access WHERE guardian_request_id=? AND band='child' AND verified_at IS NOT NULL",input.requestId);
  const pending=await one(env.DB,"SELECT id FROM age_admissions WHERE id=? AND band='child' AND state='approved' AND consumed_at IS NULL AND expires_at>?",input.requestId,now);
  ensure(account||pending,'GUARDIAN_REQUEST_CLOSED','철회할 동의 내역을 찾을 수 없어요.',404);
  await env.DB.batch([
    assertSQL(env.DB,`EXISTS(SELECT 1 FROM account_age_access WHERE guardian_request_id=? AND verified_at IS NOT NULL)
      OR EXISTS(SELECT 1 FROM age_admissions WHERE id=? AND band='child' AND state='approved' AND consumed_at IS NULL AND expires_at>?)`,input.requestId,input.requestId,now),
    sql(env.DB,"UPDATE account_age_access SET verified_at=NULL WHERE guardian_request_id=? AND band='child'",input.requestId),
    sql(env.DB,"UPDATE age_admissions SET state='declined',decided_at=?,retry_nonce=NULL WHERE id=? AND band='child'",now,input.requestId),
    auditStatement(env,admin.email,action,input.requestId,'법정대리인 동의 철회 요청 확인',undefined,{state:'withdrawn'},input.key),
    sql(env.DB,'DELETE FROM tx_assertions')
  ]);
  return {ok:true};
}
