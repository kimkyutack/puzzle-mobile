import {beforeEach,describe,expect,it,vi} from 'vitest';
import type {Product} from '../packages/contracts/src';
const sdk=vi.hoisted(()=>({platform:'ios',events:[] as string[],saved:new Map<string,string>(),storageFails:false,transactions:[] as Array<Record<string,unknown>>,purchaseError:'',verifyError:false}));
vi.mock('@capacitor/core',()=>({Capacitor:{isNativePlatform:()=>sdk.platform!=='web',getPlatform:()=>sdk.platform}}));
vi.mock('@capacitor/preferences',()=>({Preferences:{get:async({key}:{key:string})=>({value:sdk.saved.get(key)??null}),set:async({key,value}:{key:string;value:string})=>{if(sdk.storageFails)throw new Error('storage failed');sdk.saved.set(key,value);},remove:async({key}:{key:string})=>{sdk.saved.delete(key);}}}));
vi.mock('@capgo/native-purchases',()=>({PURCHASE_TYPE:{INAPP:'inapp'},NativePurchases:{
 configure:async(options:unknown)=>{expect(options).toEqual({autoFinishTransactions:false});},
 purchaseProduct:async(options:Record<string,unknown>)=>{sdk.events.push('sheet');expect(options.autoAcknowledgePurchases).toBe(false);if(sdk.purchaseError)throw new Error(sdk.purchaseError);return sdk.transactions[0];},
 finishTransaction:async({transactionId}:{transactionId:string})=>{sdk.events.push('finish:'+transactionId);},
 getPurchases:async()=>({purchases:sdk.transactions}),getUnfinishedTransactions:async()=>({transactions:sdk.transactions}),
}}));
import {purchase,recoverPurchases,type PurchaseHooks} from '../apps/client/src/platform/purchases';
import {setLocale} from '../apps/client/src/i18n';
const intentId='ce3c4be6-c02e-4bdd-83e4-428b695ca6bc';
const product={id:'coins_1000'} as Product;
const hooks=():PurchaseHooks=>({
 prepare:async()=>{sdk.events.push('prepare');return{purchaseIntentId:intentId,productId:product.id,expiresAt:Date.now()+900000};},
 verify:async()=>{sdk.events.push('verify');if(sdk.verifyError)throw new Error('offline');return{granted:true};},
 cancel:async()=>{sdk.events.push('cancel');},pending:async()=>{sdk.events.push('pending');},
});
beforeEach(()=>{setLocale('ko');sdk.platform='ios';sdk.events=[];sdk.saved.clear();sdk.storageFails=false;sdk.purchaseError='';sdk.verifyError=false;sdk.transactions=[{transactionId:'tx1',productIdentifier:product.id,jwsRepresentation:'signed-receipt',appAccountToken:intentId}];vi.stubEnv('VITE_ENABLE_PURCHASES','true');});
describe('native purchase authority and deferred recovery',()=>{
 it('opens a store only after reservation and finishes Apple only after a server grant',async()=>{
  const h=hooks();const verify=vi.spyOn(h,'verify');await purchase(product,'user1',h);
  expect(sdk.events).toEqual(['prepare','sheet','verify','finish:tx1']);
  expect(verify).toHaveBeenCalledWith(expect.objectContaining({purchaseIntentId:intentId,token:'signed-receipt'}));expect(sdk.saved.size).toBe(0);
 });
 it('keeps Apple unfinished and reservation persisted on verification failure',async()=>{
  sdk.verifyError=true;await expect(purchase(product,'user1',hooks())).rejects.toThrow('offline');
  expect(sdk.events).toEqual(['prepare','sheet','verify']);expect(sdk.saved.size).toBe(1);
 });
 it('registers Android deferred state, then verifies a pending purchase token without finishing or cancelling',async()=>{
  sdk.platform='android';sdk.purchaseError='Purchase is pending';sdk.transactions=[{transactionId:'tx1',productIdentifier:product.id,purchaseToken:'pending-token',purchaseState:'2'}];
  const h=hooks();h.verify=vi.fn(async()=>{sdk.events.push('verify-pending');return{granted:false,state:'pending' as const};});
  await purchase(product,'user1',h);
  expect(sdk.events).toEqual(['prepare','sheet','pending','verify-pending']);expect(sdk.saved.size).toBe(1);
  expect(h.verify).toHaveBeenCalledWith(expect.objectContaining({token:'pending-token',purchaseIntentId:intentId}));
 });
 it('cancels a definite user cancellation or failure before a store sheet',async()=>{
  sdk.purchaseError='User cancelled';await expect(purchase(product,'user1',hooks())).rejects.toThrow();expect(sdk.events).toEqual(['prepare','sheet','cancel']);expect(sdk.saved.size).toBe(0);
  sdk.events=[];sdk.storageFails=true;await expect(purchase(product,'user1',hooks())).rejects.toThrow();expect(sdk.events).toEqual(['prepare','cancel']);
 });
 it('recovers remaining receipts after an earlier failure and never assigns a stale product reservation',async()=>{
  sdk.saved.set('garden.purchase-intent.user1.coins_1000','newer-intent');
  sdk.transactions.push({transactionId:'tx2',productIdentifier:product.id,jwsRepresentation:'second-receipt',appAccountToken:intentId});
  const verify=vi.fn(async(input:{token:string})=>{if(input.token==='signed-receipt')throw new Error('other account');return{granted:true};});
  await expect(recoverPurchases('user1',verify)).rejects.toThrow('일부 구매');expect(verify).toHaveBeenCalledTimes(2);
  for(const [input] of verify.mock.calls)expect(input).not.toHaveProperty('purchaseIntentId',expect.any(String));
  expect(sdk.events).toEqual(['finish:tx2']);expect(sdk.saved.get('garden.purchase-intent.user1.coins_1000')).toBe('newer-intent');
 });
 it('does not invoke the web plugin purchase mock',async()=>{sdk.platform='web';await expect(purchase(product,'user1',hooks())).rejects.toThrow();expect(sdk.events).toEqual([]);});
});
