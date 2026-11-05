import {beforeEach,describe,expect,it,vi} from 'vitest';
const state=vi.hoisted(()=>({native:false,secure:new Map<string,string>(),fail:false,local:new Map<string,string>(),adListeners:new Map<string,()=>void>(),canRequestAds:true,adAction:'reward',ssv:null as unknown,prepareCount:0}));
vi.mock('@capacitor/core',()=>({Capacitor:{isNativePlatform:()=>state.native,getPlatform:()=>state.native?'android':'web'}}));
vi.mock('capacitor-secure-storage-plugin',()=>({SecureStoragePlugin:{
  keys:async()=>{if(state.fail)throw new Error('keystore locked');return{value:[...state.secure.keys()]};},
  get:async({key}:{key:string})=>({value:state.secure.get(key)}),
  set:async({key,value}:{key:string;value:string})=>{if(state.fail)throw new Error('keystore locked');state.secure.set(key,value);return {value:true};},
  remove:async({key}:{key:string})=>{state.secure.delete(key);return{value:true};},
}}));
vi.mock('@capacitor-community/admob',()=>({
  AdmobConsentStatus:{REQUIRED:'required'},RewardAdPluginEvents:{Rewarded:'rewarded',Dismissed:'dismissed',FailedToShow:'failed'},
  AdMob:{requestConsentInfo:async()=>({canRequestAds:state.canRequestAds,status:'obtained'}),initialize:async()=>{},
    addListener:async(event:string,fn:()=>void)=>{state.adListeners.set(event,fn);return{remove:async()=>{state.adListeners.delete(event);}};},
    prepareRewardVideoAd:async(options:unknown)=>{state.prepareCount++;state.ssv=options;if(state.adAction==='no-fill')throw Object.assign(new Error('no ad'),{code:'3'});},
    showRewardVideoAd:()=>new Promise(resolve=>queueMicrotask(()=>{if(state.adAction==='reward'){state.adListeners.get('rewarded')?.();resolve({amount:1});}state.adListeners.get('dismissed')?.();})),
  },
}));
import {tokenStorage} from '../apps/client/src/platform/storage';
import {showRewarded} from '../apps/client/src/platform/ads';
import type {RewardIntent} from '../packages/contracts/src';
const intent:RewardIntent={id:'intent-1',placement:'heart',amount:1,status:'reserved',adUnit:'test-unit',expiresAt:Date.now()+1000};
beforeEach(()=>{state.native=false;state.fail=false;state.secure.clear();state.local.clear();state.adListeners.clear();state.canRequestAds=true;state.adAction='reward';state.prepareCount=0;vi.stubEnv('VITE_ENABLE_ADS','true');vi.stubGlobal('localStorage',{getItem:(key:string)=>state.local.get(key)??null,setItem:(key:string,value:string)=>state.local.set(key,value),removeItem:(key:string)=>state.local.delete(key)});vi.stubGlobal('window',{dispatchEvent:()=>true});});
describe('native session storage',()=>{
  it('writes native tokens only to secure storage',async()=>{state.native=true;const tokens={accessToken:'a',refreshToken:'r'};await tokenStorage.set(tokens);expect(await tokenStorage.get()).toEqual(tokens);expect(state.local.size).toBe(0);await tokenStorage.clear();expect(await tokenStorage.get()).toBeNull();});
  it('never falls back to browser storage when the keystore is locked',async()=>{state.native=true;state.fail=true;await expect(tokenStorage.set({accessToken:'a',refreshToken:'r'})).rejects.toThrow('keystore locked');expect(state.local.size).toBe(0);});
  it('supports local browser sessions without invoking native storage',async()=>{state.fail=true;await tokenStorage.set({accessToken:'a',refreshToken:'r'});expect(await tokenStorage.get()).toEqual({accessToken:'a',refreshToken:'r'});});
});
describe('rewarded native lifecycle',()=>{
  it('sets server intent before load and reports pending without awarding',async()=>{state.native=true;const statuses:string[]=[];const result=await showRewarded(intent,'original-account',v=>statuses.push(v));expect(state.ssv).toMatchObject({adId:'test-unit',ssv:{userId:'original-account',customData:'intent-1'}});expect(result).toEqual({earnedCallback:true,status:'pending'});expect(statuses).not.toContain('granted');expect(state.adListeners.size).toBe(0);});
  it('does not treat closing an ad as a reward',async()=>{state.native=true;state.adAction='cancel';expect(await showRewarded(intent,'u',()=>{})).toEqual({earnedCallback:false,status:'cancelled'});});
  it('does not load an ad when consent says no or when running on web',async()=>{await expect(showRewarded(intent,'u',()=>{})).rejects.toThrow();state.native=true;state.canRequestAds=false;await expect(showRewarded(intent,'u',()=>{})).rejects.toThrow();expect(state.prepareCount).toBe(0);});
  it('distinguishes no fill and releases SDK listeners',async()=>{state.native=true;state.adAction='no-fill';const states:string[]=[];await expect(showRewarded(intent,'u',v=>states.push(v))).rejects.toThrow();expect(states.at(-1)).toBe('no-fill');expect(state.adListeners.size).toBe(0);});
});
