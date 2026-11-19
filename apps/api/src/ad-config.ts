import {ensure,type ApiEnv} from './db';
import type {AdPlacement} from '@garden/contracts';
/** Older clients/configurations retain their shared units; current native
 * requests explicitly identify their platform and receive its own unit. */
export function configuredRewardedUnit(env:ApiEnv,placement:AdPlacement,platform?:string|null){
 const legacy=placement==='heart'?env.ADMOB_HEART_AD_UNIT:env.ADMOB_COIN_AD_UNIT;
 const unit=platform==='ios'?(placement==='heart'?env.ADMOB_IOS_HEART_AD_UNIT:env.ADMOB_IOS_COIN_AD_UNIT):platform==='android'?(placement==='heart'?env.ADMOB_ANDROID_HEART_AD_UNIT:env.ADMOB_ANDROID_COIN_AD_UNIT):undefined;
 return unit||legacy||undefined;
}
export function selectRewardedUnit(env:ApiEnv,placement:AdPlacement,platform?:string|null){
 ensure(env.ADMOB_ENABLED!=='false','ADS_UNAVAILABLE','지금은 광고를 준비할 수 없어요. 기본 플레이는 계속할 수 있습니다.',503);
 ensure(!platform||platform==='ios'||platform==='android','ADS_NATIVE_REQUIRED','광고는 iOS·Android 앱에서 이용할 수 있어요.',400);
 const unit=configuredRewardedUnit(env,placement,platform);
 ensure(unit,'ADS_UNAVAILABLE','지금은 광고를 준비할 수 없어요. 기본 플레이는 계속할 수 있습니다.',503);
 return unit;
}
