import {tr} from "./i18n";
import {FrameFace,Icon} from './ui';
import ArtSurface from './ArtSurface';
import {useActivity,RewardDot} from './Activity';
export type HubTab='home'|'shop'|'friends'|'guild'|'events';
const tabs=[['shop','shop','상점'],['friends','lumi_happy','친구'],['home','home','홈'],['guild','guild','길드'],['events','chest','이벤트']] as const;
export function currentHubTab():HubTab{
 const route=location.hash.replace(/^#\/?/,'');
 return route==='shop'||route==='friends'||route==='guild'||route==='events'?route:'home';
}
export default function HubNavigation({active,onTab}:{active:HubTab;onTab:(tab:HubTab)=>void}){
 const {data}=useActivity(),n=data?.notifications;const badges={shop:n?.shop??0,friends:n?.friends??0,home:(n?.missions??0)+(n?.pass??0)+(n?.gifts??0),guild:n?.guild??0,events:(n?.events??0)+(n?.minigame??0)};
 return <div className="hub-navigation" data-art-root><ArtSurface/>
  <nav className="hub-footer" data-hub-tabs="5" data-frame="footer_azure_v9" data-frame-scale="0.18" data-frame-bleed="8" aria-label={tr("하단 메뉴")}>
   {tabs.map(([page,icon,label])=><button key={page} className={'hub-nav-item '+(page===active?'hub-nav-home':'')} aria-label={tr(label)} aria-current={page===active?'page':undefined} onClick={()=>onTab(page)}>{page===active&&<FrameFace id="button_secondary" scale={.15}/>}<Icon id={icon} size={page===active?65:44}/><span>{tr(label)}</span><RewardDot count={badges[page]}/></button>)}
  </nav>
 </div>;
}
