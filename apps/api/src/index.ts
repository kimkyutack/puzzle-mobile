import { ZodError } from 'zod';
import { timingSafeEqual } from 'node:crypto';
import { CONTENT_VERSION, ENGINE_VERSION } from '@garden/contracts';
import { getLevel } from '@garden/content';
import { activeRun, assertSQL, digest, ensure, HttpError, one, readPlayer, rows, sql, type ApiEnv } from './db';
import * as auth from './auth';
import * as run from './runs';
import * as economy from './economy';
import * as story from './story';
import {progression,claimMissions} from './activity';
import {startTreasure,finishTreasure} from './treasure';
import {completeBridge} from './rescue';
import * as guild from './guild';
import * as money from './monetization';
import {offers} from './offers';
import {rankings} from './rankings';
import * as friends from './friends';
import * as gardenWorld from './garden-world';
import {localFeatures,refillLocalHearts} from './local-tools';
import { bodyOf } from './validation';
import { finishPurchase, revokeAppleAuthorization, ProviderError, type VerifiedPurchase } from './providers';
import { GuildRoom } from './guild-room';
export { GuildRoom };

function response(data:unknown,request:Request,env:ApiEnv,status=200){
  const obj=data as {player?:{version?:number}};const headers=new Headers({'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
  const origin=request.headers.get('Origin');if(origin&&env.CLIENT_ORIGINS.split(',').includes(origin)){headers.set('Access-Control-Allow-Origin',origin);headers.set('Vary','Origin');}
  return Response.json({data,serverNow:Date.now(),stateVersion:obj?.player?.version??0},{status,headers});
}
async function rateLimit(env:ApiEnv,key:string,maximum=240,seconds=60){
  const window=Math.floor(Date.now()/(seconds*1000));
  const r=await sql(env.DB,'INSERT INTO rate_limits(key,window,hits,expires_at) VALUES(?,?,1,?) ON CONFLICT(key,window) DO UPDATE SET hits=hits+1 RETURNING hits',key,window,(window+1)*seconds*1000).first<{hits:number}>();
  ensure(r&&r.hits<=maximum,'RATE_LIMIT','요청이 많아요. 잠시 후 다시 시도해 주세요.',429);
}
export async function flushOutbox(env:ApiEnv){
  const pending=await rows<{id:string;topic:string;payload:string}>(env.DB,'SELECT id,topic,payload FROM outbox WHERE delivered_at IS NULL ORDER BY attempts,created_at LIMIT 40');
  for(const entry of pending){
    try{
      if(entry.topic==='$purchase'){const p=JSON.parse(entry.payload) as VerifiedPurchase;await finishPurchase(p,env);await sql(env.DB,"UPDATE purchases SET status='finished' WHERE provider=? AND environment=? AND transaction_id=? AND status='granted'",p.provider,p.environment,p.transactionId).run();}
      else if(entry.topic==='$apple-revoke'){const payload=JSON.parse(entry.payload) as {sealedToken:string};await revokeAppleAuthorization(payload.sealedToken,env);}
      else {const room=env.GUILD_ROOMS.getByName(entry.topic) as DurableObjectStub<GuildRoom>;await room.broadcast(entry.id,entry.topic);}
      await sql(env.DB,"UPDATE outbox SET delivered_at=?,attempts=attempts+1,payload=CASE WHEN topic='$apple-revoke' THEN '{}' ELSE payload END WHERE id=?",Date.now(),entry.id).run();
    }catch{await sql(env.DB,'UPDATE outbox SET attempts=attempts+1 WHERE id=?',entry.id).run();}
  }
}
async function socket(request:Request,env:ApiEnv,url:URL){
  const token=url.searchParams.get('ticket');ensure(token&&token.length<300,'UNAUTHORIZED','연결 요청이 필요합니다.',401);const hash=await digest(token);
  const ticket=await one<{user_id:string;guild_id:string}>(env.DB,'SELECT user_id,guild_id FROM socket_tickets WHERE token_hash=? AND expires_at>? AND consumed=0',hash,Date.now());ensure(ticket,'UNAUTHORIZED','연결 요청이 만료되었습니다.',401);
  await env.DB.batch([assertSQL(env.DB,'SELECT consumed=0 AND expires_at>? FROM socket_tickets WHERE token_hash=?',Date.now(),hash),sql(env.DB,'UPDATE socket_tickets SET consumed=1 WHERE token_hash=?',hash),sql(env.DB,'DELETE FROM tx_assertions')]);
  const headers=new Headers(request.headers);headers.set('x-garden-user',ticket.user_id);headers.set('x-garden-guild',ticket.guild_id);
  return env.GUILD_ROOMS.getByName(ticket.guild_id).fetch(new Request('https://guild.internal/',{headers}));
}
async function route(request:Request,env:ApiEnv,ctx:ExecutionContext){
  const url=new URL(request.url);const path=url.pathname.replace(/^\/api(?=\/|$)/,'')||'/';const method=request.method;
  if(method==='OPTIONS'){const origin=request.headers.get('Origin')??'';ensure(env.CLIENT_ORIGINS.split(',').includes(origin),'CORS_DENIED','허용되지 않은 출처입니다.',403);return new Response(null,{status:204,headers:{'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Methods':'GET,POST,PATCH,DELETE,OPTIONS','Access-Control-Allow-Headers':'Content-Type,Authorization','Access-Control-Max-Age':'600','Vary':'Origin'}});}
  if(path==='/health')return response({ok:true,engineVersion:ENGINE_VERSION,contentVersion:CONTENT_VERSION},request,env);
  if(path.startsWith('/assets/')&&method==='GET'){
    const key=path.slice('/assets/'.length);ensure(/^[a-zA-Z0-9_.\/-]+$/.test(key)&&!key.includes('..')&&key.startsWith('garden-'),'INVALID_ASSET_PATH','잘못된 에셋 경로입니다.');
    const object=await env.ASSETS.get(key);ensure(object,'ASSET_NOT_FOUND','에셋을 찾을 수 없습니다.',404);const headers=new Headers();object.writeHttpMetadata(headers);headers.set('ETag',object.httpEtag);headers.set('Cache-Control','public,max-age=31536000,immutable');headers.set('X-Content-Type-Options','nosniff');headers.set('Access-Control-Allow-Origin','*');
    return new Response(object.body,{headers});
  }
  if(path==='/ads/ssv'&&method==='GET')return response(await money.admobCallback(env,request,ctx),request,env);
  if(path==='/auth/apple/callback'&&method==='POST')return auth.appleCallback(env,request);
  if(path==='/guild/socket')return socket(request,env,url);
  const body=['POST','PATCH','DELETE'].includes(method)?await bodyOf(request):{};
  if(path==='/auth/apple/notifications'&&method==='POST')return response(await auth.appleIdentityNotification(env,body),request,env);
  if(path==='/purchases/apple/webhook'&&method==='POST')return response(await money.purchaseWebhook(env,'apple',request,body),request,env);
  if(path==='/purchases/google/webhook'&&method==='POST')return response(await money.purchaseWebhook(env,'google',request,body),request,env);
  if(path==='/auth/guest'&&method==='POST'){await rateLimit(env,`guest:${await digest(request.headers.get('CF-Connecting-IP')??'local')}`,30,3600);return response(await auth.guest(env),request,env);}
  if(path==='/auth/refresh'&&method==='POST'){await rateLimit(env,`refresh:${await digest(String(body.refreshToken??'').slice(0,300))}`,30);return response(await auth.refresh(env,body),request,env);}
  const session=await auth.authenticate(request,env);const userId=session.user_id;await rateLimit(env,`user:${userId}`);
  let data:unknown;
  if(path==='/me'&&method==='GET'){const player=await readPlayer(env.DB,userId);data={player,activeRun:await activeRun(env.DB,userId)};}
  else if(path==='/me'&&method==='PATCH')data=await auth.profile(env,userId,body);
  else if(path==='/progression'&&method==='GET')data=await progression(env,userId);
  else if(path==='/missions/claim'&&method==='POST')data=await claimMissions(env,userId,body);
  else if(path==='/minigames/treasure/start'&&method==='POST')data=await startTreasure(env,userId,body);
  else if(/^\/minigames\/treasure\/[^/]+\/finish$/.test(path)&&method==='POST')data=await finishTreasure(env,userId,path.split('/')[3],body);
  else if(path==='/rankings'&&method==='GET')data=await rankings(env,userId,url.searchParams.get('scope')??'players');
  else if(path==='/friends'&&method==='GET')data=await friends.friends(env,userId);
  else if(path==='/friends/requests'&&method==='POST')data=await friends.requestFriend(env,userId,body);
  else if(path==='/friends/respond'&&method==='POST')data=await friends.respondFriend(env,userId,body);
  else if(path==='/friends/hearts/request'&&method==='POST')data=await friends.requestHearts(env,userId,body);
  else if(/^\/friends\/hearts\/[^/]+\/help$/.test(path)&&method==='POST')data=await friends.helpHearts(env,userId,path.split('/')[3],body);
  else if(/^\/players\/[^/]+\/profile$/.test(path)&&method==='GET')data=await friends.publicProfile(env,userId,path.split('/')[2]);
  else if(path==='/local/features'&&method==='GET')data=localFeatures(env,url);
  else if(path==='/local/hearts/refill'&&method==='POST')data=await refillLocalHearts(env,url,userId,body);
  else if((path==='/me'||path==='/account')&&method==='DELETE')data=await auth.deleteAccount(env,userId,body);
  else if(path==='/auth/challenge'&&method==='POST')data=await auth.challenge(env,userId,body);
  else if(path==='/auth/link'&&method==='POST')data=await auth.link(env,userId,body);
  else if(path==='/auth/switch'&&method==='POST')data=await auth.switchAccount(env,userId,body);
  else if(path==='/auth/links'&&method==='GET')data=await auth.links(env,userId);
  else if(path==='/auth/logout'&&method==='POST'){await sql(env.DB,'UPDATE sessions SET revoked=1 WHERE id=?',session.id).run();data={loggedOut:true};}
  else if(path==='/runs/start'&&method==='POST')data=await run.startRun(env,userId,body);
  else if(/^\/runs\/[^/]+$/.test(path)&&method==='GET'){const id=path.split('/')[2];data={run:await (await import('./db')).readRun(env.DB,id,userId)};}
  else if(/^\/runs\/[^/]+\/actions$/.test(path)&&method==='POST')data=await run.runActions(env,userId,path.split('/')[2],body);
  else if(/^\/runs\/[^/]+\/booster$/.test(path)&&method==='POST')data=await run.useBooster(env,userId,path.split('/')[2],body);
  else if(/^\/runs\/[^/]+\/continue$/.test(path)&&method==='POST')data=await run.continueRun(env,userId,path.split('/')[2],body);
  else if(/^\/runs\/[^/]+\/finish$/.test(path)&&method==='POST')data=await run.closeRun(env,userId,path.split('/')[2],body);
  else if(/^\/runs\/[^/]+\/abandon$/.test(path)&&method==='POST')data=await run.closeRun(env,userId,path.split('/')[2],body,true);
  else if(path==='/hearts/free'&&method==='POST')data=await economy.freeUnlimited(env,userId,body);
  else if(path==='/hearts/buy'&&method==='POST')data=await economy.buyHearts(env,userId,body);
  else if(path==='/shop/buy'&&method==='POST')data=await economy.buyItem(env,userId,body);
  else if(path==='/garden/restore'&&method==='POST')data=await economy.restore(env,userId,body);
  else if(path==='/garden/world'&&method==='GET')data=await gardenWorld.gardenWorld(env,userId);
  else if(path==='/garden/world/commands'&&method==='POST')data=await gardenWorld.gardenCommand(env,userId,body);
  else if(path==='/garden/shop/buy'&&method==='POST')data=await gardenWorld.buyDecoration(env,userId,body);
  else if(path==='/story/episodes/bridge-v1/complete'&&method==='POST')data=await completeBridge(env,userId,body);
  else if(path==='/story'&&method==='GET')data=await story.state(env,userId);
  else if(path==='/story/seen'&&method==='POST')data=await story.acknowledge(env,userId,body);
  else if(path==='/garden/style'&&method==='POST')data=await story.chooseStyle(env,userId,body);
  else if(path==='/offers'&&method==='GET')data=await offers(env,userId);
  else if(path==='/catalog'&&method==='GET')data=await economy.catalog(env);
  else if(path==='/events'&&method==='GET')data=await economy.events(env,userId);
  else if(path==='/events/daily'&&method==='POST')data=await economy.daily(env,userId,body);
  else if(path==='/events/claim'&&method==='POST')data=await economy.eventClaim(env,userId,body);
  else if(path==='/pass/claim'&&method==='POST')data=await economy.passClaim(env,userId,body);
  else if(path==='/pass/claim-all'&&method==='POST')data=await economy.passClaimAll(env,userId,body);
  else if(path==='/pass/guild-gift'&&method==='POST')data=await economy.sendPassGuildGift(env,userId,body);
  else if(path==='/profile/decorations'&&method==='GET')data=await economy.profileDecorations(env,userId);
  else if(path==='/gifts'&&method==='GET')data=await economy.giftList(env,userId);
  else if(/^\/gifts\/[^/]+\/claim$/.test(path)&&method==='POST')data=await economy.claimGift(env,userId,path.split('/')[2],body);
  else if(path==='/guilds'&&method==='GET')data=await guild.searchGuilds(env,url.searchParams.get('q')??'',userId);
  else if(path==='/guilds'&&method==='POST')data=await guild.createGuild(env,userId,body);
  else if(/^\/guilds\/[^/]+\/join$/.test(path)&&method==='POST')data=await guild.joinGuild(env,userId,path.split('/')[2],body);
  else if(path==='/guild'&&method==='GET')data=await guild.guildView(env,userId);
  else if(path==='/guild'&&method==='PATCH')data=await guild.editGuild(env,userId,body);
  else if(path==='/guild/leave'&&method==='POST')data=await guild.leaveGuild(env,userId,body);
  else if(path==='/guild/kick'&&method==='POST')data=await guild.leaveGuild(env,userId,body,true);
  else if(path==='/guild/approve'&&method==='POST')data=await guild.approveMember(env,userId,body);
  else if(path==='/guild/role'&&method==='POST')data=await guild.changeRole(env,userId,body);
  else if(path==='/guild/chat'&&method==='POST')data=await guild.chat(env,userId,body);
  else if(path==='/guild/requests'&&method==='POST')data=await guild.requestSupport(env,userId,body);
  else if(/^\/guild\/requests\/[^/]+\/help$/.test(path)&&method==='POST')data=await guild.help(env,userId,path.split('/')[3],body);
  else if(path==='/guild/block'&&method==='POST')data=await guild.block(env,userId,body);
  else if(path==='/guild/report'&&method==='POST')data=await guild.report(env,userId,body);
  else if(path==='/guild/socket-ticket'&&method==='POST')data=await guild.socketTicket(env,userId);
  else if(path==='/ads/reward-intents'&&method==='POST')data=await money.createIntent(env,userId,body);
  else if(path==='/ads/reward-intents'&&method==='GET')data=await money.intentStatus(env,userId);
  else if(/^\/ads\/reward-intents\/[^/]+$/.test(path)&&method==='GET')data=await money.intentStatus(env,userId,path.split('/')[3]);
  else if(/^\/ads\/reward-intents\/[^/]+$/.test(path)&&method==='POST')data=await money.intentSignal(env,userId,path.split('/')[3],body);
  else if(/^\/ads\/reward-intents\/[^/]+\/cancel$/.test(path)&&method==='POST')data=await money.intentSignal(env,userId,path.split('/')[3],{...body,status:'cancelled'});
  else if(path==='/purchases/verify'&&method==='POST')data=await money.purchase(env,userId,body);
  else if(path==='/purchases/prepare'&&method==='POST')data=await money.preparePurchase(env,userId,body);
  else if(path==='/purchases/intents'&&method==='GET')data=await money.purchaseIntents(env,userId);
  else if(/^\/purchases\/intents\/[^/]+\/cancel$/.test(path)&&method==='POST')data=await money.cancelPurchaseIntent(env,userId,path.split('/')[3],body);
  else if(/^\/purchases\/intents\/[^/]+\/pending$/.test(path)&&method==='POST')data=await money.signalPurchasePending(env,userId,path.split('/')[3],body);
  else if(path==='/purchases'&&method==='GET')data=await money.purchaseHistory(env,userId);
  else if(path==='/admin/overview'&&method==='GET'){
    ensure(env.ADMIN_TOKEN,'ADMIN_REQUIRED','관리자 인증이 필요합니다.',403);
    ensure(timingSafeEqual(Buffer.from(await digest(request.headers.get('x-admin-token')??'')),Buffer.from(await digest(env.ADMIN_TOKEN))),'ADMIN_REQUIRED','관리자 인증이 필요합니다.',403);
    data={economy:await economy.catalog(env),levels:[1,5,30,200,1000,10000].map(id=>getLevel(id)),pendingAds:await rows(env.DB,"SELECT id,user_id,placement,status,approved_at FROM reward_intents WHERE status IN ('review','pending') LIMIT 100"),recentLedger:await rows(env.DB,'SELECT * FROM ledger ORDER BY created_at DESC LIMIT 100'),outbox:await rows(env.DB,'SELECT id,topic,attempts FROM outbox WHERE delivered_at IS NULL LIMIT 100')};
  }else throw new HttpError('NOT_FOUND','요청한 기능을 찾을 수 없습니다.',404);
  if(method!=='GET')ctx.waitUntil(flushOutbox(env));
  return response(data,request,env);
}
export default {
  async fetch(request:Request,env:ApiEnv,ctx:ExecutionContext){
    try{return await route(request,env,ctx);}
    catch(e){
      let status=500,code='INTERNAL_ERROR',message='서버에 연결하지 못했어요. 잠시 후 다시 시도해 주세요.';
      if(e instanceof HttpError||e instanceof ProviderError){status=e.status;code=e.code;message=e.message;}
      else if(e instanceof ZodError){status=400;code='INVALID_INPUT';message='입력 내용을 확인해 주세요.';}
      else if(/UNIQUE constraint|guild_full|CHECK constraint/.test(String(e))){status=409;code='CONFLICT';message='이미 처리되었거나 다른 기기에서 변경된 요청입니다. 새로고침해 주세요.';}
      console.error(JSON.stringify({event:'api:error',code,status,...(env.ENVIRONMENT==='development'?{detail:String(e).slice(0,500)}:{})}));
      const origin=request.headers.get('origin');const headers:Record<string,string>={'Cache-Control':'no-store'};if(origin&&env.CLIENT_ORIGINS.split(',').includes(origin))headers['Access-Control-Allow-Origin']=origin;
      return Response.json({error:{code,message},serverNow:Date.now()},{status,headers});
    }
  },
  async scheduled(_controller:ScheduledController,env:ApiEnv,ctx:ExecutionContext){
    ctx.waitUntil((async()=>{
      await flushOutbox(env);
      const callbacks=await rows<{intent_id:string}>(env.DB,'SELECT intent_id FROM ad_callbacks WHERE processed=0 LIMIT 30');
      for(const cb of callbacks)try{await money.processAdGrant(env,cb.intent_id);}catch{console.error(JSON.stringify({event:'ad:retry-needed',intentId:cb.intent_id}));}
      const external=await rows<{provider:string;event_id:string}>(env.DB,'SELECT provider,event_id FROM external_events WHERE processed=0 LIMIT 30');
      for(const e of external)try{if(e.provider==='apple-identity')await auth.processAppleIdentityNotification(env,e.event_id);else await money.processPurchaseEvent(env,e.provider,e.event_id);}catch{console.error(JSON.stringify({event:'provider:notification-retry',provider:e.provider}));}
      await env.DB.batch([sql(env.DB,"UPDATE reward_intents SET status='review' WHERE status IN ('reserved','pending') AND expires_at<?",Date.now()),sql(env.DB,'DELETE FROM rate_limits WHERE expires_at<?',Date.now()),sql(env.DB,'DELETE FROM socket_tickets WHERE expires_at<?',Date.now()-86_400_000),sql(env.DB,'DELETE FROM auth_challenges WHERE expires_at<?',Date.now()-86_400_000)]);
    })());
  }
} satisfies ExportedHandler<ApiEnv>;
