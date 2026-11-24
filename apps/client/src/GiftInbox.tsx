import {useCallback,useEffect,useRef,useState} from 'react';
import type {Gift,Player} from '@garden/contracts';
import type {OpsEvent} from '../../../packages/contracts/src/operations';
import {request} from './api';
import {tr,formatLocale} from './i18n';
import {useActivity} from './Activity';
import {useOperations} from './OperationsUI';
import {claimEventRewardBatch,hasEventReward} from './event-reward-claims';
import {Button,Card,Icon,Row,Amount,names} from './ui';
import {homeIcon} from './home-icon-art';
import './gift-inbox.css';

interface Props {
 player:Player;
 mutate:(path:string,body?:Record<string,unknown>,method?:string)=>Promise<unknown>;
 onPage:(page:string)=>void;
}

/** Both inbox sources use their original authoritative claim endpoint and receipt. */
export default function GiftInbox({player,mutate,onPage}:Props){
 const operations=useOperations(),activity=useActivity();
 const [gifts,setGifts]=useState<Gift[]>([]),[loaded,setLoaded]=useState(false);
 const [loadError,setLoadError]=useState(''),[claimError,setClaimError]=useState(''),[working,setWorking]=useState('');
 const alive=useRef(true),owner=useRef(player.id),sequence=useRef(0),claiming=useRef(false);owner.current=player.id;
 const installGifts=useCallback((next:Gift[])=>{
  setGifts(next);setLoaded(true);setLoadError('');
  activity.updateData(data=>({...data,giftCounts:{hearts:next.filter(g=>g.quantity>0&&g.kind==='heart').length,items:next.filter(g=>g.quantity>0&&g.kind!=='heart').length}}));
 },[activity.updateData]);
 const loadGifts=useCallback(async()=>{
  const id=player.id,read=++sequence.current;
  try{const result=await request<{gifts:Gift[]}>('/gifts');if(alive.current&&owner.current===id&&read===sequence.current)installGifts(result.gifts);}
  catch(error){if(alive.current&&owner.current===id&&read===sequence.current)setLoadError(error instanceof Error?error.message:tr('연결을 확인해 주세요.'));}
 },[player.id,installGifts]);
 useEffect(()=>{alive.current=true;setGifts([]);setLoaded(false);setLoadError('');setClaimError('');setWorking('');claiming.current=false;void loadGifts();return()=>{alive.current=false;sequence.current++;};},[loadGifts]);
 const events=operations.data?.events.filter(event=>event.kind==='reward'&&!event.claimed&&hasEventReward(event))??[];
 async function claim(gift:Gift|OpsEvent,source:'gift'|'event'){
  if(claiming.current)return;claiming.current=true;const id=player.id;setWorking(source+':'+gift.id);setClaimError('');
  try{
   if(source==='event')await claimEventRewardBatch([gift as OpsEvent],eventId=>mutate('/operations/events/'+eventId+'/claim',{}),eventId=>{if(alive.current&&owner.current===id)operations.markEventClaimed(eventId);});
   else{
    const result=await mutate('/gifts/'+gift.id+'/claim') as {gifts?:Gift[]};
    if(alive.current&&owner.current===id&&Array.isArray(result?.gifts))installGifts(result.gifts);
   }
   if(alive.current&&owner.current===id)await loadGifts();
  }catch(error){if(alive.current&&owner.current===id)setClaimError(error instanceof Error?error.message:tr('연결을 확인해 주세요.'));}
  finally{if(alive.current&&owner.current===id){operations.refresh();setWorking('');claiming.current=false;}}
 }
 const waiting=!loaded||!operations.data;
 return <div className="gift-inbox">
  <p className="intro">{tr('마음을 담은 정원 우편함')}</p>
  {claimError&&<p className="fine" role="alert">{claimError}</p>}
  {loadError&&<Card tone="blue"><p className="fine" role="alert">{loadError}</p><Button secondary disabled={!!working} onClick={()=>void loadGifts()}>{tr('다시 불러오기')}</Button></Card>}
  {waiting&&!loadError&&<p className="fine" role="status">{tr('선물을 불러오는 중…')}</p>}
  {events.map(event=><Card key={'event:'+event.id} tone="blue" title={event.title}>
   {event.imageUrl&&<img className="operations-event-image" src={event.imageUrl} alt=""/>}
   {event.description&&<p className="operations-notice-body">{event.description}</p>}
   <div className="operations-rewards">
    {event.reward.coins>0&&<Amount kind="coin" value={event.reward.coins}/>}
    {event.reward.stars>0&&<Amount kind="star" value={event.reward.stars}/>}
    {event.reward.hearts>0&&<Amount kind="heart" value={event.reward.hearts}/>}
    {Object.entries(event.reward.items).map(([item,count])=><span key={item}><Icon id={item} size={28}/>{names[item]??item} +{count}</span>)}
   </div>
   <p className="fine"><time dateTime={new Date(event.endsAt).toISOString()}>{new Date(event.endsAt).toLocaleString(formatLocale())}</time>{tr('까지')}</p>
   <Button attention={1} disabled={!!working} onClick={()=>void claim(event,'event')}>{working==='event:'+event.id?tr('받는 중…'):tr('받기')}</Button>
  </Card>)}
  {gifts.map(gift=><Row key={'gift:'+gift.id} icon={gift.kind==='heart'?'heart':gift.kind} title={tr('{0}님의 {1} {2}개',{0:gift.senderName,1:gift.kind==='heart'?tr('하트'):names[gift.kind],2:gift.quantity})}>
   <Button attention={gift.kind!=='heart'||player.hearts<5?1:0} disabled={!!working||gift.kind==='heart'&&player.hearts>=5} onClick={()=>void claim(gift,'gift')}>{working==='gift:'+gift.id?tr('받는 중…'):tr('받기')}</Button>
  </Row>)}
  {!waiting&&!loadError&&!events.length&&!gifts.length&&<Card className="empty"><Icon id={homeIcon('mailbox','mail')} size={100}/><p>{tr('아직 도착한 선물이 없어요.')}</p><Button secondary onClick={()=>onPage('guild')}>{tr('길드에서 도움 나누기')}</Button></Card>}
  <p className="fine">{tr('가득 찬 하트는 우편함에 안전하게 보관돼요.')}</p>
 </div>;
}
