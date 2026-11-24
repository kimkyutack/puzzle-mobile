import {beforeEach,describe,it,expect,vi} from 'vitest';

const {platform,initialize,login}=vi.hoisted(()=>({platform:{name:'android'},initialize:vi.fn(async(_options:Record<string,unknown>)=>{}),login:vi.fn(async()=>({result:{idToken:'token'}}))}));
vi.mock('@capacitor/core',()=>({Capacitor:{getPlatform:()=>platform.name}}));
vi.mock('@capacitor/app',()=>({App:{addListener:vi.fn()}}));
vi.mock('@capacitor/browser',()=>({Browser:{open:vi.fn(),close:vi.fn()}}));
vi.mock('@capacitor/preferences',()=>({Preferences:{get:vi.fn(async()=>({value:null})),set:vi.fn(),remove:vi.fn()}}));
vi.mock('@capgo/capacitor-social-login',()=>({SocialLogin:{initialize,login}}));
vi.mock('../apps/client/src/platform/account-age',()=>({childAccount:()=>false}));

async function googleSignIn(name:string){
 platform.name=name;vi.resetModules();
 const {signIn}=await import('../apps/client/src/platform/auth');
 return signIn('google','nonce-value','11111111-1111-4111-8111-111111111111');
}

describe('native social login setup',()=>{
 beforeEach(()=>{initialize.mockClear();login.mockClear();vi.stubEnv('VITE_GOOGLE_WEB_CLIENT_ID','web-client.apps.googleusercontent.com');vi.stubEnv('VITE_APPLE_SERVICE_ID','');vi.stubEnv('VITE_APPLE_REDIRECT_URL','');});
 it('never hands Apple to the plugin on Android, so Google sign-in is not rejected for a missing Services ID',async()=>{
  await expect(googleSignIn('android')).resolves.toMatchObject({idToken:'token',provider:'google'});
  const options=initialize.mock.calls[0]![0];
  expect(options.apple).toBeUndefined();expect(options.google).toMatchObject({webClientId:'web-client.apps.googleusercontent.com'});
  // Explicit scopes are rejected on Android unless MainActivity is modified; the defaults already cover openid/email/profile.
  const request=(login.mock.calls[0] as unknown as [{options:Record<string,unknown>}])[0];
  expect(request.options.scopes).toBeUndefined();expect(request.options.nonce).toBe('nonce-value');
 });
 it('still sets up native Apple sign-in on iOS',async()=>{
  await googleSignIn('ios');
  expect(initialize.mock.calls[0]![0].apple).toMatchObject({redirectUrl:''});
 });
});
