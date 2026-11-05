import {tr} from "../i18n";
import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';
import { NativePurchases, PURCHASE_TYPE, type Transaction } from '@capgo/native-purchases';
import type { Product } from '@garden/contracts';
export type PurchaseState='loading'|'ready'|'purchasing'|'pending'|'verifying'|'complete'|'cancelled'|'error'|'unavailable';
export interface PurchaseIntent {purchaseIntentId:string;productId:string;seasonId?:string;expiresAt:number}
export interface PurchaseVerification {provider:'google'|'apple';productId:string;token:string;idempotencyKey:string;purchaseIntentId?:string}
export interface PurchaseGrant {granted:boolean;state?:'pending'|'cancelled'|'purchased'}
export interface PurchaseHooks {
  prepare:(productId:string)=>Promise<PurchaseIntent>;
  verify:(input:PurchaseVerification)=>Promise<PurchaseGrant>;
  cancel:(purchaseIntentId:string)=>Promise<unknown>;
  pending:(purchaseIntentId:string)=>Promise<unknown>;
}
// The plugin owns a single BillingClient. Do not let background recovery close it during a store sheet.
let storeQueue:Promise<unknown>=Promise.resolve();
function withStore<T>(work:()=>Promise<T>):Promise<T>{const next=storeQueue.then(work,work);storeQueue=next.catch(()=>{});return next;}
export function purchasesAvailable(){return Capacitor.isNativePlatform()&&import.meta.env.VITE_ENABLE_PURCHASES==='true';}
async function configure(){
  if(!purchasesAvailable()) throw new Error(tr("스토어 상품과 결제 설정이 연결된 모바일 앱에서 구매할 수 있습니다."));
  await NativePurchases.configure({autoFinishTransactions:false});
}
async function digest(value:string){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value))),v=>v.toString(16).padStart(2,'0')).join('');}
const intentKey=(userId:string,productId:string)=>`garden.purchase-intent.${userId}.${productId}`;
async function savedIntent(userId:string,productId:string){return (await Preferences.get({key:intentKey(userId,productId)})).value??undefined;}
export function storeProducts(ids:string[]){return withStore(async()=>{
  await configure();
  const result=await NativePurchases.getProducts({productIdentifiers:ids,productType:PURCHASE_TYPE.INAPP});
  return result.products.map(p=>({id:p.identifier,title:p.title,price:p.priceString}));
});}
async function verifyAndFinish(transaction:Transaction,productId:string,verify:PurchaseHooks['verify'],onState:(state:PurchaseState)=>void,purchaseIntentId?:string):Promise<PurchaseGrant>{
  const provider=Capacitor.getPlatform()==='ios'?'apple':'google';
  const token=provider==='apple'?transaction.jwsRepresentation:transaction.purchaseToken;
  if(!token) throw new Error(tr("스토어 검증 정보가 누락되었습니다. 구매 복구에서 다시 확인할 수 있습니다."));
  onState('verifying');
  // Even PENDING tokens go to Workers, which persists them without granting currency.
  const grant=await verify({provider,productId,token,idempotencyKey:await digest(`${provider}:${token}`),purchaseIntentId});
  if(!grant.granted){onState(grant.state==='cancelled'?'cancelled':'pending');return grant;}
  if(provider==='apple') await NativePurchases.finishTransaction({transactionId:transaction.transactionId});
  onState('complete');return grant;
}
export function purchase(product:Product,userId:string,hooks:PurchaseHooks,onState:(state:PurchaseState)=>void=()=>{}){return withStore(async()=>{
  await configure();onState('loading');
  const intent=await hooks.prepare(product.id);
  // Save before opening the store so process death cannot lose receipt-to-intent attribution.
  try{await Preferences.set({key:intentKey(userId,product.id),value:intent.purchaseIntentId});}
  catch(error){await hooks.cancel(intent.purchaseIntentId).catch(()=>{});throw error;}
  let hasTransaction=false;
  try {
    onState('purchasing');
    const transaction=await NativePurchases.purchaseProduct({productIdentifier:product.id,productType:PURCHASE_TYPE.INAPP,quantity:1,appAccountToken:Capacitor.getPlatform()==='ios'?intent.purchaseIntentId:await digest(userId+':'+intent.purchaseIntentId),isConsumable:false,autoAcknowledgePurchases:false});
    hasTransaction=true;
    const grant=await verifyAndFinish(transaction,product.id,hooks.verify,onState,intent.purchaseIntentId);
    if(grant.granted)await Preferences.remove({key:intentKey(userId,product.id)});
  }catch(error){
    const message=error instanceof Error?error.message:String(error);
    const cancelled=/cancel/i.test(message),pending=/pending|deferred/i.test(message);
    onState(cancelled?'cancelled':pending?'pending':'error');
    if(pending&&!hasTransaction){
      // Both SDKs can report pending without a transaction. Persist that state without granting anything.
      await hooks.pending(intent.purchaseIntentId).catch(()=>{});
      if(Capacitor.getPlatform()==='android'){
        // getUnfinishedTransactions deliberately excludes PENDING; query the owned INAPP records instead.
        const records=await NativePurchases.getPurchases({productType:PURCHASE_TYPE.INAPP,appAccountToken:await digest(userId+':'+intent.purchaseIntentId)}).catch(()=>({purchases:[]}));
        for(const record of records.purchases){
          if(record.productIdentifier===product.id){await verifyAndFinish(record,product.id,hooks.verify,onState,intent.purchaseIntentId).catch(()=>{});}
        }
      }
      return;
    }
    // Network/verification failures and pending approvals retain their reservation for recovery.
    if(cancelled&&!hasTransaction){await hooks.cancel(intent.purchaseIntentId).catch(()=>{});await Preferences.remove({key:intentKey(userId,product.id)});}
    throw error;
  }
});}
/** Existing server transactions or locally saved intent IDs make replay idempotent after restart. */
export function recoverPurchases(userId:string,verify:PurchaseHooks['verify'],onState:(state:PurchaseState)=>void=()=>{}){return withStore(async()=>{
  await configure();
  const transactions=Capacitor.getPlatform()==='android'
    ?(await NativePurchases.getPurchases({productType:PURCHASE_TYPE.INAPP})).purchases.filter(t=>!t.isAcknowledged)
    :(await NativePurchases.getUnfinishedTransactions()).transactions;
  let failed=false;
  for(const transaction of transactions){
    if(!transaction.productIdentifier) continue;
    const productId=transaction.productIdentifier;
    try{
      // A saved product-level ID can belong to a newer purchase. The server resolves the exact receipt binding.
      const grant=await verifyAndFinish(transaction,productId,verify,onState);
      const intentId=await savedIntent(userId,productId);
      if(grant.granted&&intentId){
        const expected=Capacitor.getPlatform()==='ios'?intentId:await digest(userId+':'+intentId);
        if(transaction.appAccountToken?.toLowerCase()===expected.toLowerCase())await Preferences.remove({key:intentKey(userId,productId)});
      }
    }catch{failed=true;}
  }
  if(failed){onState('error');throw new Error(tr("일부 구매를 확인하지 못했어요. 원래 구매한 정원 계정에서 구매 내역 동기화를 다시 시도해 주세요."));}
});}
export const purchases={available:purchasesAvailable,products:storeProducts,buy:purchase,recover:recoverPurchases};
