import {homeIcon} from './home-icon-art';
import homeGiftClean from '../../../packages/assets/home-progress-v107/runtime/gift-clean.webp';
import homeDockGiftPanel from '../../../packages/assets/home-dock-v75/runtime/gift-capsule.webp';
import homeGiftPanel from '../../../packages/assets/start-gift-v72/runtime/yellow-panel.webp';
import {useEffect,useState} from 'react';
import type {Player,Run} from '@garden/contracts';
import {START_GIFT_LEVEL,START_GIFT_STAGES,startGiftPowers,startGiftReached,startGiftStage} from '../../../packages/contracts/src/start-gift';
import {POWER_RAINBOW_ART} from './assets';
import {powerRainbowUnlocked} from '@garden/contracts';
import {Button,Icon,Modal,names} from './ui';
import {t,useI18n} from './i18n';
import {lumiIntroDuration} from './lumi-intro';
import './start-gift.css';

function GiftPowers({stage,powered=false,size=25}:{stage:number;powered?:boolean;size?:number}){
 return <span className="streak-gift-powers">{startGiftPowers(stage).map(item=><span key={item} role="img" aria-label={item==='rainbow'&&powered?t('powerRainbow.name'):names[item]}><Icon id={item==='rainbow'&&powered?POWER_RAINBOW_ART:item} size={size}/></span>)}</span>;
}
export function StartGiftSummary({player,onInfo,compact=false,result=false,dock=false,homeCard=false}:{player:Player;onInfo?:()=>void;compact?:boolean;result?:boolean;dock?:boolean;homeCard?:boolean}){
 useI18n();if(!startGiftReached(player))return null;const stage=startGiftStage(player),title=result?t('startGift.next'):t('startGift.name');
 if(dock)return <button type="button" className="streak-gift-summary is-compact home-gift-chip" data-stage={stage} onClick={onInfo} aria-label={title+' · '+stage+'/3 · '+t('startGift.info')}>
  <span className="raster-frame-face streak-gift-home-frame" aria-hidden="true" style={{borderImageSource:`url(${homeDockGiftPanel})`}}/>
  {homeCard?<img className="icon" src={homeGiftClean} width={25} height={25} alt="" draggable={false}/>:<Icon id={homeIcon('gift','chest')} size={25}/>}<strong className="home-gift-chip-title">{t(homeCard?'home.progress.gift':'home.short.gift')}</strong><b className="home-gift-chip-stage"><span>{stage}/{START_GIFT_STAGES}</span></b><GiftPowers stage={stage} powered={powerRainbowUnlocked(player)} size={16}/>
 </button>;
 const content=<>{compact&&!result&&<span className="raster-frame-face streak-gift-home-frame" aria-hidden="true" style={{borderImageSource:`url(${homeGiftPanel})`}}/>}<Icon id="chest" size={compact?34:41}/><span className="streak-gift-copy"><strong>{title}</strong><span className="streak-gift-steps" role="meter" aria-label={t('startGift.name')} aria-valuemin={0} aria-valuemax={START_GIFT_STAGES} aria-valuenow={stage}>{[1,2,3].map(n=><i key={n} data-filled={n<=stage}/>)}</span><small>{stage?t('startGift.ready'):t('startGift.first')}</small></span><span className="streak-gift-end"><b>{stage}/{START_GIFT_STAGES}</b>{stage>0&&<GiftPowers stage={stage} powered={powerRainbowUnlocked(player)} size={compact?19:23}/>}</span>{onInfo&&<span className="streak-gift-info" aria-hidden="true">i</span>}</>;
 const className='streak-gift-summary'+(compact?' is-compact':'')+(result?' is-result':'');
 return onInfo?<button type="button" className={className} data-stage={stage} onClick={onInfo} aria-label={title+' · '+stage+'/3 · '+t('startGift.info')}>{content}</button>:<div className={className} data-stage={stage}>{content}</div>;
}
export function StartGiftInfoModal({player,onClose}:{player:Player;onClose:()=>void}){
 useI18n();const current=startGiftStage(player);
 return <Modal title={t('startGift.name')} onClose={onClose} className="streak-gift-modal" footer={<Button tone="green" onClick={onClose}>{t('button.okay')}</Button>}>
  <div className="streak-gift-guide"><header><Icon id="lumi_happy" size={72}/><div><p>{t('startGift.help')}</p><small>{t('startGift.unlock',{level:START_GIFT_LEVEL})}</small></div></header>
   <ol>{[1,2,3].map(stage=><li key={stage} data-current={stage===current} data-earned={stage<=current}><span className="streak-gift-stage-number">{stage}</span><div><strong>{t('startGift.wins',{count:stage})}</strong><GiftPowers stage={stage} powered={powerRainbowUnlocked(player)} size={34}/></div>{stage===current&&<span className="streak-gift-check" aria-hidden="true">✓</span>}</li>)}</ol>
   <p className="streak-gift-guide-note">{t('startGift.keep')}<br/>{t('startGift.free')}</p>
   <p className="streak-gift-guide-reset">{t('startGift.resetRule')}</p>
  </div>
 </Modal>;
}
export function StartGiftArrival({run,reduced}:{run:Run;reduced:boolean}){
 useI18n();const [visible,setVisible]=useState(true);
 useEffect(()=>{const timer=setTimeout(()=>setVisible(false),reduced?1400:lumiIntroDuration((run.startGift?.placements.length??0)+run.preBoosters.length));return()=>clearTimeout(timer);},[run.id,reduced]);
 if(!visible||!run.startGift?.placements.length||run.state.turn!==0)return null;
 return <div className="streak-gift-arrival" role="status" data-reduced={reduced}><Icon id="chest" size={30}/><strong>{t('startGift.arrived')}</strong><span>{t('startGift.stage',{count:run.startGift.stage})}</span></div>;
}
