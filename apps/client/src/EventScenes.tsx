import {useEffect,useState} from 'react';
import type {PowerFestivalState,PowerUseKind,SeasonEventReward} from '@garden/contracts';
import {POWER_FESTIVAL_STAGES,festivalStage} from '../../../packages/content/src/power-festival';
import type {EventProgress} from './EventsContent';
import {Button,Icon,names} from './ui';
import {tr} from './i18n';
import {duration,serverNow} from './api';
import {eventDesignArt} from './event-design-art';
import './event-scenes-v65.css';

function SceneMeter({progress,target,label,tone='green'}:{progress:number;target:number;label:string;tone?:'green'|'gold'}){
 const value=Math.max(0,Math.min(target,progress)),percent=target>0?100*value/target:0;
 return <div className="event-scene-meter" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={target} aria-valuenow={value}>
  {percent>0&&<span className="event-scene-meter-fill" style={{width:percent+'%'}}><img src={tone==='gold'?eventDesignArt.meterGold:eventDesignArt.meterGreen} alt=""/></span>}
  {tone==='green'&&<Icon className="season-scene-meter-level" id="level_completed_v61"/>}
  <strong>{value}/{target}</strong>
 </div>;
}

function SceneRewards({reward}:{reward:Pick<SeasonEventReward,'coins'|'items'>&{stars?:number}}){
 const tokens=[...(reward.coins>0?[{id:'coin',quantity:reward.coins}]:[]),...Object.entries(reward.items).filter(([,quantity])=>(quantity??0)>0).map(([id,quantity])=>({id,quantity})),...(reward.stars?[{id:'star',quantity:reward.stars}]:[])];
 return <div className="scene-rewards" data-count={tokens.length}>{tokens.map(({id,quantity})=><span className="scene-reward" key={id} aria-label={(id==='coin'?tr('코인'):id==='star'?tr('별'):names[id])+' ×'+quantity}><Icon id={id}/><strong>×{quantity}</strong></span>)}</div>;
}

interface SeasonSceneProps{
 season:{id:string;ends_at:number}|null;personal:EventProgress;guild:EventProgress;hasGuild:boolean;working:boolean;
 onClaimSeason:(kind:'personal'|'guild')=>void;onPage:(page:string)=>void;
}
export function SeasonEventScene(props:SeasonSceneProps){
 const [now,setNow]=useState(serverNow);
 useEffect(()=>{const timer=setInterval(()=>setNow(serverNow()),1000);return()=>clearInterval(timer)},[]);
 const remaining=Math.max(0,(props.season?.ends_at??now)-now),active=!!props.season&&remaining>0;
 const days=Math.floor(remaining/86400000),hours=Math.floor(remaining/3600000)%24,minutes=Math.floor(remaining/60000)%60;
 const time=!props.season?tr('이벤트 준비 중'):!active?tr('시즌 종료'):days?tr('{0}일',{0:days})+' '+String(hours).padStart(2,'0')+':'+String(minutes).padStart(2,'0'):duration(remaining);
 return <section className="event-scene-v65 season-scene-v65" aria-label={tr('꽃바람 시즌')}>
  <img className="event-scene-v65-art" src={eventDesignArt.seasonScene} alt="" draggable={false}/>
  <p className="season-scene-clock" data-active={active} style={{backgroundImage:`url("${eventDesignArt.seasonClock}")`}}><span>{time}</span></p>
  {props.season?(['personal','guild'] as const).map(kind=>{
   const goal=props[kind],eligible=kind==='personal'||props.hasGuild,ready=active&&eligible&&goal.progress>=goal.target;
   return <section className={'season-scene-goal season-scene-'+kind} key={kind} aria-label={tr(kind==='personal'?'나의 정원 목표':'길드 공동 목표')}>
    <h3>{tr(kind==='personal'?'새 레벨 클리어':'길드 합산 클리어')}</h3>
    <SceneMeter progress={goal.progress} target={goal.target} label={tr(kind==='personal'?'새 레벨 클리어':'길드 합산 클리어')}/>
    <div className="season-scene-prize"><SceneRewards reward={goal.reward??{coins:goal.coins,items:{}}}/>
     {goal.claimed&&<img className="season-scene-check" src={eventDesignArt.attendanceCheck} alt={tr('수령 완료')}/>}
     <div className="season-scene-prize-action">
      {!active?<span>{tr('시즌 종료')}</span>:!eligible?<Button onClick={()=>props.onPage('guild')}>{tr('길드에서 함께하기')}</Button>:goal.claimed?<span>{tr('수령 완료')}</span>:ready?<Button disabled={props.working} onClick={()=>props.onClaimSeason(kind)}>{tr('보상 받기')}</Button>:<span>{tr('목표 {0}레벨',{0:goal.target})}</span>}
     </div>
    </div>
   </section>;
  }):<div className="season-scene-empty" data-frame="card_ice_v9" data-frame-scale="0.12"><p>{tr('새로운 정원 활동을 준비하고 있어요.')}</p></div>}
 </section>;
}

interface ToolsSceneProps{
 event?:PowerFestivalState;stage:ReturnType<typeof festivalStage>|null;now:number;busy:boolean;message:string;canStart:boolean;unlocked:boolean;
 icons:Record<PowerUseKind,string>;onStart:()=>Promise<void>;onClaim:()=>Promise<void>;onPlay?:()=>void;
}
export function PowerFestivalEventScene({event,stage,now,busy,message,canStart,unlocked,icons,onStart,onClaim,onPlay}:ToolsSceneProps){
 const claimed=event?.claimedStages??0,complete=claimed>=POWER_FESTIVAL_STAGES.length,active=!!event&&now<event.endsAt&&!complete;
 const action=event&&stage?.ready&&!complete?onClaim:canStart?onStart:active?onPlay:undefined;
 const caption=message||tr('도구 목표 {0}개 달성',{0:POWER_FESTIVAL_STAGES.length});
 const label=event&&stage?.ready&&!complete?busy?'보상 확인 중':'선물 받기':canStart?busy?'준비 중':'축제 시작하기':active?'퍼즐로 이동':complete?'오늘 완료':!unlocked?'레벨 5부터 참여할 수 있어요.':'오늘의 도전이 끝났어요. 내일 다시 만나요!';
 return <section className="event-scene-v65 tools-scene-v65" aria-label={tr('도구 축제')} aria-busy={busy}>
  <img className="event-scene-v65-art" src={eventDesignArt.toolsScene} alt="" draggable={false}/>
  <p className="tools-scene-clock" role="timer" aria-live="off" aria-label={tr('도구 축제 진행 상황')}>
   <img className="tools-scene-clock-art" src={eventDesignArt.meterGold} alt=""/>
   <span>{tr(complete?'오늘 완료':active?'진행 중':event&&!canStart?'시간 종료':'시작 전')}</span>
   <strong>{complete?'5/5':active?duration(event!.endsAt-now):event&&!canStart?'00:00':tr('30분 도전')}</strong>
  </p>
  <div className="tools-scene-goals">{(['rocket','bomb','glider','rainbow'] as const).map(kind=>{
   const progress=stage?.progress[kind]??0,target=stage?.targets[kind]??POWER_FESTIVAL_STAGES[0]!.targets[kind];
   return <section className="tools-scene-goal" key={kind} aria-label={names[icons[kind]]}>
    <Icon id={icons[kind]}/><h3>{names[icons[kind]]}</h3><SceneMeter tone="gold" progress={progress} target={target} label={names[icons[kind]]}/>
   </section>;
  })}</div>
  <h3 className="tools-scene-caption" data-feedback={!!message} role={message?'status':undefined}>{caption}</h3>
  <ol className="tools-scene-stages" aria-label={tr('단계별 선물')}>{POWER_FESTIVAL_STAGES.map((item,index)=><li key={index} aria-current={index===claimed?'step':undefined} data-claimed={index<claimed}>
   <strong className="tools-scene-stage-number"><span>{index+1}</span></strong>
   {(index===1||index===3)&&index>claimed?<img className="tools-scene-lock" src={eventDesignArt.rewardLock} alt={tr('{0}단계 잠김',{0:index+1})}/>:<SceneRewards reward={item.reward}/> }
   {index<claimed&&<img className="tools-scene-check" src={eventDesignArt.attendanceCheck} alt={tr('수령 완료')}/>}
  </li>)}</ol>
  <Button className="event-scene-v65-action" data-readable-disabled tone="green" disabled={busy||!action} onClick={()=>{void action?.()}}>{tr(label)}</Button>
 </section>;
}
