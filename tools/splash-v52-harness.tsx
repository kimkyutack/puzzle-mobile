// Isolated startup UI only. No account, economy, API or game state is mounted.
import React from 'react';
import {createRoot} from 'react-dom/client';
import LoadingScreen from '../apps/client/src/LoadingScreen';
import LanguageGate from '../apps/client/src/LanguageGate';
import {LANGUAGE_KEY} from '../apps/client/src/locale-preference';
import {setLocale} from '../apps/client/src/i18n';
import '../apps/client/src/style.css';
import '../apps/client/src/fonts.css';
import '../apps/client/src/ui-v9.css';
import '../apps/client/src/loading-story.css';
const params=new URLSearchParams(location.search),mode=params.get('screen')??'loading';
setLocale(params.get('lang')==='en'?'en':'ko');
const done=(action:string)=>{document.documentElement.dataset.startupAction=action;};
if(mode!=='bootstrap'){
 if(mode==='language')localStorage.removeItem(LANGUAGE_KEY);
 await document.fonts.load('18px Jua');
 createRoot(document.getElementById('root')!).render(mode==='language'?<LanguageGate><p>언어 선택 완료</p></LanguageGate>:<LoadingScreen progress={Number(params.get('progress')??.57)} error={params.has('error')?'인터넷 연결을 확인해 주세요.':''} recovering={params.has('recover')} busy={params.has('busy')} onRecover={()=>done('recover')} onRetry={()=>done('retry')}/>);
}
