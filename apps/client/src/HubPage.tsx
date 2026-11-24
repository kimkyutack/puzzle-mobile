import {useOperations} from './OperationsUI';
import {tr,formatLocale} from "./i18n";
import type {Player} from '@garden/contracts';
import {useLayoutEffect,useRef,type ReactNode} from 'react';
import {isGuildSubpage,type HubRoute} from './HubNavigation';
import ArtSurface from './ArtSurface';
import {Card,Icon,Amount} from './ui';
import EventHeaderBackdrop from './EventHeaderBackdrop';
import './events-v17.css';
import './shop-reference-v91.css';
import './shop-shelves-v95.css';
import './friends-sky-v102.css';
import './guild-map-v109.css';
import guildTitle from '../../../packages/assets/guild-map-v109/runtime/title.webp';
import guildBack from '../../../packages/assets/guild-map-v109/runtime/back-arrow.webp';
import friendsHeader from '../../../packages/assets/friends-sky-v102/runtime/header-clean.webp';
import type {WeeklyEventId} from '../../../packages/contracts/src/weekly-events';
const guildEmblemIconBrand='guild-emblem-laurel-crown';
const headings={shop:{title:'상점',icon:'shop'},friends:{title:'친구',icon:'lumi_happy'},guild:{title:'길드',icon:'guild'},events:{title:'이벤트',icon:'chest'}};
export default function HubPage({page,player,children,onGuildBack}:{page:Exclude<HubRoute,'home'|WeeklyEventId>;player:Player;children:ReactNode;onGuildBack?:()=>void}){
 const subpage=isGuildSubpage(page),tab=subpage?'guild':page;
 const heading=headings[tab],operations=useOperations(),feature=tab==='events'?null:tab;
 const title=page==='guild/find'?tr('길드 찾기'):page==='guild/create'?tr('길드 창설'):tr(heading.title);
 const content=useRef<HTMLDivElement>(null);
 useLayoutEffect(()=>{if(content.current)content.current.scrollTop=0;},[page]);
 return <section className={'game-page theme-'+(tab==='shop'?'shop shop-reference-v91 shop-shelves-v95':tab==='guild'?'guild guild-map-v109':tab==='friends'?'sky friends-sky-v102':'sky events-header-v112')} data-page={tab} data-guild-stage={tab==='guild'?(subpage?(page==='guild/find'?'find':'create'):player.guildId?'joined':player.level>=5?'entry':'locked'):undefined} aria-label={title} data-art-root>
  <ArtSurface/>{tab==='events'&&<EventHeaderBackdrop/>}
  <header className="page-header">
   {tab==='shop'?<div className="shop-brand">
    <span className="shop-hanging-sign" aria-hidden="true"/>
    <div className="shop-brand-content"><Icon id="home-v76-shop" size={32}/><h1>{title}</h1></div>
   </div>:tab==='friends'?<><img className="friends-header-art" src={friendsHeader} alt="" aria-hidden="true" draggable={false}/><h1>{title}</h1></>:tab==='guild'?<><img className="guild-map-title-art" src={guildTitle} alt="" aria-hidden="true" draggable={false}/>{!player.guildId&&<span className="guild-map-brand-crest" aria-hidden="true"><Icon id={guildEmblemIconBrand} size={58}/></span>}<h1>{title}</h1>{subpage&&<button type="button" className="guild-page-back" data-frame="button_secondary" data-frame-scale="0.1" aria-label={tr('뒤로')} onClick={onGuildBack}><img src={guildBack} alt="" draggable={false}/></button>}</>:<div className="events-brand"><img className="events-title-plaque" src={guildTitle} alt="" aria-hidden="true" draggable={false}/><span className="events-brand-icon" aria-hidden="true"><Icon id={heading.icon} size={43}/></span><h1>{title}</h1></div>}
   {tab==='shop'?<Amount kind="coin" value={(player.coins+player.boundCoins).toLocaleString(formatLocale())}/>:null}
  </header>
  <div ref={content} className="page-content modal-content">{feature&&operations.data?.settings.features[feature]===false?<Card tone="blue"><p>{tr('잠시 쉬어가는 기능이에요. 나중에 다시 확인해 주세요.')}</p></Card>:children}</div>
 </section>;
}
