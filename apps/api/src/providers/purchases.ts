import { APPLE_ROOT_PEMS } from './apple-roots';
import type { SignedDataVerifier } from '@apple/app-store-server-library';
import { importPKCS8, SignJWT } from 'jose';
import { ProviderError, providerJSON, required, sha256, type ProviderConfig } from './common';
import { verifyGooglePushAuthorization } from './identity';
export interface PurchaseInput {provider:'google'|'apple';productId:string;token:string;userId:string;purchaseIntentId:string;consumable?:boolean}
export interface VerifiedPurchase {
  provider:'google'|'apple';transactionId:string;productId:string;environment:string;userId:string;purchaseIntentId:string;
  state:'purchased'|'pending'|'cancelled';purchasedAt?:number;acknowledgement:{token:string;consumable:boolean;alreadyFinished:boolean};
}
interface GooglePurchase {
  productLineItem?:Array<{productId?:string;productOfferDetails?:{quantity?:number;consumptionState?:string;refundableQuantity?:number}}>;
  purchaseStateContext?:{purchaseState?:string};obfuscatedExternalAccountId?:string;acknowledgementState?:string;
  testPurchaseContext?:{fopType?:string};purchaseCompletionTime?:string;
}
function checkedPurchaseTime(value:number|undefined,needed:boolean):number|undefined {
  if(value===undefined&&!needed)return undefined;
  if(typeof value!=='number'||!Number.isSafeInteger(value)||value<=0||value>Date.now()+300_000)throw new ProviderError('PURCHASE_TIME_INVALID','공급자의 구매 시각을 확인할 수 없습니다.',502);
  return value;
}
async function googleAccessToken(config:ProviderConfig) {
  let account: {client_email?:string;private_key?:string};
  try { account=JSON.parse(required(config.GOOGLE_SERVICE_ACCOUNT_JSON,'GOOGLE_SERVICE_ACCOUNT_JSON')); }
  catch { throw new ProviderError('PROVIDER_NOT_CONFIGURED','Google 서비스 계정 설정을 확인해 주세요.',503); }
  const key=await importPKCS8(required(account.private_key,'Google private_key'),'RS256');
  const assertion=await new SignJWT({scope:'https://www.googleapis.com/auth/androidpublisher'})
    .setProtectedHeader({alg:'RS256',typ:'JWT'}).setIssuer(required(account.client_email,'Google client_email'))
    .setAudience('https://oauth2.googleapis.com/token').setIssuedAt().setExpirationTime('5m').sign(key);
  const result=await providerJSON<{access_token?:string}>(await fetch('https://oauth2.googleapis.com/token',{
    method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},
    body:new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',assertion}),signal:AbortSignal.timeout(8_000),
  }));
  return required(result.access_token,'Google access token');
}
export async function verifyGooglePurchaseResponse(input:PurchaseInput,data:GooglePurchase,expectedEnvironment:'Sandbox'|'Production'='Production'):Promise<VerifiedPurchase> {
  const environment=data.testPurchaseContext?'Sandbox':'Production';
  if(environment!==expectedEnvironment)throw new ProviderError('PURCHASE_ENVIRONMENT_MISMATCH','구매 환경이 현재 서버와 일치하지 않습니다.',403);
  const line=data.productLineItem?.[0];
  if (data.productLineItem?.length!==1 || line?.productId!==input.productId || line.productOfferDetails?.quantity!==1)
    throw new ProviderError('PURCHASE_PRODUCT_MISMATCH','상품 또는 구매 수량이 올바르지 않습니다.');
  if (data.obfuscatedExternalAccountId!==await sha256(input.userId+':'+input.purchaseIntentId)) throw new ProviderError('PURCHASE_ACCOUNT_MISMATCH','구매 계정이 일치하지 않습니다.',403);
  const status=data.purchaseStateContext?.purchaseState;
  if (!['PURCHASED','PENDING','CANCELLED'].includes(status??'')) throw new ProviderError('PURCHASE_STATE_UNKNOWN','구매 상태를 확인할 수 없습니다.',502);
  const purchasedAt=checkedPurchaseTime(data.purchaseCompletionTime===undefined?undefined:Date.parse(data.purchaseCompletionTime),status==='PURCHASED');
  return {
    provider:'google',transactionId:input.token,productId:input.productId,userId:input.userId,purchaseIntentId:input.purchaseIntentId,
    environment,
    state:status==='PENDING'?'pending':status==='CANCELLED'||line.productOfferDetails?.refundableQuantity===0?'cancelled':'purchased',
    purchasedAt,
    acknowledgement:{token:input.token,consumable:input.consumable??true,alreadyFinished:line.productOfferDetails?.consumptionState==='CONSUMPTION_STATE_CONSUMED'},
  };
}
function appleEnvironment(config:ProviderConfig):'Sandbox'|'Production' {
  const value=required(config.APPLE_IAP_ENVIRONMENT,'APPLE_IAP_ENVIRONMENT');
  if(value!=='Sandbox' && value!=='Production') throw new ProviderError('PROVIDER_NOT_CONFIGURED','Apple environment는 Sandbox 또는 Production이어야 합니다.',503);
  return value;
}
async function appleVerifier(config:ProviderConfig):Promise<SignedDataVerifier> {
  const environment=appleEnvironment(config);
  let pems:unknown;
  try {pems=config.APPLE_ROOT_CA_PEMS?JSON.parse(config.APPLE_ROOT_CA_PEMS):APPLE_ROOT_PEMS;} catch {throw new ProviderError('PROVIDER_NOT_CONFIGURED','Apple Root CA JSON 설정이 필요합니다.',503);}
  if(!Array.isArray(pems)||pems.length===0||pems.some(p=>typeof p!=='string'||!p.includes('BEGIN CERTIFICATE'))) throw new ProviderError('PROVIDER_NOT_CONFIGURED','Apple Root CA 설정이 올바르지 않습니다.',503);
  const appId=config.APPLE_APP_ID?Number(config.APPLE_APP_ID):undefined;
  if(environment==='Production'&&(!Number.isSafeInteger(appId)||(appId??0)<=0)) throw new ProviderError('PROVIDER_NOT_CONFIGURED','APPLE_APP_ID 설정이 필요합니다.',503);
  // Apple's transitive crypto library initializes randomness: load it inside a Worker request, never at isolate startup.
  const apple=await import('@apple/app-store-server-library');
  return new apple.SignedDataVerifier(pems.map(p=>Buffer.from(p)),true,environment==='Sandbox'?apple.Environment.SANDBOX:apple.Environment.PRODUCTION,required(config.APPLE_BUNDLE_ID,'APPLE_BUNDLE_ID'),appId);
}
async function appleAuthorization(config:ProviderConfig) {
  const key=await importPKCS8(required(config.APPLE_IAP_PRIVATE_KEY,'APPLE_IAP_PRIVATE_KEY'),'ES256');
  return new SignJWT({bid:required(config.APPLE_BUNDLE_ID,'APPLE_BUNDLE_ID')})
    .setProtectedHeader({alg:'ES256',kid:required(config.APPLE_IAP_KEY_ID,'APPLE_IAP_KEY_ID'),typ:'JWT'})
    .setIssuer(required(config.APPLE_IAP_ISSUER_ID,'APPLE_IAP_ISSUER_ID')).setAudience('appstoreconnect-v1')
    .setIssuedAt().setExpirationTime('5m').sign(key);
}
export async function verifyPurchase(input:PurchaseInput,config:ProviderConfig):Promise<VerifiedPurchase> {
  if(!input.purchaseIntentId||!input.token||input.token.length>32_768||!input.productId||input.productId.length>200) throw new ProviderError('INVALID_PURCHASE','구매 정보가 올바르지 않습니다.');
  if(input.provider==='google') {
    const packageName=required(config.GOOGLE_PACKAGE_NAME,'GOOGLE_PACKAGE_NAME');
    const environment=required(config.GOOGLE_IAP_ENVIRONMENT,'GOOGLE_IAP_ENVIRONMENT');
    if(environment!=='Sandbox'&&environment!=='Production')throw new ProviderError('PROVIDER_NOT_CONFIGURED','Google environment는 Sandbox 또는 Production이어야 합니다.',503);
    const token=await googleAccessToken(config);
    const data=await providerJSON<GooglePurchase>(await fetch(`https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${encodeURIComponent(packageName)}/purchases/productsv2/tokens/${encodeURIComponent(input.token)}`,{headers:{authorization:`Bearer ${token}`},signal:AbortSignal.timeout(8_000)}));
    return verifyGooglePurchaseResponse(input,data,environment);
  }
  const verifier=await appleVerifier(config);
  const submitted=await verifier.verifyAndDecodeTransaction(input.token);
  if(!submitted.transactionId) throw new ProviderError('INVALID_PURCHASE','Apple 거래 번호가 없습니다.');
  const host=appleEnvironment(config)==='Sandbox'?'api.storekit-sandbox.itunes.apple.com':'api.storekit.itunes.apple.com';
  const current=await providerJSON<{signedTransactionInfo?:string}>(await fetch(`https://${host}/inApps/v1/transactions/${encodeURIComponent(submitted.transactionId)}`,{headers:{authorization:`Bearer ${await appleAuthorization(config)}`},signal:AbortSignal.timeout(8_000)}));
  const transaction=await verifier.verifyAndDecodeTransaction(required(current.signedTransactionInfo,'Apple signedTransactionInfo'));
  if(transaction.productId!==input.productId||transaction.transactionId!==submitted.transactionId||transaction.appAccountToken?.toLowerCase()!==input.purchaseIntentId.toLowerCase()||transaction.quantity!==1) throw new ProviderError('PURCHASE_ACCOUNT_MISMATCH','Apple 상품 또는 계정이 일치하지 않습니다.',403);
  return {provider:'apple',transactionId:transaction.transactionId,productId:input.productId,environment:String(transaction.environment),userId:input.userId,purchaseIntentId:input.purchaseIntentId,state:transaction.revocationDate?'cancelled':'purchased',purchasedAt:checkedPurchaseTime(transaction.purchaseDate,true),acknowledgement:{token:transaction.transactionId,consumable:input.consumable??true,alreadyFinished:false}};
}
/** Only call AFTER the D1 grant commits. Put a failed finalization in the durable outbox. */
export async function finishPurchase(purchase:VerifiedPurchase,config:ProviderConfig):Promise<void> {
  if(purchase.state!=='purchased'||purchase.acknowledgement.alreadyFinished) return;
  if(purchase.provider==='apple') return; // StoreKit has no server finish endpoint; client finishes after the grant response.
  const packageName=required(config.GOOGLE_PACKAGE_NAME,'GOOGLE_PACKAGE_NAME');
  const method=purchase.acknowledgement.consumable?'consume':'acknowledge';
  const url=`https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${encodeURIComponent(packageName)}/purchases/products/${encodeURIComponent(purchase.productId)}/tokens/${encodeURIComponent(purchase.acknowledgement.token)}:${method}`;
  const response=await fetch(url,{method:'POST',headers:{authorization:`Bearer ${await googleAccessToken(config)}`,'content-type':'application/json'},body:method==='acknowledge'?'{}':undefined,signal:AbortSignal.timeout(8_000)});
  if(!response.ok) {
    // A consume retry can return an error; verify the actual consumption state before declaring success.
    const token=await googleAccessToken(config);
    const check=await providerJSON<GooglePurchase>(await fetch(`https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${encodeURIComponent(packageName)}/purchases/productsv2/tokens/${encodeURIComponent(purchase.acknowledgement.token)}`,{headers:{authorization:`Bearer ${token}`},signal:AbortSignal.timeout(8_000)}));
    const completed=method==='consume'?check.productLineItem?.[0]?.productOfferDetails?.consumptionState==='CONSUMPTION_STATE_CONSUMED':check.acknowledgementState==='ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED';
    if(!completed) throw new ProviderError('PURCHASE_FINISH_RETRY','구매 확정을 재시도해야 합니다.',502);
  }
}
export async function verifyAppleNotification(signedPayload:string,config:ProviderConfig) {
  const verifier=await appleVerifier(config);
  const notification=await verifier.verifyAndDecodeNotification(signedPayload);
  const transaction=notification.data?.signedTransactionInfo?await verifier.verifyAndDecodeTransaction(notification.data.signedTransactionInfo):undefined;
  if(!notification.notificationUUID) throw new ProviderError('INVALID_NOTIFICATION','알림 식별자가 없습니다.');
  return {signedTransactionInfo:notification.data?.signedTransactionInfo,eventId:notification.notificationUUID,type:notification.notificationType,transactionId:transaction?.transactionId,userId:transaction?.appAccountToken,productId:transaction?.productId,environment:transaction?.environment,revoked:!!transaction?.revocationDate};
}
export async function verifyGoogleNotification(authorization:string|null,body:{message?:{messageId?:string;data?:string}},config:ProviderConfig) {
  await verifyGooglePushAuthorization(authorization,config);
  if(!body.message?.messageId||!body.message.data||body.message.data.length>32_768) throw new ProviderError('INVALID_NOTIFICATION','알림 형식 오류');
  const data=JSON.parse(Buffer.from(body.message.data,'base64').toString('utf8')) as {packageName?:string;oneTimeProductNotification?:{notificationType:number;purchaseToken:string;sku:string};voidedPurchaseNotification?:{purchaseToken:string;orderId:string;refundType:number}};
  if(data.packageName!==required(config.GOOGLE_PACKAGE_NAME,'GOOGLE_PACKAGE_NAME')) throw new ProviderError('INVALID_NOTIFICATION','앱 식별자가 다릅니다.');
  return {eventId:body.message.messageId,...data};
}

/** Used only after authenticated RTDN, to map a first callback to a prepared purchase intent. */
export async function lookupGooglePurchaseBinding(purchaseToken:string,config:ProviderConfig):Promise<string> {
  if(!purchaseToken||purchaseToken.length>32_768)throw new ProviderError('INVALID_PURCHASE','구매 토큰이 올바르지 않습니다.');
  const packageName=required(config.GOOGLE_PACKAGE_NAME,'GOOGLE_PACKAGE_NAME');
  const data=await providerJSON<GooglePurchase>(await fetch(`https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${encodeURIComponent(packageName)}/purchases/productsv2/tokens/${encodeURIComponent(purchaseToken)}`,{headers:{authorization:`Bearer ${await googleAccessToken(config)}`},signal:AbortSignal.timeout(8_000)}));
  const expected=required(config.GOOGLE_IAP_ENVIRONMENT,'GOOGLE_IAP_ENVIRONMENT');
  if((data.testPurchaseContext?'Sandbox':'Production')!==expected)throw new ProviderError('PURCHASE_ENVIRONMENT_MISMATCH','구매 환경이 다릅니다.',403);
  return required(data.obfuscatedExternalAccountId,'Google purchase account binding');
}
