import { PRODUCTS, RESTORATIONS } from '@garden/content';
import type { Gift, Item, Player, PassClaimAllResponse } from '@garden/contracts';
import { z } from 'zod';
import { assertSQL, day, ensure, mutate, one, operationKey, PRICES, readPlayer, rows, spendCoins, sql, uid, type ApiEnv, type MutationContext } from './db';
import { itemSchema } from './validation';

export async function freeUnlimited(env:ApiEnv,userId:string,body:Record<string,unknown>){
  return mutate(env,userId,operationKey(body),'hearts:free',tx=>{
    ensure(tx.player.level>=5,'LOCKED','4판을 완료하면 받을 수 있어요.');
    ensure(tx.player.freeClaimAt<=tx.now,'BONUS_COOLDOWN','아직 다음 수령 시간이 아니에요.',409);
    tx.player.unlimitedUntil=Math.max(tx.now,tx.player.unlimitedUntil)+1_800_000;tx.player.freeClaimAt=tx.now+14_400_000;
    tx.statements.push(sql(tx.db,'INSERT INTO free_claims VALUES(?,?,?,?)',userId,tx.player.version,tx.now,tx.player.unlimitedUntil));
    return {player:tx.player};
  });
}
export async function buyHearts(env:ApiEnv,userId:string,body:Record<string,unknown>){
  const amount=z.union([z.literal(1),z.literal('full')]).parse(body.amount??1);
  return mutate(env,userId,operationKey(body),`hearts:buy:${amount}`,tx=>{
    const count=amount==='full'?5-tx.player.hearts:Math.min(1,5-tx.player.hearts);ensure(count>0,'HEARTS_FULL','하트가 가득해요.');spendCoins(tx.player,count*100);tx.player.hearts+=count;if(tx.player.hearts===5)tx.player.heartAt=0;return {player:tx.player,cost:count*100};
  });
}
export async function buyItem(env:ApiEnv,userId:string,body:Record<string,unknown>){
  const item=itemSchema.parse(body.item);ensure(item!=='world-bomb','EARN_ONLY_ITEM','별빛 대폭탄은 새 퍼즐 10판을 완료할 때마다 모여요.');
  return mutate(env,userId,operationKey(body),`shop:buy:${item}`,tx=>{
    ensure(tx.player.level>=5,'LOCKED','4판을 완료하면 상점이 열려요.');
    const bound=spendCoins(tx.player,PRICES[item]);tx.player.inventory[item][bound?'bound':'normal']++;
    tx.statements.push(sql(tx.db,'INSERT INTO inventory_lots VALUES(?,?,?,?,?,?,?)',uid(),userId,item,bound?1:0,1,operationKey(body),tx.now));return {player:tx.player,bound,cost:PRICES[item]};
  });
}
export async function restore(env:ApiEnv,userId:string,body:Record<string,unknown>){
  const taskId=z.string().max(80).parse(body.taskId);const task=RESTORATIONS.find(t=>t.id===taskId);ensure(task,'UNKNOWN_RESTORATION','복원 작업을 찾을 수 없어요.');
  return mutate(env,userId,operationKey(body),`garden:restore:${taskId}`,tx=>{
    if(tx.player.restored.includes(taskId))return {player:tx.player};
    const next=RESTORATIONS.find(t=>!tx.player.restored.includes(t.id));ensure(next?.id===taskId,'RESTORATION_ORDER','앞선 복원을 먼저 마쳐 주세요.');
    ensure(tx.player.stars>=task.cost,'STARS_EMPTY','퍼즐을 완료해서 별을 모아 주세요.');tx.player.stars-=task.cost;tx.player.restored.push(taskId);
    const areaTasks=RESTORATIONS.filter(t=>t.area===task.area);const areaComplete=areaTasks.every(t=>tx.player.restored.includes(t.id));
    if(areaComplete){tx.player.coins+=100;tx.statements.push(sql(tx.db,'INSERT INTO reward_claims VALUES(?,?,?,?)',userId,'area',task.area,tx.now));}
    return {player:tx.player,areaComplete,areaReward:areaComplete?100:0};
  });
}
export async function giftList(env:ApiEnv,userId:string):Promise<{gifts:Gift[]}>{
  const data=await rows<{id:string;sender_name:string;kind:Gift['kind'];quantity:number;bound:number;created_at:number}>(env.DB,'SELECT * FROM gifts WHERE user_id=? AND quantity>0 ORDER BY created_at',userId);
  return {gifts:data.map(g=>({id:g.id,senderName:g.sender_name,kind:g.kind,quantity:g.quantity,bound:!!g.bound,createdAt:g.created_at}))};
}
export async function claimGift(env:ApiEnv,userId:string,giftId:string,body:Record<string,unknown>){
  return mutate(env,userId,operationKey(body),`gift:claim:${giftId}`,async tx=>{
    const gift=await one<{kind:Gift['kind'];quantity:number;bound:number}>(tx.db,'SELECT kind,quantity,bound FROM gifts WHERE id=? AND user_id=?',giftId,userId);ensure(gift,'GIFT_NOT_FOUND','선물을 찾을 수 없어요.',404);
    const amount=gift.kind==='heart'?Math.min(gift.quantity,5-tx.player.hearts):gift.quantity;
    ensure(amount>0,'HEARTS_FULL','하트가 가득해요. 선물은 보관됩니다.',409);
    tx.statements.push(assertSQL(tx.db,'SELECT quantity=? FROM gifts WHERE id=?',gift.quantity,giftId),sql(tx.db,'UPDATE gifts SET quantity=quantity-? WHERE id=?',amount,giftId));
    if(gift.kind==='heart'){tx.player.hearts+=amount;if(tx.player.hearts===5)tx.player.heartAt=0;}else tx.player.inventory[gift.kind][gift.bound?'bound':'normal']+=amount;
    const remaining=(await giftList(env,userId)).gifts.map(g=>g.id===giftId?{...g,quantity:g.quantity-amount}:g).filter(g=>g.quantity>0);
    return {player:tx.player,gifts:remaining,claimed:amount};
  });
}
export interface Season {id:string;starts_at:number;ends_at:number}
export async function currentSeason(env:ApiEnv,now=Date.now()):Promise<Season|null>{return one<Season>(env.DB,'SELECT * FROM seasons WHERE starts_at<=? AND ends_at>? ORDER BY starts_at DESC LIMIT 1',now,now);}
export async function catalog(env:ApiEnv){const season=await currentSeason(env);return {products:PRODUCTS.filter(product=>!product.offer),prices:PRICES,restorations:RESTORATIONS,season:season?{...season,startsAt:season.starts_at,endsAt:season.ends_at}:null,paymentsConfigured:!!env.GOOGLE_SERVICE_ACCOUNT_JSON||!!env.APPLE_IAP_PRIVATE_KEY,adsConfigured:!!env.ADMOB_HEART_AD_UNIT&&!!env.ADMOB_COIN_AD_UNIT};}
export async function events(env:ApiEnv,userId:string){
  const now=Date.now();const season=await currentSeason(env,now);const p=await readPlayer(env.DB,userId,now);
  const claims=await rows<{kind:string;source_id:string}>(env.DB,'SELECT kind,source_id FROM reward_claims WHERE user_id=?',userId);
  const clears=season?await one<{n:number}>(env.DB,'SELECT count(*) n FROM level_rewards WHERE user_id=? AND created_at>=? AND created_at<?',userId,season.starts_at,season.ends_at):null;
  const premium=season?!!await one(env.DB,'SELECT 1 FROM season_owners WHERE user_id=? AND season_id=?',userId,season.id):false;
  const guildClears=p.guildId&&season?await one<{n:number}>(env.DB,'SELECT count(*) n FROM level_rewards r JOIN guild_members m ON r.user_id=m.user_id WHERE m.guild_id=? AND r.created_at>=MAX(?,m.joined_at) AND r.created_at<?',p.guildId,season.starts_at,season.ends_at):null;
  const vouchers=await rows<{seasonId:string}>(env.DB,"SELECT o.season_id seasonId FROM season_owners o JOIN reward_claims r ON r.user_id=o.user_id AND r.kind='pass:premium' AND r.source_id=o.season_id||':30' WHERE o.user_id=?",userId);
  return {dailyClaimed:claims.some(c=>c.kind==='daily'&&c.source_id===String(day(now))),daily:{available:!claims.some(c=>c.kind==='daily'&&c.source_id===String(day(now))),coins:50,nextReset:(day(now)+1)*86_400_000},season,pass:{points:(clears?.n??0)*10,premium,guildGifts:vouchers.map(v=>({seasonId:v.seasonId,item:'hammer',quantityPerMember:1,sent:claims.some(c=>c.kind==='pass:guild-gift'&&c.source_id===v.seasonId)})),tiers:Array.from({length:30},(_,i)=>({tier:i+1,points:(i+1)*10,free:{coins:25},premium:{coins:75,hammer:(i+1)%5===0?1:0,decoration:i===14?{id:'season-gardener',name:'시즌 정원사 문장',asset:'star'}:null,guildGift:i===29?{item:'hammer',quantityPerMember:1}:null},freeClaimed:claims.some(c=>c.kind==='pass:free'&&c.source_id===`${season?.id}:${i+1}`),premiumClaimed:claims.some(c=>c.kind==='pass:premium'&&c.source_id===`${season?.id}:${i+1}`)}))},personal:{progress:clears?.n??0,target:10,coins:300,claimed:claims.some(c=>c.kind==='personal'&&c.source_id===season?.id)},guild:{progress:guildClears?.n??0,target:30,coins:100,claimed:claims.some(c=>c.kind==='guild'&&c.source_id===season?.id)}};
}
export async function profileDecorations(env:ApiEnv,userId:string){
  const earned=await rows<{seasonId:string}>(env.DB,"SELECT o.season_id seasonId FROM season_owners o JOIN reward_claims r ON r.user_id=o.user_id AND r.kind='pass:premium' AND r.source_id=o.season_id||':15' WHERE o.user_id=? ORDER BY r.created_at DESC",userId);
  return {decorations:earned.map(row=>({id:`${row.seasonId}:season-gardener`,seasonId:row.seasonId,name:'시즌 정원사 문장',asset:'star'}))};
}
export async function sendPassGuildGift(env:ApiEnv,userId:string,body:Record<string,unknown>){
  const seasonId=z.string().min(1).max(100).parse(body.seasonId);
  return mutate(env,userId,operationKey(body),`pass:guild-gift:${seasonId}`,async tx=>{
    ensure(tx.player.guildId,'NOT_IN_GUILD','길드에 가입하면 선물을 보낼 수 있어요. 선물권은 보관됩니다.');
    ensure(await one(tx.db,'SELECT 1 FROM season_owners WHERE user_id=? AND season_id=?',userId,seasonId),'PASS_REQUIRED','이 시즌의 정원 패스가 필요해요.');
    ensure(await one(tx.db,"SELECT 1 FROM reward_claims WHERE user_id=? AND kind='pass:premium' AND source_id=?",userId,`${seasonId}:30`),'GIFT_NOT_EARNED','프리미엄 30단계 선물을 먼저 받아 주세요.');
    ensure(!await one(tx.db,"SELECT 1 FROM reward_claims WHERE user_id=? AND kind='pass:guild-gift' AND source_id=?",userId,seasonId),'ALREADY_CLAIMED','이미 길드에 선물을 보냈어요.',409);
    const members=await one<{n:number}>(tx.db,'SELECT count(*) n FROM guild_members WHERE guild_id=?',tx.player.guildId);
    tx.statements.push(assertSQL(tx.db,'SELECT guild_id=? FROM guild_members WHERE user_id=?',tx.player.guildId,userId),assertSQL(tx.db,'SELECT count(*)=? FROM guild_members WHERE guild_id=?',members?.n??0,tx.player.guildId),sql(tx.db,"INSERT INTO gifts(id,user_id,sender_id,sender_name,kind,quantity,bound,source_id,created_at) SELECT lower(hex(randomblob(16))),user_id,?,?,'hammer',1,0,?||user_id,? FROM guild_members WHERE guild_id=?",userId,`${tx.player.nickname} · 정원 패스`,`${userId}:pass:${seasonId}:`,tx.now,tx.player.guildId),sql(tx.db,"INSERT INTO ledger SELECT lower(hex(randomblob(16))),user_id,'guild_gift:hammer',1,'pass:guild-gift',?||user_id,? FROM guild_members WHERE guild_id=?",`${userId}:pass:${seasonId}:`,tx.now,tx.player.guildId),sql(tx.db,"INSERT INTO reward_claims VALUES(?,'pass:guild-gift',?,?)",userId,seasonId,tx.now));
    tx.statements.push(sql(tx.db,'INSERT INTO ledger VALUES(?,?,?,?,?,?,?)',uid(),userId,'pass:guild-gift-voucher',-1,'pass:guild-gift',seasonId,tx.now));tx.notify(tx.player.guildId,{type:'pass-gift'});return {player:tx.player,sent:true,recipients:members?.n??0};
  });
}
export async function daily(env:ApiEnv,userId:string,body:Record<string,unknown>){
  return mutate(env,userId,operationKey(body),'event:daily',async tx=>{
    const source=String(day(tx.now));ensure(!await one(tx.db,"SELECT 1 FROM reward_claims WHERE user_id=? AND kind='daily' AND source_id=?",userId,source),'ALREADY_CLAIMED','오늘의 보상을 받았어요.',409);
    tx.player.coins+=50;tx.statements.push(sql(tx.db,'INSERT INTO reward_claims VALUES(?,?,?,?)',userId,'daily',source,tx.now));return {player:tx.player};
  });
}
export async function passClaim(env:ApiEnv,userId:string,body:Record<string,unknown>){
  const tier=z.number().int().min(1).max(30).parse(body.tier);const track=z.enum(['free','premium']).parse(body.track);
  return mutate(env,userId,operationKey(body),`pass:claim:${track}:${tier}`,async tx=>{
    const ev=await events(env,userId);ensure(ev.season,'SEASON_ENDED','진행 중인 시즌이 없습니다.');
    ensure(ev.pass.points>=tier*10,'PASS_POINTS','더 많은 퍼즐을 완료해 주세요.');ensure(track==='free'||ev.pass.premium,'PASS_REQUIRED','유료 보상선은 정원 패스가 필요합니다.');
    const source=`${ev.season.id}:${tier}`;ensure(!await one(tx.db,'SELECT 1 FROM reward_claims WHERE user_id=? AND kind=? AND source_id=?',userId,`pass:${track}`,source),'ALREADY_CLAIMED','이미 받은 보상입니다.',409);
    assertPassEligibility(tx,userId,ev.season,tier,track==='premium');
    grantPassReward(tx,userId,ev.season.id,tier,track);return {player:tx.player};
  });
}
function assertPassEligibility(tx:MutationContext,userId:string,season:Season,tier:number,premium:boolean){
  tx.statements.push(assertSQL(tx.db,'SELECT id=? FROM seasons WHERE starts_at<=? AND ends_at>? ORDER BY starts_at DESC LIMIT 1',season.id,tx.now,tx.now),assertSQL(tx.db,'SELECT count(*)>=? FROM level_rewards WHERE user_id=? AND created_at>=? AND created_at<?',tier,userId,season.starts_at,season.ends_at));
  if(premium)tx.statements.push(assertSQL(tx.db,'SELECT EXISTS(SELECT 1 FROM season_owners WHERE user_id=? AND season_id=?)',userId,season.id));
}
function grantPassReward(tx:MutationContext,userId:string,seasonId:string,tier:number,track:'free'|'premium'){
  const source=`${seasonId}:${tier}`;
  tx.player.coins+=track==='free'?25:75;if(track==='premium'&&tier%5===0)tx.player.inventory.hammer.normal++;
  if(track==='premium'&&(tier===15||tier===30))tx.statements.push(sql(tx.db,'INSERT INTO ledger VALUES(?,?,?,?,?,?,?)',uid(),userId,tier===15?'profile:season-gardener':'pass:guild-gift-voucher',1,'pass:claim',source,tx.now));
  tx.statements.push(sql(tx.db,'INSERT INTO reward_claims VALUES(?,?,?,?)',userId,`pass:${track}`,source,tx.now));
}
const passClaimAllInput=z.object({key:z.string().optional(),idempotencyKey:z.string().optional()}).strict();
export async function passClaimAll(env:ApiEnv,userId:string,body:Record<string,unknown>):Promise<PassClaimAllResponse>{
  passClaimAllInput.parse(body);
  return mutate(env,userId,operationKey(body),'pass:claim-all',async tx=>{
    const season=await currentSeason(env,tx.now);
    if(!season)return {player:tx.player,claimed:[],seasonId:null,reason:'NOTHING_TO_CLAIM'};
    const [clears,premium,existing]=await Promise.all([
      one<{n:number}>(tx.db,'SELECT count(*) n FROM level_rewards WHERE user_id=? AND created_at>=? AND created_at<?',userId,season.starts_at,season.ends_at),
      one(tx.db,'SELECT 1 FROM season_owners WHERE user_id=? AND season_id=?',userId,season.id),
      rows<{kind:string;source_id:string}>(tx.db,"SELECT kind,source_id FROM reward_claims WHERE user_id=? AND kind IN ('pass:free','pass:premium')",userId)
    ]);
    const received=new Set(existing.map(claim=>`${claim.kind}:${claim.source_id}`)),claimed:PassClaimAllResponse['claimed']=[];
    for(let tier=1;tier<=Math.min(30,clears?.n??0);tier++)for(const track of ['free','premium'] as const){
      if((track==='free'||premium)&&!received.has(`pass:${track}:${season.id}:${tier}`))claimed.push({tier,track});
    }
    if(!claimed.length)return {player:tx.player,claimed,seasonId:season.id,reason:'NOTHING_TO_CLAIM'};
    tx.touch(tx.player);
    assertPassEligibility(tx,userId,season,Math.max(...claimed.map(claim=>claim.tier)),claimed.some(claim=>claim.track==='premium'));
    for(const claim of claimed)grantPassReward(tx,userId,season.id,claim.tier,claim.track);
    return {player:tx.player,claimed,seasonId:season.id,reason:'CLAIMED'};
  },{touchPlayer:false});
}
export async function eventClaim(env:ApiEnv,userId:string,body:Record<string,unknown>){
  const kind=z.enum(['personal','guild']).parse(body.kind);
  return mutate(env,userId,operationKey(body),`event:claim:${kind}`,async tx=>{
    const ev=await events(env,userId);ensure(ev.season,'SEASON_ENDED','진행 중인 이벤트가 없습니다.');const event=ev[kind];ensure(event.progress>=event.target&&!event.claimed,'EVENT_NOT_READY','보상을 아직 받을 수 없어요.');
    tx.player.coins+=event.coins;tx.statements.push(sql(tx.db,'INSERT INTO reward_claims VALUES(?,?,?,?)',userId,kind,ev.season.id,tx.now));return {player:tx.player};
  });
}
