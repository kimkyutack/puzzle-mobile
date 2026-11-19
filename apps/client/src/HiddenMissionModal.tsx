import {useEffect,useRef,useState} from 'react';
import type {HiddenPowerMissionState,Player,PowerUseKind} from '@garden/contracts';
import {HIDDEN_MISSION_DURATION,hiddenMissionStage} from '../../../packages/content/src/hidden-power-missions';
import letter from '../../../packages/assets/hidden-mission/night-letter.webp';
import {ActivityRewards} from './Activity';
import {duration,request} from './api';
import {tr} from './i18n';
import {sound} from './sound';
import {Button,Card,FrameFace,Icon,Modal,names} from './ui';
import './hidden-mission.css';

const powers:Record<PowerUseKind,{title:string;icon:string}>={
 glider:{title:'잠자리 편대',icon:'glider'},
 bomb:{title:'폭탄 연쇄',icon:'bomb'},
 rocket:{title:'로켓 발사대',icon:'wind-row'},
 rainbow:{title:'무지개 소동',icon:'rainbow'},
};

function MissionClock({endsAt,now,compact=false}:{endsAt?:number;now:number;compact?:boolean}){
 const remaining=endsAt===undefined?undefined:Math.max(0,endsAt-now);
 const challengeTime=tr('{0}시간 도전',{0:HIDDEN_MISSION_DURATION/3_600_000});
 const value=remaining===undefined?(compact?duration(HIDDEN_MISSION_DURATION):challengeTime):duration(remaining);
 return <span className="hidden-mission-clock" role={remaining===undefined?undefined:'timer'} aria-label={remaining===undefined?(compact?challengeTime:undefined):tr('남은 시간')+' '+value}>
  {!compact&&<FrameFace id="event_sky_v9" scale={.055}/>}
  {value}
 </span>;
}

export function HiddenMissionPlayBadge({mission,now,disabled,onOpen}:{
 mission:HiddenPowerMissionState;now:number;disabled:boolean;onOpen:()=>void;
}){
 const stage=hiddenMissionStage(mission),power=powers[mission.kind];
 if(!stage)return null;
 return <button className="hidden-mission-play-badge" type="button" onClick={()=>{sound('button');onOpen();}} disabled={disabled}>
  <FrameFace id="card_peach_v9" scale={.08}/>
  <span className="sr-only">{tr('히든 미션')} {tr(power.title)}</span>
  <MissionClock endsAt={mission.endsAt} now={now} compact/>
  <Icon id={power.icon} size={30}/>
  <strong className="hidden-mission-badge-progress">{stage.progress}/{stage.target}</strong>
 </button>;
}

export default function HiddenMissionModal({mission,now,beforeRequest,onPlayer,onContinue}:{
 mission:HiddenPowerMissionState;now:number;beforeRequest:()=>Promise<void>;onPlayer:(player:Player)=>void;onContinue:()=>void;
}){
 const content=useRef<HTMLDivElement>(null),title=useRef<HTMLHeadingElement>(null),working=useRef(false),close=useRef(onContinue);
 close.current=onContinue;
 const [busy,setBusy]=useState(false),[message,setMessage]=useState('');
 const stage=hiddenMissionStage(mission),power=powers[mission.kind];
 const endsAt=mission.endsAt,discovered=endsAt===undefined;
 const label=stage?.ready?'목표 달성!':discovered?'히든 미션 발견!':'히든 미션';
 const action=stage?.ready?'claim':stage&&discovered?'start':null;

 useEffect(()=>{
  const dialog=content.current?.closest<HTMLElement>('.modal-layer');
  if(!dialog)return;
  const previous=document.activeElement;
  title.current?.focus({preventScroll:true});
  function keyboard(event:KeyboardEvent){
   if(event.key==='Escape'){event.preventDefault();if(!working.current)close.current();return;}
   if(event.key!=='Tab')return;
   const buttons=dialog!.querySelectorAll<HTMLButtonElement>('button:not(:disabled)');
   const first=buttons[0],last=buttons[buttons.length-1];
   if(!first||!last){event.preventDefault();return;}
   if(event.shiftKey&&(document.activeElement===first||document.activeElement===title.current)){event.preventDefault();last.focus();}
   else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
  }
  dialog.addEventListener('keydown',keyboard);
  return()=>{
   dialog.removeEventListener('keydown',keyboard);
   if(previous instanceof HTMLElement&&previous.isConnected)previous.focus();
  };
 },[]);

 async function primary(){
  if(working.current)return;
  if(!action){onContinue();return;}
  const stageNumber=action==='claim'?stage?.number:undefined;
  working.current=true;setBusy(true);setMessage('');
  try{
   await beforeRequest();
   const result=await request<{player:Player}>('/missions/hidden',{
    action,milestone:mission.milestone,stage:stageNumber,key:'hidden-mission-'+mission.milestone+'-'+action+'-'+(stageNumber??0),
   });
   onPlayer(result.player);
   if(action==='claim')sound('win');
  }catch(error){
   setMessage(tr(error instanceof Error?error.message:'잠시 후 다시 시도해 주세요.'));
  }finally{working.current=false;setBusy(false);}
 }

 return <Modal title={tr(label)} onClose={busy?undefined:onContinue}>
  <div ref={content} className="hidden-mission-poster-modal" data-state={stage?.ready?'ready':discovered?'discovered':'active'}>
   <figure className="hidden-mission-hero" aria-label={tr(power.title)}>
    <div className="hidden-mission-illustration" aria-hidden="true">
     <img className="hidden-mission-letter-art" src={letter} alt="" draggable={false}/>
     <Icon id={power.icon} className="hidden-mission-letter-icon" size={42}/>
    </div>
    {stage&&<MissionClock endsAt={endsAt} now={now}/>}
   </figure>
   <Card tone="gold" className="hidden-mission-stage">
    <h3 ref={title} tabIndex={-1}>{tr(power.title)}</h3>
    {stage?<><span className="hidden-mission-stage-label">{tr('보상 단계 {0}/{1}',{0:stage.number,1:stage.total})}</span>
     <div className="hidden-mission-goal">
      <p>{tr('{0} 사용 횟수',{0:mission.kind==='rocket'?tr('로켓'):names[power.icon]})}</p>
      <strong>{stage.progress}/{stage.target}</strong>
     </div>
     <div className="hidden-mission-meter" role="progressbar" aria-label={tr(power.title)}
      aria-valuenow={stage.progress} aria-valuemax={stage.target}>
      <span style={{width:100*stage.progress/stage.target+'%'}}/>
     </div>
     <div className="hidden-mission-reward"><span>{tr('보상')}</span><ActivityRewards reward={stage.reward}/></div>
    </>:<p className="hidden-mission-complete">{tr('모든 보상 수령 완료')}</p>}
   </Card>
   {stage&&(discovered||endsAt<=now&&!stage.ready)&&<p className="hidden-mission-note">
    {discovered?tr('시작하면 {0}시간 동안 도전할 수 있어요.',{0:HIDDEN_MISSION_DURATION/3_600_000}):tr('도전 시간이 끝났어요.')}
   </p>}
   {message&&<p className="hidden-mission-error" role="status">{message}</p>}
   <Button disabled={busy} onClick={()=>void primary()}>{tr(busy?'확인 중…':action==='claim'?'보상 받기':action==='start'?'도전 시작':'계속')}</Button>
  </div>
 </Modal>;
}
