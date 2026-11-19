import { PRODUCTS,missionPeriod } from '@garden/content';
import type { AdPlacement, AdRewardQuotas, Item, RewardIntent } from '@garden/contracts';
import { z } from 'zod';
import { decodeJwt } from 'jose';
import { assertSQL, digest, ensure, mutate, one, operationKey, readPlayer, readRun, rows, sql, uid, type ApiEnv } from './db';
import { currentSeason } from './economy';
import {offerState,checkOfferGrant,monthlyBundlePurchase} from './offers';
import {purchaseGrantForIntent,snapshotPurchaseGrant} from './purchase-bundle-grants';
import {configuredRewardedUnit,selectRewardedUnit} from './ad-config';
import {purchaseRecordKey,updateRetainedRefund} from './retention';
import { ADMOB_SSV_SETUP_CHECK, finishPurchase, lookupGooglePurchaseBinding, verifyAdMobCallback, verifyAppleNotification, verifyGoogleNotification, verifyPurchase, ProviderError, type VerifiedAdCallback, type VerifiedPurchase } from './providers';

interface IntentRow {id:string;user_id:string;placement:AdPlacement;run_id:string|null;amount:number;ad_unit:string;status:RewardIntent['status'];approved_at:number;expires_at:number;day:number;transaction_id:string|null}
interface AdQuotaCount {placement:AdPlacement;status:RewardIntent['status'];ad_unit:string;n:number}
const AD_DAILY_LIMITS:Record<AdPlacement,number>={heart:5,coin_bonus:10};
function intentView(i:IntentRow):RewardIntent{return {id:i.id,placement:i.placement,amount:i.amount,status:i.status,adUnit:i.ad_unit,expiresAt:i.expires_at,...(i.run_id?{runId:i.run_id}:{})};}
function adRewardPeriod(now:number){const period=missionPeriod('daily',now);return {...period,day:Math.floor((period.start+9*3_600_000)/86_400_000)};}
export async function createIntent(env:ApiEnv,userId:string,body:Record<string,unknown>,platform?:string|null){
  const placement=z.enum(['heart','coin_bonus']).parse(body.placement);const runId=z.string().uuid().optional().parse(body.runId);
  const unit=selectRewardedUnit(env,placement,platform);
  return mutate(env,userId,operationKey(body),`ad:intent:${placement}:${runId??''}`,async tx=>{
    const period=adRewardPeriod(tx.now);
    ensure(tx.player.level>=5,'LOCKED','4판을 완료하면 선택형 광고가 열려요.');
    if(placement==='heart')ensure(tx.player.hearts<5&&tx.player.unlimitedUntil<=tx.now,'AD_NOT_NEEDED','지금은 하트 광고가 필요하지 않아요.');
    const open=await one<IntentRow>(tx.db,"SELECT * FROM reward_intents WHERE user_id=? AND status IN ('reserved','pending','review') ORDER BY approved_at DESC LIMIT 1",userId);
    ensure(!open,'AD_PENDING','이전 광고 보상을 확인 중이에요. 내역에서 상태를 확인해 주세요.',409);
    // Retry a cancelled load using the same intent: no new promise or quota slot is created.
    // Timestamp windows include existing UTC-keyed rows during the KST cutover
    // without rewriting reservations or their original signature time bounds.
    const retry=await one<IntentRow>(tx.db,"SELECT * FROM reward_intents WHERE user_id=? AND placement=? AND run_id IS ? AND status='cancelled' AND approved_at>=? AND approved_at<? AND ad_unit=? ORDER BY approved_at DESC LIMIT 1",userId,placement,runId??null,period.start,period.endsAt,unit);
    if(retry){retry.status='reserved';retry.expires_at=Math.max(retry.expires_at,tx.now+1_800_000);tx.statements.push(sql(tx.db,"UPDATE reward_intents SET status='reserved',expires_at=? WHERE id=?",retry.expires_at,retry.id));return {intent:intentView(retry)};}
    const count=await one<{n:number}>(tx.db,'SELECT count(*) n FROM reward_intents WHERE user_id=? AND placement=? AND approved_at>=? AND approved_at<?',userId,placement,period.start,period.endsAt);
    // Cancelled slots are reusable, not consumed: prevents cancel/reissue laundering of late signed views.
    ensure((count?.n??0)<AD_DAILY_LIMITS[placement],'AD_DAILY_LIMIT','오늘의 광고 보상 한도에 도달했어요.',409);
    let amount=1;
    if(placement==='heart')ensure(tx.player.hearts<5&&tx.player.unlimitedUntil<=tx.now,'AD_NOT_NEEDED','지금은 하트 광고가 필요하지 않아요.');
    else{ensure(runId,'RUN_REQUIRED','보상을 받을 퍼즐이 필요합니다.');const run=await readRun(tx.db,runId,userId);ensure(run.status==='won'&&run.reward&&run.reward.coins>0,'NO_CLEAR_REWARD','최초 클리어 보상이 있는 판만 코인을 두 배로 받을 수 있어요.');amount=run.reward.coins;ensure(!await one(tx.db,"SELECT 1 FROM reward_intents WHERE user_id=? AND run_id=? AND placement='coin_bonus'",userId,runId),'AD_ALREADY_REQUESTED','이미 이 판의 광고 보상을 요청했어요.');}
    const intent:IntentRow={id:uid(),user_id:userId,placement,run_id:runId??null,amount,ad_unit:unit,status:'reserved',approved_at:tx.now,expires_at:tx.now+1_800_000,day:period.day,transaction_id:null};
    tx.statements.push(sql(tx.db,'INSERT INTO reward_intents VALUES(?,?,?,?,?,?,?,?,?,?,NULL)',intent.id,userId,placement,intent.run_id,amount,unit,'reserved',tx.now,intent.expires_at,intent.day));
    return {intent:intentView(intent)};
  });
}
export async function intentStatus(env:ApiEnv,userId:string,intentId?:string,platform?:string|null){
  const period=adRewardPeriod(Date.now());
  const [history,usage]=await env.DB.batch<IntentRow|AdQuotaCount>([
    sql(env.DB,`SELECT * FROM reward_intents WHERE user_id=? ${intentId?'AND id=?':''} ORDER BY approved_at DESC LIMIT 30`,userId,...(intentId?[intentId]:[])),
    sql(env.DB,'SELECT placement,status,ad_unit,count(*) n FROM reward_intents WHERE user_id=? AND approved_at>=? AND approved_at<? GROUP BY placement,status,ad_unit',userId,period.start,period.endsAt)
  ]);
  const list=history!.results.filter((row):row is IntentRow=>'id' in row),counts=usage!.results.filter((row):row is AdQuotaCount=>'n' in row);
  const quotas:AdRewardQuotas={heart:{limit:AD_DAILY_LIMITS.heart,remaining:AD_DAILY_LIMITS.heart,resetsAt:period.endsAt},coin_bonus:{limit:AD_DAILY_LIMITS.coin_bonus,remaining:AD_DAILY_LIMITS.coin_bonus,resetsAt:period.endsAt}};
  for(const count of counts){
    // Same-unit cancelled/no-fill slots are reusable and must remain visible
    // as available; pending/review and other-unit reservations still hold slots.
    if(count.status==='cancelled'&&count.ad_unit===configuredRewardedUnit(env,count.placement,platform))continue;
    quotas[count.placement].remaining=Math.max(0,quotas[count.placement].remaining-count.n);
  }
  return intentId?{intent:list[0]?intentView(list[0]):null,quotas}:{intents:list.map(intentView),quotas};
}
export async function intentSignal(env:ApiEnv,userId:string,intentId:string,body:Record<string,unknown>){
  const status=z.enum(['pending','cancelled','review']).parse(body.status);
  return mutate(env,userId,operationKey(body),`ad:signal:${intentId}:${status}`,async tx=>{
    const intent=await one<IntentRow>(tx.db,'SELECT * FROM reward_intents WHERE id=? AND user_id=?',intentId,userId);ensure(intent,'INTENT_NOT_FOUND','광고 내역을 찾을 수 없어요.');
    if(intent.status==='granted')return {intent:intentView(intent)};
    if(intent.status!=='review'){intent.status=status;tx.statements.push(sql(tx.db,'UPDATE reward_intents SET status=? WHERE id=? AND status<>?',status,intentId,'granted'));}
    return {intent:intentView(intent)};
  });
}
/** Called only with an authenticated provider result. Exported for offline cryptographic test fixtures. */
export async function storeVerifiedCallback(env:ApiEnv,callback:VerifiedAdCallback){
  ensure(callback.userId!==ADMOB_SSV_SETUP_CHECK||callback.intentId!==ADMOB_SSV_SETUP_CHECK,'SSV_SETUP_ONLY','AdMob setup checks cannot grant game rewards.',400);
  const intent=await one<IntentRow>(env.DB,'SELECT * FROM reward_intents WHERE id=?',callback.intentId);ensure(intent,'INTENT_NOT_FOUND','Unknown ad intent',404);
  ensure(callback.userId===intent.user_id&&callback.adUnit===intent.ad_unit&&callback.timestamp>=intent.approved_at-5000&&callback.timestamp<=intent.expires_at+5000,'SSV_INTENT_MISMATCH','광고 승인 내역과 일치하지 않습니다.',403);
  const existing=await one<{intent_id:string}>(env.DB,"SELECT intent_id FROM ad_callbacks WHERE provider='admob' AND transaction_id=?",callback.transactionId);
  if(existing){ensure(existing.intent_id===intent.id,'SSV_REPLAY','다른 광고에 사용된 거래입니다.',409);return intent.id;}
  const sameIntent=await one(env.DB,'SELECT 1 FROM ad_callbacks WHERE intent_id=?',intent.id);if(sameIntent)return intent.id;
  // Callback durability precedes HTTP 200; processing retries from this inbox even after process loss.
  await sql(env.DB,'INSERT INTO ad_callbacks VALUES(?,?,?,?,?,?,0) ON CONFLICT DO NOTHING','admob',callback.transactionId,intent.id,JSON.stringify(callback),Date.now(),callback.timestamp).run();
  const recorded=await one<{intent_id:string}>(env.DB,"SELECT intent_id FROM ad_callbacks WHERE provider='admob' AND transaction_id=?",callback.transactionId);
  ensure(!recorded||recorded.intent_id===intent.id,'SSV_REPLAY','다른 광고에 사용된 거래입니다.',409);return intent.id;
}
export async function processAdGrant(env:ApiEnv,intentId:string){
  const callback=await one<{payload:string}>(env.DB,'SELECT payload FROM ad_callbacks WHERE intent_id=?',intentId);if(!callback)return;
  const verified=JSON.parse(callback.payload) as VerifiedAdCallback;
  return mutate(env,verified.userId,`ad-grant:${intentId}`,'ad:verified-grant',async tx=>{
    const intent=await one<IntentRow>(tx.db,'SELECT * FROM reward_intents WHERE id=?',intentId);ensure(intent,'INTENT_NOT_FOUND','광고 내역을 찾을 수 없어요.');
    if(intent.status==='granted')return {player:tx.player,intent:intentView(intent)};
    tx.statements.push(assertSQL(tx.db,"SELECT status<>'granted' FROM reward_intents WHERE id=?",intentId));
    if(intent.placement==='coin_bonus')tx.player.boundCoins+=intent.amount;
    else if(tx.player.hearts<5){tx.player.hearts++;if(tx.player.hearts===5)tx.player.heartAt=0;}
    else tx.statements.push(sql(tx.db,'INSERT INTO gifts VALUES(?,?,NULL,?,?,?,1,?,?)',uid(),tx.player.id,'광고 보상','heart',intent.amount,`ad:${intentId}`,tx.now));
    intent.status='granted';intent.transaction_id=verified.transactionId;
    tx.statements.push(sql(tx.db,"UPDATE reward_intents SET status='granted',transaction_id=? WHERE id=?",verified.transactionId,intentId),sql(tx.db,'UPDATE ad_callbacks SET processed=1 WHERE intent_id=?',intentId),sql(tx.db,'INSERT INTO ad_daily_usage VALUES(?,?,?,1) ON CONFLICT(user_id,placement,day) DO UPDATE SET granted=granted+1',tx.player.id,intent.placement,adRewardPeriod(intent.approved_at).day));
    return {player:tx.player,intent:intentView(intent)};
  });
}
export async function admobCallback(env:ApiEnv,request:Request,ctx:ExecutionContext){
  let verified:VerifiedAdCallback;
  try{verified=await verifyAdMobCallback(request.url,env)}catch(error){
    // Never log raw callbacks, user/intent IDs or signatures. These bounded
    // shape flags identify console/protocol failures with query redaction on.
    const params=new URL(request.url).searchParams,signature=params.get('signature')??'';
    console.warn(JSON.stringify({event:'ad:ssv-rejected',code:error instanceof ProviderError?error.code:'INTERNAL_ERROR',reason:error instanceof ProviderError?error.message:'Provider verification failed',hasSignature:params.has('signature'),signatureLength:Math.min(signature.length,1000),signatureHasPadding:signature.endsWith('='),signatureLast:/&signature=[^&]+&key_id=\d+$/.test(request.url),hasKeyId:params.has('key_id'),hasUserId:!!params.get('user_id'),hasCustomData:!!params.get('custom_data'),setupUser:params.get('user_id')===ADMOB_SSV_SETUP_CHECK,setupData:params.get('custom_data')===ADMOB_SSV_SETUP_CHECK,configuredUnit:(env.ADMOB_AD_UNITS??'').split(',').some(unit=>unit===params.get('ad_unit')||unit.endsWith('/'+params.get('ad_unit'))),rewardAmountIsOne:params.get('reward_amount')==='1',configuredRewardItem:(env.ADMOB_REWARD_ITEMS??'reward').split(',').includes(params.get('reward_item')??'')}));
    throw error;
  }
  if(verified.userId===ADMOB_SSV_SETUP_CHECK&&verified.intentId===ADMOB_SSV_SETUP_CHECK){
    console.log(JSON.stringify({event:'ad:ssv-setup-check',adUnit:verified.adUnit}));
    return {received:true,verificationOnly:true};
  }
  const id=await storeVerifiedCallback(env,verified);ctx.waitUntil(processAdGrant(env,id).catch(()=>console.error(JSON.stringify({event:'ad:grant-retry',intentId:id}))));return {received:true};
}
interface PurchaseIntentRow {id:string;user_id:string;product_id:string;season_id:string|null;status:string;created_at:number;expires_at:number;transaction_id:string|null;grant_data:string|null}
export async function preparePurchase(env:ApiEnv,userId:string,body:Record<string,unknown>){
  const productId=z.string().max(200).parse(body.productId);const product=PRODUCTS.find(p=>p.id===productId);ensure(product,'UNKNOWN_PRODUCT','상품을 찾을 수 없어요.');
  return mutate(env,userId,operationKey(body),`purchase:prepare:${productId}`,async tx=>{
    ensure(tx.player.level>=5,'LOCKED','4판을 완료하면 상점이 열려요.');
    const season=product.kind==='pass'?await currentSeason(env,tx.now):null;
    if(product.kind==='pass'){ensure(season,'NO_SEASON','진행 중인 시즌이 없습니다.');ensure(!await one(tx.db,'SELECT 1 FROM season_owners WHERE user_id=? AND season_id=?',userId,season.id),'PRODUCT_ALREADY_OWNED','이번 시즌의 패스를 이미 보유하고 있어요.',409);}
    if(product.oneTime)ensure(!await one(tx.db,"SELECT 1 FROM purchases WHERE user_id=? AND product_id=? AND status IN ('granted','finished')",userId,productId),'PRODUCT_ALREADY_OWNED','이미 구매한 상품입니다.',409);
    const pending=await one<PurchaseIntentRow>(tx.db,"SELECT * FROM purchase_intents WHERE user_id=? AND product_id=? AND status IN ('reserved','pending')",userId,productId);
    ensure(!pending,'PURCHASE_PENDING','이 상품의 구매를 확인 중이에요. 구매 내역 동기화를 먼저 사용해 주세요.',409);
    const offer=product.offer?await offerState(tx.db,userId,product,tx.now):null;
    ensure(!offer||offer.status==='available','OFFER_UNAVAILABLE',offer?.reason||'이미 구매한 패키지예요.',409);
    const monthly=product.monthlyLimit?await monthlyBundlePurchase(tx.db,userId,product.id,tx.now):null;
    ensure(!monthly?.purchased,'MONTHLY_BUNDLE_ALREADY_PURCHASED','이번 달 공략 도구 꾸러미를 이미 구매했어요.',409);
    const id=uid(),expiresAt=Math.min(tx.now+900_000,offer?.endsAt??monthly?.resetsAt??Infinity);
    tx.statements.push(sql(tx.db,"INSERT INTO purchase_intents(id,user_id,product_id,season_id,status,created_at,expires_at,transaction_id,receipt_binding,grant_data) VALUES(?,?,?,?,'reserved',?,?,NULL,?,?)",id,userId,productId,offer?.periodId??monthly?.periodId??season?.id??null,tx.now,expiresAt,await digest(userId+':'+id),snapshotPurchaseGrant(product)));
    return {purchaseIntentId:id,productId,seasonId:season?.id??null,expiresAt};
  });
}
export async function cancelPurchaseIntent(env:ApiEnv,userId:string,intentId:string,body:Record<string,unknown>){
  return mutate(env,userId,operationKey(body),`purchase:cancel:${intentId}`,async tx=>{const intent=await one<PurchaseIntentRow>(tx.db,'SELECT * FROM purchase_intents WHERE id=? AND user_id=?',intentId,userId);ensure(intent,'PURCHASE_INTENT_REQUIRED','구매 준비 내역을 찾을 수 없어요.');ensure(intent.status!=='pending','PURCHASE_PENDING','스토어 승인 대기 중인 구매는 확인을 계속합니다.',409);if(intent.status==='reserved')tx.statements.push(sql(tx.db,"UPDATE purchase_intents SET status='cancelled' WHERE id=?",intentId));return {cancelled:intent.status!=='granted'};});
}
export async function purchaseIntents(env:ApiEnv,userId:string){
  const intents=await rows<PurchaseIntentRow>(env.DB,"SELECT * FROM purchase_intents WHERE user_id=? AND status IN ('reserved','pending','review') ORDER BY created_at DESC LIMIT 30",userId);
  return {intents:intents.map(i=>({id:i.id,productId:i.product_id,status:i.status,seasonId:i.season_id,expiresAt:i.expires_at,canCancel:i.status==='reserved'}))};
}
export async function signalPurchasePending(env:ApiEnv,userId:string,intentId:string,body:Record<string,unknown>){
  return mutate(env,userId,operationKey(body),`purchase:pending:${intentId}`,async tx=>{ensure(await one(tx.db,'SELECT 1 FROM purchase_intents WHERE id=? AND user_id=?',intentId,userId),'PURCHASE_INTENT_REQUIRED','구매 요청을 찾을 수 없어요.');tx.statements.push(sql(tx.db,"UPDATE purchase_intents SET status='pending' WHERE id=? AND status='reserved'",intentId));return {pending:true};});
}
export async function purchase(env:ApiEnv,userId:string,body:Record<string,unknown>){
  const input=z.object({provider:z.enum(['google','apple']),productId:z.string().max(200),token:z.string().min(1).max(32_768),purchaseIntentId:z.string().uuid().optional()}).parse(body);const product=PRODUCTS.find(p=>p.id===input.productId);ensure(product,'UNKNOWN_PRODUCT','상품을 찾을 수 없어요.');
  let purchaseIntentId=input.purchaseIntentId;
  if(!purchaseIntentId&&input.provider==='google'){
    const binding=await lookupGooglePurchaseBinding(input.token,env);const candidate=await one<{id:string}>(env.DB,'SELECT id FROM purchase_intents WHERE receipt_binding=? AND user_id=?',binding,userId);purchaseIntentId=candidate?.id;
  }else if(!purchaseIntentId&&input.provider==='apple'){
    // Untrusted hint only: receipt authenticity and exact binding are checked by verifyPurchase below.
    try{const hint=decodeJwt(input.token).appAccountToken;if(typeof hint==='string')purchaseIntentId=hint;}catch{/* verified error below */}
  }
  ensure(purchaseIntentId,'PURCHASE_INTENT_REQUIRED','구매 준비 내역을 연결해야 합니다. 구매 내역 동기화를 이용해 주세요.',409);
  const intent=await one<PurchaseIntentRow>(env.DB,'SELECT * FROM purchase_intents WHERE id=? AND user_id=? AND product_id=?',purchaseIntentId,userId,product.id);ensure(intent,'PURCHASE_INTENT_REQUIRED','이 계정의 구매 준비 내역이 아닙니다.',403);
  const verified=await verifyPurchase({...input,purchaseIntentId,userId,consumable:product.kind!=='starter'},env);
  ensure(!verified.purchasedAt||verified.purchasedAt>=intent.created_at-300_000,'PURCHASE_TIME_MISMATCH','구매 준비 이전에 발생한 거래입니다.',403);
  if(verified.environment==='Production')ensure(!await one(env.DB,'SELECT 1 FROM retained_purchase_records WHERE provider=? AND transaction_key=?',verified.provider,await purchaseRecordKey(verified.environment,verified.transactionId)),
    'PURCHASE_ACCOUNT_MISMATCH','다른 계정의 구매입니다.',403);
  const stored=await one<{user_id:string;status:string;intent_id:string|null}>(env.DB,'SELECT user_id,status,intent_id FROM purchases WHERE provider=? AND environment=? AND transaction_id=?',verified.provider,verified.environment,verified.transactionId);
  ensure(!stored||stored.user_id===userId,'PURCHASE_ACCOUNT_MISMATCH','다른 계정의 구매입니다.',403);
  if(stored?.status==='refunded')return {granted:false,state:'cancelled',player:await readPlayer(env.DB,userId)};
  const intentId=purchaseIntentId;
  ensure(!intent.transaction_id||intent.transaction_id===verified.transactionId,'PURCHASE_INTENT_USED','다른 거래에 사용된 구매 요청입니다.',409);
  if(verified.state!=='purchased'){
    await env.DB.batch([assertSQL(env.DB,'SELECT deleted_at IS NULL FROM players WHERE id=?',userId),sql(env.DB,'INSERT INTO purchases(provider,transaction_id,user_id,product_id,environment,status,verified_json,created_at,intent_id) VALUES(?,?,?,?,?,?,?,?,?) ON CONFLICT(provider,environment,transaction_id) DO NOTHING',verified.provider,verified.transactionId,userId,product.id,verified.environment,verified.state,JSON.stringify(verified),Date.now(),intentId),sql(env.DB,'UPDATE purchase_intents SET status=?,transaction_id=? WHERE id=?',verified.state==='pending'?'pending':'cancelled',verified.transactionId,intentId),sql(env.DB,'DELETE FROM tx_assertions')]);
    return {granted:false,state:verified.state,player:await readPlayer(env.DB,userId)};
  }
  const source=`${verified.provider}:${verified.environment}:${await digest(verified.transactionId)}`;
  const result=await mutate(env,userId,`purchase:${await digest(source)}`,`purchase:grant:${product.id}`,async tx=>{
    const previous=await one<{user_id:string;status:string}>(tx.db,'SELECT user_id,status FROM purchases WHERE provider=? AND environment=? AND transaction_id=?',verified.provider,verified.environment,verified.transactionId);
    ensure(!previous||previous.user_id===userId,'PURCHASE_ACCOUNT_MISMATCH','다른 계정에 연결된 구매입니다.',403);
    if(previous&&['granted','finished','refunded'].includes(previous.status))return {granted:previous.status!=='refunded',state:'purchased',player:tx.player};
    ensure(previous||!verified.acknowledgement.alreadyFinished,'CONSUMED_PURCHASE','이미 사용된 소모품은 다시 지급하지 않습니다.',409);
    if(product.oneTime)ensure(!await one(tx.db,"SELECT 1 FROM purchases WHERE user_id=? AND product_id=? AND status IN ('granted','finished')",userId,product.id),'PRODUCT_ALREADY_OWNED','이미 구매한 상품입니다.',409);
    await checkOfferGrant(tx.db,userId,product,intent.season_id,intent.created_at);
    if(product.monthlyLimit&&intent.grant_data){
      const monthly=await monthlyBundlePurchase(tx.db,userId,product.id,intent.created_at);
      ensure(monthly.periodId===intent.season_id,'OFFER_PERIOD_MISMATCH','패키지 판매 기간이 일치하지 않아요.',409);
      ensure(!monthly.purchased,'MONTHLY_BUNDLE_ALREADY_PURCHASED','이번 달 공략 도구 꾸러미를 이미 구매했어요.',409);
    }
    const grant=purchaseGrantForIntent(product,intent.grant_data);
    tx.player.coins+=grant.coins;for(const [item,quantity] of Object.entries(grant.items))tx.player.inventory[item as Item].normal+=quantity??0;
    if(grant.unlimitedSeconds)tx.player.unlimitedUntil=Math.max(tx.now,tx.player.unlimitedUntil)+grant.unlimitedSeconds*1000;
    if(product.kind==='pass'){ensure(intent.season_id,'NO_SEASON','시즌이 지정되지 않은 구매입니다.');ensure(!await one(tx.db,'SELECT 1 FROM season_owners WHERE user_id=? AND season_id=?',userId,intent.season_id),'PRODUCT_ALREADY_OWNED','이번 시즌의 패스를 이미 보유하고 있어요.',409);tx.statements.push(sql(tx.db,'INSERT INTO season_owners VALUES(?,?,?)',userId,intent.season_id,source));}
    const purchaseRecord=JSON.stringify({...verified,suppliedAt:tx.now});
    tx.statements.push(assertSQL(tx.db,'SELECT transaction_id IS NULL OR transaction_id=? FROM purchase_intents WHERE id=?',verified.transactionId,intentId),sql(tx.db,"UPDATE purchase_intents SET status='granted',transaction_id=? WHERE id=?",verified.transactionId,intentId),sql(tx.db,"INSERT INTO purchases(provider,transaction_id,user_id,product_id,environment,status,verified_json,created_at,intent_id) VALUES(?,?,?,?,?,?,?,?,?) ON CONFLICT(provider,environment,transaction_id) DO UPDATE SET status='granted',verified_json=excluded.verified_json,intent_id=excluded.intent_id",verified.provider,verified.transactionId,userId,product.id,verified.environment,'granted',purchaseRecord,tx.now,intentId),sql(tx.db,'INSERT INTO outbox VALUES(?,?,?,?,NULL,0)',uid(),'$purchase',JSON.stringify(verified),tx.now));
    return {granted:true,state:'purchased',player:tx.player};
  });
  // Returning a committed grant never depends on network finalization succeeding.
  try{await finishPurchase(verified,env);await sql(env.DB,"UPDATE purchases SET status='finished' WHERE provider=? AND environment=? AND transaction_id=? AND status='granted'",verified.provider,verified.environment,verified.transactionId).run();}catch{console.log(JSON.stringify({event:'purchase:finish-pending',provider:verified.provider}));}
  return result;
}
export async function purchaseHistory(env:ApiEnv,userId:string){return {purchases:await rows(env.DB,'SELECT product_id productId,provider,environment,status,created_at createdAt FROM purchases WHERE user_id=? ORDER BY created_at DESC',userId),player:await readPlayer(env.DB,userId)};}

async function refund(env:ApiEnv,provider:string,environment:string,transactionId:string,at=Date.now()){
  const original=await one<{user_id:string;product_id:string;environment:string;status:string;grant_data:string|null}>(env.DB,`SELECT p.user_id,p.product_id,p.environment,p.status,i.grant_data FROM purchases p
    LEFT JOIN purchase_intents i ON i.id=p.intent_id WHERE p.provider=? AND p.environment=? AND p.transaction_id=?`,provider,environment,transactionId);
  if(!original){await updateRetainedRefund(env,provider,environment,transactionId,at);return;}
  if(original.status==='refunded')return;
  const source=`refund:${await digest(provider+':'+environment+':'+transactionId)}`;
  try{await mutate(env,original.user_id,source,'purchase:refund',async tx=>{
    const product=PRODUCTS.find(p=>p.id===original.product_id);ensure(product,'UNKNOWN_PRODUCT','상품을 찾을 수 없습니다.');
    if(['granted','finished'].includes(original.status)){
      const grant=purchaseGrantForIntent(product,original.grant_data);
      const reclaim=Math.min(tx.player.coins,grant.coins);tx.player.coins-=reclaim;
      if(reclaim<grant.coins)tx.statements.push(sql(tx.db,'INSERT INTO purchase_debts VALUES(?,?,?,?)',tx.player.id,source,grant.coins-reclaim,tx.now));
      for(const [item,quantity] of Object.entries(grant.items)){const count=tx.player.inventory[item as Item];count.normal=Math.max(0,count.normal-(quantity??0));}
      if(grant.unlimitedSeconds)tx.player.unlimitedUntil=Math.max(tx.now,tx.player.unlimitedUntil-grant.unlimitedSeconds*1000);
      if(product.kind==='pass')tx.statements.push(sql(tx.db,'DELETE FROM season_owners WHERE user_id=? AND source_id=?',tx.player.id,`${provider}:${original.environment}:${await digest(transactionId)}`));
    }
    tx.statements.push(sql(tx.db,"UPDATE purchases SET status='refunded',refunded_at=? WHERE provider=? AND environment=? AND transaction_id=?",at,provider,environment,transactionId));return {refunded:true};
  });}catch(error){
    if(await one(env.DB,'SELECT 1 FROM players WHERE id=? AND deleted_at IS NULL',original.user_id))throw error;
    await updateRetainedRefund(env,provider,environment,transactionId,at);
  }
}
export async function purchaseWebhook(env:ApiEnv,provider:'google'|'apple',request:Request,body:Record<string,unknown>){
  const verified=provider==='apple'?await verifyAppleNotification(z.string().max(100_000).parse(body.signedPayload),env):await verifyGoogleNotification(request.headers.get('Authorization'),body,env);
  await sql(env.DB,'INSERT INTO external_events VALUES(?,?,?,0,?) ON CONFLICT DO NOTHING',provider,verified.eventId,JSON.stringify(verified),Date.now()).run();
  await processPurchaseEvent(env,provider,verified.eventId);return {received:true};
}
export async function processPurchaseEvent(env:ApiEnv,provider:string,eventId:string){
  const row=await one<{payload:string;processed:number;created_at:number}>(env.DB,'SELECT payload,processed,created_at FROM external_events WHERE provider=? AND event_id=?',provider,eventId);if(!row||row.processed)return;
  if(provider==='apple'){
    const e=JSON.parse(row.payload) as Awaited<ReturnType<typeof verifyAppleNotification>>;
    if(e.revoked&&e.transactionId&&e.environment)await refund(env,provider,String(e.environment),e.transactionId,e.refundedAt??row.created_at);
    else if(e.userId&&e.productId&&e.signedTransactionInfo){const intent=await one<PurchaseIntentRow>(env.DB,'SELECT * FROM purchase_intents WHERE id=?',e.userId);if(intent)await purchase(env,intent.user_id,{provider:'apple',productId:e.productId,token:e.signedTransactionInfo,purchaseIntentId:intent.id});}
  }else{
    const e=JSON.parse(row.payload) as Awaited<ReturnType<typeof verifyGoogleNotification>>;
    if(e.voidedPurchaseNotification)await refund(env,provider,String(env.GOOGLE_IAP_ENVIRONMENT),e.voidedPurchaseNotification.purchaseToken,row.created_at);
    else if(e.oneTimeProductNotification){const n=e.oneTimeProductNotification;const binding=await lookupGooglePurchaseBinding(n.purchaseToken,env);const intent=await one<PurchaseIntentRow>(env.DB,'SELECT * FROM purchase_intents WHERE receipt_binding=?',binding);if(intent)await purchase(env,intent.user_id,{provider:'google',productId:n.sku,token:n.purchaseToken,purchaseIntentId:intent.id});}
  }
  await sql(env.DB,"UPDATE external_events SET processed=1,payload='{}' WHERE provider=? AND event_id=?",provider,eventId).run();
}
