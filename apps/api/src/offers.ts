import type {OffersResponse,Product,ShopOffer} from '@garden/contracts';
import {OFFER_PRODUCTS,offerWindow} from '@garden/content';
import {ensure,one,readPlayer,type ApiEnv} from './db';
type DB=ApiEnv['DB'];
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
export async function offers(env:ApiEnv,userId:string):Promise<OffersResponse>{
 const player=await readPlayer(env.DB,userId),now=Date.now(),list=await Promise.all(OFFER_PRODUCTS.map(product=>offerState(env.DB,userId,product,now)));return {serverTime:now,offers:list.map(offer=>player.level<5&&offer.status!=='purchased'&&offer.status!=='refunded'?{...offer,status:'locked',reason:'4판을 완료하면 열려요'}:offer)};
}
export async function checkOfferGrant(db:DB,userId:string,product:Product,periodId:string|null,preparedAt:number){
 if(!product.offer)return;
 ensure(periodId,'OFFER_RESERVATION_REQUIRED','패키지 예약을 확인할 수 없어요.',409);
 const expected=await offerState(db,userId,product,preparedAt);
 // Authentic late/pending store approvals retain their original reserved campaign.
 ensure(expected.periodId===periodId,'OFFER_PERIOD_MISMATCH','패키지 판매 기간이 일치하지 않아요.',409);
 ensure(!await hasOfferPurchase(db,userId,product.id,periodId),'OFFER_ALREADY_PURCHASED','이번 판매 기간에 이미 구매한 패키지예요.',409);
}
