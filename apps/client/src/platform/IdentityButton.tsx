import {tr} from "../i18n";
import {Capacitor} from '@capacitor/core';
import type {SignInProvider} from './auth';
/** Official provider artwork is deliberately separate from the game's generated button frames. */
export function IdentityButton({provider,disabled,onClick}:{provider:SignInProvider;disabled:boolean;onClick:()=>void}){
 const source=provider==='apple'?'apple-signin.png':`google-signin-${Capacitor.getPlatform()==='ios'?'ios':'web'}.png`;
 return <button type="button" disabled={disabled} onClick={onClick} aria-label={provider==='apple'?tr("Apple로 계속하기"):tr("Google로 로그인")} style={{display:'block',width:210,minHeight:48,margin:'8px auto',padding:0,background:'transparent'}}><img src={'/provider-assets/'+source} alt={provider==='apple'?tr("Apple로 계속하기"):'Sign in with Google'} style={{display:'block',width:'100%',height:'auto'}}/></button>;
}
