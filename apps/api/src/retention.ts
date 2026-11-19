import { assertSQL, digest, one, rows, sql, uid, type ApiEnv } from './db';

export function retentionDeadline(at:number,years:number) {
  const koreaOffset=9*60*60*1000;
  const date=new Date(at+koreaOffset);
  const month=date.getUTCMonth();
  date.setUTCFullYear(date.getUTCFullYear()+years);
  if(date.getUTCMonth()!==month)date.setUTCDate(0);
  return date.getTime()-koreaOffset;
}

export const purchaseRecordKey=(environment:string,transactionId:string)=>digest(environment+':'+transactionId);

export function privacyAccessRecord(env:ApiEnv,adminId:string,ip:string|null,action:string,subjectKey:string,at=Date.now()){
  const years=env.PRIVACY_ACCESS_RETENTION_YEARS==='2'?2:1;
  return sql(env.DB,'INSERT INTO privacy_access_records VALUES(?,?,?,?,?,?,?)',uid(),adminId,ip,action,subjectKey,at,retentionDeadline(at,years));
}

interface PurchaseRow {
  provider:string;environment:string;transaction_id:string;product_id:string;
  status:string;verified_json:string;created_at:number;refunded_at:number|null;pending_refund_at:number|null;
}

const pendingRefund=`CASE WHEN purchases.provider='apple' THEN (
  SELECT max(coalesce(json_extract(payload,'$.refundedAt'),created_at)) FROM external_events
  WHERE processed=0 AND provider='apple' AND json_extract(payload,'$.revoked')=1
  AND json_extract(payload,'$.environment')='Production' AND json_extract(payload,'$.transactionId')=purchases.transaction_id
) WHEN ?='Production' THEN (
  SELECT max(created_at) FROM external_events WHERE processed=0 AND provider='google'
  AND json_extract(payload,'$.voidedPurchaseNotification.purchaseToken')=purchases.transaction_id
) END`;

export async function retainCompletedPurchases(env:ApiEnv,userId:string,now:number) {
  const googleEnvironment=env.GOOGLE_IAP_ENVIRONMENT??null;
  const purchases=await rows<PurchaseRow>(env.DB,`SELECT *,${pendingRefund} pending_refund_at FROM purchases
    WHERE user_id=? AND environment='Production' AND status IN ('granted','finished','refunded','cancelled')`,googleEnvironment,userId);
  const statements=[assertSQL(env.DB,`SELECT count(*)=? FROM purchases WHERE user_id=? AND environment='Production'
    AND status IN ('granted','finished','refunded','cancelled')`,purchases.length,userId)];
  for(const purchase of purchases){
    statements.push(assertSQL(env.DB,`SELECT status=? AND refunded_at IS ? AND (${pendingRefund}) IS ? FROM purchases
      WHERE provider=? AND environment=? AND transaction_id=?`,purchase.status,purchase.refunded_at,googleEnvironment,
      purchase.pending_refund_at,purchase.provider,purchase.environment,purchase.transaction_id));
    let details:{state?:string;purchasedAt?:number;orderId?:string;priceMilliunits?:number;currency?:string;suppliedAt?:number;refundedAt?:number}={};
    try{details=JSON.parse(purchase.verified_json)??{};}catch{/* Older fulfilled transactions still have a grant timestamp. */}
    const hasPurchaseDate=Number.isSafeInteger(details.purchasedAt)&&details.purchasedAt!>0;
    if(purchase.status==='cancelled'&&!hasPurchaseDate)continue;
    const paidAt=hasPurchaseDate?details.purchasedAt!:purchase.created_at;
    const supplied=details.state==='purchased'||['granted','finished'].includes(purchase.status);
    const suppliedAt=supplied?Math.max(paidAt,details.suppliedAt??purchase.created_at):null;
    let refundAt=purchase.refunded_at??details.refundedAt??purchase.pending_refund_at;
    if(purchase.status==='refunded'&&refundAt===null){
      const key='refund:'+await digest(`${purchase.provider}:${purchase.environment}:${purchase.transaction_id}`);
      refundAt=(await one<{created_at:number}>(env.DB,'SELECT created_at FROM operations WHERE user_id=? AND key=?',userId,key))?.created_at??paidAt;
    }
    const expires=retentionDeadline(Math.max(paidAt,suppliedAt??0,refundAt??0),5);
    if(expires<=now)continue;
    const orderRef=purchase.provider==='apple'?purchase.transaction_id:details.orderId;
    const safeReference=typeof orderRef==='string'&&/^[\w.\-]{1,128}$/.test(orderRef)?orderRef:null;
    statements.push(sql(env.DB,`INSERT INTO retained_purchase_records VALUES(?,?,?,?,?,?,?,?,?,?)
      ON CONFLICT(provider,transaction_key) DO NOTHING`,purchase.provider,await purchaseRecordKey(purchase.environment,purchase.transaction_id),safeReference,purchase.product_id,
      Number.isSafeInteger(details.priceMilliunits)?details.priceMilliunits:null,/^[A-Z]{3}$/.test(details.currency??'')?details.currency:null,paidAt,suppliedAt,refundAt,expires));
  }
  return statements;
}

export async function updateRetainedRefund(env:ApiEnv,provider:string,environment:string,transactionId:string,at:number) {
  if(environment!=='Production')return;
  await sql(env.DB,`UPDATE retained_purchase_records SET refunded_at=?,expires_at=max(expires_at,?)
    WHERE provider=? AND transaction_key=? AND refunded_at IS NULL AND expires_at>?`,at,retentionDeadline(at,5),provider,await purchaseRecordKey(environment,transactionId),at).run();
}

export async function retainConsumerDisputes(env:ApiEnv,userId:string,now:number) {
  const tickets=await rows<{id:string;dispute_summary:string;status:string;created_at:number;handled_at:number}>(env.DB,
    `SELECT id,dispute_summary,status,created_at,max(updated_at,dispute_at) handled_at
     FROM cs_tickets WHERE user_id=? AND dispute_summary IS NOT NULL AND dispute_at IS NOT NULL`,userId);
  const statements=[assertSQL(env.DB,'SELECT count(*)=? FROM cs_tickets WHERE user_id=? AND dispute_summary IS NOT NULL AND dispute_at IS NOT NULL',tickets.length,userId)];
  for(const ticket of tickets){
    statements.push(assertSQL(env.DB,'SELECT dispute_summary=? AND status=? AND max(updated_at,dispute_at)=? FROM cs_tickets WHERE id=?',
      ticket.dispute_summary,ticket.status,ticket.handled_at,ticket.id));
    const expiresAt=retentionDeadline(ticket.handled_at,3);
    if(expiresAt>now)statements.push(sql(env.DB,`INSERT INTO retained_consumer_disputes VALUES(?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING`,
      ticket.id,ticket.dispute_summary,ticket.status,ticket.created_at,ticket.handled_at,expiresAt));
  }
  return statements;
}

export async function purgeExpiredRecords(env:ApiEnv,now:number) {
  const day=86_400_000;
  await env.DB.batch([
    sql(env.DB,'DELETE FROM retained_purchase_records WHERE expires_at<=?',now),
    sql(env.DB,'DELETE FROM retained_consumer_disputes WHERE expires_at<=?',now),
    sql(env.DB,'DELETE FROM account_erasure_receipts WHERE expires_at<=?',now),
    sql(env.DB,'DELETE FROM privacy_access_records WHERE expires_at<=?',now),
    sql(env.DB,"DELETE FROM outbox WHERE delivered_at IS NULL AND created_at<=? AND (topic='$apple-revoke' OR (topic='$purchase' AND json_type(payload,'$.userId') IS NULL))",now-7*day),
    sql(env.DB,'DELETE FROM external_events WHERE created_at<=?',now-7*day),
    sql(env.DB,"DELETE FROM outbox WHERE delivered_at IS NOT NULL AND delivered_at<=?",now-day)
  ]);
}
