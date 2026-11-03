import { createPublicKey, verify } from 'node:crypto';
import { csv, providerJSON, ProviderError, type ProviderConfig } from './common';
const KEY_URL = 'https://www.gstatic.com/admob/reward/verifier-keys.json';
type KeyDocument = {keys:Array<{keyId:number;pem:string;base64?:string}>};
// Only public verification material is cached; this never contains player/session state.
let keyCache: {expires:number;keys:KeyDocument['keys']}|undefined;
async function getKeys(force = false) {
  if (!force && keyCache && Date.now() < keyCache.expires) return keyCache.keys;
  const document = await providerJSON<KeyDocument>(await fetch(KEY_URL, {signal:AbortSignal.timeout(8_000)}), 64_000);
  if (!Array.isArray(document.keys) || document.keys.length === 0 || document.keys.length > 20) throw new ProviderError('AD_KEYS_UNAVAILABLE','광고 서명 키를 확인할 수 없습니다.',503);
  keyCache = {expires:Date.now()+6*60*60*1_000,keys:document.keys};
  return document.keys;
}
export interface VerifiedAdCallback {transactionId:string;intentId:string;userId:string;adUnit:string;timestamp:number;rewardAmount:number;rewardItem:string}
export function signedAdMobQuery(rawUrl: string) {
  const queryAt = rawUrl.indexOf('?');
  if (queryAt < 0 || rawUrl.length > 16_384 || rawUrl.includes('#')) throw new ProviderError('INVALID_SSV','잘못된 광고 콜백입니다.');
  const rawQuery = rawUrl.slice(queryAt+1);
  const match = /^(.*)&signature=([A-Za-z0-9_%-]+)&key_id=([0-9]+)$/.exec(rawQuery);
  if (!match || /(?:^|&)(?:signature|key_id)=/.test(match[1])) throw new ProviderError('INVALID_SSV','광고 서명 형식이 올바르지 않습니다.');
  return {signed:match[1],signature:decodeURIComponent(match[2]),keyId:Number(match[3])};
}
export function verifyAdMobSignature(rawUrl: string, pem: string, config: ProviderConfig): VerifiedAdCallback {
  const {signed,signature} = signedAdMobQuery(rawUrl);
  // Google's signature is ASN.1 DER ECDSA; node:crypto performs DER parsing and P-256/SHA-256 verification.
  const key = createPublicKey(pem);
  if (key.asymmetricKeyType !== 'ec' || key.asymmetricKeyDetails?.namedCurve !== 'prime256v1' ||
      !verify('sha256',Buffer.from(signed,'utf8'),key,Buffer.from(signature,'base64url')))
    throw new ProviderError('INVALID_SSV_SIGNATURE','광고 서명을 확인할 수 없습니다.',401);
  // Decode only after the original bytes have been authenticated.
  const params = new URLSearchParams(signed);
  for (const keyName of params.keys()) if (params.getAll(keyName).length !== 1) throw new ProviderError('INVALID_SSV','중복 광고 필드입니다.');
  const value = (name:string) => { const v=params.get(name); if (!v) throw new ProviderError('INVALID_SSV',`광고 ${name} 누락`); return v; };
  const result:VerifiedAdCallback = {transactionId:value('transaction_id'),intentId:value('custom_data'),userId:value('user_id'),adUnit:value('ad_unit'),timestamp:Number(value('timestamp')),rewardAmount:Number(value('reward_amount')),rewardItem:value('reward_item')};
  if (!csv(config.ADMOB_AD_UNITS,'ADMOB_AD_UNITS').includes(result.adUnit) || !csv(config.ADMOB_REWARD_ITEMS ?? 'reward','ADMOB_REWARD_ITEMS').includes(result.rewardItem)) throw new ProviderError('INVALID_SSV_PLACEMENT','허용되지 않은 광고 단위 또는 보상 종류입니다.');
  if (!Number.isSafeInteger(result.timestamp) || result.timestamp < 1_000_000_000_000 || result.timestamp > Date.now()+300_000 || !Number.isSafeInteger(result.rewardAmount) || result.rewardAmount !== 1 || result.transactionId.length > 255 || result.intentId.length > 128 || result.userId.length > 128) throw new ProviderError('INVALID_SSV_VALUE','광고 보상 필드가 올바르지 않습니다.');
  // Do NOT reject an old arrival here: the D1 intent binds signed view time to its original validity window.
  return result;
}
export async function verifyAdMobCallback(rawUrl:string,config:ProviderConfig):Promise<VerifiedAdCallback> {
  const {keyId} = signedAdMobQuery(rawUrl);
  let key = (await getKeys()).find(candidate=>candidate.keyId===keyId);
  if (!key) key=(await getKeys(true)).find(candidate=>candidate.keyId===keyId);
  if (!key) throw new ProviderError('UNKNOWN_SSV_KEY','광고 서명 키를 찾을 수 없습니다.',401);
  return verifyAdMobSignature(rawUrl,key.pem,config);
}
