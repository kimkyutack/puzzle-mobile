import legal from '../../../config/legal.json';
import {guardianConsentEmail,type GuardianMailStatus} from '../../../packages/content/src/guardian-consent-email';
import {rows,sql,type ApiEnv} from './db';

const MINUTE=60_000;
const SEND_WINDOW=10*MINUTE;
const MAX_ATTEMPTS=3;
const refused=new Set([
  'E_VALIDATION_ERROR','E_SENDER_NOT_VERIFIED','E_SENDER_DOMAIN_NOT_AVAILABLE',
  'E_RECIPIENT_NOT_ALLOWED','E_RECIPIENT_SUPPRESSED','E_ACCOUNT_SUSPENDED','E_DELIVERY_FAILED',
]);

function retryDelay(code:unknown,attempt:number):number|undefined {
  if(attempt>=MAX_ATTEMPTS)return;
  if(code==='E_RATE_LIMIT_EXCEEDED')return attempt*5*MINUTE;
  if(code==='E_DAILY_LIMIT_EXCEEDED')return 24*60*MINUTE;
}

interface ClaimedRequest {
  guardian_email:string;
  consent_version:string;
  expires_at:number;
  mail_attempts:number;
}

export async function sendGuardianEmail(env:ApiEnv,id:string):Promise<void> {
  if(!env.GUARDIAN_EMAIL)return;
  const now=Date.now();
  const request=await sql(env.DB,`UPDATE age_admissions
    SET mail_status='sending',mail_attempts=mail_attempts+1,mail_due_at=?
    WHERE id=? AND band='child' AND state='waiting' AND sent_at IS NULL AND expires_at>?
      AND mail_status='queued' AND mail_due_at<=? AND guardian_email IS NOT NULL
    RETURNING guardian_email,consent_version,expires_at,mail_attempts`,
    now+SEND_WINDOW,id,now,now).first<ClaimedRequest>();
  if(!request)return;

  const message=guardianConsentEmail(id,request.consent_version,request.expires_at);
  const html=message.text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\n/g,'<br>');
  try{
    const result=await env.GUARDIAN_EMAIL.send({
      from:{email:'consent@hiddenstage.app',name:'구름정원'},
      to:request.guardian_email,
      replyTo:legal.contactEmail,
      html,
      ...message,
    });
    if(!result.messageId)throw new Error('Missing email acknowledgement');
  }catch(error){
    const code=error instanceof Error&&'code' in error?error.code:undefined;
    const delay=retryDelay(code,request.mail_attempts),finishedAt=Date.now();
    const dueAt=delay!==undefined&&finishedAt+delay<request.expires_at?finishedAt+delay:null;
    const rejected=typeof code==='string'&&(refused.has(code)||code==='E_RATE_LIMIT_EXCEEDED'||code==='E_DAILY_LIMIT_EXCEEDED');
    const status:GuardianMailStatus=dueAt!==null?'queued':rejected?'failed':'unknown';
    await sql(env.DB,`UPDATE age_admissions SET mail_status=?,mail_due_at=?
      WHERE id=? AND state='waiting' AND sent_at IS NULL AND mail_status='sending' AND mail_attempts=?`,
      status,dueAt,id,request.mail_attempts).run();
    console.warn(JSON.stringify({event:'guardian-email:send',status,attempt:request.mail_attempts}));
    return;
  }

  await sql(env.DB,`UPDATE age_admissions SET sent_at=?,mail_status='sent',mail_due_at=NULL
    WHERE id=? AND state='waiting' AND sent_at IS NULL
      AND mail_status IN ('sending','unknown') AND mail_attempts=?`,Date.now(),id,request.mail_attempts).run();
}

export async function sendPendingGuardianEmails(env:ApiEnv):Promise<void> {
  if(!env.GUARDIAN_EMAIL)return;
  const now=Date.now();
  // A lost acknowledgement cannot prove the provider rejected the message.
  await sql(env.DB,`UPDATE age_admissions SET mail_status='unknown',mail_due_at=NULL
    WHERE band='child' AND state='waiting' AND sent_at IS NULL AND mail_status='sending' AND mail_due_at<=?`,now).run();
  const pending=await rows<{id:string}>(env.DB,`SELECT id FROM age_admissions
    WHERE band='child' AND state='waiting' AND sent_at IS NULL AND expires_at>?
      AND mail_status='queued' AND mail_due_at<=? ORDER BY mail_due_at LIMIT 20`,now,now);
  for(const {id} of pending)await sendGuardianEmail(env,id).catch(logGuardianEmailError);
}

export function logGuardianEmailError() {
  console.error(JSON.stringify({event:'guardian-email:processing-error'}));
}
