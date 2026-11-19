import {useState,type ReactNode} from 'react';
import {APP_LOCALES} from '@garden/contracts';
import {setLocale,useI18n,type Locale} from './i18n';
import {languageOptions,readLanguagePreference,saveLanguagePreference} from './locale-preference';
import BrandLogo from './BrandLogo';
import StartupPoster from './StartupPoster';
import './language.css';

/** No App effects, guest creation or heart-consuming run can mount before selection. */
export default function LanguageGate({children}:{children:ReactNode}){
 const [accepted,setAccepted]=useState(()=>!!readLanguagePreference());
 const {t}=useI18n();
 if(accepted)return children;
 const choose=(language:Locale)=>{saveLanguagePreference(language);setLocale(language);setAccepted(true)};
 return <main className="language-gate" aria-labelledby="language-title">
  <StartupPoster className="language-backdrop"/>
  <div className="language-choice">
   <h1 className="brand-heading"><BrandLogo/></h1>
   <section aria-labelledby="language-title"><h2 id="language-title">{t('language.choose')}</h2>
    {APP_LOCALES.map(language=><button key={language} lang={language} onClick={()=>choose(language)}>{languageOptions[language]}</button>)}
    <p>{t('language.changeLater')}</p>
   </section>
  </div>
 </main>;
}
