import {tr} from "../i18n";
import { Capacitor, type PluginListenerHandle } from '@capacitor/core';
import { AdMob, AdmobConsentStatus, RewardAdPluginEvents } from '@capacitor-community/admob';
import type { RewardIntent } from '@garden/contracts';
export type AdState='idle'|'loading'|'no-fill'|'showing'|'cancelled'|'pending'|'granted'|'error'|'unavailable';
let initialized=false,showing=false;
export function adsAvailable(){return Capacitor.isNativePlatform()&&import.meta.env.VITE_ENABLE_ADS==='true';}
export async function adPrivacyOptions(){
  if(!adsAvailable()) throw new Error(tr("광고 개인정보 설정은 광고가 연결된 모바일 앱에서 사용할 수 있습니다."));
  await AdMob.showPrivacyOptionsForm();
}
async function consent(){
  let info=await AdMob.requestConsentInfo();
  if(info.status===AdmobConsentStatus.REQUIRED && info.isConsentFormAvailable) info=await AdMob.showConsentForm();
  if(!info.canRequestAds) throw new Error(tr("현재 광고 요청이 허용되지 않습니다. 게임은 계속 이용할 수 있습니다."));
  if(!initialized){await AdMob.initialize({initializeForTesting:import.meta.env.VITE_ADS_TEST_MODE!=='false'});initialized=true;}
}
/** This never changes currency. Only verified SSV on the server can grant the reserved reward. */
export async function showRewarded(intent:RewardIntent,userId:string,onState:(state:AdState)=>void):Promise<{earnedCallback:boolean;status:'pending'|'cancelled'}>{
  if(!adsAvailable()){onState('unavailable');throw new Error(tr("보상형 광고는 광고 설정이 연결된 iOS·Android 앱에서 이용할 수 있습니다."));}
  if(showing) throw new Error(tr("이미 광고가 열려 있습니다."));
  if(!intent.id||!intent.adUnit) throw new Error(tr("광고 보상 요청이 올바르지 않습니다."));
  showing=true;let earned=false;let showError:Error|undefined;const listeners:PluginListenerHandle[]=[];
  let resolveClosed:()=>void=()=>{};
  const closed=new Promise<void>(resolve=>{resolveClosed=resolve;});
  try {
    onState('loading');await consent();
    listeners.push(await AdMob.addListener(RewardAdPluginEvents.Rewarded,()=>{earned=true;onState('pending');}));
    listeners.push(await AdMob.addListener(RewardAdPluginEvents.Dismissed,()=>{resolveClosed();}));
    listeners.push(await AdMob.addListener(RewardAdPluginEvents.FailedToShow,(error)=>{showError=new Error(error.message||tr("광고를 표시할 수 없습니다."));resolveClosed();onState('error');}));
    // SSV is fixed before loading this ad; never reuse a preloaded ad for a different intent/account.
    await AdMob.prepareRewardVideoAd({adId:intent.adUnit,isTesting:import.meta.env.VITE_ADS_TEST_MODE!=='false',ssv:{userId,customData:intent.id}});
    onState('showing');window.dispatchEvent(new Event('garden:audio-pause'));
    const shown=AdMob.showRewardVideoAd().then(()=>{earned=true;onState('pending');}).catch((error)=>{showError=error instanceof Error?error:new Error(tr("광고를 표시할 수 없습니다."));resolveClosed();});
    await Promise.race([shown,closed]);
    if(showError)throw showError;
    // An earned callback may precede dismissal. We wait for dismissal before unlocking UI/audio.
    if(earned) await closed;
    onState(earned?'pending':'cancelled');
    return {earnedCallback:earned,status:earned?'pending':'cancelled'};
  } catch(error) {
    const code=error&&typeof error==='object'&&'code'in error?String(error.code):'';
    onState(code==='3'||code==='1'?'no-fill':'error');throw error;
  } finally {
    for(const listener of listeners) await listener.remove().catch(()=>{});
    showing=false;window.dispatchEvent(new Event('garden:audio-resume'));
  }
}
export const rewardedAds={show:showRewarded,available:adsAvailable,privacyOptions:adPrivacyOptions};
