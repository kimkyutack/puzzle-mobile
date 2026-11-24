import {useEffect,useRef} from 'react';
import type {EventTab,EventTabId} from './event-tabs';
import {useOperations} from './OperationsUI';
import {configuredExpeditionRound,EXPEDITION_ANIMALS} from '../../../packages/content/src/animal-expedition';
import {serverNow} from './api';
import {eventArt} from './event-art-v17';
import {WORLD_ART} from './garden-world/assets';
import {arcadeIcons} from './garden-arcade-art';
import {isGardenGame} from '../../../packages/contracts/src/garden-games';
import {Icon} from './ui';
import {RewardDot} from './Activity';
import {tr} from './i18n';
import gardenInviteIcon from '../../../packages/assets/garden-invite-v117/runtime/invite-icon.webp';
function EventTabIcon({id}:{id:EventTabId}){
 const {data}=useOperations(),animal=configuredExpeditionRound(data?.settings,serverNow()).animal;
 if(id==='garden-invite')return <img src={gardenInviteIcon} alt="" draggable={false}/>;
 if(id==='attendance')return <img src={eventArt.calendar} alt="" draggable={false}/>;
 if(id==='flowerlight'||id==='animal-expedition')return <img src={WORLD_ART[id==='flowerlight'?'garden-flowerlight-fountain':EXPEDITION_ANIMALS[animal].itemId]} alt="" draggable={false}/>;
 if(isGardenGame(id))return <img src={arcadeIcons[id]} alt="" draggable={false}/>;
 return <Icon id={id==='season'?'guild':'chest'} size={64}/>;
}
export default function EventTabsBar({tabs,selected,id,onSelect}:{tabs:EventTab[];selected:EventTabId;id:string;onSelect:(id:EventTabId)=>void}){
 const row=useRef<HTMLElement>(null);
 useEffect(()=>{const reset=()=>row.current?.scrollTo({left:0,behavior:'instant'});window.addEventListener('garden:events-open',reset);return()=>window.removeEventListener('garden:events-open',reset);},[]);
 function select(next:EventTabId,focus=false){
  onSelect(next);const list=row.current,button=list?.querySelector<HTMLButtonElement>(`[data-event-tab="${next}"]`);
  if(list&&button){const view=list.getBoundingClientRect(),item=button.getBoundingClientRect(),delta=item.left<view.left?item.left-view.left:item.right>view.right?item.right-view.right:0;if(delta)list.scrollTo({left:list.scrollLeft+delta,behavior:'instant'});if(focus)button.focus({preventScroll:true});}
 }
 return <nav ref={row} className="event-tabs-row" role="tablist" aria-label={tr('이벤트 선택')} onKeyDown={event=>{
  const button=(event.target as HTMLElement).closest<HTMLButtonElement>('[data-event-tab]'),index=tabs.findIndex(tab=>tab.id===(button?.dataset.eventTab??selected));
  const next=event.key==='ArrowRight'?(index+1)%tabs.length:event.key==='ArrowLeft'?(index+tabs.length-1)%tabs.length:event.key==='Home'?0:event.key==='End'?tabs.length-1:null;
  if(next!==null){event.preventDefault();select(tabs[next]!.id,true);}
 }}>{tabs.map(tab=><button key={tab.id} role="tab" data-event-tab={tab.id} id={id+'-tab-'+tab.id} aria-selected={tab.id===selected} aria-controls={id+'-panel'} tabIndex={tab.id===selected?0:-1} className="event-tab" onClick={()=>select(tab.id)}>
  <span className="event-tab-art"><Icon id="booster_socket" size={70} className="event-tab-socket"/><EventTabIcon id={tab.id}/><RewardDot count={Number(tab.attention)}/></span>
  <strong data-frame={tab.id===selected?'button_gold':'button_secondary'} data-frame-scale="0.09">{tr(tab.title)}</strong>
 </button>)}</nav>;
}
