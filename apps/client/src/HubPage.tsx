import {useOperations} from './OperationsUI';
import {tr,formatLocale} from "./i18n";
import type {Player} from '@garden/contracts';
import {useLayoutEffect,useRef,type ReactNode} from 'react';
import {isGuildSubpage,type HubRoute} from './HubNavigation';
import ArtSurface from './ArtSurface';
import {Card,Icon,Amount} from './ui';
import {eventArt} from './event-art-v17';
import './events-v17.css';
const headings={shop:{title:'상점',icon:'shop'},friends:{title:'친구',icon:'lumi_happy'},guild:{title:'우리 길드',icon:'guild'},events:{title:'이벤트',icon:'chest'}};
export default function HubPage({page,player,children,onGuildBack}:{page:Exclude<HubRoute,'home'>;player:Player;children:ReactNode;onGuildBack?:()=>void}){
 const subpage=isGuildSubpage(page),tab=subpage?'guild':page;
 const heading=headings[tab],operations=useOperations(),feature=tab==='events'?null:tab;
 const title=page==='guild/find'?tr('길드 찾기'):page==='guild/create'?tr('길드 창설'):tr(heading.title);
 const content=useRef<HTMLDivElement>(null);
 useLayoutEffect(()=>{if(content.current)content.current.scrollTop=0;},[page]);
 return <section className={'game-page theme-'+(tab==='shop'?'shop':tab==='guild'?'guild':'sky')} data-page={tab} aria-label={title} data-art-root>
  <ArtSurface scene={tab==='events'?undefined:'pages_v9'}/>{tab==='events'&&<img className="events-page-backdrop" src={eventArt.background} alt="" draggable={false}/>}
  <header className="page-header" data-frame={tab==='events'?undefined:'chrome_teal_v6'} data-frame-scale="0.15">
   {subpage?<button type="button" className="guild-page-back" data-frame="button_secondary" data-frame-scale="0.1" onClick={onGuildBack}>{tr('뒤로')}</button>:<Icon id={heading.icon} size={43}/>}
   <h1>{title}</h1>{tab==='shop'?<Amount kind="coin" value={(player.coins+player.boundCoins).toLocaleString(formatLocale())}/>:tab!=='events'&&<span className="page-player-level">{tr("레벨")}{' '}{player.level}</span>}
  </header>
  <div ref={content} className="page-content modal-content">{feature&&operations.data?.settings.features[feature]===false?<Card tone="blue"><p>{tr('잠시 쉬어가는 기능이에요. 나중에 다시 확인해 주세요.')}</p></Card>:children}</div>
 </section>;
}
