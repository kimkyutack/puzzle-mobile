import {tr,formatLocale} from "./i18n";
import type {Player} from '@garden/contracts';
import type {ReactNode} from 'react';
import type {HubTab} from './HubNavigation';
import ArtSurface from './ArtSurface';
import {Icon,Amount} from './ui';
import {eventArt} from './event-art-v17';
import './events-v17.css';
const headings={shop:{title:'상점',icon:'shop'},friends:{title:'친구',icon:'lumi_happy'},guild:{title:'우리 길드',icon:'guild'},events:{title:'이벤트',icon:'chest'}};
export default function HubPage({page,player,children}:{page:Exclude<HubTab,'home'>;player:Player;children:ReactNode}){
 const heading=headings[page];
 return <section className={'game-page theme-'+(page==='shop'?'shop':page==='guild'?'guild':'sky')} data-page={page} aria-label={tr(heading.title)} data-art-root>
  <ArtSurface scene={page==='events'?undefined:'pages_v9'}/>{page==='events'&&<img className="events-page-backdrop" src={eventArt.background} alt="" draggable={false}/>}
  <header className="page-header" data-frame={page==='events'?undefined:'chrome_teal_v6'} data-frame-scale="0.15"><Icon id={heading.icon} size={43}/><h1>{tr(heading.title)}</h1>{page==='shop'?<Amount kind="coin" value={(player.coins+player.boundCoins).toLocaleString(formatLocale())}/>:<span className="page-player-level">{tr("레벨")}{' '}{player.level}</span>}</header>
  <div className="page-content modal-content">{children}</div>
 </section>;
}
