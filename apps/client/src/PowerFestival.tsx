import {homeIcon} from './home-icon-art';
import {gameEventConfig} from '../../../packages/contracts/src/operations';
import {createContext,useContext,useEffect,useRef,useState,type ReactNode} from 'react';
import type {Player,Run,PowerFestivalState,PowerUseKind} from '@garden/contracts';
import {POWER_FESTIVAL_MIN_LEVEL,POWER_FESTIVAL_STAGES,POWER_USE_KINDS,festivalStage,festivalClaimable} from '../../../packages/content/src/power-festival';
import {powerFestivalCanStart} from '../../../packages/content/src/attention';
import {request,key,serverNow,duration} from './api';
import {t,tr} from './i18n';
import {Button,Icon,FrameFace,Modal,names} from './ui';
import {ActivityRewards,RewardDot,useAttention} from './Activity';
import {sound} from './sound';
import {useOperations,featureEnabled} from './OperationsUI';
import {predictedFestival,showFestival} from './power-festival-state';
import './power-festival.css';
import './power-festival-modal.css';
import {eventDesignArt} from './event-design-art';
import {PowerFestivalEventScene} from './EventScenes';

const icons:Record<PowerUseKind,string>={rocket:'wind-row',bomb:'bomb',glider:'glider',rainbow:'rainbow'};
interface FestivalContext {event?:PowerFestivalState;confirmed?:PowerFestivalState;now:number;busy:boolean;message:string;canStart:boolean;unlocked:boolean;start:()=>Promise<void>;claim:()=>Promise<void>}
const Context=createContext<FestivalContext>({now:0,busy:false,message:'',canStart:false,unlocked:false,start:async()=>{},claim:async()=>{}});
export const usePowerFestival=()=>useContext(Context);
export function PowerFestivalProvider({player,run,confirmedRun,onPlayer,beforeRequest,children}:{player:Player;run:Run|null;confirmedRun:Run|null;onPlayer:(p:Player)=>void;beforeRequest:()=>Promise<void>;children:ReactNode}){
 const [,tick]=useState(0),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),guard=useRef(false),startKey=useRef(key()),owner=useRef(player.id);owner.current=player.id;
 useEffect(()=>{const timer=setInterval(()=>tick(n=>n+1),1000);return()=>clearInterval(timer)},[]);
 useEffect(()=>{setMessage('');setBusy(false);guard.current=false;startKey.current=key()},[player.id]);
 const now=serverNow(),saved=player.powerFestival,event=saved?predictedFestival(saved,run,confirmedRun,now):undefined;
 const operations=useOperations(),unlocked=player.level>=gameEventConfig('powerFestival',operations.data?.settings).minLevel,canStart=powerFestivalCanStart(player,now,operations.data?.settings);
 async function command(kind:'start'|'claim'){
  if(guard.current)return;guard.current=true;setBusy(true);setMessage('');const user=player.id;
  try{
   await beforeRequest();
   const response=await request<{player:Player;granted?:boolean}>('/power-festival/'+kind,kind==='start'?{key:startKey.current}:{key:`festival-${saved!.id}-${saved!.claimedStages+1}`,eventId:saved!.id,stage:saved!.claimedStages+1});
   if(owner.current!==user)return;onPlayer(response.player);if(kind==='start')startKey.current=key();else{sound('win');setMessage(tr('도구 축제 보상을 받았어요!'));}
   window.dispatchEvent(new Event('garden:activity-changed'));
  }catch(error){if(owner.current===user)setMessage(error instanceof Error?error.message:tr('연결을 확인해 주세요.'));}finally{if(owner.current===user){guard.current=false;setBusy(false)}}
 }
 return <Context value={{event,confirmed:saved,now,busy,message,canStart,unlocked,start:()=>command('start'),claim:()=>command('claim')}}>{children}</Context>;
}
function FestivalMeters({event}:{event:PowerFestivalState}){
 const stage=festivalStage(event.counts,event.claimedStages);
 return <div className="festival-meters">{POWER_USE_KINDS.map(kind=><div key={kind} className={'festival-meter meter-'+kind} role="progressbar" aria-label={names[icons[kind]]} aria-valuemin={0} aria-valuenow={stage.progress[kind]} aria-valuemax={stage.targets[kind]}><Icon id={icons[kind]} size={32}/><span className="festival-meter-track"><i style={{width:100*stage.progress[kind]/stage.targets[kind]+'%'}}/><strong>{stage.progress[kind]}/{stage.targets[kind]}</strong></span></div>)}</div>;
}
export function PowerFestivalBar({onOpen,disabled=false}:{onOpen:()=>void;disabled?:boolean}){
 const {data}=useOperations(),{event,confirmed,now}=usePowerFestival();if(!featureEnabled('powerFestival',data)||!showFestival(event,now)||!event)return null;
 const ready=confirmed?festivalClaimable(confirmed):0;
 return <button className={'power-festival-bar'+(ready?' is-ready':'')} onClick={onOpen} disabled={disabled} aria-label={tr('도구 축제 진행 상황')}>
  <FrameFace id="event_sky_v9" scale={.1}/><FestivalMeters event={event}/><span className="festival-bar-caption"><span>{tr('단계')} {event.claimedStages+1}/5</span><span>{ready?tr('선물 받기'):duration(event.endsAt-now)}</span><Icon id="chest" size={22}/></span><RewardDot count={ready}/>
 </button>;
}
export function PowerFestivalShortcut({onOpen}:{onOpen:()=>void}){
 const attention=useAttention();
 const {unlocked,event,confirmed,now,canStart}=usePowerFestival();if(!unlocked)return null;
 return <button className="hub-festival-shortcut" aria-label={tr('도구 축제')} onClick={onOpen}><FrameFace id="event_sky_v9" scale={.06}/><Icon id={homeIcon('festival','bundle_tools_v7')} size={54}/><span>{t('home.short.festival')}</span><small>{event&&showFestival(event,now)?duration(event.endsAt-now):canStart?t('home.short.festivalReady'):tr('오늘 완료')}</small><RewardDot count={attention.counts.festival}/></button>;
}
export function PowerFestivalMenu({onPlay,presentation}:{onPlay?:()=>void;presentation?:'scene'}={}){
 const {event,confirmed,now,busy,message,canStart,unlocked,start,claim}=usePowerFestival(),stage=event?festivalStage(event.counts,event.claimedStages):null;
 const operations=useOperations();
 if(!featureEnabled('powerFestival',operations.data))return <p>{tr('잠시 쉬어가는 기능이에요. 나중에 다시 확인해 주세요.')}</p>;
 const completed=event?.claimedStages===POWER_FESTIVAL_STAGES.length,active=!!event&&now<event.endsAt&&!completed;
 if(presentation==='scene')return <PowerFestivalEventScene event={event} stage={stage} now={now} busy={busy} message={message} canStart={canStart} unlocked={unlocked} icons={icons} onStart={start} onClaim={claim} onPlay={onPlay}/>;
 return <div className="power-festival-menu" style={{backgroundImage:`url(${eventDesignArt.workshop})`}}>
  <div className="festival-clock"><Icon id="chest" size={29}/><strong>{completed?tr('5단계 완주!'):active?duration(event!.endsAt-now):tr('30분 · 5단계 도전')}</strong></div>
  {!completed&&<section className="festival-goals"><h3>{tr('{0}단계 목표',{0:(event?.claimedStages??0)+1})}</h3><div className="festival-tool-board">{(['rocket','bomb','glider','rainbow'] as const).map(kind=>{const progress=stage?.progress[kind]??0,target=stage?.targets[kind]??POWER_FESTIVAL_STAGES[0]!.targets[kind];return <div key={kind}><Icon id={icons[kind]} size={56}/><strong>{names[icons[kind]]}</strong><progress aria-label={names[icons[kind]]} value={progress} max={target}/><small>{progress}/{target}</small></div>})}</div></section>}
  <ol className="festival-stages" aria-label={tr('단계별 선물')}>{POWER_FESTIVAL_STAGES.map((item,index)=><li key={index} className={index<(event?.claimedStages??0)?'is-claimed':index===(event?.claimedStages??0)?'is-current':''}><span>{index<(event?.claimedStages??0)?'✓':index+1}</span><ActivityRewards reward={item.reward}/></li>)}</ol>
  <section className="festival-prize"><strong>{completed?tr('마지막 선물'):tr('이번 단계 선물')}</strong><ActivityRewards reward={stage?.reward??POWER_FESTIVAL_STAGES[0]!.reward}/></section>
  {event&&stage?.ready&&!completed?<Button icon="chest" tone="green" disabled={busy} attention={confirmed?festivalClaimable(confirmed):0} onClick={()=>void claim()}>{busy?tr('보상 확인 중'):tr('선물 받기')}</Button>:canStart?<Button icon="rainbow" tone="green" disabled={busy} onClick={()=>void start()}>{busy?tr('준비 중'):tr('축제 시작하기')}</Button>:<p className="festival-status" role="status">{!unlocked?tr('레벨 5부터 참여할 수 있어요.'):active?tr('퍼즐에서 특수 아이템을 사용해 주세요.'):completed?tr('모든 선물을 받았어요. 내일 다시 만나요!'):tr('오늘의 도전이 끝났어요. 내일 다시 만나요!')}</p>}
  {active&&onPlay&&<Button tone="green" onClick={onPlay}>{tr('퍼즐로 이동')}</Button>}
  {message&&<p className="festival-feedback" role="status">{message}</p>}
  <p className="fine">{tr('로켓 두 방향은 합산하고 연쇄 발동도 포함해요. 가방 도구를 소비할 필요는 없어요.')}</p><p className="fine">{tr('하루 한 번 무료로 시작해요. 횟수는 다음 단계로 이월되고, 달성한 보상은 시간이 끝나도 받을 수 있어요.')}</p>
 </div>;
}

/** Home shortcut and the in-game progress bar share the event's full scene. */
export function PowerFestivalDialog({onClose,onPlay}:{onClose:()=>void;onPlay:()=>void}){
 return <Modal title={tr('도구 축제')} className="power-festival-modal" onClose={onClose}><PowerFestivalMenu presentation="scene" onPlay={onPlay}/></Modal>;
}
