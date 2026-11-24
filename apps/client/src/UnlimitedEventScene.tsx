import {useEffect,useState} from 'react';
import {START_BOOSTER_RUSH_MS,startBoosterWindow,type StartBoosterSchedule} from '../../../packages/contracts/src/start-booster-rush';
import {serverNow,duration} from './api';
import {Button,Icon,names} from './ui';
import {tr} from './i18n';
import {eventDesignArt} from './event-design-art';
import './event-extras-v71.css';

export default function UnlimitedEventScene({schedule,onPlay}:{schedule?:StartBoosterSchedule;onPlay:()=>void}){
 const [now,setNow]=useState(serverNow);
 useEffect(()=>{const timer=setInterval(()=>setNow(serverNow()),1000);return()=>clearInterval(timer)},[]);
 const window=startBoosterWindow(schedule,now),enabled=!!schedule?.enabled,next=window.active?window.endsAt:window.nextStartsAt;
 const title=window.active?'무제한 진행 중':enabled?'다음 무제한까지':'이벤트 준비 중';
 return <section className="unlimited-scene-v71" aria-label={tr('시작 아이템 무제한')}>
  <img className="unlimited-scene-art" src={eventDesignArt.unlimitedScene} alt="" draggable={false}/>
  <div className="unlimited-scene-status" role="timer" aria-live="off"><h2>{tr(title)}</h2><strong>{next?duration(Math.max(0,next-now)):'—'}</strong></div>
  <div className="unlimited-scene-tools" aria-label={tr('시작 아이템 무제한')}>{['wind-row','bomb','rainbow'].map(item=><span key={item} aria-label={names[item]}><Icon id={item}/></span>)}</div>
  <h3 className="unlimited-scene-schedule-title">{tr('시작 도구 무제한')}</h3>
  <div className="unlimited-scene-times" data-variable={(schedule?.dailyTimes.length??0)!==3} aria-label={(schedule?.dailyTimes??[]).join(', ')}>{(schedule?.dailyTimes??[]).map(time=><strong key={time}>{time}</strong>)}</div>
  <p className="unlimited-scene-note">{tr('매일 · 각 {0}분 · 한국 시간',{0:START_BOOSTER_RUSH_MS/60000})}</p>
  <Button className="unlimited-scene-play" tone="green" onClick={onPlay}>{tr('퍼즐 플레이')}</Button>
 </section>;
}
