import {homeIcon} from './home-icon-art';
import type {CSSProperties} from 'react';
import {tr} from "./i18n";
import {Icon} from './ui';
import HomeDockFace from './HomeDockFace';
import './home-command-dock.css';
import './home-reference-icons.css';
import './home-exact-reference.css';
import ArtSurface from './ArtSurface';
import {useAttention,RewardDot} from './Activity';
import {useEventDiscovery} from './use-event-discovery';
import './event-discovery.css';
import {childAccount} from './platform/account-age';
import {isWeeklyEvent,type WeeklyEventId} from '../../../packages/contracts/src/weekly-events';
export type HubTab='home'|'shop'|'friends'|'guild'|'events';
export type GuildSubpage='guild/find'|'guild/create';
export type HubRoute=HubTab|GuildSubpage|WeeklyEventId;
const tabs=[['shop','shop','상점'],['friends','lumi_happy','친구'],['home','home','홈'],['guild','guild','길드'],['events','chest','이벤트']] as const;
export const isGuildSubpage=(page:string):page is GuildSubpage=>page==='guild/find'||page==='guild/create';
export function currentHubRoute():HubRoute{
 const route=location.hash.replace(/^#\/?/,'');
 return route==='shop'||route==='friends'||route==='guild'||route==='events'||isGuildSubpage(route)||isWeeklyEvent(route)?route:'home';
}
export default function HubNavigation({active,onTab}:{active:HubTab;onTab:(tab:HubTab)=>void}){
 const {footer:badges}=useAttention(),newEvents=useEventDiscovery(active==='events');
 const visibleTabs=childAccount()?tabs.filter(([tab])=>tab!=='friends'&&tab!=='guild'):tabs;
 const selectedIndex=Math.max(0,visibleTabs.findIndex(([page])=>page===active)),fraction=(selectedIndex+.5)/visibleTabs.length;
 const offset=8-16*fraction+5*(selectedIndex-(visibleTabs.length-1)/2)/visibleTabs.length;
 const footerStyle={'--footer-active-center':`calc(${fraction*100}% ${offset<0?'-':'+'} ${Math.abs(offset).toFixed(4)}px)`} as CSSProperties;
 return <div className="hub-navigation command-navigation" style={footerStyle} data-active={active} data-art-root><ArtSurface/>
  <HomeDockFace/>
  <nav className="hub-footer" data-hub-tabs={visibleTabs.length} aria-label={tr("하단 메뉴")}>
   {visibleTabs.map(([page,icon,label])=><button key={page} data-hub-tab={page} className={'hub-nav-item '+(page===active?'hub-nav-home':'')} aria-label={tr(label)} aria-current={page===active?'page':undefined} onClick={()=>{onTab(page);if(page==='events')window.dispatchEvent(new Event('garden:events-open'));}}>{page===active&&<span className="home-active-tab-face" aria-hidden="true"/>}<Icon id={homeIcon(page==='home'?'home-nav':page==='events'?'events':page,icon)} size={page===active?65:44}/><span>{tr(label)}</span><RewardDot count={badges[page]+Number(page==='events'&&newEvents)}/></button>)}
  </nav>
 </div>;
}
