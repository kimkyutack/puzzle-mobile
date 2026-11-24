import {homeIcon} from './home-icon-art';
import {homeCountdown} from './home-countdown';
import {useEffect,useState} from 'react';
import {startBoosterWindow} from '../../../packages/contracts/src/start-booster-rush';
import {serverNow} from './api';
import {useOperations} from './OperationsUI';
import {EventIcon} from './event-icons';
import {Modal,Icon} from './ui';
import {tr,t} from './i18n';
import UnlimitedEventScene from './UnlimitedEventScene';
import './unlimited-tools.css';

export function UnlimitedHomeShortcut({onOpen,dock=false}:{onOpen:()=>void;dock?:boolean}){
 const {data}=useOperations(),[now,setNow]=useState(serverNow);
 useEffect(()=>{const timer=setInterval(()=>setNow(serverNow()),1000);return()=>clearInterval(timer)},[]);
 const schedule=data?.settings.startBoosterRush,window=startBoosterWindow(schedule,now),until=window.active?window.endsAt:window.nextStartsAt;
 if(!schedule?.enabled||!until)return null;
 const caption=tr(window.active?'남은 시간':'시작까지'),time=homeCountdown(until-now);
 return <button className="hub-unlimited-shortcut" data-active={window.active} aria-label={`${tr('아이템 무제한')} · ${caption} ${time}`} onClick={onOpen}>
  {dock?<Icon id={homeIcon('unlimited','rainbow')} size={61}/>:<EventIcon kind="unlimited" size={61}/>}
  <b className="hub-menu-time hub-unlimited-clock" role="timer" aria-live="off">
   <small>{caption}</small><strong>{time}</strong>
  </b>
  <span data-frame={dock?undefined:"event_sky_v9"} data-frame-scale={dock?undefined:"0.11"}>{dock?t('home.short.unlimited').split(' ').map((word,index)=><span className="home-label-word" key={index}>{word}</span>):tr('아이템 무제한')}</span>
 </button>;
}

export default function UnlimitedToolsModal({onClose,onPlay}:{onClose:()=>void;onPlay:()=>void}){
 const {data}=useOperations();
 return <Modal title={tr('아이템 무제한')} className="unlimited-tools-modal" onClose={onClose}>
  <UnlimitedEventScene schedule={data?.settings.startBoosterRush} onPlay={onPlay}/>
 </Modal>;
}
