import type {AdRewardQuota} from '@garden/contracts';
import {tr} from './i18n';
import {LinkAction} from './ui';
import './heart-ad-button.css';

export default function HeartAdButton({quota,error=false,disabled=false,onClick}:{quota:AdRewardQuota|null;error?:boolean;disabled?:boolean;onClick:()=>void}){
 return <LinkAction className="heart-ad-action" icon="heart" disabled={disabled||quota?.remaining===0} onClick={onClick}>
  <span className="heart-ad-title">{tr('광고 보고 하트 +1')}</span>
  <small className="heart-ad-remaining" role="status" aria-live="polite">{quota?tr('오늘 {0}/{1}회 남음',{0:quota.remaining,1:quota.limit}):tr(error?'횟수 확인 실패':'횟수 확인 중…')}</small>
 </LinkAction>;
}
