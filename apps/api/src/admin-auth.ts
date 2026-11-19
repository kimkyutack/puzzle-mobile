import {timingSafeEqual} from 'node:crypto';
import {z} from 'zod';
import type {AdminIdentity,AdminRole} from '../../../packages/contracts/src/operations';
import {assertSQL,digest,ensure,one,sql,uid,type ApiEnv} from './db';
export type AdminSession=AdminIdentity&{csrf:string;tokenHash:string};
const PASSWORD_ROUNDS=100000;
const passwordSchema=z.string().min(12,'비밀번호는 12자 이상이어야 합니다.').max(200).refine(v=>/[\p{L}]/u.test(v)&&/\d/.test(v),'문자와 숫자를 포함해 주세요.');
const random=()=>Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('base64url');
const local=(request:Request,env:ApiEnv)=>env.ENVIRONMENT==='development'&&['localhost','127.0.0.1'].includes(new URL(request.url).hostname)&&new URL(request.url).protocol==='http:';
const cookieName=(request:Request,env:ApiEnv)=>local(request,env)?'garden_admin_dev':'__Host-garden_admin';
function cookie(request:Request,env:ApiEnv,token:string,seconds=28800){return `${cookieName(request,env)}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${seconds}${local(request,env)?'':'; Secure'}`;}
function readCookie(request:Request,env:ApiEnv){const name=cookieName(request,env);return request.headers.get('cookie')?.split(';').map(v=>v.trim()).find(v=>v.startsWith(name+'='))?.slice(name.length+1)??'';}
export function adminResponse(data:unknown,status=200,headers:Record<string,string>={}){return Response.json({data,serverNow:Date.now()},{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...headers}});}
export function sameOrigin(request:Request){ensure(request.headers.get('origin')===new URL(request.url).origin,'ADMIN_ORIGIN','운영 콘솔에서 다시 시도해 주세요.',403);}
async function equal(a:string,b:string){return timingSafeEqual(Buffer.from(await digest(a)),Buffer.from(await digest(b)));}
async function passwordHash(password:string,salt:string,env:ApiEnv){
 ensure(env.ADMIN_PASSWORD_PEPPER&&env.ADMIN_PASSWORD_PEPPER.length>=32,'ADMIN_NOT_CONFIGURED','관리자 보안 설정이 필요합니다.',503);
 const encoder=new TextEncoder(),pepper=await crypto.subtle.importKey('raw',encoder.encode(env.ADMIN_PASSWORD_PEPPER),{name:'HMAC',hash:'SHA-256'},false,['sign']);
 const prehash=await crypto.subtle.sign('HMAC',pepper,encoder.encode(password)),key=await crypto.subtle.importKey('raw',prehash,'PBKDF2',false,['deriveBits']);
 return Buffer.from(await crypto.subtle.deriveBits({name:'PBKDF2',salt:encoder.encode(salt),iterations:PASSWORD_ROUNDS,hash:'SHA-256'},key,256)).toString('base64url');
}
async function authRate(env:ApiEnv,request:Request,email:string){
 const now=Date.now(),window=Math.floor(now/900000),ip=await digest(request.headers.get('cf-connecting-ip')??'local');
 const results=await env.DB.batch<Record<string,unknown>>([sql(env.DB,'INSERT INTO rate_limits VALUES(?,?,1,?) ON CONFLICT(key,window) DO UPDATE SET hits=hits+1 RETURNING hits','admin-ip:'+ip,window,(window+1)*900000),sql(env.DB,'INSERT INTO rate_limits VALUES(?,?,1,?) ON CONFLICT(key,window) DO UPDATE SET hits=hits+1 RETURNING hits','admin-email:'+await digest(email),window,(window+1)*900000)]);
 ensure(results.every(r=>Number(r.results[0]?.hits)<=10),'RATE_LIMIT','로그인 시도가 많습니다. 15분 뒤 다시 시도해 주세요.',429);
}
export function auditStatement(env:ApiEnv,actor:string,action:string,target:string,reason:string,before:unknown,after:unknown,key:string=uid(),fingerprint=action+':'+target){return sql(env.DB,'INSERT INTO admin_audit VALUES(?,?,?,?,?,?,?,?,?,?)',uid(),actor,action,target,reason,before===undefined?null:JSON.stringify(before),after===undefined?null:JSON.stringify(after),key,fingerprint,Date.now());}
async function newSession(env:ApiEnv,account:AdminIdentity){const token=random(),csrf=random(),now=Date.now();return {token,csrf,statement:sql(env.DB,'INSERT INTO admin_sessions VALUES(?,?,?,?,?)',await digest(token),account.id,csrf,now+28800000,now)};}
function owners(env:ApiEnv){return (env.ADMIN_OWNER_EMAILS??'').split(',').map(e=>e.trim().toLowerCase()).filter(Boolean);}
export async function adminAuthRoute(request:Request,env:ApiEnv,path:string,body:Record<string,unknown>):Promise<Response|null>{
 if(path==='/admin/auth/meta'&&request.method==='GET'){const existing=await one(env.DB,'SELECT 1 FROM admin_accounts LIMIT 1');return adminResponse({initialized:!!existing,configured:!!env.ADMIN_PASSWORD_PEPPER&&!!env.ADMIN_BOOTSTRAP_TOKEN});}
 if(!['/admin/auth/login','/admin/auth/setup'].includes(path)||request.method!=='POST')return null;
 sameOrigin(request);const input=z.object({email:z.email().max(200).transform(v=>v.toLowerCase()),password:z.string().min(1).max(200),token:z.string().max(200).optional()}).strict().parse(body);await authRate(env,request,input.email);
 if(path.endsWith('/setup')){
  passwordSchema.parse(input.password);let role:AdminRole='owner',invited=false;
  if(input.token&&env.ADMIN_BOOTSTRAP_TOKEN&&await equal(input.token,env.ADMIN_BOOTSTRAP_TOKEN))ensure(owners(env).includes(input.email),'ADMIN_DENIED','허용된 관리자 이메일을 사용해 주세요.',403);
  else{const invitation=input.token?await one<{email:string;role:AdminRole}>(env.DB,'SELECT email,role FROM admin_invites WHERE token_hash=? AND expires_at>? AND consumed_at IS NULL',await digest(input.token),Date.now()):null;ensure(invitation&&invitation.email.toLowerCase()===input.email,'ADMIN_INVITE_INVALID','초기 설정 또는 초대 링크가 만료되었습니다.',403);role=invitation.role;invited=true;}
  const account:AdminIdentity={id:uid(),email:input.email,role},salt=random(),hash=await passwordHash(input.password,salt,env),session=await newSession(env,account),statements=[];
  if(!invited)statements.push(assertSQL(env.DB,'SELECT count(*)=0 FROM admin_accounts'));
  else statements.push(assertSQL(env.DB,'SELECT consumed_at IS NULL AND expires_at>? FROM admin_invites WHERE token_hash=?',Date.now(),await digest(input.token!)),sql(env.DB,'UPDATE admin_invites SET consumed_at=? WHERE email=? AND consumed_at IS NULL',Date.now(),input.email));
  statements.push(sql(env.DB,'INSERT INTO admin_accounts(id,email,password_hash,password_salt,role,created_at,last_login_at) VALUES(?,?,?,?,?,?,?)',account.id,account.email,hash,salt,role,Date.now(),Date.now()),session.statement,auditStatement(env,account.email,'admin.setup',account.id,'관리자 최초 등록',undefined,{email:account.email,role}),sql(env.DB,'DELETE FROM tx_assertions'));
  await env.DB.batch(statements);return adminResponse({admin:account,csrf:session.csrf},201,{'Set-Cookie':cookie(request,env,session.token)});
 }
 const row=await one<AdminIdentity&{password_hash:string;password_salt:string;enabled:number}>(env.DB,'SELECT id,email,role,password_hash,password_salt,enabled FROM admin_accounts WHERE email=?',input.email);
 const hash=await passwordHash(input.password,row?.password_salt??'invalid-login-constant-salt-32bytes',env),valid=await equal(hash,row?.password_hash??'invalid');
 ensure(row&&row.enabled&&valid,'ADMIN_UNAUTHORIZED','이메일 또는 비밀번호를 확인해 주세요.',401);
 const admin:AdminIdentity={id:row.id,email:row.email,role:row.role},session=await newSession(env,admin);
 await env.DB.batch<Record<string,unknown>>([session.statement,sql(env.DB,'UPDATE admin_accounts SET last_login_at=? WHERE id=?',Date.now(),admin.id),auditStatement(env,admin.email,'admin.login',admin.id,'로그인',undefined,{role:admin.role})]);return adminResponse({admin,csrf:session.csrf},200,{'Set-Cookie':cookie(request,env,session.token)});
}
export async function requireAdmin(request:Request,env:ApiEnv):Promise<AdminSession>{
 const token=readCookie(request,env);ensure(token&&token.length<=200,'ADMIN_UNAUTHORIZED','운영 콘솔에 로그인해 주세요.',401);const tokenHash=await digest(token);
 const account=await one<AdminIdentity&{csrf:string}>(env.DB,'SELECT a.id,a.email,a.role,s.csrf_token csrf FROM admin_sessions s JOIN admin_accounts a ON a.id=s.admin_id WHERE s.token_hash=? AND s.expires_at>? AND a.enabled=1',tokenHash,Date.now());ensure(account,'ADMIN_UNAUTHORIZED','관리자 세션이 만료되었습니다.',401);
 if(!['GET','HEAD'].includes(request.method)){sameOrigin(request);ensure(await equal(request.headers.get('x-admin-csrf')??'',account.csrf),'ADMIN_CSRF','화면을 새로고침하고 다시 시도해 주세요.',403);}
 return {...account,tokenHash};
}
export function requireRole(admin:AdminIdentity,roles:AdminRole[]){ensure(roles.includes(admin.role),'ADMIN_FORBIDDEN','이 작업을 수행할 권한이 없습니다.',403);}
export async function logoutAdmin(request:Request,env:ApiEnv,admin:AdminSession){await env.DB.batch<Record<string,unknown>>([sql(env.DB,'DELETE FROM admin_sessions WHERE token_hash=?',admin.tokenHash),auditStatement(env,admin.email,'admin.logout',admin.id,'로그아웃',undefined,undefined)]);return adminResponse({loggedOut:true},200,{'Set-Cookie':cookie(request,env,'',0)});}
export async function inviteAdmin(request:Request,env:ApiEnv,admin:AdminSession,body:Record<string,unknown>){requireRole(admin,['owner']);const input=z.object({email:z.email().max(200).transform(v=>v.toLowerCase()),role:z.enum(['operator','support','viewer']),reason:z.string().trim().min(2).max(500)}).strict().parse(body),token=random(),expires=Date.now()+86400000;await env.DB.batch<Record<string,unknown>>([sql(env.DB,'INSERT INTO admin_invites VALUES(?,?,?,?,?,NULL)',await digest(token),input.email,input.role,admin.id,expires),auditStatement(env,admin.email,'admin.invite',input.email,input.reason,undefined,{email:input.email,role:input.role,expiresAt:expires})]);return {url:new URL('/admin',request.url).href+'#invite='+token,email:input.email,expiresAt:expires};}
export async function changePassword(request:Request,env:ApiEnv,admin:AdminSession,body:Record<string,unknown>){const input=z.object({currentPassword:z.string().max(200),password:passwordSchema}).strict().parse(body),row=await one<{password_hash:string;password_salt:string}>(env.DB,'SELECT password_hash,password_salt FROM admin_accounts WHERE id=?',admin.id);ensure(row&&await equal(await passwordHash(input.currentPassword,row.password_salt,env),row.password_hash),'ADMIN_UNAUTHORIZED','현재 비밀번호가 일치하지 않습니다.',401);const salt=random();await env.DB.batch<Record<string,unknown>>([sql(env.DB,'UPDATE admin_accounts SET password_hash=?,password_salt=? WHERE id=?',await passwordHash(input.password,salt,env),salt,admin.id),sql(env.DB,'DELETE FROM admin_sessions WHERE admin_id=? AND token_hash<>?',admin.id,admin.tokenHash),auditStatement(env,admin.email,'admin.password',admin.id,'본인 비밀번호 변경 및 다른 세션 종료',undefined,undefined)]);return {changed:true};}
