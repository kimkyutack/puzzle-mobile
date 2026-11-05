import {tr,formatLocale} from './i18n';
import {Button,Icon,Amount} from './ui';
import {eventArt} from './event-art-v17';
import './events-comfort-v15.css';
import './events-v17.css';

export interface AttendanceState {total:number;claimedDays:number;cycleDay:number;bonusItem:'hammer';bonusQuantity:number}
export interface AttendanceProps {
 daily:{available:boolean;coins:number;nextReset:number};
 attendance?:AttendanceState;
 working:boolean;
 onClaim:()=>void;
}

export default function AttendancePanel({daily,attendance,working,onClaim}:AttendanceProps){
 const completed=attendance?.claimedDays??(daily.available?0:1),today=attendance?.cycleDay??1;
 return <section id="event-attendance" className="attendance-panel attendance-v17" aria-labelledby="attendance-title">
  <div className="attendance-scene">
   <img src={eventArt.attendance} alt="" draggable={false}/>
   <div className="attendance-scene-copy">
    <span className="event-kicker">{tr('매일 만나는 선물')}</span>
    <h2 id="attendance-title">{tr('7일 출석 선물')}</h2>
    <p>{tr('7번째 출석에는 특별한 선물!')}</p>
   </div>
   <span className="attendance-counter"><Icon id="star" size={20}/>{completed} / 7</span>
  </div>
  <div className="attendance-content">
   <div className="attendance-days" aria-label={tr('출석 보상 목록')}>{Array.from({length:7},(_,i)=>{
    const number=i+1,claimed=number<=completed,current=number===today;
    return <div key={number} className={'attendance-day '+(number===7?'is-bonus ':'')+(claimed?'is-claimed ':'')+(current?'is-today':'')} aria-label={tr('{0}일차',{0:number})+' · '+tr(claimed?'수령 완료':current?'오늘의 선물':'다음 선물')}>
     <strong>{tr('{0}일차',{0:number})}</strong>
     <div className="attendance-day-reward"><Amount kind="coin" value={daily.coins}/>{number===7&&<span className="attendance-bonus"><Icon id="hammer" size={30}/>+{attendance?.bonusQuantity??1}</span>}</div>
     {claimed?<span className="attendance-stamp" aria-hidden="true">✓</span>:current?<small>{tr('오늘의 선물')}</small>:null}
    </div>;
   })}</div>
   <Button className="attendance-claim" icon={daily.available?'chest':'star'} tone="green" attention={Number(daily.available)} disabled={working||!daily.available} onClick={onClaim}>{tr(daily.available?'출석하고 받기':'오늘 출석 완료')}</Button>
   <p className="attendance-reset">{tr('다음 선물')} {new Date(daily.nextReset).toLocaleString(formatLocale())}</p>
   <p className="attendance-note">{tr('빠진 날이 있어도 모은 출석은 유지돼요.')}</p>
  </div>
 </section>;
}
