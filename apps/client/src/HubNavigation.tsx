import {tr} from "./i18n";
import {FrameFace,Icon} from './ui';
import ArtSurface from './ArtSurface';
import {useAttention,RewardDot} from './Activity';
import {useEventDiscovery} from './use-event-discovery';
import './event-discovery.css';
import {childAccount} from './platform/account-age';
export type HubTab='home'|'shop'|'friends'|'guild'|'events';
export type GuildSubpage='guild/find'|'guild/create';
export type HubRoute=HubTab|GuildSubpage;
const tabs=[['shop','shop','상점'],['friends','lumi_happy','친구'],['home','home','홈'],['guild','guild','길드'],['events','chest','이벤트']] as const;
export const isGuildSubpage=(page:string):page is GuildSubpage=>page==='guild/find'||page==='guild/create';
export function currentHubRoute():HubRoute{
 const route=location.hash.replace(/^#\/?/,'');
 return route==='shop'||route==='friends'||route==='guild'||route==='events'||isGuildSubpage(route)?route:'home';
}
export default function HubNavigation({active,onTab}:{active:HubTab;onTab:(tab:HubTab)=>void}){
 const {footer:badges}=useAttention(),newEvents=useEventDiscovery(active==='events');
 const visibleTabs=childAccount()?tabs.filter(([tab])=>tab!=='friends'&&tab!=='guild'):tabs;
 return <div className="hub-navigation" data-art-root><ArtSurface/>
  <nav className="hub-footer" data-hub-tabs={visibleTabs.length} data-frame="footer_azure_v9" data-frame-scale="0.18" data-frame-bleed="8" aria-label={tr("하단 메뉴")}>
   {visibleTabs.map(([page,icon,label])=><button key={page} className={'hub-nav-item '+(page===active?'hub-nav-home':'')} aria-label={tr(label)} aria-current={page===active?'page':undefined} onClick={()=>{onTab(page);if(page==='events')window.dispatchEvent(new Event('garden:events-open'));}}>{page===active&&<FrameFace id="button_secondary" scale={.15}/>}<Icon id={icon} size={page===active?65:44}/><span>{tr(label)}</span>{!(page==='events'&&newEvents)&&<RewardDot count={badges[page]}/>} {page==='events'&&newEvents&&<span className="hub-new-event-label" role="status">{tr('새 이벤트')}</span>}</button>)}
  </nav>
 </div>;
}
