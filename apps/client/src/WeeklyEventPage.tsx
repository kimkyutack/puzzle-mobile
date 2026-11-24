import {homeIconUrls} from './home-icon-art';
import {homeCountdown} from './home-countdown';
import {useEffect,useState} from 'react';
import type {Player} from '@garden/contracts';
import {weeklyEvent,type WeeklyEventId} from '../../../packages/contracts/src/weekly-events';
import {gameEventAvailable,gameEventConfig,type RuntimeSettings} from '../../../packages/contracts/src/operations';
import {configuredExpeditionRound,EXPEDITION_ANIMALS} from '../../../packages/content/src/animal-expedition';
import {useOperations} from './OperationsUI';
import {duration,serverNow} from './api';
import {Button} from './ui';
import {tr,t} from './i18n';
import {WORLD_ART} from './garden-world/assets';
import {arcadeIcons} from './garden-arcade-art';
import AnimalExpedition from './AnimalExpedition';
import GardenGameMenu from './GardenGameMenu';
import ArtSurface from './ArtSurface';
import {eventDesignArt} from './event-design-art';
import './weekly-events.css';
import './event-design-v62.css';

const titles={'animal-expedition':'동물 구출 원정','acorn-pinball':'도토리 핀볼','greenhouse-water':'온실 물길'};
export function weeklyEventEntry(player:Player,now:number,settings:RuntimeSettings|undefined){
 const event=weeklyEvent(now),feature=event.id==='animal-expedition'?'animalExpedition':event.id;
 const visible=player.level>=gameEventConfig(feature,settings).minLevel&&gameEventAvailable(feature,settings,now);
 return {...event,title:titles[event.id],visible};
}
export function WeeklyEventShortcut({player,onOpen,dock=false}:{player:Player;onOpen:(id:WeeklyEventId)=>void;dock?:boolean}){
 const {data}=useOperations(),now=serverNow(),event=weeklyEventEntry(player,now,data?.settings);
 if(!event.visible)return null;
 const animal=configuredExpeditionRound(data?.settings,now).animal;
 const image=event.id==='animal-expedition'?(dock&&animal==='panda'&&homeIconUrls['home-v76-rescue']||WORLD_ART[EXPEDITION_ANIMALS[animal].itemId]):arcadeIcons[event.id];
 return <button className="hub-weekly-event" aria-label={tr(event.title)} onClick={()=>onOpen(event.id)}>
  <img src={image} data-home-icon={dock&&animal==='panda'&&event.id==='animal-expedition'?'rescue':undefined} alt="" draggable={false}/><small className="hub-menu-time" role="timer" aria-live="off" aria-label={tr('남은 시간')}>{homeCountdown(event.endsAt-now)}</small>
  <span data-frame={dock?undefined:"event_sky_v9"} data-frame-scale={dock?undefined:"0.11"}>{dock?t(event.id==='animal-expedition'?'home.short.rescue':event.id==='acorn-pinball'?'home.short.pinball':'home.short.water'):tr(event.title)}</span>
 </button>;
}
export default function WeeklyEventPage({event,player,onPlayer,onHome,onPage}:{event:WeeklyEventId;player:Player;onPlayer:(player:Player)=>void;onHome:()=>void;onPage:(page:string)=>void}){
 const {data}=useOperations(),[now,setNow]=useState(serverNow);
 useEffect(()=>{const timer=setInterval(()=>setNow(serverNow()),1000);return()=>clearInterval(timer);},[]);
 const current=weeklyEventEntry(player,now,data?.settings),available=current.id===event&&current.visible;
 const scene=event==='animal-expedition'?eventDesignArt.rescue:event==='acorn-pinball'?eventDesignArt.pinball:eventDesignArt.water;
 return <section className="weekly-event-page weekly-designed" data-weekly-event={event} aria-label={tr(titles[event])}>
  <div className="weekly-event-stage" data-art-root>
  <img className="weekly-event-backdrop" src={scene} alt="" draggable={false}/><ArtSurface/>
  <nav className="weekly-event-navigation" aria-label={tr('홈으로')}>
   <Button rasterFrame={false} className="weekly-home" onClick={onHome}>{tr('홈')}</Button>
   <Button rasterFrame={false} className="weekly-close" onClick={onHome}><img src={eventDesignArt.closeButton} alt={tr('닫기')}/></Button>
  </nav>
  <h1 className="weekly-scene-title">{tr(titles[event])}</h1>
  <span className="weekly-event-countdown">{available?duration(current.endsAt-now):tr('이번 회차 종료')}</span>
  <div className="weekly-event-content">
   {available?event==='animal-expedition'
    ?<AnimalExpedition key={current.key} embedded weekly player={player} onPlayer={onPlayer} onClose={onHome} onPage={onPage}/>
    :<GardenGameMenu key={current.key+event} variant="weekly" game={event} player={player} settings={data?.settings} onPlayer={onPlayer} onPuzzle={()=>onPage('start')}/>
    :<div className="weekly-event-ended"><p>{tr('새로운 주간 이벤트가 시작됐어요.')}</p><Button tone="gold" onClick={onHome}>{tr('홈으로')}</Button></div>}
  </div>
  </div>
 </section>;
}
