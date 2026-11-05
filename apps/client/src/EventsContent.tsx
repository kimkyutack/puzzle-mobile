import {tr,formatLocale} from './i18n';
import {ActivityEntries,useActivity} from './Activity';
import AttendancePanel,{type AttendanceProps} from './AttendancePanel';
import {Amount,Button,Icon,Poster} from './ui';
import {eventArt} from './event-art-v17';
import './events-v17.css';

export interface EventProgress {progress:number;target:number;coins:number;claimed:boolean}
export interface EventsContentProps extends AttendanceProps {
 season:{id:string;ends_at:number}|null;
 personal:EventProgress;
 guild:EventProgress;
 hasGuild:boolean;
 onPage:(page:string)=>void;
 onClaimSeason:(kind:'personal'|'guild')=>void;
}

export default function EventsContent(props:EventsContentProps){
 const {data}=useActivity();
 const remaining=data?.minigame.remaining;
 return <div className="events-v17">
  <ActivityEntries onPage={props.onPage} attendanceAvailable={props.daily.available} seasonAvailable={!!props.season}/>
  <section id="event-treasure" className="event-treasure-feature" aria-labelledby="treasure-event-title">
   <Poster id="poster_treasure_v14" label={tr('루미와 함께 보물 카드 찾기')}/>
   <div className="treasure-event-copy"><span className="event-kicker">{tr('미니게임')}</span><h2 id="treasure-event-title">{tr('보물 카드')}</h2><p>{tr('짝을 찾아 도구를 모아요')}</p></div>
   <div className="treasure-event-bottom">
    <div className="treasure-event-status"><span><Icon id="heart" size={18}/>{tr('하트 소모 없음')}</span><small>{tr('오늘 남은 도전')} {remaining===undefined?'—':remaining} / 3</small></div>
    <Button tone="gold" onClick={()=>props.onPage('treasure')}>{tr(remaining===0?'오늘 도전 완료':data?.minigame.active?.status==='playing'?'이어서 플레이':'보물 카드 시작')}</Button>
   </div>
  </section>
  <AttendancePanel daily={props.daily} attendance={props.attendance} working={props.working} onClaim={props.onClaim}/>
  {props.season?<section id="event-season" className="event-season-feature" aria-labelledby="season-event-title">
   <div className="event-season-scene"><img src={eventArt.season} alt="" draggable={false} loading="lazy"/><div><span className="event-kicker">{tr('함께 자라는 정원')}</span><h2 id="season-event-title">{tr('시즌 이벤트')}</h2><p>{tr('시즌 종료')}<br/>{new Date(props.season.ends_at).toLocaleString(formatLocale())}</p></div></div>
   <div className="event-season-goals">{(['personal','guild'] as const).map(kind=>{
    const progress=props[kind],eligible=kind==='personal'||props.hasGuild,ready=progress.progress>=progress.target;
    const count=Math.min(progress.progress,progress.target),percent=progress.target>0?Math.min(100,100*count/progress.target):0;
    return <div key={kind} className={'season-goal season-goal-'+kind}>
     <Icon id={kind==='personal'?'star':'guild'} size={46}/>
     <div className="season-goal-copy"><h3>{tr(kind==='personal'?'나의 정원 목표':'길드 공동 목표')}</h3><div className="season-goal-meter" role="progressbar" aria-label={tr(kind==='personal'?'새 레벨 클리어':'길드와 함께 클리어')} aria-valuenow={count} aria-valuemin={0} aria-valuemax={progress.target}><i style={{width:percent+'%'}}/><strong>{count} / {progress.target}</strong></div></div>
     <Amount kind="coin" value={progress.coins}/>
     <div className="season-goal-action">{!eligible?<Button tone="blue" onClick={()=>props.onPage('guild')}>{tr('길드에서 함께하기')}</Button>:ready&&!progress.claimed?<Button attention={1} tone="gold" icon="chest" disabled={props.working} onClick={()=>props.onClaimSeason(kind)}>{tr('보상 받기')}</Button>:<span className={progress.claimed?'is-complete':''}>{progress.claimed&&<Icon id="star" size={20}/>} {tr(progress.claimed?'수령 완료':'{0}판 남았어요',{0:Math.max(0,progress.target-progress.progress)})}</span>}</div>
    </div>;
   })}</div>
  </section>:<p className="events-next-season">{tr('새로운 정원 활동을 준비하고 있어요.')}</p>}
 </div>;
}
