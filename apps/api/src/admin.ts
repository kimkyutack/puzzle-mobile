import {uploadAdminImage} from './admin-media';
import {z} from 'zod';
import {ENGINE_VERSION,SUPPORTED_ENGINE_VERSIONS,CONTENT_VERSION} from '@garden/contracts';
import {APPROVED_LEVEL_COUNT} from '@garden/content';
import {digest,ensure,HttpError,rows,sql,assertSQL,one,type ApiEnv} from './db';
import {bodyOf} from './validation';
import {adminAuthRoute,adminResponse,requireAdmin,requireRole,logoutAdmin,inviteAdmin,changePassword,auditStatement} from './admin-auth';
import * as data from './admin-data';
import {listGuardianRequests,reviewGuardianRequest,withdrawGuardianConsent} from './admin-guardian';
import {runtime} from './operations';
import {erasureAccountHash,eraseAccount} from './account-erasure';
import {exportErasureReceipts,importErasureReceipts,replayErasureReceipts} from './restore-erasure';
import {privacyAccessRecord} from './retention';
export async function serveAdmin(request:Request,env:ApiEnv){
 ensure(env.ADMIN_ASSETS,'ADMIN_NOT_BUILT','운영 콘솔 빌드가 필요합니다.',503);const url=new URL(request.url),suffix=url.pathname.slice('/admin'.length);
 const file=suffix.startsWith('/assets/')?suffix:'/index.html';const forwarded=new URL(file,url.origin);const result=await env.ADMIN_ASSETS.fetch(new Request(forwarded,{method:request.method==='HEAD'?'HEAD':'GET'}));
 const headers=new Headers(result.headers);headers.set('X-Content-Type-Options','nosniff');headers.set('Referrer-Policy','no-referrer');headers.set('X-Frame-Options','DENY');headers.set('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'");headers.set('Cache-Control',file==='/index.html'?'no-store':'public,max-age=31536000,immutable');return new Response(result.body,{status:result.status,headers});
}
export async function adminApi(request:Request,env:ApiEnv,path:string){
 if(path==='/admin/media'&&request.method==='POST')return uploadAdminImage(request,env);
 const method=request.method,body=['POST','PUT','PATCH','DELETE'].includes(method)?await bodyOf(request):{},auth=await adminAuthRoute(request,env,path,body);if(auth)return auth;
 const admin=await requireAdmin(request,env),url=new URL(request.url);let result:unknown;
 if(path==='/admin/session'&&method==='GET')result={admin:{id:admin.id,email:admin.email,role:admin.role},csrf:admin.csrf};
 else if(path==='/admin/auth/logout'&&method==='POST')return logoutAdmin(request,env,admin);
 else if(path==='/admin/auth/password'&&method==='POST')result=await changePassword(request,env,admin,body);
 else if(path==='/admin/overview'&&method==='GET')result=await data.dashboard(env);
 else if(path==='/admin/runtime'&&method==='GET')result=await runtime(env);
 else if(path==='/admin/runtime'&&method==='PUT')result=await data.saveRuntime(env,admin,body);
 else if(path==='/admin/users'&&method==='GET')result=await data.listUsers(env,url);
 else if(/^\/admin\/users\/[^/]+$/.test(path)&&method==='GET')result=await data.userDetail(env,path.split('/')[3]!,admin.role==='owner');
 else if(/^\/admin\/users\/[^/]+\/grant$/.test(path)&&method==='POST')result=await data.grantUser(env,admin,path.split('/')[3]!,body);
 else if(/^\/admin\/users\/[^/]+\/profile$/.test(path)&&method==='PUT')result=await data.changeUser(env,admin,path.split('/')[3]!,body);
 else if(/^\/admin\/users\/[^/]+\/birth-date$/.test(path)&&method==='PUT')result=await data.correctUserBirthDate(env,admin,path.split('/')[3]!,body);
 else if(/^\/admin\/users\/[^/]+\/restriction$/.test(path)&&method==='PUT')result=await data.controlUser(env,admin,path.split('/')[3]!,body);
 else if(/^\/admin\/users\/[^/]+\/erase$/.test(path)&&method==='POST'){
  requireRole(admin,['owner']);
  const userId=z.string().uuid().parse(path.split('/')[3]);
  z.object({confirmed:z.literal(true)}).strict().parse(body);
  result=await eraseAccount(env,userId,'request',privacyAccessRecord(env,admin.id,request.headers.get('CF-Connecting-IP'),'account.erase',await erasureAccountHash(userId)));
 }
 else if(path==='/admin/notices'&&method==='GET')result=await data.listNotices(env,url);
 else if(path==='/admin/notices'&&method==='POST')result=await data.saveNotice(env,admin,undefined,body);
 else if(/^\/admin\/notices\/[^/]+$/.test(path)&&method==='PUT')result=await data.saveNotice(env,admin,path.split('/')[3]!,body);
 else if(path==='/admin/events'&&method==='GET')result=await data.listEvents(env,url);
 else if(path==='/admin/events'&&method==='POST')result=await data.saveEvent(env,admin,undefined,body);
 else if(/^\/admin\/events\/[^/]+$/.test(path)&&method==='PUT')result=await data.saveEvent(env,admin,path.split('/')[3]!,body);
 else if(path==='/admin/tickets'&&method==='GET')result=await data.listTickets(env,url);
 else if(/^\/admin\/tickets\/[^/]+$/.test(path)&&method==='GET')result=await data.ticketDetail(env,path.split('/')[3]!);
 else if(/^\/admin\/tickets\/[^/]+\/reply$/.test(path)&&method==='POST')result=await data.respondTicket(env,admin,path.split('/')[3]!,body);
 else if(/^\/admin\/tickets\/[^/]+\/dispute$/.test(path)&&method==='PUT')result=await data.classifyConsumerDispute(env,admin,path.split('/')[3]!,body);
 else if(path==='/admin/audit'&&method==='GET')result=await data.listAudit(env,url);
 else if(path==='/admin/health'&&method==='GET')result={...await data.listHealth(env),engineVersion:ENGINE_VERSION,supportedEngineVersions:SUPPORTED_ENGINE_VERSIONS,contentVersion:CONTENT_VERSION,levels:APPROVED_LEVEL_COUNT};
 else if(path==='/admin/reports'&&method==='GET')result=await data.listReports(env,url);
 else if(path==='/admin/privacy/erasure-receipts'&&method==='GET'){
  requireRole(admin,['owner']);
  const after=z.string().regex(/^(?:[a-f0-9]{64})?$/).parse(url.searchParams.get('after')??'');
  result=await exportErasureReceipts(env,after);
 }
 else if(path==='/admin/privacy/retained-records'&&method==='POST'){
  requireRole(admin,['owner']);const input=z.object({reference:z.string().trim().min(1).max(128)}).strict().parse(body);
  result=await data.retainedRecords(env,input.reference);
 }
 else if((path==='/admin/privacy/erasure-receipts'||path==='/admin/privacy/replay-erasures')&&method==='POST'){
  requireRole(admin,['owner']);
  const settings=(await runtime(env)).settings.maintenance,now=Date.now();
  ensure(settings.enabled&&settings.startsAt<=now&&(settings.endsAt===null||settings.endsAt>now),'MAINTENANCE_REQUIRED','복원 중에는 점검을 먼저 활성화해 주세요.',409);
  if(path==='/admin/privacy/erasure-receipts'){
   const input=z.object({items:z.array(z.object({account_hash:z.string().regex(/^[a-f0-9]{64}$/),erased_at:z.number().int().positive(),expires_at:z.number().int().positive()}).strict()).max(100)}).strict().parse(body);
   result=await importErasureReceipts(env,input.items);
  }else{
   const input=z.object({after:z.string().max(80).default('')}).strict().parse(body);
   result=await replayErasureReceipts(env,input.after);
  }
 }
 else if(path==='/admin/guardian-consents'&&method==='GET')result=await listGuardianRequests(env,admin);
 else if(path==='/admin/guardian-consents/withdraw'&&method==='POST')result=await withdrawGuardianConsent(env,admin,body);
 else if(/^\/admin\/guardian-consents\/[^/]+$/.test(path)&&method==='POST')result=await reviewGuardianRequest(env,admin,path.split('/')[3]!,body);
 else if(/^\/admin\/reports\/[^/]+$/.test(path)&&method==='PUT')result=await data.resolveReport(env,admin,path.split('/')[3]!,body);
 else if(/^\/admin\/reports\/[^/]+\/message$/.test(path)&&method==='DELETE')result=await data.deleteReportedMessage(env,admin,path.split('/')[3]!,body);
 else if(path==='/admin/accounts'&&method==='GET'){requireRole(admin,['owner']);result={items:await rows(env.DB,'SELECT id,email,role,enabled,created_at,last_login_at FROM admin_accounts ORDER BY created_at'),invites:await rows(env.DB,'SELECT token_hash id,email,role,expires_at FROM admin_invites WHERE consumed_at IS NULL AND expires_at>? ORDER BY expires_at DESC',Date.now())};}
 else if(/^\/admin\/accounts\/invites\/[^/]+\/revoke$/.test(path)&&method==='POST'){
  requireRole(admin,['owner']);const id=path.split('/')[4]!,input=z.object({key:z.string().uuid(),reason:z.string().trim().min(2).max(500)}).strict().parse(body),invite=await one<{email:string}>(env.DB,'SELECT email FROM admin_invites WHERE token_hash=?',id);ensure(invite,'INVITE_NOT_FOUND','초대를 찾을 수 없습니다.',404);await env.DB.batch([sql(env.DB,'UPDATE admin_invites SET consumed_at=? WHERE token_hash=?',Date.now(),id),auditStatement(env,admin.email,'admin.invite.revoke',invite.email,input.reason,undefined,undefined,input.key)]);result={revoked:true};
 }
 else if(path==='/admin/accounts/invite'&&method==='POST')result=await inviteAdmin(request,env,admin,body);
 else if(/^\/admin\/accounts\/[^/]+$/.test(path)&&method==='PUT'){
  requireRole(admin,['owner']);const target=path.split('/')[3]!,input=z.object({enabled:z.boolean(),role:z.enum(['operator','support','viewer']),reason:z.string().trim().min(2).max(500),key:z.string().uuid()}).strict().parse(body),old=await one<{role:string}>(env.DB,'SELECT role FROM admin_accounts WHERE id=?',target);ensure(old&&old.role!=='owner'&&target!==admin.id,'OWNER_PROTECTED','최초 소유자 계정은 변경할 수 없습니다.',409);
  await env.DB.batch([assertSQL(env.DB,"SELECT role<>'owner' FROM admin_accounts WHERE id=?",target),sql(env.DB,'UPDATE admin_accounts SET enabled=?,role=? WHERE id=?',input.enabled?1:0,input.role,target),sql(env.DB,'DELETE FROM admin_sessions WHERE admin_id=?',target),auditStatement(env,admin.email,'admin.account',target,input.reason,old,{enabled:input.enabled,role:input.role},input.key),sql(env.DB,'DELETE FROM tx_assertions')]);result={saved:true};
 }
 else throw new HttpError('NOT_FOUND','운영 기능을 찾을 수 없습니다.',404);
 const accessPath=/^\/admin\/(users|tickets|reports|health|guardian-consents|privacy)(?:\/|$)/.test(path);
 if(accessPath&&!path.endsWith('/erase')){
  const subject=path==='/admin/privacy/retained-records'?String(body.reference):path.split('/')[3]??'';
  await privacyAccessRecord(env,admin.id,request.headers.get('CF-Connecting-IP'),`${method} ${path.replace(/\/[a-f0-9]{8}-[a-f0-9-]{27}(?=\/|$)/gi,'/:id')}`,
    path==='/admin/privacy/retained-records'||/^[a-f0-9]{8}-[a-f0-9-]{27}$/i.test(subject)?await digest('garden:privacy-access:v1:'+subject):'collection').run();
 }
 return adminResponse(result);
}
