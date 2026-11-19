import {z} from 'zod';
import type {MonthlyBundleStatus,OfferChainReward,OffersResponse,Product,ShopOffer} from '@garden/contracts';
import {OFFER_PRODUCTS,offerWindow} from '@garden/content';
import {OFFER_CHAIN_REWARDS} from '../../../packages/content/src/offers';
import {ensure,mutate,one,readPlayer,rows,type ApiEnv} from './db';
import {grantOpsReward} from './operations';
type DB=ApiEnv['DB'];

function monthlyBundleWindow(now:number){
 const offset=9*3_600_000,date=new Date(now+offset);
 const year=date.getUTCFullYear(),month=date.getUTCMonth();
 return {
  id:'monthly-bundle:'+year+'-'+String(month+1).padStart(2,'0'),
  startsAt:Date.UTC(year,month,1)-offset,
  resetsAt:Date.UTC(year,month+1,1)-offset,
 };
}

export async function monthlyBundlePurchase(db:DB,userId:string,productId:string,now:number):Promise<MonthlyBundleStatus&{periodId:string}>{
 const window=monthlyBundleWindow(now);
 // Older purchases had no period. Count their grant date so existing buyers also observe the monthly limit.
 const purchase=await one(db,`SELECT 1 FROM purchases p
  LEFT JOIN purchase_intents i ON i.id=p.intent_id
  WHERE p.user_id=? AND p.product_id=? AND p.status IN ('granted','finished','refunded')
  AND (i.season_id=? OR (i.season_id IS NULL AND p.created_at>=? AND p.created_at<?)) LIMIT 1`,
  userId,productId,window.id,window.startsAt,window.resetsAt);
 return {productId,purchased:!!purchase,periodId:window.id,resetsAt:window.resetsAt};
}
export async function hasOfferPurchase(db:DB,userId:string,productId:string,periodId:string,includeRefunded=true){
 return !!await one(db,`SELECT 1 FROM purchases p JOIN purchase_intents i ON i.id=p.intent_id WHERE p.user_id=? AND p.product_id=? AND i.season_id=? AND p.status IN (${includeRefunded?"'granted','finished','refunded'":"'granted','finished'"}) LIMIT 1`,userId,productId,periodId);
}
export async function offerState(db:DB,userId:string,product:Product,now:number):Promise<ShopOffer>{
 const clear=await one<{created_at:number}>(db,'SELECT created_at FROM level_rewards WHERE user_id=? AND level_id=4',userId);
 const window=offerWindow(product,clear?.created_at??0,now);
 const receipt=await one<{status:string}>(db,"SELECT p.status FROM purchases p JOIN purchase_intents i ON i.id=p.intent_id WHERE p.user_id=? AND p.product_id=? AND i.season_id=? AND p.status IN ('granted','finished','refunded') ORDER BY p.created_at DESC LIMIT 1",userId,product.id,window.periodId);
 if(receipt)return {product,...window,status:receipt.status==='refunded'?'refunded':'purchased'};
 if(product.offer!.kind==='timed'&&!clear)return {product,...window,status:'locked',reason:'레벨 4를 클리어하면 열려요'};
 if(now<window.startsAt||now>=window.endsAt)return {product,...window,status:'expired',reason:'판매 기간이 끝났어요'};
 const previous=product.offer!.previousProductId;
 if(previous&&!await hasOfferPurchase(db,userId,previous,window.periodId,false))return {product,...window,status:'locked',reason:'앞 단계를 구매하면 열려요'};
 return {product,...window,status:'available'};
}
const chainRewardKey=(periodId:string,id:string)=>'offer-chain:'+periodId+':'+id;
const firstChainProduct=OFFER_PRODUCTS.find(product=>product.offer?.kind==='chain')!;

export async function offers(env:ApiEnv,userId:string):Promise<OffersResponse>{
 const now=Date.now(),periodId=offerWindow(firstChainProduct,0,now).periodId;
 const keys=OFFER_CHAIN_REWARDS.map(step=>chainRewardKey(periodId,step.id));
 const [player,list,claims]=await Promise.all([
  readPlayer(env.DB,userId),
  Promise.all(OFFER_PRODUCTS.map(product=>offerState(env.DB,userId,product,now))),
  rows<{key:string}>(env.DB,`SELECT key FROM operations WHERE user_id=? AND key=fingerprint
    AND key IN (${keys.map(()=>'?').join(',')})`,userId,...keys)
 ]);
 const claimed=new Set(claims.map(claim=>claim.key));
 const purchased=new Set(list.filter(offer=>offer.status==='purchased').map(offer=>offer.product.id));
 const chainRewards=OFFER_CHAIN_REWARDS.map((step,index):OfferChainReward=>({...step,periodId,
  status:claimed.has(keys[index]!)?'claimed':player.level>=5&&purchased.has(step.previousProductId)?'available':'locked'
 }));
 return {serverTime:now,chainRewards,offers:list.map(offer=>player.level<5&&offer.status!=='purchased'&&offer.status!=='refunded'?
  {...offer,status:'locked',reason:'4판을 완료하면 열려요'}:offer)};
}

export async function claimOfferChainReward(env:ApiEnv,userId:string,body:Record<string,unknown>){
 const {rewardId,periodId}=z.object({rewardId:z.string().max(40),periodId:z.string().max(40)}).strict().parse(body);
 const step=OFFER_CHAIN_REWARDS.find(reward=>reward.id===rewardId);
 ensure(step,'OFFER_REWARD_NOT_FOUND','보상을 찾을 수 없어요.',404);
 const key=chainRewardKey(periodId,step.id);
 return mutate(env,userId,key,key,async tx=>{
  const window=offerWindow(firstChainProduct,0,tx.now);
  ensure(periodId===window.periodId,'OFFER_PERIOD_MISMATCH','패키지 판매 기간이 일치하지 않아요.',409);
  ensure(tx.player.level>=5&&await hasOfferPurchase(tx.db,userId,step.previousProductId,periodId,false),
   'OFFER_UNAVAILABLE','앞 단계 구매 후 열려요',409);
  grantOpsReward(tx,{...step.reward,hearts:0,stars:0,items:{...step.reward.items}});
  return {reward:step.reward};
 });
}
export async function checkOfferGrant(db:DB,userId:string,product:Product,periodId:string|null,preparedAt:number){
 if(!product.offer)return;
 ensure(periodId,'OFFER_RESERVATION_REQUIRED','패키지 예약을 확인할 수 없어요.',409);
 const expected=await offerState(db,userId,product,preparedAt);
 // Authentic late/pending store approvals retain their original reserved campaign.
 ensure(expected.periodId===periodId,'OFFER_PERIOD_MISMATCH','패키지 판매 기간이 일치하지 않아요.',409);
 ensure(!await hasOfferPurchase(db,userId,product.id,periodId),'OFFER_ALREADY_PURCHASED','이번 판매 기간에 이미 구매한 패키지예요.',409);
}
