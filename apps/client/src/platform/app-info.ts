import {Capacitor} from '@capacitor/core';
import {App} from '@capacitor/app';
export interface ClientRelease {platform:'ios'|'android'|'web';version:string;build?:string}
let info:Promise<ClientRelease>|undefined;
export function clientRelease():Promise<ClientRelease>{if(!info){const platform=Capacitor.getPlatform();info=Capacitor.isNativePlatform()?App.getInfo().then(value=>({platform:platform==='ios'?'ios' as const:'android' as const,version:value.version,build:value.build}),()=>({platform:platform==='ios'?'ios' as const:'android' as const,version:'0.0.0'})):Promise.resolve({platform:'web',version:import.meta.env.VITE_APP_VERSION??'0.0.0'});}return info;}
