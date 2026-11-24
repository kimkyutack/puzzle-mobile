import {EventIcon} from './event-icons';
import {startBoosterWindow} from '../../../packages/contracts/src/start-booster-rush';
import {useOperations} from './OperationsUI';
import {serverNow,duration} from './api';
import {Icon} from './ui';
import {tr} from './i18n';
/** The parent game clock already renders once per second; this adds no polling. */
export default function StartBoosterRush({showSchedule=false,presentation}:{showSchedule?:boolean;presentation?:'event'}){
 const {data}=useOperations(),schedule=data?.settings.startBoosterRush,window=startBoosterWindow(schedule,serverNow());
 if(!schedule?.enabled||!window.active&&!showSchedule)return null;
 if(presentation==='event')return <section className="event-unlimited-state" aria-label={tr('시작 아이템 무제한')}>
  <strong>{tr(window.active?'무제한 진행 중':'시작 아이템 무제한')}</strong>
  {window.active&&<b aria-label={tr('남은 시간')}>{duration(window.endsAt!-serverNow())}</b>}
  <div className="event-unlimited-times">{schedule.dailyTimes.map(time=><span key={time}>{time}</span>)}</div>
 </section>;
 return <section className={'start-rush-banner'+(window.active?' active':'')} data-frame="event_sky_v9" data-frame-scale="0.1" aria-label={tr('시작 아이템 무제한')}>
  <div className="start-rush-icons" aria-hidden="true"><EventIcon kind="unlimited" size={52}/></div>
  <div className="start-rush-copy"><strong>{tr('시작 아이템 무제한')}</strong><small>{window.active?tr('보유 수량 소모 없이 선택해요'):tr('매일 {0} · 각 10분 · 한국 시간',{0:schedule.dailyTimes.join(' / ')})}</small></div>
  {window.active&&<b className="start-rush-timer" aria-label={tr('남은 시간')}>{duration(window.endsAt!-serverNow())}</b>}
 </section>;
}
