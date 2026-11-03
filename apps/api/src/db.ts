import type { Item, Player, Run } from '@garden/contracts';

export type ApiEnv = { [K in keyof Env]: Env[K] extends string ? string : Env[K] } & {
  ADMIN_TOKEN?:string; GOOGLE_CLIENT_IDS?:string; APPLE_CLIENT_IDS?:string; GOOGLE_SERVICE_ACCOUNT_JSON?:string;
  GOOGLE_PACKAGE_NAME?:string; APPLE_APP_ID?:string; APPLE_IAP_ISSUER_ID?:string; APPLE_IAP_KEY_ID?:string;
  GOOGLE_IAP_ENVIRONMENT?:string;
  APPLE_IAP_PRIVATE_KEY?:string; APPLE_IAP_ENVIRONMENT?:'Sandbox'|'Production'; APPLE_ROOT_CA_PEMS?:string;
  ADMOB_AD_UNITS?:string; ADMOB_REWARD_ITEMS?:string; GOOGLE_RTDN_AUDIENCE?:string; GOOGLE_RTDN_EMAIL?:string;
  APPLE_TEAM_ID?:string; APPLE_AUTH_KEY_ID?:string; APPLE_AUTH_PRIVATE_KEY?:string; APPLE_AUTH_CLIENT_ID?:string; APPLE_AUTH_REDIRECT_URL?:string;
  AUTH_TOKEN_ENCRYPTION_KEY?:string;
};
export class HttpError extends Error {
  constructor(public code:string,message:string,public status=400){super(message);}
}
export function ensure(ok:unknown,code:string,message:string,status=400):asserts ok{if(!ok)throw new HttpError(code,message,status);}
export const uid=()=>crypto.randomUUID();
export const day=(now:number)=>Math.floor(now/86_400_000);
export const sql=(db:D1Database,query:string,...args:unknown[])=>db.prepare(query).bind(...args);
export async function one<T>(db:D1Database,query:string,...args:unknown[]){return sql(db,query,...args).first<T>();}
export async function rows<T>(db:D1Database,query:string,...args:unknown[]){return (await sql(db,query,...args).all<T>()).results;}
export async function digest(value:string){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value))),x=>x.toString(16).padStart(2,'0')).join('');}
export async function readPlayer(db:D1Database,id:string,now=Date.now()):Promise<Player>{
  const r=await one<{data:string}>(db,'SELECT data FROM players WHERE id=? AND deleted_at IS NULL',id);
  ensure(r,'ACCOUNT_NOT_FOUND','계정을 찾을 수 없습니다.',401);
  const player=recoverHearts(JSON.parse(r.data) as Player,now);
  for(const item of ITEMS)player.inventory[item]??={normal:0,bound:0};
  const season=await one<{starts_at:number;ends_at:number}>(db,'SELECT starts_at,ends_at FROM seasons WHERE starts_at<=? AND ends_at>? ORDER BY starts_at DESC LIMIT 1',now,now);
  const progress=season?await one<{n:number}>(db,'SELECT count(*) n FROM level_rewards WHERE user_id=? AND created_at>=? AND created_at<?',id,season.starts_at,season.ends_at):null;
  player.passPoints=(progress?.n??0)*10;
  return player;
}
export function recoverHearts(player:Player,now:number):Player {
  const p=structuredClone(player);
  if(p.hearts>=5){p.heartAt=0;return p;}
  if(!p.heartAt){p.heartAt=now;return p;}
  const recovered=Math.max(0,Math.floor((now-p.heartAt)/3_600_000));
  p.hearts=Math.min(5,p.hearts+recovered);
  p.heartAt=p.hearts===5?0:p.heartAt+recovered*3_600_000;
  return p;
}
export function consumeHeart(p:Player,now:number){
  if(p.unlimitedUntil>now)return false;
  ensure(p.hearts>0,'HEARTS_EMPTY','하트가 부족해요. 다음 회복을 기다리거나 무료 보너스를 확인하세요.',409);
  if(p.hearts===5)p.heartAt=now;
  p.hearts--;return true;
}
export function spendCoins(p:Player,amount:number){
  ensure(Number.isInteger(amount)&&amount>=0,'INVALID_COST','잘못된 비용입니다.');
  ensure(p.coins+p.boundCoins>=amount,'COINS_EMPTY','코인이 부족해요.',409);
  const bound=Math.min(p.boundCoins,amount);p.boundCoins-=bound;p.coins-=amount-bound;return bound>0;
}
export function spendItem(p:Player,item:Item,transfer=false){
  const v=p.inventory[item];ensure(v && (transfer?v.normal:v.normal+v.bound)>0,'ITEMS_EMPTY',transfer?'지원 가능한 아이템이 없어요.':'아이템이 부족해요.',409);
  if(!transfer&&v.bound>0)v.bound--;else v.normal--;
}
export async function readRun(db:D1Database,id:string,userId:string):Promise<Run>{
  const row=await one<{data:string}>(db,'SELECT data FROM runs WHERE id=? AND user_id=?',id,userId);
  ensure(row,'RUN_NOT_FOUND','진행 중인 퍼즐을 찾을 수 없어요.',404);return JSON.parse(row.data) as Run;
}
export async function activeRun(db:D1Database,userId:string):Promise<Run|null>{
  const row=await one<{data:string}>(db,"SELECT data FROM runs WHERE user_id=? AND status='active'",userId);return row?JSON.parse(row.data) as Run:null;
}
export function saveRun(db:D1Database,r:Run){return sql(db,'UPDATE runs SET data=?,status=?,sequence=? WHERE id=?',JSON.stringify(r),r.status,r.sequence,r.id);}
export function assertSQL(db:D1Database,condition:string,...args:unknown[]){
  // INSERT always inserts exactly one row: false or NULL aborts the entire D1 batch.
  return sql(db,`INSERT INTO tx_assertions(id,ok) VALUES (?,CASE WHEN (${condition}) THEN 1 ELSE 0 END)`,uid(),...args);
}
export interface MutationContext {db:D1Database;now:number;player:Player;statements:D1PreparedStatement[];changed:Map<string,Player>;sourceId:string;touch:(p:Player)=>void;notify:(guildId:string,payload:unknown)=>void;}
export async function mutate<T>(env:ApiEnv,userId:string,key:string,fingerprint:string,fn:(tx:MutationContext)=>Promise<T>|T,options:{touchPlayer?:boolean}={}):Promise<T>{
  ensure(typeof key==='string'&&key.length>=8&&key.length<=100,'INVALID_IDEMPOTENCY_KEY','요청 식별자가 필요합니다.');
  for(let attempt=0;attempt<4;attempt++){
    const prior=await one<{fingerprint:string;response:string}>(env.DB,'SELECT fingerprint,response FROM operations WHERE user_id=? AND key=?',userId,key);
    if(prior){ensure(prior.fingerprint===fingerprint,'IDEMPOTENCY_CONFLICT','다른 요청에 사용한 식별자입니다.',409);return JSON.parse(prior.response) as T;}
    const now=Date.now();const player=await readPlayer(env.DB,userId,now);const changed=new Map<string,Player>();const statements:D1PreparedStatement[]=[];
    const tx:MutationContext={db:env.DB,now,player,statements,changed,sourceId:key,
      touch(p){if(!changed.has(p.id)){const expected=p.version;changed.set(p.id,p);statements.push(assertSQL(env.DB,'SELECT version=? AND deleted_at IS NULL FROM players WHERE id=?',expected,p.id));p.version++;}},
      notify(guildId,payload){statements.push(sql(env.DB,'INSERT INTO outbox(id,topic,payload,created_at) VALUES(?,?,?,?)',uid(),guildId,JSON.stringify(payload),now));}
    };
    if(options.touchPlayer!==false)tx.touch(player);
    const result=await fn(tx);
    for(const p of changed.values()){
      statements.push(sql(env.DB,'UPDATE players SET data=?,version=? WHERE id=?',JSON.stringify(p),p.version,p.id));
      // Every quantity-changing write receives an immutable, per-asset ledger entry.
      const old=await one<{data:string}>(env.DB,'SELECT data FROM players WHERE id=?',p.id);
      if(old){const before=JSON.parse(old.data) as Player;for(const asset of ['coins','boundCoins','stars','hearts'] as const){const delta=p[asset]-before[asset];if(delta)statements.push(sql(env.DB,'INSERT INTO ledger VALUES(?,?,?,?,?,?,?)',uid(),p.id,asset,delta,fingerprint,key,now));}
        for(const item of Object.keys(p.inventory) as Item[])for(const bucket of ['normal','bound'] as const){const delta=p.inventory[item][bucket]-(before.inventory[item]?.[bucket]??0);if(delta)statements.push(sql(env.DB,'INSERT INTO ledger VALUES(?,?,?,?,?,?,?)',uid(),p.id,`item:${item}:${bucket}`,delta,fingerprint,key,now));}
        if(p.unlimitedUntil!==before.unlimitedUntil)statements.push(sql(env.DB,'INSERT INTO ledger VALUES(?,?,?,?,?,?,?)',uid(),p.id,'unlimitedMs',p.unlimitedUntil-Math.max(now,before.unlimitedUntil),fingerprint,key,now));
      }
    }
    statements.push(sql(env.DB,'INSERT INTO operations VALUES(?,?,?,?,?)',userId,key,fingerprint,JSON.stringify(result),now));
    // Assertions are only needed for the duration of this transaction.
    statements.push(sql(env.DB,'DELETE FROM tx_assertions'));
    try{await env.DB.batch(statements);const parts=fingerprint.split(':');console.log(JSON.stringify({event:parts[0]+(/^[a-z_-]+$/.test(parts[1]??'')?':'+parts[1]:''),userId,at:now}));return result;}
    catch(e){if(attempt<3&&/tx_assertions|UNIQUE constraint failed: operations|CHECK constraint failed: ok/.test(String(e)))continue;throw e;}
  }
  throw new HttpError('CONFLICT','다른 기기에서 변경되었습니다. 다시 시도해 주세요.',409);
}
export function operationKey(body:Record<string,unknown>){return String(body.idempotencyKey??body.key??'');}
export const ITEMS:Item[]=['hammer','sweep-row','sweep-column','shuffle','sweep-border','world-bomb','cross-firework','color-magnet','move-hourglass','wind-row','bomb','rainbow'];
export const PRICES:Record<Item,number>={'hammer':150,'sweep-row':250,'sweep-column':250,'shuffle':150,'sweep-border':350,'world-bomb':0,'cross-firework':350,'color-magnet':400,'move-hourglass':300,'wind-row':150,'bomb':200,'rainbow':300};
export function newPlayer(id:string,now:number):Player{return {id,nickname:`정원사${id.slice(0,4)}`,level:1,coins:500,boundCoins:0,stars:0,hearts:5,heartAt:0,unlimitedUntil:0,freeClaimAt:0,version:1,inventory:Object.fromEntries(ITEMS.map(item=>[item,{normal:item==='world-bomb'?0:2,bound:0}])) as Player['inventory'],restored:[],tutorials:[],settings:{sound:true,music:true,haptics:true,reducedMotion:false,language:'ko'},guildId:null,passPoints:0};}
