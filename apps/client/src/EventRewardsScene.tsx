import type {OpsEvent,OpsReward} from '../../../packages/contracts/src/operations';
import {Button,Icon,names} from './ui';
import {tr,formatLocale} from './i18n';
import {eventDesignArt} from './event-design-art';
import {collectedEventRewards,hasEventReward} from './event-reward-claims';
import './event-extras-v71.css';
import {refinedEventArt} from './event-refinement-art';
import './event-refinement-v74.css';
function RewardIcons({reward}:{reward:OpsReward}){
 const rewards=[{id:'coin',count:reward.coins},{id:'star',count:reward.stars},{id:'heart',count:reward.hearts},...Object.entries(reward.items).map(([id,count])=>({id,count}))].filter(value=>value.count>0);
 return <div className="mail-scene-rewards">{rewards.map(({id,count})=><span key={id} aria-label={(id==='coin'?tr('코인'):id==='star'?tr('별'):id==='heart'?tr('하트'):names[id]??id)+' ×'+count}><Icon id={id}/><strong>×{count.toLocaleString(formatLocale())}</strong></span>)}</div>;
}
export default function EventRewardsScene({events,loading,working,error,onClaim,onClaimAll}:{events:OpsEvent[];loading:boolean;working:string;error:string;onClaim:(id:string)=>void;onClaimAll:()=>void}){
 const claimable=events.filter(event=>!event.claimed&&hasEventReward(event)),collected=collectedEventRewards(events),received=events.some(event=>event.claimed);
 return <section className="mail-scene-v71" aria-label={tr('이벤트 보상')} aria-busy={!!working}>
  <img className="mail-scene-art" src={eventDesignArt.mailboxScene} alt="" draggable={false}/>
  <header className="mail-scene-heading"><h2>{tr('받을 수 있는 선물')}</h2></header>
  {error&&<p className="mail-scene-error" role="alert">{error}</p>}
  <div className="mail-scene-list" data-count={events.length}>
   {loading?<p className="mail-scene-empty" role="status">{tr('선물을 확인하고 있어요.')}</p>:events.length?events.map((event,index)=><article key={event.id} className="mail-scene-postcard" data-claimed={!!event.claimed}>
    <img className="mail-scene-envelope" src={event.imageUrl||refinedEventArt.envelopes[index%3]} alt=""/>
    <div className="mail-scene-copy"><h3>{event.title}</h3>{event.description&&<p>{event.description}</p>}<RewardIcons reward={event.reward}/><small>{tr('{0}까지',{0:new Date(event.endsAt).toLocaleDateString(formatLocale(),{month:'numeric',day:'numeric'})})}</small></div>
    <Button tone="green" className="mail-scene-claim" disabled={!!working||!!event.claimed||!hasEventReward(event)} onClick={()=>onClaim(event.id)}>{tr(event.claimed?'수령 완료':working===event.id?'받는 중…':'받기')}</Button>
   </article>):<div className="mail-scene-empty"><Icon id="mail"/><p>{tr('진행 중인 보상 이벤트가 없어요.')}</p></div>}
  </div>
  <section className="mail-scene-summary" aria-label={tr('받은 보상')}><img className="mail-summary-art" src={refinedEventArt.mailSummary} alt=""/><h3>{tr('받은 보상')}</h3>{received?<RewardIcons reward={collected}/>:<p>{tr('선물을 받으면 여기에 모여요.')}</p>}<Button tone="green" disabled={!!working||!claimable.length} onClick={onClaimAll}>{tr(working==='all'?'받는 중…':'모두 받기')}</Button></section>
 </section>;
}
