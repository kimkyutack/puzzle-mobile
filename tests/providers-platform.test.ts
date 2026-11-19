import {beforeEach,describe,expect,it,vi} from 'vitest';
const state=vi.hoisted(()=>({native:false,platform:'android',secure:new Map<string,string>(),fail:false,local:new Map<string,string>(),adListeners:new Map<string,(value?:unknown)=>void>(),canRequestAds:true,adAction:'reward',adErrorCode:'3',ssv:null as unknown,showOptions:null as unknown,initializeOptions:null as unknown,prepareCount:0,consentCount:0}));
vi.mock('@capacitor/core',()=>({Capacitor:{isNativePlatform:()=>state.native,getPlatform:()=>state.native?state.platform:'web'}}));
vi.mock('capacitor-secure-storage-plugin',()=>({SecureStoragePlugin:{
  keys:async()=>{if(state.fail)throw new Error('keystore locked');return{value:[...state.secure.keys()]};},
  get:async({key}:{key:string})=>({value:state.secure.get(key)}),
  set:async({key,value}:{key:string;value:string})=>{if(state.fail)throw new Error('keystore locked');state.secure.set(key,value);return {value:true};},
  remove:async({key}:{key:string})=>{state.secure.delete(key);return{value:true};},
}}));
vi.mock('@capacitor-community/admob',()=>({
  AdmobConsentStatus:{REQUIRED:'required'},RewardAdPluginEvents:{Rewarded:'rewarded',Dismissed:'dismissed',FailedToShow:'failed'},
  AdMob:{requestConsentInfo:async()=>{state.consentCount++;return {canRequestAds:state.canRequestAds,status:'obtained'};},initialize:async(options:unknown)=>{state.initializeOptions=options},
    addListener:async(event:string,fn:()=>void)=>{state.adListeners.set(event,fn);return{remove:async()=>{state.adListeners.delete(event);}};},
    prepareRewardVideoAd:async(options:unknown)=>{state.prepareCount++;state.ssv=options;if(state.adAction==='no-fill')throw Object.assign(new Error('no ad'),{code:state.adErrorCode});},
    showRewardVideoAd:(options:unknown)=>{state.showOptions=options;return new Promise((resolve,reject)=>queueMicrotask(()=>{if(state.adAction==='show-error'){reject(new Error('presentation failed'));return}if(state.adAction==='reward'||state.adAction==='reward-wait'){state.adListeners.get('rewarded')?.();resolve({amount:1});}if(state.adAction==='promise-only')resolve({amount:1});if(state.adAction!=='reward-wait')state.adListeners.get('dismissed')?.();}));},
  },
}));
import {ageAdmissionStorage,tokenStorage} from '../apps/client/src/platform/storage';
import {adPrivacyOptions,showRewarded} from '../apps/client/src/platform/ads';
import {setAccountAge} from '../apps/client/src/platform/account-age';
import type {RewardIntent} from '../packages/contracts/src';
const intent:RewardIntent={id:'intent-1',placement:'heart',amount:1,status:'reserved',adUnit:'test-unit',expiresAt:Date.now()+1000};
beforeEach(()=>{state.native=false;state.platform='android';state.adErrorCode='3';state.fail=false;state.secure.clear();state.local.clear();state.adListeners.clear();state.canRequestAds=true;state.adAction='reward';state.prepareCount=0;state.consentCount=0;state.showOptions=null;setAccountAge('adult');vi.stubEnv('VITE_ENABLE_ADS','true');vi.stubEnv('VITE_ADS_TEST_MODE','false');vi.stubGlobal('localStorage',{getItem:(key:string)=>state.local.get(key)??null,setItem:(key:string,value:string)=>state.local.set(key,value),removeItem:(key:string)=>state.local.delete(key)});vi.stubGlobal('window',{dispatchEvent:()=>true});});
describe('native session storage',()=>{
  it('writes native tokens only to secure storage',async()=>{state.native=true;const tokens={accessToken:'a',refreshToken:'r'};await tokenStorage.set(tokens);expect(await tokenStorage.get()).toEqual(tokens);expect(state.local.size).toBe(0);await tokenStorage.clear();expect(await tokenStorage.get()).toBeNull();});
  it('never falls back to browser storage when the keystore is locked',async()=>{state.native=true;state.fail=true;await expect(tokenStorage.set({accessToken:'a',refreshToken:'r'})).rejects.toThrow('keystore locked');expect(state.local.size).toBe(0);});
  it('supports local browser sessions without invoking native storage',async()=>{state.fail=true;await tokenStorage.set({accessToken:'a',refreshToken:'r'});expect(await tokenStorage.get()).toEqual({accessToken:'a',refreshToken:'r'});});
  it('keeps only the opaque guardian admission token in native secure storage',async()=>{state.native=true;await ageAdmissionStorage.set('test-opaque-token');expect(await ageAdmissionStorage.get()).toBe('test-opaque-token');expect(state.local.size).toBe(0);await ageAdmissionStorage.clear();expect(await ageAdmissionStorage.get()).toBeNull();});
});
describe('rewarded native lifecycle',()=>{
  it.each([null,'child','teen'] as const)('does not call the native ads or consent SDK for age band %s',async(band)=>{state.native=true;setAccountAge(band);await expect(showRewarded(intent,'u',()=>{})).rejects.toThrow();await expect(adPrivacyOptions()).rejects.toThrow();expect(state.consentCount).toBe(0);expect(state.prepareCount).toBe(0);});
  it('sets server intent before load and reports pending without awarding',async()=>{state.native=true;const statuses:string[]=[];const result=await showRewarded(intent,'original-account',v=>statuses.push(v));expect(state.ssv).toMatchObject({adId:'test-unit',ssv:{userId:'original-account',customData:'intent-1'}});expect(result).toEqual({earnedCallback:true,status:'pending'});expect(statuses).not.toContain('granted');expect(state.adListeners.size).toBe(0);});
  it('does not treat closing an ad as a reward',async()=>{state.native=true;state.adAction='cancel';expect(await showRewarded(intent,'u',()=>{})).toEqual({earnedCallback:false,status:'cancelled'});});
  it('does not load an ad when consent says no or when running on web',async()=>{await expect(showRewarded(intent,'u',()=>{})).rejects.toThrow();state.native=true;state.canRequestAds=false;await expect(showRewarded(intent,'u',()=>{})).rejects.toThrow();expect(state.prepareCount).toBe(0);});
  it('distinguishes no fill and releases SDK listeners',async()=>{state.native=true;state.adAction='no-fill';const states:string[]=[];await expect(showRewarded(intent,'u',v=>states.push(v))).rejects.toThrow();expect(states.at(-1)).toBe('no-fill');expect(state.adListeners.size).toBe(0);});
  it('never treats a resolved presentation promise as an earned SDK callback',async()=>{state.native=true;state.adAction='promise-only';expect(await showRewarded(intent,'u',()=>{})).toEqual({earnedCallback:false,status:'cancelled'});expect(state.showOptions).toEqual({adId:intent.adUnit});expect(state.ssv).toMatchObject({isTesting:false});});
  it('waits for dismissal after earning and blocks another simultaneous presentation',async()=>{state.native=true;state.adAction='reward-wait';let finished=false;const pending=showRewarded(intent,'u',()=>{}).then(v=>{finished=true;return v});await vi.waitFor(()=>expect(state.showOptions).not.toBeNull());expect(finished).toBe(false);await expect(showRewarded(intent,'u',()=>{})).rejects.toThrow();state.adListeners.get('dismissed')?.();expect(await pending).toEqual({earnedCallback:true,status:'pending'});expect(state.adListeners.size).toBe(0);});
  it('restores the UI and listeners after native show failure',async()=>{state.native=true;state.adAction='show-error';await expect(showRewarded(intent,'u',()=>{})).rejects.toThrow('presentation failed');expect(state.adListeners.size).toBe(0);state.adAction='cancel';expect((await showRewarded(intent,'u',()=>{})).status).toBe('cancelled');});
  it.each([['ios','1','no-fill'],['ios','3','error'],['android','1','error']])('classifies %s SDK code %s as %s',async(platform,code,last)=>{state.native=true;state.platform=platform;state.adErrorCode=code;state.adAction='no-fill';const statuses:string[]=[];await expect(showRewarded(intent,'u',s=>statuses.push(s))).rejects.toThrow();expect(statuses.at(-1)).toBe(last);});
});
