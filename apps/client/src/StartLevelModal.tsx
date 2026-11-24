import {startBoosterWindow} from '../../../packages/contracts/src/start-booster-rush';
import {useOperations} from './OperationsUI';
import StartBoosterRush from './StartBoosterRush';
import {serverNow} from './api';
import GardenStageIntro from './GardenStageIntro';
import {formatLocale,t,tr} from './i18n';
import {useEffect,useId,useState} from 'react';
import type {LevelDefinition,Player,PreBooster} from '@garden/contracts';
import {freeStartTrialItem,powerRainbowReached,powerRainbowUnlocked,POWER_RAINBOW_WINS,supportsPowerRainbow} from '@garden/contracts';
import {getLevel} from '@garden/content';
import {goalArt,POWER_RAINBOW_ART} from './assets';
import {Amount,Button,Card,Icon,Modal,names} from './ui';
import './start-level-modal.css';
import {StartGiftInfoModal,StartGiftSummary} from './StartGift';
interface Props {player:Player;levelId?:number;engineVersion?:string;reloadKey?:number;loadLevel?:(id:number)=>Promise<LevelDefinition>;peekLevel?:(id:number)=>LevelDefinition|undefined;error?:string;selected:PreBooster[];busy:boolean;unlimited:boolean;onToggle:(item:PreBooster)=>void;onPlay:()=>void;onClose:()=>void}
export default function StartLevelModal({player,levelId=player.level,engineVersion,loadLevel,peekLevel,reloadKey,error,selected,busy,unlimited,onToggle,onPlay,onClose}:Props){
 const {data}=useOperations(),schedule=data?.settings.startBoosterRush,rush=startBoosterWindow(schedule,serverNow());
 const rainbowStatusId=useId();
 const [giftInfo,setGiftInfo]=useState(false);
 const [remote,setRemote]=useState<LevelDefinition|null>(()=>peekLevel?.(levelId)??null),[previewError,setPreviewError]=useState(''),[loading,setLoading]=useState(!!loadLevel&&!peekLevel?.(levelId)),[attempt,setAttempt]=useState(0);
 useEffect(()=>{
  if(!loadLevel)return;let active=true;const cached=peekLevel?.(levelId);setLoading(!cached);setRemote(cached??null);setPreviewError('');
  void loadLevel(levelId).then(level=>{if(active)setRemote(level);},reason=>{if(active)setPreviewError(reason instanceof Error?reason.message:tr('퍼즐 정보를 확인하지 못했어요. 다시 불러와 주세요.'));}).finally(()=>{if(active)setLoading(false);});
  return()=>{active=false;};
 },[levelId,engineVersion,loadLevel,peekLevel,reloadKey,attempt]);
 let level=remote?.id===levelId?remote:null;
 // Standalone art fixtures may use a bundled definition; the installed app always supplies loadLevel.
 if(!loadLevel)try{level=getLevel(levelId,engineVersion);}catch{}
 const modalProps={title:t('hud.level',{level:levelId}),onClose,theme:'garden' as const,className:'start-level-modal',rasterFrame:false};
 if(!level&&loading)return <Modal {...modalProps}><Card title={tr('다음 정원을 준비하고 있어요')}><Icon id="lumi" size={120}/><p role="status">{tr('퍼즐 준비 중…')}</p></Card></Modal>;
 if(!level)return <Modal {...modalProps}><Card title={tr('다음 정원을 준비하고 있어요')}><Icon id="lumi" size={120}/><p role="status">{previewError||tr('새 퍼즐을 준비 중이에요. 잠시 후 다시 확인해 주세요.')}</p></Card><Button onClick={()=>setAttempt(n=>n+1)}>{tr('다시 불러오기')}</Button><Button secondary onClick={onClose}>{tr('정원으로')}</Button></Modal>;
 const rainbowSupported=supportsPowerRainbow(level.engineVersion)&&powerRainbowReached(player);
 const powered=rainbowSupported&&powerRainbowUnlocked(player);
 const streak=Math.max(0,Math.min(player.winStreak??0,POWER_RAINBOW_WINS));
 const rainbowStatus=powered?t('powerRainbow.ready'):t('powerRainbow.streak',{count:streak,target:POWER_RAINBOW_WINS});
 const guide=level.startBoosterGuide,trial=freeStartTrialItem(level,player);
 const guideHint=trial?t('start.trialHint'):guide?t(guide.item==='wind-row'?'start.rocketHint':'start.bombHint'):null;
 if(giftInfo)return <StartGiftInfoModal player={player} onClose={()=>setGiftInfo(false)}/>;
 const playAction=<div className={'start-play-action'+(busy?' is-preparing':'')} aria-busy={busy||loading} aria-live="polite">
  {error&&!busy&&<p className="start-error" role="alert">{error}</p>}
  <Button tone="green" className="start-level-play" rasterFrame={false} icon={busy?'lumi':undefined} disabled={busy||loading} onClick={onPlay}>{busy?tr('퍼즐 준비 중…'):t('button.play')}</Button>
  <div className="heart-cost"><Amount kind="heart" value={unlimited?'∞':1}/><span aria-hidden="true">·</span><span>{unlimited?tr('무제한 이용 중'):tr('실패할 때만 사용')}</span></div>
 </div>;
 return <Modal {...modalProps} footer={playAction}>
  <div className="start-level-layout">
   <section className="start-level-objectives" data-special={!!level.gardenStage} data-frame={level.gardenStage?undefined:'card_ice_v9'} data-frame-scale="0.17" aria-labelledby="start-goal-title">
    <div className="start-level-goals" data-many-goals={level.goals.length>2||undefined}>
     <h3 id="start-goal-title">{t('hud.goals')}</h3>
     <ul>{level.goals.map(goal=><li key={goal.kind}>
      <Icon id={goalArt(goal.kind,level)} size={38}/>
      <span className="sr-only">{goal.kind==='device'?tr('장치 작동'):names[goal.kind==='pipe'&&level.obstacles.some(o=>o.endOnly)?'magnet-rail':goal.kind]}</span>
      <strong>×{goal.count.toLocaleString(formatLocale())}</strong>
     </li>)}</ul>
    </div>
    {level.gardenStage?<GardenStageIntro stage={level.gardenStage}/>:<>
     {level.campaign&&['introduction','practice','celebration'].includes(level.campaign.beat)&&<p className="start-level-hint" data-campaign-beat={level.campaign.beat}>{tr(level.campaign.beat==='introduction'?'새로운 규칙을 만나봐요':level.campaign.beat==='practice'?'새 규칙을 가볍게 연습해요':'시원하게 터뜨리는 연쇄 축제')}</p>}
     {level.strategy&&<div className="start-level-hint"><strong>{tr(level.strategy.name)}</strong><p>{tr(level.strategy.hint)}</p></div>}
    </>}
   </section>
   <section className="start-level-tools" aria-labelledby="start-tool-title">
    <StartGiftSummary player={player} onInfo={()=>setGiftInfo(true)}/>
    {rainbowSupported&&<div className="start-rainbow-chip" data-powered={powered}>
     <Icon id={POWER_RAINBOW_ART} size={30}/>
     <div className="start-rainbow-chip-progress">
      <strong>{t('powerRainbow.name')}</strong>
      <div className="start-rainbow-chip-meter" role="progressbar" aria-label={t('powerRainbow.name')}
       aria-valuemin={0} aria-valuemax={POWER_RAINBOW_WINS} aria-valuenow={streak} aria-valuetext={rainbowStatus}>
       {Array.from({length:POWER_RAINBOW_WINS},(_,index)=><span key={index} data-filled={index<streak} aria-hidden="true"/>)}
      </div>
     </div>
     <span className="start-rainbow-chip-count" aria-hidden="true">
      <span className="start-rainbow-chip-number">{streak}/{POWER_RAINBOW_WINS}</span>
      {powered&&<span className="start-rainbow-chip-ready">{rainbowStatus}</span>}
     </span>
     <span id={rainbowStatusId} className="sr-only">{rainbowStatus}</span>
    </div>}
    <div className="start-level-tools-heading">
     <h3 id="start-tool-title">{tr('시작 도구')}</h3>
     {schedule?.enabled&&<details className="start-level-rush">
      <summary>{t('start.rushSchedule')} <span aria-hidden="true">ⓘ</span></summary>
      <div className="start-level-rush-panel"><StartBoosterRush showSchedule/></div>
     </details>}
    </div>
    {guide&&<p className="start-level-tool-hint"><Icon id={guide.item} size={22}/><span>{guideHint}</span></p>}
    <div className="start-level-tool-row">{(['wind-row','bomb','rainbow'] as const).map(item=>{
     const count=(player.inventory[item]?.normal||0)+(player.inventory[item]?.bound||0);
     const active=selected.includes(item),freeTrial=item===trial&&!rush.active;
     const availability=rush.active?tr(' · 무제한'):freeTrial?' · '+t('start.trialStock'):tr(' · 보유 ')+count;
     const name=item==='rainbow'&&powered?t('powerRainbow.name'):names[item];
     return <button type="button" key={item} aria-pressed={active} aria-label={name+availability} aria-describedby={item==='rainbow'&&rainbowSupported?rainbowStatusId:undefined} disabled={busy} onClick={()=>onToggle(item)}>
      <span className="start-level-tool-art"><Icon id="booster_socket" size={64}/><Icon id={item==='rainbow'&&powered?POWER_RAINBOW_ART:item} size={48}/></span>
      <span className="start-level-tool-stock" data-frame={active?'button_coral_v6':'button_blue_v9'} data-frame-scale="0.1">{active?tr('선택'):rush.active?'∞':freeTrial?t('start.trialStock'):count}</span>
      <span className="start-level-tool-name">{names[item]}</span>
     </button>;
    })}</div>
   </section>
  </div>
 </Modal>;
}
