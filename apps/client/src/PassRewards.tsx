import {EventIcon} from './event-icons';
import {useEffect,useRef,useState,type CSSProperties} from 'react';
import type {PassPrize} from '../../../packages/contracts/src/pass-rewards';
import {PassPrizeImage,passPrizeName} from './PassPrize';
import {formatLocale,tr} from './i18n';
import {availablePassRewards,confirmedPassSelection,type PassRewardProgress} from './pass-rewards';
import {Icon} from './ui';
import './garden-pass.css';
import {eventDesignArt} from './event-design-art';
import {refinedEventArt} from './event-refinement-art';
import './event-refinement-v74.css';
import './pass-modal-v122.css';

export interface PassTier {
 tier:number;
 points:number;
 free:{coins:number;reward?:PassPrize};
 premium:{
  coins:number;
  reward?:PassPrize;
  hammer:number;
  decoration:{id:string;name:string;asset:string}|null;
  guildGift:{item:'hammer';quantityPerMember:number}|null;
 };
 freeClaimed:boolean;
 premiumClaimed:boolean;
}

interface Props {
 pass:Omit<PassRewardProgress,'tiers'> & {tiers:readonly PassTier[]};
 working:boolean;
 reducedMotion:boolean;
 onClaim:(tier:number,track:'free'|'premium')=>void;
}

const compactPage=()=>typeof window==='undefined'?5:window.matchMedia('(max-height:620px)').matches?2:window.matchMedia('(max-height:740px)').matches?3:5;

export function PassProgress({pass}:{pass:{points:number;tiers:ReadonlyArray<{points:number}>}}){
 const target=pass.tiers.find(tier=>tier.points>pass.points)?.points??pass.tiers.at(-1)?.points??1;
 return <><div className="pass-scene-emblem" aria-hidden="true"><EventIcon kind="pass" size={70}/></div><div className="pass-progress-heading" role="progressbar" aria-label={tr('정원 패스')} aria-valuemin={0} aria-valuemax={target} aria-valuenow={Math.min(pass.points,target)}>
  <Icon id="star" size={32}/><div className="pass-progress-fill" style={{width:Math.min(100,pass.points/target*100)+'%'}}><img src={eventDesignArt.meterGold} alt=""/></div><strong>{pass.points} / {target}</strong>
 </div></>;
}

export default function PassRewards({pass,working,reducedMotion,onClaim}:Props){
 const {tiers}=pass;
 const [pageSize,setPageSize]=useState(compactPage);
 useEffect(()=>{const update=()=>setPageSize(compactPage());window.addEventListener('resize',update);return()=>window.removeEventListener('resize',update)},[]);
 const [selection,setSelection]=useState<{tier:number|undefined;slide:boolean}>(()=>({
  tier:availablePassRewards(pass)[0]?.tier??tiers.filter(tier=>pass.points>=tier.points).at(-1)?.tier??tiers[0]?.tier,
  slide:false,
 }));
 const index=Math.max(0,tiers.findIndex(tier=>tier.tier===selection.tier));
 const tier=tiers[index];
 const previousTiers=useRef(tiers);
 useEffect(()=>{
  const before=previousTiers.current;
  previousTiers.current=tiers;
  if(before===tiers)return;
  const confirmed=confirmedPassSelection(before,tiers);
  if(confirmed!==undefined)setSelection({tier:confirmed,slide:true});
 },[tiers]);
 if(!tier)return null;

 const start=Math.floor(index/pageSize)*pageSize;
 const end=start+pageSize;
 const visible=tiers.slice(start,end);
 const selectTier=(tier:number|undefined)=>setSelection({tier,slide:false});

 return <>
  <div className="pass-tier-picker" role="group" aria-label={tr('단계 선택')}>
   {Array.from({length:Math.ceil(tiers.length/pageSize)},(_,page)=>{const first=page*pageSize,last=Math.min(tiers.length,first+pageSize);return <button key={first} type="button" aria-pressed={start===first} onClick={()=>selectTier(tiers[first]?.tier)}>{tiers[first]?.tier}–{tiers[last-1]?.tier}</button>})}
  </div>
  <div className="pass-reward-book" style={{'--pass-visible-tiers':visible.length} as CSSProperties} data-slide={selection.slide&&!reducedMotion}>
   <div className="pass-book-head"><strong>{tr('무료')}</strong><strong>{tr('프리미엄')}</strong></div>
   {visible.map(option=><div className="pass-book-row" key={option.tier} data-current={option.tier===tier.tier}>
    <button type="button" className="pass-book-number" aria-label={tr('{0}단계 보상',{0:option.tier})} aria-pressed={option.tier===tier.tier} onClick={()=>selectTier(option.tier)}>{option.tier}</button>
    {(['free','premium'] as const).map(track=>{
     const premium=track==='premium',claimed=premium?option.premiumClaimed:option.freeClaimed,owned=!premium||pass.premium,reached=pass.points>=option.points,claimable=owned&&reached&&!claimed,prize:PassPrize=option[track].reward??{kind:'coins',quantity:option[track].coins};
     return <button key={track} type="button" className="pass-book-cell" data-track={track} data-claimed={claimed} data-claimable={claimable} disabled={working||!claimable} aria-label={tr('{0}단계 보상',{0:option.tier})+' · '+tr(premium?'프리미엄 선물':'무료 선물')+' · '+passPrizeName(prize)+' ×'+prize.quantity+' · '+tr(claimed?'수령 완료':!owned?'패스 필요':claimable?'받기':'{0}점에 열림',{0:option.points})} onClick={()=>onClaim(option.tier,track)}>
      <span className="pass-single-prize" data-prize-kind={prize.kind}><PassPrizeImage prize={prize}/><strong>{prize.kind==='coins'?'':'×'}{prize.quantity.toLocaleString(formatLocale())}</strong></span>
      {claimed&&<img className="pass-book-check" src={eventDesignArt.attendanceCheck} alt=""/>}
      {!owned&&<img className="pass-book-lock" src={refinedEventArt.lock} alt=""/>}
      <small>{tr(claimed?'수령 완료':!owned?'패스 필요':claimable?'받기':'{0}점에 열림',{0:option.points})}</small>
     </button>;
    })}
   </div>)}
  </div>
 </>;
}
