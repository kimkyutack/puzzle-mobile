import type {FlowerFestivalProgress} from '@garden/contracts';
import {FLOWERLIGHT_STAGES,FLOWERLIGHT_GARDEN_GIFTS} from '../../../packages/content/src/flowerlight';
import {Button,Icon} from './ui';
import {ActivityRewards} from './Activity';
import {eventDesignArt} from './event-design-art';
import {WORLD_ART} from './garden-world/assets';
import {tr,t} from './i18n';
import './flowerlight-scene.css';

interface FlowerlightEventSceneProps{
 event?:FlowerFestivalProgress;stage:number;ready:boolean;busy:boolean;expired:boolean;available:boolean;
 time:string;error:string;receipt:{installed:number;stored:number}|null;
 dialogue?:{speaker:string;text:string;last:boolean};
 onNext:()=>void;onJoin:()=>void;onRestore:()=>void;onPlay:()=>void;onHome:()=>void;
}

/** The selected three-card composition, populated only with authoritative festival rewards. */
export default function FlowerlightEventScene(props:FlowerlightEventSceneProps){
 const {event,stage,ready,busy,expired,available,time,error,receipt,dialogue,onNext,onJoin,onRestore,onPlay,onHome}=props;
 const total=FLOWERLIGHT_STAGES.at(-1)!.target,complete=stage>=FLOWERLIGHT_STAGES.length;
 const first=Math.min(stage,FLOWERLIGHT_STAGES.length-3),cards=FLOWERLIGHT_STAGES.slice(first,first+3);
 const action=dialogue?onNext:!event?onJoin:complete||expired&&!ready?onHome:ready?onRestore:onPlay;
 const label=dialogue?dialogue.last?'꾸미러 가기':'다음 이야기':!event?busy?'초대장을 여는 중…':available?'무료로 축제 시작':'이벤트 준비 중':complete||expired&&!ready?'내 정원으로':ready?busy?'정원에 설치 중…':'정원에 설치하기':'퍼즐 플레이';
 return <section className="flowerlight-scene-v64" aria-label={tr('루미의 꽃빛축제')} aria-busy={busy}>
  <div className="flowerlight-scene-content">
  <img className="flowerlight-scene-art" src={eventDesignArt.flowerlightScene} alt="" draggable={false}/>
  <div className="flowerlight-scene-progress" role="progressbar" aria-label={tr('모은 꽃잎')} aria-valuemin={0} aria-valuemax={total} aria-valuenow={Math.min(total,event?.petals??0)}>
   <strong><span>{tr('꽃잎 {0}/{1}',{0:event?.petals??0,1:total})}</span></strong>
  </div>
  <p className="flowerlight-scene-time" data-active={!!event&&!complete&&!expired} role="timer" aria-live="off" aria-label={tr('남은 시간 {0}',{0:time})} style={{backgroundImage:`url("${eventDesignArt.seasonClock}")`}}><span>{time}</span></p>
  {receipt&&<p className="flowerlight-scene-receipt" role="status">{receipt.installed>0&&tr('내 정원에 {0}개를 설치했어요.',{0:receipt.installed})}{receipt.stored>0&&' '+tr('보관함에 {0}개를 보관했어요.',{0:receipt.stored})}</p>}
  {dialogue?<section className="flowerlight-scene-dialogue" aria-live="polite" data-frame="card_peach_v9" data-frame-scale="0.12">
   <Icon id={dialogue.speaker==='lumi'?'lumi':dialogue.speaker==='tori'?'tori_v8':'naru_v8'} size={65}/><p>{tr(dialogue.text)}</p>
  </section>:<ol className="flowerlight-scene-rewards" aria-label={tr('축제 정원 선물')}>
   {cards.map((milestone,index)=>{const n=first+index,gift=FLOWERLIGHT_GARDEN_GIFTS[n]!,claimed=n<stage;
    return <li key={milestone.id} data-claimed={claimed} aria-current={n===stage?'step':undefined} aria-label={t('hud.count',{count:milestone.target})+' · '+tr(gift.name)+' ×'+gift.quantity+(claimed?' · '+tr('수령 완료'):'')}>
     <h3><span>{t('hud.count',{count:milestone.target})}</span></h3>
     <div className="flowerlight-scene-gift"><img src={WORLD_ART[gift.itemId+(gift.variant==='festival'?':festival':'')]} alt={tr(gift.name)} draggable={false}/><strong>×{gift.quantity}</strong></div>
     <ActivityRewards reward={milestone.reward}/>
     {claimed&&<img className="flowerlight-scene-check" src={eventDesignArt.attendanceCheck} alt={tr('수령 완료')}/>}
    </li>;
   })}
  </ol>}
  </div>
  <Button className="flowerlight-scene-action" tone="green" disabled={busy||!event&&!available} onClick={action}>{tr(label)}</Button>
  {error&&<p className="flowerlight-scene-error" role="alert">{error}</p>}
 </section>;
}
