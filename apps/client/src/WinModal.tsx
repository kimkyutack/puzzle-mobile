import GoldGardenEntry from './GoldGarden';
import {isGoldGardenMilestone} from '../../../packages/content/src/gold-garden';
import {POWER_RAINBOW_WINS,type Player,type Run} from '@garden/contracts';
import {useEffect,useRef,useState,type ReactNode} from 'react';
import {tr,t} from './i18n';
import {Amount,Button,Icon,LinkAction,Modal,Poster} from './ui';
import {POWER_RAINBOW_ART} from './assets';
import {completionReward,needsFinish} from './completion';
import './power-rainbow-unlock.css';

const sparkles=[
 [18,24,18],[39,10,13],[73,18,23],[87,49,13],[74,76,18],[55,88,14],[25,81,22],[11,52,12],
] as const;
function PowerRainbowUnlock({reduced,onContinue}:{reduced:boolean;onContinue:()=>void}){
 const buttonSlot=useRef<HTMLDivElement>(null);
 useEffect(()=>{buttonSlot.current?.querySelector('button')?.focus({preventScroll:true});},[]);
 return <section className="modal-layer power-rainbow-reveal" data-reduced={reduced} role="dialog" aria-modal="true"
  aria-labelledby="power-rainbow-reveal-title" aria-describedby="power-rainbow-reveal-message"
  onKeyDown={event=>{if(event.key==='Escape'){event.preventDefault();onContinue();}}}>
  <div className="modal-scrim" aria-hidden="true"/>
  <div className="power-rainbow-reveal-content">
   <h2 id="power-rainbow-reveal-title">{t('powerRainbow.name')}</h2>
   <div className="power-rainbow-reveal-art" aria-hidden="true">
    <Icon id="fx_starburst" size={270} className="power-rainbow-reveal-glow"/>
    <Icon id={POWER_RAINBOW_ART} size={170} className="power-rainbow-reveal-ball"/>
    {sparkles.map(([x,y,size],i)=><span key={x} style={{left:x+'%',top:y+'%',animationDelay:i*90+'ms'}}><Icon id="sparkle" size={size}/></span>)}
   </div>
   <p id="power-rainbow-reveal-message">{t('powerRainbow.unlocked')}</p>
   <div ref={buttonSlot}><Button tone="green" onClick={onContinue}>{t('button.okay')}</Button></div>
  </div>
 </section>;
}

export default function WinModal({run,player,busy,preparingNext=false,showAd=true,onClose,onNext,onHome,onDouble,onPlayer,children}:{run:Run;player:Player;busy:boolean;preparingNext?:boolean;showAd?:boolean;onClose:()=>void;onNext:()=>void;onHome:()=>void;onDouble:()=>void;onPlayer?:(player:Player)=>void;children?:ReactNode}){
 const confirming=needsFinish(run),reward=completionReward(run);
 const [seenUnlock,setSeenUnlock]=useState<string>();
 const awaitingUnlock=confirming&&player.winStreak===POWER_RAINBOW_WINS-1;
 const goldMilestone=!!onPlayer&&isGoldGardenMilestone(run.level.id);
 if(run.reward?.powerRainbowUnlocked&&seenUnlock!==run.id){
  return <PowerRainbowUnlock reduced={player.settings.reducedMotion} onContinue={()=>setSeenUnlock(run.id)}/>;
 }
 const nextButton=<Button tone="green" icon="lumi" disabled={busy||preparingNext||awaitingUnlock||goldMilestone&&confirming} onClick={onNext}>{tr(preparingNext?'퍼즐 준비 중…':'다음 레벨')}</Button>;
 return <Modal theme="result" title={tr('정원이 활짝 피었어요!')} onClose={onClose}>
  <Poster id="poster_victory_v5" className="victory-poster" label={tr('꽃별을 들어 올리며 기뻐하는 루미')}/>
  <div className="result-payout" data-content-group data-frame="card_gold_v4"><Amount kind="coin" value={'+'+reward.coins}/><Amount kind="star" value={'+'+reward.stars}/></div>
  {confirming&&<p className="result-confirming" role="status">{tr('보상을 확인하고 있어요.')}</p>}
  {!!reward.items?.['world-bomb']&&<div className="world-bomb-earned"><Icon id="world-bomb" size={74}/><strong>+{reward.items['world-bomb']}</strong><span>{tr('10판 완성 선물!')}</span></div>}
  {!!run.reward?.flowerPetals&&<p className="flowerlight-clear-reward"><Icon id="stage_flower_bloom_v33" size={28}/>{tr('꽃빛축제 꽃잎 +{0}',{0:run.reward.flowerPetals})}</p>}
  <p className="result-level">{tr('레벨')}{' '}{run.level.id}{' '}{tr('완료')}</p>
  {onPlayer&&goldMilestone&&run.reward?<GoldGardenEntry key={run.id} player={player} milestone={run.level.id} onPlayer={onPlayer} fallback={nextButton}/>:nextButton}
  <LinkAction className="result-return" icon="home" onClick={onHome}>{tr('정원으로')}</LinkAction>
  {showAd&&player.level>5&&run.reward&&<LinkAction icon="coin" disabled={busy||confirming} onClick={onDouble}>{tr('광고 보고 보상 2배')}{' '}<Amount kind="coin" value={'+'+run.reward.coins}/></LinkAction>}
  {children}
 </Modal>;
}
