import {useEffect,useRef,useState} from 'react';
import {formatLocale,tr} from './i18n';
import {availablePassRewards,type PassRewardProgress} from './pass-rewards';
import {Button,Icon} from './ui';
import './garden-pass.css';

export interface PassTier {
 tier:number;
 points:number;
 free:{coins:number};
 premium:{
  coins:number;
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

const TIERS_PER_PAGE=4;

export default function PassRewards({pass,working,reducedMotion,onClaim}:Props){
 const {tiers}=pass;
 const [selection,setSelection]=useState<{tier:number|undefined;slide:boolean}>(()=>({
  tier:availablePassRewards(pass)[0]?.tier??tiers.filter(tier=>pass.points>=tier.points).at(-1)?.tier??tiers[0]?.tier,
  slide:false,
 }));
 const index=Math.max(0,tiers.findIndex(tier=>tier.tier===selection.tier));
 const tier=tiers[index];
 const nextTier=tiers[index+1]?.tier;
 const previousTiers=useRef(tiers);
 useEffect(()=>{
  const before=previousTiers.current;
  previousTiers.current=tiers;
  if(before===tiers||!tier||nextTier===undefined)return;
  const prior=before.find(item=>item.tier===tier.tier);
  if(prior&&(tier.freeClaimed&&!prior.freeClaimed||tier.premiumClaimed&&!prior.premiumClaimed)){
   setSelection({tier:nextTier,slide:true});
  }
 },[tiers,tier,nextTier]);
 if(!tier)return null;

 const start=Math.floor(index/TIERS_PER_PAGE)*TIERS_PER_PAGE;
 const end=start+TIERS_PER_PAGE;
 const visible=tiers.slice(start,end);
 const previous=tiers[start-TIERS_PER_PAGE];
 const next=tiers[end];
 const selectTier=(tier:number|undefined)=>setSelection({tier,slide:false});

 return <>
  <div className="pass-tier-picker" role="group" aria-label={tr('단계 선택')}>
   <span>{tr('단계 선택')}</span>
   <div className="pass-tier-controls">
    <button type="button" className="pass-tier-arrow" aria-label={tr('이전 단계')} disabled={!previous} onClick={()=>selectTier(previous?.tier)}><span aria-hidden="true">‹</span></button>
    <div className="pass-tier-options">
     {visible.map(option=><button type="button" key={option.tier} aria-label={tr('{0}단계 보상',{0:option.tier})} aria-pressed={option===tier} data-frame={option===tier?'button_gold':'card_lavender_v9'} data-frame-scale="0.09" onClick={()=>selectTier(option.tier)}>{option.tier}</button>)}
    </div>
    <button type="button" className="pass-tier-arrow" aria-label={tr('다음 단계')} disabled={!next} onClick={()=>selectTier(next?.tier)}><span aria-hidden="true">›</span></button>
   </div>
  </div>
  <h3 className="pass-selected-title" aria-live="polite">{tr('{0}단계 보상',{0:tier.tier})}</h3>
  <div key={tier.tier} className="pass-track-comparison" data-slide={selection.slide&&!reducedMotion}>
   {(['free','premium'] as const).map(track=>{
    const premium=track==='premium';
    const claimed=premium?tier.premiumClaimed:tier.freeClaimed;
    const owned=!premium||pass.premium;
    const reached=pass.points>=tier.points;
    const extra=premium?tier.premium:null;
    return <section key={track} className="pass-track" data-track={track} aria-label={tr(premium?'프리미엄 선물':'무료 선물')}>
     <h4><Icon id={premium?'rainbow':'chest'} size={24}/>{tr(premium?'프리미엄 선물':'무료 선물')}</h4>
     <div className="pass-track-items">
      <div className="pass-track-coins"><Icon id="coin" size={31}/><span><strong>{tier[track].coins.toLocaleString(formatLocale())}</strong> {tr('코인')}</span></div>
      {!!extra?.hammer&&<div className="pass-track-extra"><Icon id="hammer" size={27}/><span>{tr('망치 {0}개',{0:extra.hammer})}</span></div>}
      {extra?.decoration&&<div className="pass-track-extra"><Icon id={extra.decoration.asset} size={27}/><span>{tr('프로필 문장')}</span></div>}
      {extra?.guildGift&&<div className="pass-track-extra"><Icon id="guild" size={27}/><span>{tr('길드 선물권')} <small>· {tr('망치 {0}개',{0:extra.guildGift.quantityPerMember})}</small></span></div>}
     </div>
     {owned&&reached&&!claimed
      ?<Button className="pass-tier-claim" disabled={working} tone={premium?'gold':'green'} onClick={()=>onClaim(tier.tier,track)}>{tr('받기')}</Button>
      :<p className="pass-track-status" data-claimed={claimed}>{claimed&&<Icon id="star" size={19}/>}<span>{claimed?tr('수령 완료'):owned?tr('{0}점에 열림',{0:tier.points}):tr('패스 필요')}</span></p>}
    </section>;
   })}
  </div>
 </>;
}
