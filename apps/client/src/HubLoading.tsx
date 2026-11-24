import {useEffect,useState} from 'react';
import {tr} from './i18n';
import {Button,Icon} from './ui';
import './hub-loading.css';

type Kind='events'|'friends'|'guild'|'shop'|'pass'|'ranking';
const icons:Record<Kind,string>={events:'chest',friends:'lumi_happy',guild:'guild',shop:'bundle_tools_v7',pass:'star',ranking:'ranking_trophy_v51'};
const messages:Record<Kind,string>={events:'정원 소식을 불러오는 중…',friends:'친구를 불러오는 중…',guild:'길드 정원을 불러오는 중…',shop:'상품을 진열하고 있어요.',pass:'정원 소식을 불러오는 중…',ranking:'순위를 불러오는 중…'};
export default function HubLoading({kind,error='',retrying=false,onRetry,reducedMotion=false}:{kind:Kind;error?:string;retrying?:boolean;onRetry?:()=>void;reducedMotion?:boolean}){
 const [slow,setSlow]=useState(false);
 useEffect(()=>{setSlow(false);const timer=setTimeout(()=>setSlow(true),6000);return()=>clearTimeout(timer);},[retrying]);
 return <section className={'hub-content-loading hub-content-loading-'+kind} aria-busy={retrying||!error} data-reduced-motion={reducedMotion||undefined}>
  <div className="hub-loading-art" aria-hidden="true"><Icon id={icons[kind]} size={132}/><Icon id="sparkle" size={30} className="hub-loading-spark hub-loading-spark-a"/><Icon id="sparkle" size={22} className="hub-loading-spark hub-loading-spark-b"/></div>
  <p role={error&&!retrying?'alert':'status'}>{retrying?tr(messages[kind]):error||tr(messages[kind])}</p>
  {!error&&slow&&<small>{tr('연결이 조금 늦어지고 있어요.')}</small>}
  {(error||slow)&&onRetry&&<Button className="hub-loading-retry" tone="blue" disabled={retrying&&!slow} onClick={onRetry}>{tr('다시 불러오기')}</Button>}
 </section>;
}
