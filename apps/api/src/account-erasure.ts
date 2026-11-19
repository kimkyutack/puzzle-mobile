import { assertSQL, digest, ensure, one, rows, sql, uid, type ApiEnv } from './db';
import { retainCompletedPurchases, retainConsumerDisputes } from './retention';

// Leaf tables with a direct user_id and no remaining dependent rows.
const playerDataTables=[
  'account_age_access','activity_counters','activity_days','ad_daily_usage','auth_challenges','auth_links',
  'apple_authorizations','clear_milestones','free_claims','garden_styles','garden_worlds','guild_applications',
  'inventory_lots','ledger','level_rewards','mission_claims','operations','ops_event_claims','ops_user_controls',
  'player_activity','purchase_debts','ranking_scores','reward_claims','season_owners','sessions','socket_tickets',
  'story_seen','treasure_attempts'
];

export const erasureAccountHash=(userId:string)=>digest('garden:account-erasure:v1:'+userId);

export async function eraseAccount(env:ApiEnv,userId:string,mode:'request'|'legacy'|'restore'='request',audit?:D1PreparedStatement) {
  const db=env.DB;
  const accountHash=await erasureAccountHash(userId);
  for(let attempt=0;attempt<4;attempt++){
    const now=Date.now();
    const player=await one<{version:number;deleted_at:number|null}>(db,'SELECT version,deleted_at FROM players WHERE id=?',userId);
    if(!player)return {deleted:true,identityRevocation:'not_needed'};
    ensure(mode!=='legacy'||player.deleted_at!==null,'ACCOUNT_NOT_FOUND','계정을 찾을 수 없습니다.',401);
    const missing=mode==='request'&&await one(db,`SELECT 1 FROM auth_links l LEFT JOIN apple_authorizations a ON a.subject=l.subject AND a.user_id=l.user_id
        WHERE l.user_id=? AND l.provider='apple' AND a.subject IS NULL`,userId);
    const tokens=await rows<{sealed_token:string}>(db,`SELECT sealed_token FROM apple_authorizations WHERE user_id=?
      UNION SELECT sealed_apple_token FROM auth_challenges WHERE user_id=? AND sealed_apple_token IS NOT NULL`,userId,userId);
    const purchases=await retainCompletedPurchases(env,userId,now);
    const disputes=await retainConsumerDisputes(env,userId,now);
    const reports=`SELECT r.id FROM reports r JOIN chat_messages m ON m.id=r.message_id WHERE r.user_id=? OR m.user_id=?`;
    const tickets='SELECT id FROM cs_tickets WHERE user_id=?';
    const guild=await one<{guild_id:string;role:string}>(db,'SELECT guild_id,role FROM guild_members WHERE user_id=?',userId);
    const statements=[
      assertSQL(db,'SELECT version=? AND deleted_at IS ? FROM players WHERE id=?',player.version,player.deleted_at,userId),
      assertSQL(db,`SELECT coalesce(json_group_array(sealed_token),'[]')=(SELECT coalesce(json_group_array(value),'[]') FROM
        (SELECT value FROM json_each(?) ORDER BY value)) FROM (SELECT sealed_token FROM apple_authorizations WHERE user_id=?
        UNION SELECT sealed_apple_token FROM auth_challenges WHERE user_id=? AND sealed_apple_token IS NOT NULL ORDER BY sealed_token)`,JSON.stringify(tokens.map(token=>token.sealed_token)),userId,userId),
      ...purchases,...disputes,
      ...tokens.map(token=>sql(db,"INSERT INTO outbox(id,topic,payload,created_at) VALUES(?,'$apple-revoke',?,?)",uid(),JSON.stringify({sealedToken:token.sealed_token}),now)),
      sql(db,`DELETE FROM admin_audit WHERE target=? OR (action IN ('support.reply','support.dispute') AND target IN (${tickets}))
        OR (action IN ('report.resolve','report.message.delete') AND target IN (${reports})) OR (action LIKE 'guardian.%' AND target IN (
          SELECT id FROM age_admissions WHERE user_id=? OR result_user_id=? UNION SELECT guardian_request_id FROM account_age_access WHERE user_id=?))`,userId,userId,userId,userId,userId,userId,userId),
      sql(db,`DELETE FROM ops_reports WHERE report_id IN (${reports})`,userId,userId),
      sql(db,`DELETE FROM reports WHERE id IN (${reports})`,userId,userId),
      sql(db,`DELETE FROM operations WHERE user_id<>? AND (
        (fingerprint LIKE 'guild:report:%' AND substr(fingerprint,14,36) IN (SELECT id FROM chat_messages WHERE user_id=?)) OR
        (fingerprint LIKE 'guild:help:%' AND substr(fingerprint,12) IN (SELECT id FROM support_requests WHERE user_id=?)) OR
        (fingerprint LIKE 'friend:hearts:help:%' AND substr(fingerprint,20) IN (SELECT id FROM friend_heart_requests WHERE user_id=?)))`,userId,userId,userId,userId),
      sql(db,'DELETE FROM chat_messages WHERE user_id=?',userId),
      sql(db,`DELETE FROM cs_ticket_reads WHERE user_id=? OR ticket_id IN (${tickets})`,userId,userId),
      sql(db,`DELETE FROM cs_messages WHERE ticket_id IN (${tickets}) OR (author='player' AND author_id=?)`,userId,userId),
      sql(db,'DELETE FROM cs_tickets WHERE user_id=?',userId),
      sql(db,`DELETE FROM external_events WHERE (provider='apple-identity' AND json_extract(payload,'$.subject') IN (
        SELECT subject FROM auth_links WHERE user_id=? AND provider='apple' UNION SELECT subject FROM apple_authorizations WHERE user_id=?
        UNION SELECT verified_subject FROM auth_challenges WHERE user_id=? AND provider='apple')) OR
        (provider='apple' AND (json_extract(payload,'$.userId') IN (SELECT id FROM purchase_intents WHERE user_id=?) OR EXISTS (
          SELECT 1 FROM purchases WHERE user_id=? AND provider='apple' AND transaction_id=json_extract(payload,'$.transactionId')
          AND environment=json_extract(payload,'$.environment')))) OR
        (provider='google' AND (json_extract(payload,'$.oneTimeProductNotification.purchaseToken') IN (SELECT transaction_id FROM purchases WHERE user_id=? AND provider='google')
          OR json_extract(payload,'$.voidedPurchaseNotification.purchaseToken') IN (SELECT transaction_id FROM purchases WHERE user_id=? AND provider='google')))`,userId,userId,userId,userId,userId,userId,userId),
      sql(db,`DELETE FROM outbox WHERE topic='$purchase' AND json_extract(payload,'$.userId')=?
        AND (delivered_at IS NOT NULL OR json_extract(payload,'$.provider')<>'google' OR NOT EXISTS (
          SELECT 1 FROM purchases p WHERE p.user_id=? AND p.transaction_id=json_extract(outbox.payload,'$.transactionId') AND p.status='granted'))`,userId,userId),
      sql(db,`UPDATE outbox SET payload=json_remove(payload,'$.userId','$.purchaseIntentId','$.orderId','$.priceMilliunits','$.currency')
        WHERE topic='$purchase' AND json_extract(payload,'$.userId')=?`,userId),
      sql(db,"UPDATE outbox SET payload='{}' WHERE substr(topic,1,1)<>'$' AND json_extract(payload,'$.userId')=?",userId),
      sql(db,'DELETE FROM purchases WHERE user_id=?',userId),
      sql(db,'DELETE FROM purchase_intents WHERE user_id=?',userId),
      sql(db,'DELETE FROM ad_callbacks WHERE intent_id IN (SELECT id FROM reward_intents WHERE user_id=?)',userId),
      sql(db,'DELETE FROM reward_intents WHERE user_id=?',userId),
      sql(db,'DELETE FROM run_actions WHERE run_id IN (SELECT id FROM runs WHERE user_id=?)',userId),
      sql(db,`DELETE FROM friend_heart_help WHERE sender_id=? OR recipient_id=? OR request_id IN (SELECT id FROM friend_heart_requests WHERE user_id=?)`,userId,userId,userId),
      sql(db,`DELETE FROM donations WHERE sender_id=? OR recipient_id=? OR request_id IN (SELECT id FROM support_requests WHERE user_id=?)`,userId,userId,userId),
      sql(db,'DELETE FROM friend_heart_requests WHERE user_id=?',userId),
      sql(db,'DELETE FROM support_requests WHERE user_id=?',userId),
      sql(db,`UPDATE operations SET response=json_set(response,'$.gifts',(SELECT json_group_array(json(CASE WHEN EXISTS(
        SELECT 1 FROM gifts WHERE id=json_extract(j.value,'$.id') AND sender_id=?) THEN json_set(j.value,'$.senderName','정원사') ELSE j.value END))
        FROM json_each(response,'$.gifts') j)) WHERE user_id IN (SELECT user_id FROM gifts WHERE sender_id=? AND user_id<>?)
        AND fingerprint LIKE 'gift:claim:%' AND json_type(response,'$.gifts')='array'`,userId,userId,userId),
      sql(db,'DELETE FROM gifts WHERE user_id=?',userId),
      sql(db,`UPDATE gifts SET sender_id=NULL,sender_name='정원사',source_id=(CASE WHEN source_id LIKE 'friend-heart:%'
        THEN 'friend-heart:' ELSE '' END)||'erased-sender:'||id WHERE sender_id=?`,userId),
      sql(db,`DELETE FROM operations WHERE user_id IN (SELECT from_user FROM account_switches WHERE to_user=?)
        AND fingerprint LIKE 'auth:link:%' AND json_type(response,'$.conflict')='object'`,userId),
      sql(db,`UPDATE operations SET fingerprint=replace(fingerprint,?,'[삭제]') WHERE user_id<>?
        AND (fingerprint LIKE 'guild:%' OR fingerprint LIKE 'friend:%') AND instr(fingerprint,?)>0`,userId,userId,userId),
      sql(db,`UPDATE ledger SET reason=replace(reason,?,'[삭제]') WHERE user_id<>? AND (reason LIKE 'guild:%' OR reason LIKE 'friend:%') AND instr(reason,?)>0`,userId,userId,userId),
      sql(db,'DELETE FROM account_switches WHERE from_user=? OR to_user=?',userId,userId),
      sql(db,'DELETE FROM friendships WHERE user_low=? OR user_high=? OR requested_by=?',userId,userId,userId),
      sql(db,'DELETE FROM blocks WHERE user_id=? OR blocked_id=?',userId,userId),
      sql(db,'DELETE FROM age_admissions WHERE user_id=? OR result_user_id=?',userId,userId),
      sql(db,"DELETE FROM rate_limits WHERE key='user:'||? OR key LIKE 'age:'||?||':%' OR key='age-status:'||?",userId,userId,userId),
      ...playerDataTables.map(table=>sql(db,`DELETE FROM ${table} WHERE user_id=?`,userId)),
      sql(db,'DELETE FROM runs WHERE user_id=?',userId)
    ];
    if(guild?.role==='leader')statements.push(sql(db,`UPDATE guild_members SET role='leader' WHERE user_id=(
      SELECT user_id FROM guild_members WHERE guild_id=? AND user_id<>? ORDER BY joined_at,user_id LIMIT 1)`,guild.guild_id,userId));
    statements.push(sql(db,'DELETE FROM guild_members WHERE user_id=?',userId));
    if(guild)statements.push(sql(db,`UPDATE guilds SET description='',notice='',name='종료된 길드 '||id,mode='approval'
      WHERE id=? AND NOT EXISTS(SELECT 1 FROM guild_members WHERE guild_id=?)`,guild.guild_id,guild.guild_id));
    if(guild)statements.push(sql(db,'INSERT INTO outbox(id,topic,payload,created_at) VALUES(?,?,?,?)',uid(),guild.guild_id,'{}',now));
    if(audit)statements.push(audit);
    if(mode!=='restore')statements.push(sql(db,'INSERT INTO account_erasure_receipts VALUES(?,?,?) ON CONFLICT(account_hash) DO NOTHING',accountHash,now,now+30*86_400_000));
    statements.push(sql(db,'DELETE FROM players WHERE id=?',userId),sql(db,'DELETE FROM tx_assertions'));
    try{await db.batch(statements);return {deleted:true,identityRevocation:tokens.length?'pending':missing?'manual':'not_needed'};}
    catch(error){if(attempt===3||!/CHECK constraint failed: ok/.test(String(error)))throw error;}
  }
  throw new Error('Account deletion retry exhausted');
}

export async function erasePreviouslyDeletedAccounts(env:ApiEnv) {
  const pending=await rows<{id:string}>(env.DB,'SELECT id FROM players WHERE deleted_at IS NOT NULL ORDER BY deleted_at LIMIT 5');
  for(const {id} of pending)try{await eraseAccount(env,id,'legacy');}
  catch{console.error(JSON.stringify({event:'privacy:legacy-erasure-retry'}));}
}
