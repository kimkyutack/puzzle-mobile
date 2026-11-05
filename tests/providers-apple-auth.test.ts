import {afterEach,beforeAll,describe,expect,it,vi} from 'vitest';
import {createLocalJWKSet,exportJWK,exportPKCS8,generateKeyPair,jwtVerify,SignJWT} from 'jose';
import {exchangeAppleAuthorizationCode,revokeAppleAuthorization,sealAppleRevocationToken,verifyAppleIdentityNotification,type ProviderConfig} from '../apps/api/src/providers';

const config:ProviderConfig={APPLE_CLIENT_IDS:'com.cloudgarden.match',APPLE_BUNDLE_ID:'com.cloudgarden.match',APPLE_AUTH_CLIENT_ID:'com.cloudgarden.web',APPLE_TEAM_ID:'test-team',APPLE_AUTH_KEY_ID:'test-key',AUTH_TOKEN_ENCRYPTION_KEY:Buffer.alloc(32,7).toString('base64url')};
const token={subject:'apple-subject',clientId:'com.cloudgarden.match',refreshToken:'private-refresh-token-fixture'};
let signing:Awaited<ReturnType<typeof generateKeyPair>>;
beforeAll(async()=>{signing=await generateKeyPair('ES256',{extractable:true});config.APPLE_AUTH_PRIVATE_KEY=await exportPKCS8(signing.privateKey);});
afterEach(()=>vi.unstubAllGlobals());
describe('Apple authorization deletion outbox cryptography',()=>{
 it('redeems native and web codes with their exact client audience and redirect rules',async()=>{
  const keys=await generateKeyPair('RS256');const key={...await exportJWK(keys.publicKey),kid:'exchange-key',alg:'RS256'};
  const nonce='server-challenge-nonce-12345';const bodies:URLSearchParams[]=[];let mismatched=false;
  const cfg={...config,APPLE_AUTH_REDIRECT_URL:'https://game.example/api/auth/apple/callback'};
  vi.stubGlobal('fetch',vi.fn(async(url:URL|string,init?:RequestInit)=>{
   if(String(url)==='https://appleid.apple.com/auth/keys')return Response.json({keys:[key]});
   expect(String(url)).toBe('https://appleid.apple.com/auth/token');const body=new URLSearchParams(String(init?.body));bodies.push(body);
   const jwt=await new SignJWT({nonce}).setProtectedHeader({alg:'RS256',kid:'exchange-key'}).setIssuer('https://appleid.apple.com').setAudience(mismatched?'other-application':body.get('client_id')!).setSubject(token.subject).setIssuedAt().setExpirationTime('5m').sign(keys.privateKey);
   return Response.json({id_token:jwt,access_token:'access-fixture',refresh_token:token.refreshToken});
  }));
  expect((await exchangeAppleAuthorizationCode('native-code',nonce,cfg,'native')).clientId).toBe(config.APPLE_BUNDLE_ID);
  expect(bodies[0]!.has('redirect_uri')).toBe(false);
  expect((await exchangeAppleAuthorizationCode('web-code',nonce,cfg,'web')).clientId).toBe(config.APPLE_AUTH_CLIENT_ID);
  expect(bodies[1]!.get('redirect_uri')).toBe(cfg.APPLE_AUTH_REDIRECT_URL);
  mismatched=true;await expect(exchangeAppleAuthorizationCode('wrong-code',nonce,cfg,'native')).rejects.toThrow();
 });
 it('encrypts the token and sends a correctly signed confidential revoke request only after decrypting',async()=>{
  const sealed=await sealAppleRevocationToken(token,config);expect(sealed).not.toContain(token.refreshToken);expect(sealed).not.toContain(token.subject);
  let requests=0;
  vi.stubGlobal('fetch',vi.fn(async(url:string,init:RequestInit)=>{
   expect(url).toBe('https://appleid.apple.com/auth/revoke');expect(init.method).toBe('POST');const body=new URLSearchParams(String(init.body));
   expect(body.get('token')).toBe(token.refreshToken);expect(body.get('token_type_hint')).toBe('refresh_token');expect(body.get('client_id')).toBe(token.clientId);
   const {payload}=await jwtVerify(body.get('client_secret')!,signing.publicKey,{algorithms:['ES256'],issuer:'test-team',audience:'https://appleid.apple.com',subject:token.clientId});expect(payload.exp).toBeGreaterThan(payload.iat!);
   requests++;return new Response(null,{status:200});
  }));
  await revokeAppleAuthorization(sealed,config);await revokeAppleAuthorization(sealed,config);expect(requests).toBe(2);
 });
 it('rejects ciphertext alteration, wrong encryption keys and unauthorized clients before sending a token',async()=>{
  vi.stubGlobal('fetch',vi.fn());
  const sealed=await sealAppleRevocationToken(token,config);const parts=sealed.split('.');parts[3]=(parts[3]![0]==='a'?'b':'a')+parts[3]!.slice(1);
  await expect(revokeAppleAuthorization(parts.join('.'),config)).rejects.toThrow();
  await expect(revokeAppleAuthorization(sealed,{...config,AUTH_TOKEN_ENCRYPTION_KEY:Buffer.alloc(32,8).toString('base64url')})).rejects.toThrow();
  await expect(sealAppleRevocationToken({...token,clientId:'unrelated-client'},config)).rejects.toThrow();
  await expect(sealAppleRevocationToken(token,{...config,AUTH_TOKEN_ENCRYPTION_KEY:undefined})).rejects.toThrow('AUTH_TOKEN_ENCRYPTION_KEY');expect(fetch).not.toHaveBeenCalled();
 });
 it('keeps a non-200 provider response retryable',async()=>{
  vi.stubGlobal('fetch',vi.fn(async()=>new Response(null,{status:503})));
  await expect(revokeAppleAuthorization(await sealAppleRevocationToken(token,config),config)).rejects.toMatchObject({code:'APPLE_REVOKE_RETRY'});
 });
});
describe('Apple identity consent notifications',()=>{
 it('verifies real signed account events, including official payloads without exp, and rejects wrong audience or tampering',async()=>{
  const keys=await generateKeyPair('RS256');const jwks=createLocalJWKSet({keys:[{...await exportJWK(keys.publicKey),kid:'apple-test',alg:'RS256'}]});
  const time=Math.floor(Date.now()/1000);
  const signed=await new SignJWT({events:{type:'consent-revoked',sub:token.subject,event_time:time}}).setProtectedHeader({alg:'RS256',kid:'apple-test'}).setIssuer('https://appleid.apple.com').setAudience(token.clientId).setIssuedAt(time).setJti('notification-1').sign(keys.privateKey);
  await expect(verifyAppleIdentityNotification(signed,config,jwks)).resolves.toEqual({eventId:'notification-1',type:'consent-revoked',subject:token.subject,eventTime:time*1000});
  await expect(verifyAppleIdentityNotification(signed,{...config,APPLE_CLIENT_IDS:'other'},jwks)).rejects.toThrow();
  await expect(verifyAppleIdentityNotification(signed.slice(0,-8)+'tampered',config,jwks)).rejects.toThrow();
 });
});
