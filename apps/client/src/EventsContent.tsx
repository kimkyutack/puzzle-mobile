import {configuredExpeditionRound,EXPEDITION_ANIMALS} from '../../../packages/content/src/animal-expedition';
import {useEffect,useId,useRef,useState} from 'react';
import type {Player} from '@garden/contracts';
import {FlowerlightFestival} from './ContentEvents';
import AnimalExpedition from './AnimalExpedition';
import StartBoosterRush from './StartBoosterRush';
import {PowerFestivalMenu} from './PowerFestival';
import {OperationsMenu,useOperations} from './OperationsUI';
import {tr,formatLocale} from './i18n';
import {useActivity,RewardDot,TreasureMenu} from './Activity';
import AttendancePanel,{type AttendanceProps} from './AttendancePanel';
import {Amount,Button,Card,Icon} from './ui';
import {eventArt} from './event-art-v17';
import {WORLD_ART} from './garden-world/assets';
import {expeditionCanResume} from './expedition-progress';
import {eventTabs,type EventTabId} from './event-tabs';
import {serverNow} from './api';
import {sound} from './sound';
import {treasureAttention} from '../../../packages/content/src/attention';
import {arcadeIcons} from './garden-arcade-art';
import {isGardenGame} from '../../../packages/contracts/src/garden-games';
import GardenGameMenu from './GardenGameMenu';
import './events-v17.css';
import './event-tabs.css';

export interface EventProgress {progress:number;target:number;coins:number;claimed:boolean}
export interface EventsContentProps extends AttendanceProps {
 player:Player;
 season:{id:string;ends_at:number}|null;
 personal:EventProgress;
 guild:EventProgress;
 hasGuild:boolean;
 onPage:(page:string)=>void;
 onClaimSeason:(kind:'personal'|'guild')=>void;
 mutate:(path:string,body?:Record<string,unknown>,method?:string)=>Promise<unknown>;
}
function EventTabIcon({id}:{id:EventTabId}){
 const {data}=useOperations(),animal=configuredExpeditionRound(data?.settings).animal;
 if(id==='attendance')return <img src={eventArt.calendar} alt="" draggable={false}/>;
 if(id==='flowerlight'||id==='animal-expedition')return <img src={WORLD_ART[id==='flowerlight'?'garden-flowerlight-fountain':EXPEDITION_ANIMALS[animal].itemId]} alt="" draggable={false}/>;
 if(isGardenGame(id))return <img src={arcadeIcons[id]} alt="" draggable={false}/>;
 return <Icon id={id==='power-festival'?'bundle_tools_v7':id==='season'?'guild':id==='start-rush'?'rainbow':'chest'} size={64}/>;
}
export default function EventsContent(props:EventsContentProps){
 const {data,updatePlayer,updateData}=useActivity(),operations=useOperations();
 useEffect(()=>{updateData(data=>data.eventRewards?{...data,eventRewards:{...data.eventRewards,daily:props.daily,season:props.season,personal:props.personal,guild:props.guild}}:data);},[props.daily,props.season,props.personal,props.guild,!!data,updateData]);
 const [selected,setSelected]=useState<EventTabId>('attendance'),row=useRef<HTMLElement>(null),panel=useRef<HTMLDivElement>(null),id=useId();
 const tabs=eventTabs({player:props.player,now:serverNow(),dailyAvailable:props.daily.available&&serverNow()<props.daily.nextReset,treasureRemaining:data&&treasureAttention(data.minigame,serverNow())?1:0,season:props.season,personal:props.personal,guild:props.guild,hasGuild:props.hasGuild,features:operations.data?.settings.features,settings:operations.data?.settings,expeditionCanResume:expeditionCanResume(props.player),startRush:operations.data?.settings.startBoosterRush,rewards:operations.data?.events.filter(event=>event.kind==='reward')});
 const active=tabs.find(tab=>tab.id===selected)??tabs[0]!,tabIds=tabs.map(tab=>tab.id).join('|');
 useEffect(()=>{if(!tabs.some(tab=>tab.id===selected))setSelected('attendance');},[selected,tabIds]);
 useEffect(()=>{panel.current?.scrollTo({top:0,behavior:'instant'});},[active.id]);
 useEffect(()=>{const reset=()=>{setSelected('attendance');row.current?.scrollTo({left:0,behavior:'instant'});panel.current?.scrollTo({top:0,behavior:'instant'});};window.addEventListener('garden:events-open',reset);return()=>window.removeEventListener('garden:events-open',reset)},[]);
 function select(next:EventTabId,focus=false){
  sound('button');setSelected(next);const list=row.current,button=list?.querySelector<HTMLButtonElement>(`[data-event-tab="${next}"]`);
  if(list&&button){const view=list.getBoundingClientRect(),item=button.getBoundingClientRect();const delta=item.left<view.left?item.left-view.left:item.right>view.right?item.right-view.right:0;if(delta)list.scrollTo({left:list.scrollLeft+delta,behavior:'instant'});if(focus)button.focus({preventScroll:true});}
 }
 return <div className="events-v17 events-v45">
  <nav ref={row} className="event-tabs-row" role="tablist" aria-label={tr('이벤트 선택')} onKeyDown={event=>{
   const button=(event.target as HTMLElement).closest<HTMLButtonElement>('[data-event-tab]'),index=tabs.findIndex(tab=>tab.id===(button?.dataset.eventTab??active.id));
   const next=event.key==='ArrowRight'?(index+1)%tabs.length:event.key==='ArrowLeft'?(index+tabs.length-1)%tabs.length:event.key==='Home'?0:event.key==='End'?tabs.length-1:null;
   if(next!==null){event.preventDefault();select(tabs[next]!.id,true);}
  }}>{tabs.map(tab=><button key={tab.id} role="tab" data-event-tab={tab.id} id={id+'-tab-'+tab.id} aria-selected={tab.id===active.id} aria-controls={id+'-panel'} tabIndex={tab.id===active.id?0:-1} className="event-tab" onClick={()=>select(tab.id)}>
   <span className="event-tab-art"><Icon id="booster_socket" size={70} className="event-tab-socket"/><EventTabIcon id={tab.id}/><RewardDot count={Number(tab.attention)}/></span>
   <strong data-frame={tab.id===active.id?'button_gold':'button_secondary'} data-frame-scale="0.09">{tr(tab.title)}</strong>
  </button>)}</nav>
  <div key={props.player.id} ref={panel} id={id+'-panel'} className="event-tab-panel" role="tabpanel" aria-labelledby={id+'-tab-'+active.id} tabIndex={0} data-event-panel={active.id}>
   {active.id==='attendance'&&(operations.data?.settings.features.daily===false?<Card><p>{tr('잠시 쉬어가는 기능이에요. 나중에 다시 확인해 주세요.')}</p></Card>:<AttendancePanel daily={props.daily} attendance={props.attendance} working={props.working} onClaim={props.onClaim}/>)}
   {active.id==='flowerlight'&&<><h2 className="event-detail-title">{tr('루미의 꽃빛축제')}</h2><FlowerlightFestival key={props.player.id} embedded player={props.player} onPlayer={updatePlayer} onClose={()=>select('attendance')} onPage={props.onPage} onPlay={()=>props.onPage('start')}/></>}
   {active.id==='animal-expedition'&&<AnimalExpedition key={props.player.id} embedded player={props.player} onPlayer={updatePlayer} onClose={()=>select('attendance')} onPage={props.onPage}/>}
   {active.id==='treasure'&&<><h2 className="event-detail-title">{tr('보물 카드')}</h2><TreasureMenu/></>}
   {isGardenGame(active.id)&&<GardenGameMenu key={active.id} game={active.id} player={props.player} settings={operations.data?.settings} onPlayer={updatePlayer} onPuzzle={()=>props.onPage('start')}/>}
   {active.id==='power-festival'&&<><h2 className="event-detail-title">{tr('도구 축제')}</h2><PowerFestivalMenu onPlay={()=>props.onPage('start')}/></>}
   {active.id==='season'&&<SeasonEvent {...props}/>}
   {active.id==='start-rush'&&<div className="event-rush-panel"><h2 className="event-detail-title">{tr('시작 아이템 무제한')}</h2><div className="event-rush-art"><Icon id="wind-row" size={70}/><Icon id="rainbow" size={110}/><Icon id="bomb" size={70}/></div><StartBoosterRush showSchedule/><p>{tr('무제한 시간에는 보유 수량을 소모하지 않고 시작 아이템을 선택해요.')}</p><Button tone="green" onClick={()=>props.onPage('start')}>{tr('퍼즐 플레이')}</Button></div>}
   {active.id==='live-events'&&<OperationsMenu page="live-events" mutate={props.mutate}/>}
  </div>
 </div>;
}
function SeasonEvent(props:EventsContentProps){return (props.season?<section id="event-season" className="event-season-feature" aria-labelledby="season-event-title">
   <div className="event-season-scene"><img src={eventArt.season} alt="" draggable={false} loading="lazy"/><div><span className="event-kicker">{tr('함께 자라는 정원')}</span><h2 id="season-event-title">{tr('시즌 이벤트')}</h2><p>{tr('시즌 종료')}<br/>{new Date(props.season.ends_at).toLocaleString(formatLocale())}</p></div></div>
   <div className="event-season-goals">{(['personal','guild'] as const).map(kind=>{
    const progress=props[kind],eligible=kind==='personal'||props.hasGuild,active=serverNow()<props.season!.ends_at,ready=active&&progress.progress>=progress.target;
    const count=Math.min(progress.progress,progress.target),percent=progress.target>0?Math.min(100,100*count/progress.target):0;
    return <div key={kind} className={'season-goal season-goal-'+kind}>
     <Icon id={kind==='personal'?'star':'guild'} size={46}/>
     <div className="season-goal-copy"><h3>{tr(kind==='personal'?'나의 정원 목표':'길드 공동 목표')}</h3><div className="season-goal-meter" role="progressbar" aria-label={tr(kind==='personal'?'새 레벨 클리어':'길드와 함께 클리어')} aria-valuenow={count} aria-valuemin={0} aria-valuemax={progress.target}><i style={{width:percent+'%'}}/><strong>{count} / {progress.target}</strong></div></div>
     <Amount kind="coin" value={progress.coins}/>
     <div className="season-goal-action">{!active?<span>{tr('시즌 종료')}</span>:!eligible?<Button tone="blue" onClick={()=>props.onPage('guild')}>{tr('길드에서 함께하기')}</Button>:ready&&!progress.claimed?<Button attention={1} tone="gold" icon="chest" disabled={props.working} onClick={()=>props.onClaimSeason(kind)}>{tr('보상 받기')}</Button>:<span className={progress.claimed?'is-complete':''}>{progress.claimed&&<Icon id="star" size={20}/>} {tr(progress.claimed?'수령 완료':'{0}판 남았어요',{0:Math.max(0,progress.target-progress.progress)})}</span>}</div>
    </div>;
   })}</div>
  </section>:<p className="events-next-season">{tr('새로운 정원 활동을 준비하고 있어요.')}</p>);}
