import {describe,it,expect,beforeAll} from 'vitest';
import {generateKeyPairSync,sign as nodeSign} from 'node:crypto';
import {createLocalJWKSet,exportJWK,generateKeyPair,SignJWT} from 'jose';
import {verifyIdentityWithKeys,verifyAdMobSignature,signedAdMobQuery,verifyGooglePurchaseResponse,sha256,verifyPurchase} from '../apps/api/src/providers';
const config={GOOGLE_CLIENT_IDS:'google-client',APPLE_CLIENT_IDS:'apple-client',ADMOB_AD_UNITS:'test-unit',ADMOB_REWARD_ITEMS:'reward'};
const nonce='challenge-nonce-at-least-sixteen-bytes';
const ec=generateKeyPairSync('ec',{namedCurve:'prime256v1'});
const pem=ec.publicKey.export({format:'pem',type:'spki'}).toString();
function ssv(signed:string){return `https://example.test/api/ads/ssv?${signed}&signature=${nodeSign('sha256',Buffer.from(signed),ec.privateKey).toString('base64url')}&key_id=17`;}
const body=()=>`ad_unit=test-unit&custom_data=intent%2Bencoded&reward_amount=1&reward_item=reward&timestamp=${Date.now()-3_600_000}&transaction_id=tx-1&user_id=user-1`;
describe('AdMob real ECDSA verification of original query bytes',()=>{
  it('accepts signed DER and decodes intent only after verifying; old arrival is preserved',()=>{
    const result=verifyAdMobSignature(ssv(body()),pem,config);expect(result.intentId).toBe('intent+encoded');expect(result.transactionId).toBe('tx-1');
  });
  it('rejects reordered, decoded and modified signed content',()=>{
    const url=ssv(body());
    expect(()=>verifyAdMobSignature(url.replace('custom_data=intent%2Bencoded','custom_data=intent+encoded'),pem,config)).toThrow();
    expect(()=>verifyAdMobSignature(url.replace('reward_amount=1','reward_amount=9'),pem,config)).toThrow();
    const raw=signedAdMobQuery(url);const swapped=raw.signed.split('&').reverse().join('&');
    expect(()=>verifyAdMobSignature(url.replace(raw.signed,swapped),pem,config)).toThrow();
  });
  it('rejects duplicate fields, disallowed ad units, invalid amount and future timestamp even with valid signature',()=>{
    expect(()=>verifyAdMobSignature(ssv(body()+'&user_id=other'),pem,config)).toThrow();
    expect(()=>verifyAdMobSignature(ssv(body().replace('test-unit','unknown')),pem,config)).toThrow();
    expect(()=>verifyAdMobSignature(ssv(body().replace('reward_amount=1','reward_amount=2')),pem,config)).toThrow();
    expect(()=>verifyAdMobSignature(ssv(body().replace(/timestamp=\d+/,`timestamp=${Date.now()+600_000}`)),pem,config)).toThrow();
  });
  it('rejects an unrelated signing key and missing signature',()=>{
    const alien=generateKeyPairSync('ec',{namedCurve:'prime256v1'}).publicKey.export({format:'pem',type:'spki'}).toString();
    expect(()=>verifyAdMobSignature(ssv(body()),alien,config)).toThrow();
    expect(()=>signedAdMobQuery('https://example.test/?a=b')).toThrow();
  });
});
describe('OIDC identity checks with cryptographically signed fixtures',()=>{
  let keys:Awaited<ReturnType<typeof generateKeyPair>>,jwks:ReturnType<typeof createLocalJWKSet>;
  beforeAll(async()=>{keys=await generateKeyPair('RS256');jwks=createLocalJWKSet({keys:[{...await exportJWK(keys.publicKey),kid:'test',alg:'RS256'}]});});
  async function token(claims:Record<string,unknown>={}){return new SignJWT({nonce,...claims}).setProtectedHeader({alg:'RS256',kid:'test'}).setIssuer('https://accounts.google.com').setAudience('google-client').setSubject('subject-42').setIssuedAt().setExpirationTime('5m').sign(keys.privateKey);}
  it('binds signature, issuer, audience, nonce and provider subject',async()=>{
    await expect(verifyIdentityWithKeys('google',await token(),nonce,config,jwks)).resolves.toEqual({provider:'google',subject:'subject-42'});
    await expect(verifyIdentityWithKeys('google',await token({nonce:'wrong'}),nonce,config,jwks)).rejects.toThrow();
    await expect(verifyIdentityWithKeys('google',await token(),nonce,{...config,GOOGLE_CLIENT_IDS:'different'},jwks)).rejects.toThrow();
    await expect(verifyIdentityWithKeys('apple',await token(),nonce,config,jwks)).rejects.toThrow();
  });
  it('rejects expired or unsigned tokens',async()=>{
    const expired=await new SignJWT({nonce}).setProtectedHeader({alg:'RS256',kid:'test'}).setIssuer('https://accounts.google.com').setAudience('google-client').setSubject('x').setIssuedAt().setExpirationTime('1s').sign(keys.privateKey);
    const parts=expired.split('.');parts[2]='';await expect(verifyIdentityWithKeys('google',parts.join('.'),nonce,config,jwks)).rejects.toThrow();
    const old=await new SignJWT({nonce}).setProtectedHeader({alg:'RS256',kid:'test'}).setIssuer('https://accounts.google.com').setAudience('google-client').setSubject('x').setIssuedAt(Math.floor(Date.now()/1000)-100).setExpirationTime(Math.floor(Date.now()/1000)-90).sign(keys.privateKey);
    await expect(verifyIdentityWithKeys('google',old,nonce,config,jwks)).rejects.toThrow();
  });
});
describe('purchase authority',()=>{
  const input={provider:'google' as const,productId:'coins_1000',token:'purchase-token',userId:'user-id',purchaseIntentId:'50c76396-22ca-4b8a-839d-ebff7d5ceada'};
  const response=async(state:string)=>({productLineItem:[{productId:input.productId,productOfferDetails:{quantity:1}}],purchaseStateContext:{purchaseState:state},purchaseCompletionTime:state==='PURCHASED'?new Date(Date.now()-1000).toISOString():undefined,obfuscatedExternalAccountId:await sha256(input.userId+':'+input.purchaseIntentId)});
  it('uses purchaseToken as unique transaction and never grants PENDING',async()=>{
    expect((await verifyGooglePurchaseResponse(input,await response('PURCHASED'))).transactionId).toBe(input.token);
    expect((await verifyGooglePurchaseResponse(input,await response('PENDING'))).state).toBe('pending');
    expect((await verifyGooglePurchaseResponse(input,await response('CANCELLED'))).state).toBe('cancelled');
  });
  it('rejects test receipts in a production environment',async()=>{const data={...await response('PURCHASED'),testPurchaseContext:{fopType:'TEST'}};await expect(verifyGooglePurchaseResponse(input,data,'Production')).rejects.toThrow();expect((await verifyGooglePurchaseResponse(input,data,'Sandbox')).environment).toBe('Sandbox');});
  it('recognizes the official consumed enum and a fully refunded quantity',async()=>{
    const data=await response('PURCHASED');
    const consumed={...data,productLineItem:[{productId:input.productId,productOfferDetails:{quantity:1,consumptionState:'CONSUMPTION_STATE_CONSUMED'}}]};
    expect((await verifyGooglePurchaseResponse(input,consumed)).acknowledgement.alreadyFinished).toBe(true);
    expect((await verifyGooglePurchaseResponse(input,{...data,productLineItem:[{productId:input.productId,productOfferDetails:{quantity:1,refundableQuantity:0}}]})).state).toBe('cancelled');
  });
  it('requires a valid completion time only after purchase completion',async()=>{
    const data=await response('PURCHASED');
    for(const purchaseCompletionTime of [undefined,'invalid',new Date(Date.now()+600_000).toISOString()])await expect(verifyGooglePurchaseResponse(input,{...data,purchaseCompletionTime})).rejects.toThrow();
    expect((await verifyGooglePurchaseResponse(input,await response('PENDING'))).purchasedAt).toBeUndefined();
  });
  it('rejects another account, product or multiple quantity',async()=>{
    await expect(verifyGooglePurchaseResponse({...input,userId:'other'},await response('PURCHASED'))).rejects.toThrow();
    await expect(verifyGooglePurchaseResponse({...input,purchaseIntentId:'another-intent'},await response('PURCHASED'))).rejects.toThrow();
    await expect(verifyGooglePurchaseResponse({...input,productId:'other'},await response('PURCHASED'))).rejects.toThrow();
    const data=await response('PURCHASED');data.productLineItem[0].productOfferDetails.quantity=2;
    await expect(verifyGooglePurchaseResponse(input,data)).rejects.toThrow();
  });
  it('fails closed without credentials instead of trusting a client token',async()=>{await expect(verifyPurchase(input,{})).rejects.toThrow('GOOGLE_PACKAGE_NAME');});
});
