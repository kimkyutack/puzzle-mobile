import {useEffect,useId,useRef,useState} from 'react';
import type {Player,SeasonEventProgress} from '@garden/contracts';
import {FlowerlightFestival} from './ContentEvents';
import AnimalExpedition from './AnimalExpedition';
import {OperationsMenu,useOperations} from './OperationsUI';
import {tr} from './i18n';
import {useActivity,TreasureMenu} from './Activity';
import AttendancePanel,{type AttendanceProps} from './AttendancePanel';
import {Button,Card} from './ui';
import {expeditionCanResume} from './expedition-progress';
import {eventTabs,type EventTabId} from './event-tabs';
import {serverNow} from './api';
import {sound} from './sound';
import {treasureAttention} from '../../../packages/content/src/attention';
import {isGardenGame} from '../../../packages/contracts/src/garden-games';
import GardenGameMenu from './GardenGameMenu';
import EventTabsBar from './EventTabsBar';
import HubLoading from './HubLoading';
import './events-v17.css';
import './event-tabs.css';
import './event-design-v62.css';
import './events-fullscreen.css';
import {SeasonEventScene} from './EventScenes';
import GardenInvitation from './GardenInvitation';
import {useCallback} from 'react';
import {childAccount} from './platform/account-age';

export type EventProgress=SeasonEventProgress;
export interface EventsContentProps extends AttendanceProps {
 initialTab?:EventTabId;
 onTabChange?:(tab:EventTabId)=>void;
 refreshError?:string;
 revalidating?:boolean;
 onRetry?:()=>void;
 player:Player;
 season:{id:string;ends_at:number}|null;
 personal:EventProgress;
 guild:EventProgress;
 hasGuild:boolean;
 onPage:(page:string)=>void;
 onClaimSeason:(kind:'personal'|'guild')=>void;
 mutate:(path:string,body?:Record<string,unknown>,method?:string)=>Promise<unknown>;
}
export function EventsLoadingContent({player,selected,onSelect,error,retrying,onRetry}:{player:Player;selected:EventTabId;onSelect:(tab:EventTabId)=>void;error:string;retrying:boolean;onRetry:()=>void}){
 const operations=useOperations(),id=useId();
 useEffect(()=>{const reset=()=>onSelect('attendance');window.addEventListener('garden:events-open',reset);return()=>window.removeEventListener('garden:events-open',reset);},[onSelect]);
 const tabs=eventTabs({socialAllowed:!childAccount(),player,now:serverNow(),dailyAvailable:false,season:null,hasGuild:!!player.guildId,features:operations.data?.settings.features,settings:operations.data?.settings,rewards:operations.data?.events.filter(event=>event.kind==='reward')});
 const active=tabs.find(tab=>tab.id===selected)??tabs[0]!;
 return <div className="events-v17 events-v45 events-v62"><EventTabsBar tabs={tabs} selected={active.id} id={id} onSelect={next=>{sound('button');onSelect(next);}}/>
  <div className="event-tab-panel events-loading-panel" id={id+'-panel'} role="tabpanel" aria-labelledby={id+'-tab-'+active.id} data-event-panel={active.id}><HubLoading reducedMotion={player.settings.reducedMotion} kind="events" error={error} retrying={retrying} onRetry={onRetry}/></div>
 </div>;
}
export default function EventsContent(props:EventsContentProps){
 const {data,updatePlayer,updateData}=useActivity(),operations=useOperations();
 useEffect(()=>{updateData(data=>data.eventRewards?{...data,eventRewards:{...data.eventRewards,daily:props.daily,season:props.season,personal:props.personal,guild:props.guild}}:data);},[props.daily,props.season,props.personal,props.guild,!!data,updateData]);
 const onInvitationStatus=useCallback((claimable:boolean)=>updateData(data=>({...data,notifications:{...data.notifications,invitation:Number(claimable)}})),[updateData]);
 const [selected,setSelected]=useState<EventTabId>(props.initialTab??'attendance'),panel=useRef<HTMLDivElement>(null),id=useId();
 const tabs=eventTabs({invitationClaimable:!!data?.notifications.invitation,socialAllowed:!childAccount(),player:props.player,now:serverNow(),dailyAvailable:props.daily.available&&serverNow()<props.daily.nextReset,treasureRemaining:data&&treasureAttention(data.minigame,serverNow())?1:0,season:props.season,personal:props.personal,guild:props.guild,hasGuild:props.hasGuild,features:operations.data?.settings.features,settings:operations.data?.settings,expeditionCanResume:expeditionCanResume(props.player),startRush:operations.data?.settings.startBoosterRush,rewards:operations.data?.events.filter(event=>event.kind==='reward')});
 const active=tabs.find(tab=>tab.id===selected)??tabs[0]!,tabIds=tabs.map(tab=>tab.id).join('|');
 useEffect(()=>{if(!tabs.some(tab=>tab.id===selected))setSelected('attendance');},[selected,tabIds]);
 useEffect(()=>{panel.current?.scrollTo({top:0,behavior:'instant'});},[active.id]);
 useEffect(()=>{const reset=()=>{setSelected('attendance');props.onTabChange?.('attendance');panel.current?.scrollTo({top:0,behavior:'instant'});};window.addEventListener('garden:events-open',reset);return()=>window.removeEventListener('garden:events-open',reset)},[]);
 function select(next:EventTabId){sound('button');setSelected(next);props.onTabChange?.(next);}
 return <div className="events-v17 events-v45 events-v62">
  <EventTabsBar tabs={tabs} selected={active.id} id={id} onSelect={select}/>
  {props.refreshError&&<div className="hub-refresh-notice" role="status"><span>{tr('최신 정보를 확인하지 못했어요.')}</span><Button tone="blue" disabled={props.revalidating} onClick={props.onRetry}>{tr('다시 불러오기')}</Button></div>}
  <div key={props.player.id} ref={panel} id={id+'-panel'} className="event-tab-panel" role="tabpanel" aria-labelledby={id+'-tab-'+active.id} tabIndex={0} data-event-panel={active.id}>
   {active.id==='attendance'&&(operations.data?.settings.features.daily===false?<Card><p>{tr('잠시 쉬어가는 기능이에요. 나중에 다시 확인해 주세요.')}</p></Card>:<AttendancePanel daily={props.daily} attendance={props.attendance} working={props.working} onClaim={props.onClaim}/>)}
   {active.id==='flowerlight'&&<FlowerlightFestival key={props.player.id} embedded player={props.player} onPlayer={updatePlayer} onClose={()=>select('attendance')} onPage={props.onPage} onPlay={()=>props.onPage('start')}/>}
   {active.id==='animal-expedition'&&<AnimalExpedition key={props.player.id} embedded player={props.player} onPlayer={updatePlayer} onClose={()=>select('attendance')} onPage={props.onPage}/>}
   {active.id==='treasure'&&<TreasureMenu presentation="scene"/>}
   {isGardenGame(active.id)&&<GardenGameMenu key={active.id} game={active.id} player={props.player} settings={operations.data?.settings} onPlayer={updatePlayer} onPuzzle={()=>props.onPage('start')}/>}
   {active.id==='season'&&<SeasonEventScene {...props}/>}
   {active.id==='garden-invite'&&<GardenInvitation key={props.player.id} player={props.player} onPlayer={updatePlayer} onStatus={onInvitationStatus} onPage={props.onPage}/>}
   {active.id==='live-events'&&<OperationsMenu page="live-events" presentation="event" mutate={props.mutate}/>}

  </div>
 </div>;
}
