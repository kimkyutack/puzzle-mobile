import { Capacitor, SystemBars, SystemBarsStyle, SystemBarType } from '@capacitor/core';
import { App } from '@capacitor/app';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
export async function pulse(enabled:boolean){if(enabled&&Capacitor.isNativePlatform()) await Haptics.impact({style:ImpactStyle.Light});}
export async function onResume(callback:()=>void):Promise<()=>void>{
  if(Capacitor.isNativePlatform()){
    const handle=await App.addListener('appStateChange',({isActive})=>{window.dispatchEvent(new Event(isActive?'garden:audio-resume':'garden:audio-pause'));if(isActive)callback();});
    return ()=>{void handle.remove();};
  }
  const listener=()=>{window.dispatchEvent(new Event(document.hidden?'garden:audio-pause':'garden:audio-resume'));if(!document.hidden)callback();};
  document.addEventListener('visibilitychange',listener);return ()=>document.removeEventListener('visibilitychange',listener);
}

let chromeRevision=0;
let chromeUpdate:Promise<void>=Promise.resolve();
/** Match native chrome to the currently visible artwork; never hide system controls. */
export function setSceneChrome(darkSurface:boolean):Promise<void>{
  if(!Capacitor.isNativePlatform())return Promise.resolve();
  const revision=++chromeRevision;
  const platform=Capacitor.getPlatform();
  // Android uses native padding (viewport-fit=contain), so its reserved bars
  // always show the dark native theme background rather than scene artwork.
  const nativeAndroidInsets=platform==='android';
  chromeUpdate=chromeUpdate.catch(()=>{}).then(async()=>{
    if(revision!==chromeRevision)return;
    // Capacitor Dark means light foreground icons on a dark surface.
    await SystemBars.setStyle({bar:SystemBarType.StatusBar,style:darkSurface||nativeAndroidInsets?SystemBarsStyle.Dark:SystemBarsStyle.Light});
    // iOS chooses its home-indicator contrast automatically; its style API controls status only.
    if(platform==='android')await SystemBars.setStyle({bar:SystemBarType.NavigationBar,style:SystemBarsStyle.Dark});
  });
  return chromeUpdate;
}
