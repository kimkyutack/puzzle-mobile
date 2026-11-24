import {startGiftStage} from '../../../packages/contracts/src/start-gift';
import {CONTINUE_COSTS,type Player,type Run} from '@garden/contracts';
import {serverNow} from './api';
import {tr,useI18n} from './i18n';
import {Amount,Button,Icon,LinkAction,Modal} from './ui';
import './run-menus.css';

export function RunPauseMenu({onClose,onSettings,onSave,onEnd,tutorial=false}:{tutorial?:boolean;onClose:()=>void;onSettings:()=>void;onSave:()=>void;onEnd:()=>void}){
 return <Modal title={tr('잠깐 쉬어가기')} onClose={onClose}>
  <div className="run-menu-layout">
   <Button icon="lumi_happy" onClick={onClose}>{tr('계속 플레이')}</Button>
   <div className="run-menu-options" data-frame="card_sage_v6" data-frame-scale="0.13">
    <LinkAction icon="settings" onClick={onSettings}>{tr('음향과 플레이 설정')}</LinkAction>
    {!tutorial&&<LinkAction icon="home" onClick={onSave}>{tr('진행 보관하고 정원으로')}</LinkAction>}
   </div>
   {!tutorial&&<LinkAction className="run-menu-secondary" icon="close" onClick={onEnd}>{tr('이번 판 종료')}</LinkAction>}
  </div>
 </Modal>;
}

export function RunContinueMenu({run,player,coins,continuing,onContinue,onSave,onEnd}:{run:Run;player?:Player;coins:number;continuing:boolean;onContinue:()=>void;onSave:()=>void;onEnd:()=>void}){
 const {t}=useI18n();
 const cost=CONTINUE_COSTS[run.continues];
 return <Modal theme="result" title={tr('계속할까요?')} onClose={()=>{if(!continuing)onSave();}}>
  <div className="run-menu-layout run-continue-menu">
   <div className="run-continue-balance" data-frame="card_gold_v4" data-frame-scale="0.1"><Amount kind="coin" value={coins}/></div>
   <div className="run-continue-reward" data-frame="card_peach_v9" data-frame-scale="0.14">
    <div><Icon id="move-hourglass" size={67}/><strong>+5</strong></div>
    <p>{tr('이동 5회를 더해서 정원을 완성해요.')}</p>
   </div>
   <Button disabled={continuing||cost===undefined} onClick={onContinue}>{cost===undefined?tr('추가 이동을 모두 사용했어요'):<><span>{continuing?t('status.continuing'):tr('계속 플레이')}</span><Amount kind="coin" value={cost}/></>}</Button>
   {player&&startGiftStage(player)>0&&<p className="run-gift-warning"><Icon id="chest" size={28}/>{t('startGift.continue')}</p>}
   <div className="run-menu-links">
    <LinkAction className="run-menu-secondary" icon="close" disabled={continuing} onClick={onEnd}>{tr('이번 판 종료')}</LinkAction>
    <LinkAction className="run-menu-secondary" icon="home" disabled={continuing} onClick={onSave}>{tr('진행 보관하고 정원으로')}</LinkAction>
   </div>
  </div>
 </Modal>;
}

export function EndRunMenu({run,player,onClose,onRetry,onExit}:{run:Run;player:Player;onClose:()=>void;onRetry:()=>void;onExit:()=>void}){
 const {t}=useI18n();
 const now=serverNow();
 const spendsHeart=run.heartCharge==='failure'&&!run.heartSpent&&player.hearts>0&&player.unlimitedUntil<=now&&run.expiresAt>now&&run.state.status!=='error';
 return <Modal theme="result" title={t('runExit.title')} onClose={onClose}>
  <div className="run-menu-layout">
   <div className="run-exit-reward" data-frame="card_peach_v9" data-frame-scale="0.14">
    <Icon id="heart" size={48}/>
    <div><p>{t(spendsHeart?'runExit.heartUsed':'runExit.heartKept')}</p>{!!player.winStreak&&<p>{t('powerRainbow.forfeit')}</p>}{startGiftStage(player)>0&&<p>{t('startGift.reset')}</p>}</div>
   </div>
   <div className="run-exit-actions">
    <Button icon="shuffle" tone="green" onClick={onRetry}>{t('runExit.retry')}</Button>
    <Button icon="home" tone="blue" onClick={onExit}>{t('runExit.exit')}</Button>
   </div>
  </div>
 </Modal>;
}
