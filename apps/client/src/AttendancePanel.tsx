import {tr,formatLocale} from './i18n';
import {Button,Icon,Amount} from './ui';
import {eventDesignArt} from './event-design-art';
import './attendance-calendar.css';

export interface AttendanceState {total:number;claimedDays:number;cycleDay:number;bonusItem:'hammer';bonusQuantity:number}
export interface AttendanceProps {
 daily:{available:boolean;coins:number;nextReset:number};
 attendance?:AttendanceState;
 working:boolean;
 onClaim:()=>void;
}

export default function AttendancePanel({daily,attendance,working,onClaim}:AttendanceProps){
 const completed=attendance?.claimedDays??(daily.available?0:1),today=attendance?.cycleDay??1;
 return <section id="event-attendance" className="attendance-calendar" aria-labelledby="attendance-title">
  <img className="attendance-calendar-art" src={eventDesignArt.attendanceCalendar} alt="" draggable={false}/>
  <h2 id="attendance-title" className="attendance-calendar-title">{tr('7일 출석 선물')}</h2>
  <div className="attendance-calendar-days" aria-label={tr('출석 보상 목록')}>{Array.from({length:7},(_,i)=>{
    const number=i+1,claimed=number<=completed,current=number===today;
    return <div key={number} data-day={number} className={'attendance-calendar-day '+(number===7?'is-bonus ':'')+(claimed?'is-claimed ':'')+(current&&!claimed?'is-today':'')} aria-label={tr('{0}일차',{0:number})+' · '+tr(claimed?'수령 완료':current?'오늘의 선물':'다음 선물')}>
     <strong><span>{tr('{0}일차',{0:number})}</span></strong>
     {number===7?<div className="attendance-calendar-bonus"><Icon id="hammer" size={52}/><span><Amount kind="coin" value={daily.coins}/><span>+ {tr('망치')}{attendance?.bonusQuantity??1}</span></span></div>:<Amount kind="coin" value={daily.coins}/>}
     {claimed&&<img className="attendance-calendar-check" src={eventDesignArt.attendanceCheck} alt=""/>}
    </div>;
   })}</div>
  <section className="attendance-calendar-prize" aria-label={tr('오늘 받을 선물')}>
   <h3>{tr('오늘 받을 선물')}</h3><Amount kind="coin" value={daily.coins}/>
   <Button className="attendance-calendar-claim" tone="green" disabled={working||!daily.available} onClick={onClaim}>{tr(daily.available?'선물 받기':'오늘 출석 완료')}</Button>
  </section>
  {!daily.available&&<p className="attendance-calendar-reset">{tr('다음 선물')} {new Date(daily.nextReset).toLocaleTimeString(formatLocale(),{hour:'2-digit',minute:'2-digit'})}</p>}
 </section>;
}
