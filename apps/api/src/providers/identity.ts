import { CompactEncrypt, compactDecrypt, createRemoteJWKSet, jwtVerify, importPKCS8, SignJWT, type JWTVerifyGetKey } from 'jose';
import { csv, ProviderError, providerJSON, required, sha256, type ProviderConfig } from './common';
const googleKeys = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'));
const appleKeys = createRemoteJWKSet(new URL('https://appleid.apple.com/auth/keys'));
export type IdentityProvider = 'google'|'apple';
/** Challenge nonce must come from the server's unconsumed, session-bound challenge row. */
export async function verifyIdentity(provider: IdentityProvider, idToken: string, expectedNonce: string, config: ProviderConfig) {
  return verifyIdentityWithKeys(provider, idToken, expectedNonce, config, provider === 'google' ? googleKeys : appleKeys);
}
/** Key injection is internal-only for offline signature regression tests, never an HTTP input. */
export async function verifyIdentityWithKeys(provider: IdentityProvider, idToken: string, expectedNonce: string, config: ProviderConfig, keys: JWTVerifyGetKey) {
  if (idToken.length > 16_384 || expectedNonce.length < 16) throw new ProviderError('INVALID_IDENTITY', '인증 요청이 올바르지 않습니다.');
  const audiences = provider === 'google' ? csv(config.GOOGLE_CLIENT_IDS, 'GOOGLE_CLIENT_IDS') : csv(config.APPLE_CLIENT_IDS, 'APPLE_CLIENT_IDS');
  const {payload} = await jwtVerify(idToken, keys, {
    algorithms:['RS256'], audience:audiences,
    issuer:provider === 'google' ? ['accounts.google.com','https://accounts.google.com'] : 'https://appleid.apple.com',
    requiredClaims:['iss','aud','sub','exp','iat','nonce'], clockTolerance:5,
  });
  const validNonce = payload.nonce === expectedNonce || (provider === 'apple' && payload.nonce === await sha256(expectedNonce));
  if (!validNonce || typeof payload.sub !== 'string' || !payload.sub || payload.sub.length > 255)
    throw new ProviderError('INVALID_IDENTITY', '인증 nonce 또는 계정 식별자가 올바르지 않습니다.');
  return {provider,subject:payload.sub};
}
export async function verifyGooglePushAuthorization(authorization: string | null, config: ProviderConfig) {
  const token = authorization?.startsWith('Bearer ') ? authorization.slice(7) : '';
  if (!token) throw new ProviderError('UNAUTHORIZED_CALLBACK','공급자 인증이 필요합니다.',401);
  const {payload} = await jwtVerify(token, googleKeys, {
    algorithms:['RS256'],issuer:['accounts.google.com','https://accounts.google.com'],
    audience:csv(config.GOOGLE_RTDN_AUDIENCE,'GOOGLE_RTDN_AUDIENCE'),requiredClaims:['iss','aud','exp','email','email_verified'],
  });
  if (payload.email !== config.GOOGLE_RTDN_EMAIL || payload.email_verified !== true)
    throw new ProviderError('UNAUTHORIZED_CALLBACK','허용되지 않은 알림 발신자입니다.',401);
}

async function appleClientSecret(clientId:string,config:ProviderConfig){
  if(![config.APPLE_AUTH_CLIENT_ID,config.APPLE_BUNDLE_ID].filter(Boolean).includes(clientId))throw new ProviderError('INVALID_APPLE_CLIENT','허용되지 않은 Apple 앱 식별자입니다.',403);
  return new SignJWT({})
    .setProtectedHeader({alg:'ES256',kid:required(config.APPLE_AUTH_KEY_ID,'APPLE_AUTH_KEY_ID')})
    .setIssuer(required(config.APPLE_TEAM_ID,'APPLE_TEAM_ID')).setSubject(clientId)
    .setAudience('https://appleid.apple.com').setIssuedAt().setExpirationTime('5m')
    .sign(await importPKCS8(required(config.APPLE_AUTH_PRIVATE_KEY,'APPLE_AUTH_PRIVATE_KEY'),'ES256'));
}
/** Exchange only on Workers. Native Apple authorization has no redirect_uri; web form_post does. */
export async function exchangeAppleAuthorizationCode(code:string,expectedNonce:string,config:ProviderConfig,flow:'web'|'native'='web') {
  if(!code||code.length>4096) throw new ProviderError('INVALID_IDENTITY','Apple 인증 코드가 올바르지 않습니다.');
  const clientId=required(flow==='native'?config.APPLE_BUNDLE_ID:config.APPLE_AUTH_CLIENT_ID,flow==='native'?'APPLE_BUNDLE_ID':'APPLE_AUTH_CLIENT_ID');
  const body=new URLSearchParams({grant_type:'authorization_code',client_id:clientId,client_secret:await appleClientSecret(clientId,config),code});
  if(flow==='web')body.set('redirect_uri',required(config.APPLE_AUTH_REDIRECT_URL,'APPLE_AUTH_REDIRECT_URL'));
  const tokens=await providerJSON<{id_token?:string;access_token?:string;refresh_token?:string}>(await fetch('https://appleid.apple.com/auth/token',{
    method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},
    body,signal:AbortSignal.timeout(8_000),
  }));
  const idToken=required(tokens.id_token,'Apple id_token');
  // The exchanged token must belong to the exact client that redeemed this one-use code.
  const identity=await verifyIdentity('apple',idToken,expectedNonce,{...config,APPLE_CLIENT_IDS:clientId});
  return {idToken,accessToken:required(tokens.access_token,'Apple access_token'),refreshToken:required(tokens.refresh_token,'Apple refresh_token'),clientId,identity};
}

export interface AppleRevocationToken {subject:string;clientId:string;refreshToken:string}
function tokenEncryptionKey(config:ProviderConfig){
 const value=required(config.AUTH_TOKEN_ENCRYPTION_KEY,'AUTH_TOKEN_ENCRYPTION_KEY');
 if(!/^[A-Za-z0-9_-]{43}$/.test(value))throw new ProviderError('PROVIDER_NOT_CONFIGURED','AUTH_TOKEN_ENCRYPTION_KEY는 32바이트 base64url 비밀키여야 합니다.',503);
 const key=Buffer.from(value,'base64url');
 if(key.byteLength!==32)throw new ProviderError('PROVIDER_NOT_CONFIGURED','인증 토큰 암호화 키 길이가 올바르지 않습니다.',503);
 return key;
}
function checkRevocationToken(value:unknown,config:ProviderConfig):AppleRevocationToken{
 if(!value||typeof value!=='object')throw new ProviderError('APPLE_TOKEN_INVALID','보관된 Apple 인증을 확인할 수 없습니다.',503);
 const token=value as Partial<AppleRevocationToken>;
 if(typeof token.subject!=='string'||!token.subject||token.subject.length>255||typeof token.clientId!=='string'||![config.APPLE_AUTH_CLIENT_ID,config.APPLE_BUNDLE_ID].filter(Boolean).includes(token.clientId)||typeof token.refreshToken!=='string'||!token.refreshToken||token.refreshToken.length>8192)throw new ProviderError('APPLE_TOKEN_INVALID','보관된 Apple 인증을 확인할 수 없습니다.',503);
 return token as AppleRevocationToken;
}
/** Authenticated encryption via jose. Store only this ciphertext in D1 and the revocation outbox. */
export async function sealAppleRevocationToken(input:AppleRevocationToken,config:ProviderConfig):Promise<string>{
 const token=checkRevocationToken(input,config);
 return new CompactEncrypt(new TextEncoder().encode(JSON.stringify(token)))
  .setProtectedHeader({alg:'dir',enc:'A256GCM',typ:'apple-revocation-v1'}).encrypt(tokenEncryptionKey(config));
}
/** Apple returns HTTP 200 for an already-revoked token too, making outbox retries safe. */
export async function revokeAppleAuthorization(sealed:string,config:ProviderConfig):Promise<void>{
 if(!sealed||sealed.length>16000)throw new ProviderError('APPLE_TOKEN_INVALID','보관된 Apple 인증을 확인할 수 없습니다.',503);
 const {plaintext,protectedHeader}=await compactDecrypt(sealed,tokenEncryptionKey(config),{keyManagementAlgorithms:['dir'],contentEncryptionAlgorithms:['A256GCM']});
 if(protectedHeader.typ!=='apple-revocation-v1')throw new ProviderError('APPLE_TOKEN_INVALID','Apple 인증 암호문 종류가 다릅니다.',503);
 const token=checkRevocationToken(JSON.parse(new TextDecoder().decode(plaintext)),config);
 const response=await fetch('https://appleid.apple.com/auth/revoke',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:token.clientId,client_secret:await appleClientSecret(token.clientId,config),token:token.refreshToken,token_type_hint:'refresh_token'}),signal:AbortSignal.timeout(8000)});
 if(response.status!==200)throw new ProviderError('APPLE_REVOKE_RETRY','Apple 연결 해제를 다시 확인해야 합니다.',502);
}
/** Identity consent notifications are separate from App Store purchase notifications. */
export async function verifyAppleIdentityNotification(payload:string,config:ProviderConfig,keys:JWTVerifyGetKey=appleKeys){
 if(!payload||payload.length>32768)throw new ProviderError('INVALID_NOTIFICATION','Apple 계정 알림 형식 오류');
 const {payload:claims}=await jwtVerify(payload,keys,{algorithms:['RS256'],issuer:'https://appleid.apple.com',audience:csv(config.APPLE_CLIENT_IDS,'APPLE_CLIENT_IDS'),requiredClaims:['iss','aud','iat','jti','events'],clockTolerance:5});
 const event=typeof claims.events==='string'?JSON.parse(claims.events):claims.events;
 if(!event||typeof event!=='object'||typeof event.sub!=='string'||!event.sub||event.sub.length>255||typeof claims.jti!=='string'||!claims.jti||claims.jti.length>255||typeof event.event_time!=='number'||!Number.isSafeInteger(event.event_time)||event.event_time<=0||event.event_time*1000>Date.now()+300000||typeof claims.iat!=='number'||claims.iat*1000>Date.now()+300000||!['email-enabled','email-disabled','consent-revoked','account-deleted'].includes(event.type))throw new ProviderError('INVALID_NOTIFICATION','Apple 계정 알림 값이 올바르지 않습니다.');
 return {eventId:claims.jti,type:event.type as 'email-enabled'|'email-disabled'|'consent-revoked'|'account-deleted',subject:event.sub as string,eventTime:event.event_time*1000};
}
