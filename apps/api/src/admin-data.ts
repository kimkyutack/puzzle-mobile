import {z} from 'zod';
import {APPROVED_LEVEL_COUNT} from '@garden/content';
import type {AdminIdentity,OpsNotice,OpsEvent,SupportTicket} from '../../../packages/contracts/src/operations';
import {runtimeSchema,noticeSchema,eventSchema,rewardSchema,runtime,grantOpsReward} from './operations';
import {auditStatement,requireRole} from './admin-auth';
import {assertSQL,ensure,one,rows,sql,uid,readPlayer,mutate,type ApiEnv} from './db';
import {ageBandAt} from '../../../packages/contracts/src/age-access';
import {accountAge,restrictExistingChild} from './age-access';
const reason=z.string().trim().min(2,'작업 사유를 입력해 주세요.').max(500),key=z.string().uuid();
const change=z.object({key,reason,revision:z.number().int().min(0),data:z.unknown()}).strict();
const pageOf=(url:URL)=>Math.min(10000,Math.max(1,Math.floor(Number(url.searchParams.get('page')))||1));
const LIMIT=30;
function parseRows<T>(data:Array<{id:string;data:string;revision:number}>):T[]{return data.map(r=>({...JSON.parse(r.data),id:r.id,revision:r.revision})) as T[];}
function operationFingerprint(admin:AdminIdentity,input:{reason:string},action:string,target:string,after:unknown){return JSON.stringify([admin.id,action,target,input.reason,after]);}
async function replayed(env:ApiEnv,admin:AdminIdentity,input:{key:string;reason:string},action:string,target:string,after:unknown){
 const existing=await one<{fingerprint:string}>(env.DB,'SELECT fingerprint FROM admin_audit WHERE operation_key=?',input.key);
 if(!existing)return false;
 ensure(existing.fingerprint===operationFingerprint(admin,input,action,target,after),'IDEMPOTENCY_CONFLICT','다른 작업에 사용된 요청입니다.',409);return true;
}
async function write(env:ApiEnv,admin:AdminIdentity,input:{key:string;reason:string},action:string,target:string,before:unknown,after:unknown,statements:D1PreparedStatement[]){
 const fingerprint=operationFingerprint(admin,input,action,target,after);
 if(await replayed(env,admin,input,action,target,after))return {replayed:true};
 try{await env.DB.batch<Record<string,unknown>>([...statements,auditStatement(env,admin.email,action,target,input.reason,before,after,input.key,fingerprint),sql(env.DB,'DELETE FROM tx_assertions')]);}
 catch(error){const raced=await one<{fingerprint:string}>(env.DB,'SELECT fingerprint FROM admin_audit WHERE operation_key=?',input.key);if(raced?.fingerprint===fingerprint)return {replayed:true};throw error;}
 return {saved:true};
}
export async function dashboard(env:ApiEnv){
 const now=Date.now(),start=new Date(now);start.setUTCHours(0,0,0,0);const today=start.getTime();
 const data=await env.DB.batch<Record<string,unknown>>([
 sql(env.DB,'SELECT count(*) total,sum(CASE WHEN created_at>=? THEN 1 ELSE 0 END) newToday FROM players WHERE deleted_at IS NULL',today),sql(env.DB,'SELECT count(*) dau FROM player_activity WHERE last_seen>=?',now-86400000),sql(env.DB,"SELECT count(*) active FROM runs WHERE status='active' AND expires_at>?",now),sql(env.DB,"SELECT count(*) clears FROM level_rewards WHERE created_at>=?",today),sql(env.DB,"SELECT count(*) n FROM cs_tickets WHERE status IN('open','pending')"),sql(env.DB,"SELECT count(*) n FROM reward_intents WHERE status IN('pending','review')"),sql(env.DB,"SELECT count(*) n FROM purchases WHERE created_at>=? AND status IN('granted','finished')",today),sql(env.DB,'SELECT count(*) n FROM outbox WHERE delivered_at IS NULL'),sql(env.DB,"SELECT strftime('%Y-%m-%d',created_at/1000,'unixepoch') day,count(*) clears FROM level_rewards WHERE created_at>=? GROUP BY day ORDER BY day",today-6*86400000),sql(env.DB,'SELECT id,actor,action,target,reason,created_at FROM admin_audit ORDER BY created_at DESC LIMIT 8')]);
 return {users:data[0]!.results[0],dau:Number(data[1]!.results[0]?.dau??0),activeRuns:Number(data[2]!.results[0]?.active??0),clears:Number(data[3]!.results[0]?.clears??0),tickets:Number(data[4]!.results[0]?.n??0),pendingAds:Number(data[5]!.results[0]?.n??0),purchases:Number(data[6]!.results[0]?.n??0),outbox:Number(data[7]!.results[0]?.n??0),trend:data[8]!.results,audit:data[9]!.results,at:now,activityAvailableSince:'운영 연동 앱 접속부터 집계'};
}
export async function listUsers(env:ApiEnv,url:URL){const q=(url.searchParams.get('q')??'').trim().slice(0,100),page=pageOf(url),where="p.deleted_at IS NULL AND (?='' OR p.id=? OR instr(lower(json_extract(p.data,'$.nickname')),lower(?))>0)";const data=await env.DB.batch<Record<string,unknown>>([sql(env.DB,`SELECT p.id,json_extract(p.data,'$.nickname') nickname,p.level,json_extract(p.data,'$.coins') coins,json_extract(p.data,'$.stars') stars,p.created_at,a.last_seen,c.data controls FROM players p LEFT JOIN player_activity a ON a.user_id=p.id LEFT JOIN ops_user_controls c ON c.user_id=p.id WHERE ${where} ORDER BY p.created_at DESC,p.id LIMIT ? OFFSET ?`,q,q,q,LIMIT,(page-1)*LIMIT),sql(env.DB,`SELECT count(*) n FROM players p WHERE ${where}`,q,q,q)]);return {items:data[0]!.results.map(r=>({...r,controls:r.controls?JSON.parse(String(r.controls)):null})),total:Number(data[1]!.results[0]?.n??0),page,pageSize:LIMIT};}
export async function userDetail(env:ApiEnv,id:string,includeAge:boolean){
 const player=await readPlayer(env.DB,id);
 const [profile,controls,links,ledger,runs,purchases,tickets,age]=await env.DB.batch<Record<string,unknown>>([
  sql(env.DB,'SELECT created_at FROM players WHERE id=?',id),
  sql(env.DB,'SELECT data FROM ops_user_controls WHERE user_id=?',id),
  sql(env.DB,'SELECT provider,created_at FROM auth_links WHERE user_id=?',id),
  sql(env.DB,'SELECT id,asset,delta,reason,created_at FROM ledger WHERE user_id=? ORDER BY created_at DESC LIMIT 30',id),
  sql(env.DB,'SELECT id,status,sequence,expires_at FROM runs WHERE user_id=? ORDER BY expires_at DESC LIMIT 10',id),
  sql(env.DB,'SELECT provider,transaction_id,product_id,status,created_at FROM purchases WHERE user_id=? ORDER BY created_at DESC LIMIT 20',id),
  sql(env.DB,'SELECT id,title,status,updated_at FROM cs_tickets WHERE user_id=? ORDER BY updated_at DESC LIMIT 10',id),
  ...(includeAge?[sql(env.DB,'SELECT band,verified_at FROM account_age_access WHERE user_id=?',id)]:[])
 ]);
 const ageRow=age?.results[0],control=controls!.results[0]?.data;
 return {player,createdAt:profile!.results[0]?.created_at,controls:control?JSON.parse(String(control)):null,
  links:links!.results,ledger:ledger!.results,runs:runs!.results,purchases:purchases!.results,tickets:tickets!.results,
  ...(includeAge?{ageAccess:{band:ageRow?.band??null,confirmed:!!ageRow?.verified_at}}:{})};
}

export async function correctUserBirthDate(env:ApiEnv,admin:AdminIdentity,id:string,body:Record<string,unknown>){
 requireRole(admin,['owner']);
 const bandSchema=z.enum(['child','teen','adult']);
 const input=z.object({key,reason,birthDate:z.string().max(10),band:bandSchema,
  expected:z.object({band:bandSchema.nullable(),confirmed:z.boolean()}).strict()}).strict().parse(body);
 const band=ageBandAt(input.birthDate,Date.now());
 ensure(band,'INVALID_BIRTH_DATE','올바른 생년월일을 입력해 주세요.');
 ensure(band===input.band,'AGE_BAND_CHANGED','연령 구간이 달라졌습니다. 날짜를 다시 확인해 주세요.',409);
 ensure(!input.reason.includes(input.birthDate),'INVALID_REASON','변경 사유에 생년월일을 입력하지 마세요.');
 const action='user.birth-date',fingerprint='admin:birth-date:'+JSON.stringify([admin.id,band,input.expected,input.reason]);
 return mutate(env,id,input.key,fingerprint,async tx=>{
  const current=await accountAge(env,id);
  const before={band:current?.band??null,confirmed:!!current?.verified_at};
  ensure(before.band===input.expected.band&&before.confirmed===input.expected.confirmed,
   'AGE_ACCESS_CHANGED','계정의 연령 확인 상태가 바뀌었습니다. 상세 화면을 다시 열어 주세요.',409);
  const changed=band!==before.band;
  const after={band,confirmed:changed?band!=='child':before.confirmed};
  tx.statements.push(current
   ?assertSQL(tx.db,'SELECT band=? AND verified_at IS ? FROM account_age_access WHERE user_id=?',current.band,current.verified_at,id)
   :assertSQL(tx.db,'NOT EXISTS(SELECT 1 FROM account_age_access WHERE user_id=?)',id));
  if(changed){
   if(band==='child'){
    tx.touch(tx.player);
    await restrictExistingChild(tx);
   }
   tx.statements.push(
    sql(tx.db,`INSERT INTO account_age_access (user_id,band,verified_at) VALUES(?,?,?)
      ON CONFLICT(user_id) DO UPDATE SET band=excluded.band,verified_at=excluded.verified_at,
        consent_version=NULL,guardian_request_id=NULL`,id,band,band==='child'?null:tx.now),
    sql(tx.db,`UPDATE age_admissions SET expires_at=?,retry_nonce=NULL,guardian_name=NULL,guardian_email=NULL
      WHERE (user_id=? OR result_user_id=?) AND expires_at>?`,tx.now,id,id,tx.now)
   );
  }
  tx.statements.push(auditStatement(env,admin.email,action,id,input.reason,before,after,input.key,fingerprint));
  return {ageAccess:after};
 },{touchPlayer:false});
}
export async function grantUser(env:ApiEnv,admin:AdminIdentity,id:string,body:Record<string,unknown>){requireRole(admin,['owner','operator']);const input=z.object({key,reason,reward:rewardSchema}).strict().parse(body);return mutate(env,id,input.key,'admin:grant:'+JSON.stringify([admin.id,input.reason,input.reward]),tx=>{const before={coins:tx.player.coins,stars:tx.player.stars,hearts:tx.player.hearts,inventory:structuredClone(tx.player.inventory)};grantOpsReward(tx,input.reward);tx.statements.push(auditStatement(env,admin.email,'user.grant',id,input.reason,before,input.reward,input.key));return {player:tx.player};});}
export async function changeUser(env:ApiEnv,admin:AdminIdentity,id:string,body:Record<string,unknown>){requireRole(admin,['owner','operator']);const input=z.object({key,reason,nickname:z.string().trim().min(2).max(20).regex(/^[\p{L}\p{N} _-]+$/u),level:z.number().int().min(1).max(APPROVED_LEVEL_COUNT)}).strict().parse(body);return mutate(env,id,input.key,'admin:profile:'+JSON.stringify([admin.id,input.nickname,input.level,input.reason]),tx=>{const before={nickname:tx.player.nickname,level:tx.player.level};tx.player.nickname=input.nickname;tx.player.level=input.level;if(before.level!==input.level)tx.statements.push(sql(tx.db,"UPDATE runs SET status='abandoned',data=json_set(data,'$.status','abandoned') WHERE user_id=? AND status='active'",id));tx.statements.push(auditStatement(env,admin.email,'user.profile',id,input.reason,before,{nickname:input.nickname,level:input.level},input.key));return {player:tx.player};});}
export async function controlUser(env:ApiEnv,admin:AdminIdentity,id:string,body:Record<string,unknown>){requireRole(admin,['owner','operator']);const input=z.object({key,reason,banned:z.boolean(),until:z.number().int().min(0).nullable()}).strict().parse(body);await readPlayer(env.DB,id);ensure(!input.banned||input.until===null||input.until>Date.now(),'INVALID_BAN','해제 시간은 현재 이후여야 합니다.');const before=await one<{data:string}>(env.DB,'SELECT data FROM ops_user_controls WHERE user_id=?',id),next={banned:input.banned,until:input.until,reason:input.reason};return write(env,admin,input,'user.restrict',id,before?JSON.parse(before.data):null,next,[sql(env.DB,'INSERT INTO ops_user_controls VALUES(?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET data=excluded.data,updated_at=excluded.updated_at,updated_by=excluded.updated_by',id,JSON.stringify(next),Date.now(),admin.id)]);}
export async function saveRuntime(env:ApiEnv,admin:AdminIdentity,body:Record<string,unknown>){requireRole(admin,['owner','operator']);const input=change.parse(body),next=runtimeSchema.parse(input.data);if(await replayed(env,admin,input,'runtime.update','runtime',next))return {replayed:true};const before=await runtime(env);ensure(before.revision===input.revision,'OPS_CONFLICT','다른 관리자가 설정을 바꿨습니다. 새로고침해 주세요.',409);return write(env,admin,input,'runtime.update','runtime',before.settings,next,[assertSQL(env.DB,"SELECT COALESCE((SELECT revision FROM ops_settings WHERE key='runtime'),0)=?",input.revision),sql(env.DB,"INSERT INTO ops_settings VALUES('runtime',?,?,?,?) ON CONFLICT(key) DO UPDATE SET data=excluded.data,revision=excluded.revision,updated_at=excluded.updated_at,updated_by=excluded.updated_by",JSON.stringify(next),input.revision+1,Date.now(),admin.id)]);}
export async function listNotices(env:ApiEnv,url:URL){const page=pageOf(url),data=await env.DB.batch<Record<string,unknown>>([sql(env.DB,'SELECT id,data,revision FROM ops_notices ORDER BY updated_at DESC LIMIT ? OFFSET ?',LIMIT,(page-1)*LIMIT),sql(env.DB,'SELECT count(*) n FROM ops_notices')]);return {items:parseRows<OpsNotice>(data[0]!.results as unknown as Array<{id:string;data:string;revision:number}>),total:Number(data[1]!.results[0]?.n??0),page,pageSize:LIMIT};}
export async function saveNotice(env:ApiEnv,admin:AdminIdentity,id:string|undefined,body:Record<string,unknown>){requireRole(admin,['owner','operator']);const input=change.parse(body),next=noticeSchema.parse(input.data);if(await replayed(env,admin,input,'notice.save',id??input.key,next))return {replayed:true};const prior=id?await one<{data:string;revision:number}>(env.DB,'SELECT data,revision FROM ops_notices WHERE id=?',id):null;ensure((prior?.revision??0)===input.revision,'OPS_CONFLICT','공지가 변경되었습니다. 새로고침해 주세요.',409);const target=id??input.key,now=Date.now();return write(env,admin,input,'notice.save',target,prior?JSON.parse(prior.data):null,next,[...(id?[assertSQL(env.DB,'SELECT revision=? FROM ops_notices WHERE id=?',input.revision,id)]:[]),sql(env.DB,'INSERT INTO ops_notices VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data,status=excluded.status,starts_at=excluded.starts_at,ends_at=excluded.ends_at,revision=excluded.revision,updated_at=excluded.updated_at',target,JSON.stringify(next),next.status,next.startsAt,next.endsAt,input.revision+1,now,now)]);}
export async function listEvents(env:ApiEnv,url:URL){const page=pageOf(url),data=await env.DB.batch<Record<string,unknown>>([sql(env.DB,'SELECT id,data,revision FROM ops_events ORDER BY updated_at DESC LIMIT ? OFFSET ?',LIMIT,(page-1)*LIMIT),sql(env.DB,'SELECT count(*) n FROM ops_events')]);return {items:parseRows<OpsEvent>(data[0]!.results as unknown as Array<{id:string;data:string;revision:number}>),total:Number(data[1]!.results[0]?.n??0),page,pageSize:LIMIT};}
export async function saveEvent(env:ApiEnv,admin:AdminIdentity,id:string|undefined,body:Record<string,unknown>){requireRole(admin,['owner','operator']);const input=change.parse(body),next=eventSchema.parse(input.data);if(await replayed(env,admin,input,'event.save',id??input.key,next))return {replayed:true};const prior=id?await one<{data:string;revision:number;kind:string}>(env.DB,'SELECT data,revision,kind FROM ops_events WHERE id=?',id):null;ensure((prior?.revision??0)===input.revision,'OPS_CONFLICT','이벤트가 변경되었습니다. 새로고침해 주세요.',409);ensure(env.ENVIRONMENT!=='production'||!next.imageUrl||new URL(next.imageUrl).protocol==='https:','INVALID_IMAGE_URL','운영 이벤트에는 HTTPS 이미지를 사용해 주세요.');ensure(!prior||prior.kind===next.kind,'EVENT_KIND_FIXED','생성 후에는 이벤트 종류를 바꿀 수 없습니다.');const target=id??input.key,now=Date.now();const statements:D1PreparedStatement[]=[];
 if(next.kind==='season'&&next.status==='published'){const overlap=await one(env.DB,"SELECT id FROM seasons WHERE id<>? AND starts_at<? AND ends_at>? AND NOT EXISTS(SELECT 1 FROM ops_events e WHERE e.id=seasons.id AND e.status<>'published')",target,next.endsAt,next.startsAt);ensure(!overlap,'SEASON_OVERLAP','진행 또는 예약된 다른 패스와 기간이 겹칩니다.',409);statements.push(sql(env.DB,'INSERT INTO seasons VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET starts_at=excluded.starts_at,ends_at=excluded.ends_at',target,next.startsAt,next.endsAt));}
 if(prior){statements.push(assertSQL(env.DB,'SELECT revision=? FROM ops_events WHERE id=?',input.revision,id));const old=JSON.parse(prior.data) as OpsEvent;if(next.kind==='season'){const issued=await one(env.DB,'SELECT 1 FROM season_owners WHERE season_id=? LIMIT 1',target);ensure(!issued||(old.startsAt===next.startsAt&&old.endsAt===next.endsAt),'SEASON_ALREADY_SOLD','구매자가 있는 패스의 기간은 변경할 수 없습니다. 중지 또는 재개를 사용해 주세요.',409);}}
 statements.push(sql(env.DB,'INSERT INTO ops_events VALUES(?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data,status=excluded.status,starts_at=excluded.starts_at,ends_at=excluded.ends_at,revision=excluded.revision,updated_at=excluded.updated_at',target,JSON.stringify(next),next.kind,next.status,next.startsAt,next.endsAt,input.revision+1,now,now));return write(env,admin,input,'event.save',target,prior?JSON.parse(prior.data):null,next,statements);
}
export async function listTickets(env:ApiEnv,url:URL){const status=url.searchParams.get('status')??'',q=(url.searchParams.get('q')??'').slice(0,100),page=pageOf(url),where="(?='' OR t.status=?) AND (?='' OR instr(lower(t.title),lower(?))>0 OR t.user_id=?)",data=await env.DB.batch<Record<string,unknown>>([sql(env.DB,`SELECT t.*,json_extract(p.data,'$.nickname') nickname FROM cs_tickets t JOIN players p ON p.id=t.user_id WHERE ${where} ORDER BY CASE t.priority WHEN 'high' THEN 0 ELSE 1 END,t.updated_at DESC LIMIT ? OFFSET ?`,status,status,q,q,q,LIMIT,(page-1)*LIMIT),sql(env.DB,`SELECT count(*) n FROM cs_tickets t WHERE ${where}`,status,status,q,q,q)]);return {items:data[0]!.results.map(ticketRow),total:Number(data[1]!.results[0]?.n??0),page,pageSize:LIMIT};}
export function ticketRow(r:Record<string,unknown>){return {id:String(r.id),userId:String(r.user_id),title:String(r.title),category:String(r.category),status:r.status,priority:r.priority,createdAt:Number(r.created_at),updatedAt:Number(r.updated_at),...(r.nickname?{nickname:String(r.nickname)}:{})};}
export async function ticketDetail(env:ApiEnv,id:string){const ticket=await one<Record<string,unknown>>(env.DB,'SELECT * FROM cs_tickets WHERE id=?',id);ensure(ticket,'TICKET_NOT_FOUND','문의를 찾을 수 없습니다.',404);return {...ticketRow(ticket),disputeSummary:ticket.dispute_summary??null,metadata:JSON.parse(String(ticket.metadata)),messages:(await rows<Record<string,unknown>>(env.DB,'SELECT id,author,body,created_at FROM cs_messages WHERE ticket_id=? ORDER BY created_at,id',id)).map(r=>({id:r.id,author:r.author,body:r.body,createdAt:r.created_at}))};}
export async function classifyConsumerDispute(env:ApiEnv,admin:AdminIdentity,id:string,body:Record<string,unknown>){
 requireRole(admin,['owner','operator','support']);
 const input=z.object({key,reason,summary:z.string().trim().min(2).max(2000).nullable()}).strict().parse(body);
 const action='support.dispute',after={summary:input.summary};
 if(await replayed(env,admin,input,action,id,after))return {replayed:true};
 const previous=await one<{dispute_summary:string|null;dispute_at:number|null}>(env.DB,'SELECT dispute_summary,dispute_at FROM cs_tickets WHERE id=?',id);
 ensure(previous,'TICKET_NOT_FOUND','문의를 찾을 수 없습니다.',404);
 return write(env,admin,input,action,id,undefined,after,[
  assertSQL(env.DB,'SELECT dispute_at IS ? FROM cs_tickets WHERE id=?',previous.dispute_at,id),
  sql(env.DB,'UPDATE cs_tickets SET dispute_summary=?,dispute_at=? WHERE id=?',input.summary,input.summary===null?null:Date.now(),id)
 ]);
}
export async function retainedRecords(env:ApiEnv,reference:string){
 const now=Date.now();
 const [purchases,disputes]=await env.DB.batch<Record<string,unknown>>([
  sql(env.DB,`SELECT provider,order_reference,product_id,price_milliunits,currency,purchased_at,supplied_at,refunded_at,expires_at
    FROM retained_purchase_records WHERE order_reference=? AND expires_at>? LIMIT 10`,reference,now),
  sql(env.DB,'SELECT id,summary,status,filed_at,handled_at,expires_at FROM retained_consumer_disputes WHERE id=? AND expires_at>?',reference,now)
 ]);
 return {purchases:purchases!.results,disputes:disputes!.results};
}
export async function respondTicket(env:ApiEnv,admin:AdminIdentity,id:string,body:Record<string,unknown>){requireRole(admin,['owner','operator','support']);const input=z.object({key,reason,body:z.string().trim().min(1).max(6000),internal:z.boolean(),status:z.enum(['open','pending','resolved','closed'])}).strict().parse(body),before=await one<{status:string}>(env.DB,'SELECT status FROM cs_tickets WHERE id=?',id);ensure(before,'TICKET_NOT_FOUND','문의를 찾을 수 없습니다.',404);return write(env,admin,input,'support.reply',id,before,{body:input.body,internal:input.internal,status:input.status},[sql(env.DB,'INSERT INTO cs_messages VALUES(?,?,?,?,?,?)',uid(),id,input.internal?'note':'admin',admin.id,input.body,Date.now()),sql(env.DB,'UPDATE cs_tickets SET status=?,updated_at=? WHERE id=?',input.status,Date.now(),id)]);}
export async function listAudit(env:ApiEnv,url:URL){const q=(url.searchParams.get('q')??'').slice(0,100),page=pageOf(url),where="(?='' OR instr(actor,?)>0 OR instr(target,?)>0 OR instr(action,?)>0)",data=await env.DB.batch<Record<string,unknown>>([sql(env.DB,`SELECT * FROM admin_audit WHERE ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,q,q,q,q,LIMIT,(page-1)*LIMIT),sql(env.DB,`SELECT count(*) n FROM admin_audit WHERE ${where}`,q,q,q,q)]);return {items:data[0]!.results,total:Number(data[1]!.results[0]?.n??0),page,pageSize:LIMIT};}
export async function listHealth(env:ApiEnv){const data=await env.DB.batch<Record<string,unknown>>([sql(env.DB,"SELECT id,user_id,placement,status,approved_at,expires_at FROM reward_intents WHERE status IN('pending','review') ORDER BY approved_at DESC LIMIT 50"),sql(env.DB,'SELECT id,topic,attempts,created_at FROM outbox WHERE delivered_at IS NULL ORDER BY created_at LIMIT 50'),sql(env.DB,'SELECT provider,product_id,user_id,status,created_at,transaction_id FROM purchases ORDER BY created_at DESC LIMIT 50')]);return {ads:data[0]!.results,outbox:data[1]!.results,purchases:data[2]!.results};}
export async function listReports(env:ApiEnv,url:URL){
 const page=pageOf(url),data=await env.DB.batch<Record<string,unknown>>([
  sql(env.DB,`SELECT r.*,CASE WHEN d.deleted_at IS NULL THEN m.text END message,m.user_id reported_user,
    m.nickname reported_nickname,g.name guild_name,d.deleted_at,c.status,c.note
    FROM reports r JOIN chat_messages m ON m.id=r.message_id JOIN guilds g ON g.id=m.guild_id
    LEFT JOIN deleted_chat_messages d ON d.message_id=m.id LEFT JOIN ops_reports c ON c.report_id=r.id
    ORDER BY r.created_at DESC,r.id LIMIT ? OFFSET ?`,LIMIT,(page-1)*LIMIT),
  sql(env.DB,'SELECT count(*) n FROM reports'),
 ]);
 return {items:data[0]!.results,total:Number(data[1]!.results[0]?.n??0),page,pageSize:LIMIT};
}

export async function resolveReport(env:ApiEnv,admin:AdminIdentity,id:string,body:Record<string,unknown>){
 requireRole(admin,['owner','operator','support']);
 const input=z.object({key,reason,status:z.enum(['reviewing','resolved','dismissed']),note:z.string().max(2000)}).strict().parse(body);
 const action='report.resolve',next={status:input.status,note:input.note};
 if(await replayed(env,admin,input,action,id,next))return {replayed:true};
 const report=await one<{message_id:string;deleted_at:number|null}>(env.DB,`SELECT r.message_id,d.deleted_at FROM reports r
   LEFT JOIN deleted_chat_messages d ON d.message_id=r.message_id WHERE r.id=?`,id);
 ensure(report,'REPORT_NOT_FOUND','신고를 찾을 수 없습니다.',404);
 ensure(report.deleted_at===null,'REPORT_MESSAGE_DELETED','이미 삭제 처리된 메시지입니다.',409);
 return write(env,admin,input,action,id,undefined,next,[
  assertSQL(env.DB,'NOT EXISTS(SELECT 1 FROM deleted_chat_messages WHERE message_id=?)',report.message_id),
  sql(env.DB,'INSERT INTO ops_reports VALUES(?,?,?,?,?) ON CONFLICT(report_id) DO UPDATE SET status=excluded.status,note=excluded.note,updated_at=excluded.updated_at,updated_by=excluded.updated_by',id,input.status,input.note,Date.now(),admin.id),
 ]);
}

export async function deleteReportedMessage(env:ApiEnv,admin:AdminIdentity,id:string,body:Record<string,unknown>){
 requireRole(admin,['owner','operator','support']);
 const input=z.object({key,reason}).strict().parse(body);
 const action='report.message.delete',next={messageDeleted:true};
 if(await replayed(env,admin,input,action,id,next))return {replayed:true};
 const report=await one<{message_id:string;guild_id:string;user_id:string;deleted_at:number|null}>(env.DB,`SELECT r.message_id,m.guild_id,m.user_id,d.deleted_at
   FROM reports r JOIN chat_messages m ON m.id=r.message_id LEFT JOIN deleted_chat_messages d ON d.message_id=m.id WHERE r.id=?`,id);
 ensure(report,'REPORT_NOT_FOUND','신고를 찾을 수 없습니다.',404);
 if(report.deleted_at!==null)return {alreadyDeleted:true};

 const now=Date.now(),removedText='[삭제된 메시지]';
 return write(env,admin,input,action,id,undefined,next,[
  assertSQL(env.DB,'SELECT message_id=? FROM reports WHERE id=?',report.message_id,id),
  sql(env.DB,'INSERT INTO deleted_chat_messages(message_id,deleted_at) VALUES(?,?)',report.message_id,now),
  sql(env.DB,'UPDATE chat_messages SET text=? WHERE id=?',removedText,report.message_id),
  // A completed send caches the original text in its response and fingerprint.
  sql(env.DB,`UPDATE operations SET response=json_set(response,'$.message.text',?),fingerprint=?
   WHERE user_id=? AND fingerprint LIKE 'guild:chat:%' AND json_extract(response,'$.message.id')=?`,
   removedText,'guild:chat:deleted:'+report.message_id,report.user_id,report.message_id),
  sql(env.DB,`INSERT INTO ops_reports(report_id,status,note,updated_at,updated_by)
   SELECT id,'resolved','',?,? FROM reports WHERE message_id=?
   ON CONFLICT(report_id) DO UPDATE SET status='resolved',updated_at=excluded.updated_at,updated_by=excluded.updated_by`,
   now,admin.id,report.message_id),
  sql(env.DB,'INSERT INTO outbox(id,topic,payload,created_at) VALUES(?,?,?,?)',uid(),report.guild_id,'{"type":"chat"}',now),
 ]);
}
