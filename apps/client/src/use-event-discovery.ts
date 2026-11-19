import {useEffect,useState} from 'react';
import {useActivity} from './Activity';
import {useOperations} from './OperationsUI';
import {serverNow} from './api';
import {eventIntroductionIds,readEventDiscovery,markEventDiscoveryRead} from './event-discovery';

/** A visit is acknowledged only after the events page is actually active. */
export function useEventDiscovery(eventsOpen:boolean){
 const {player,data,now}=useActivity(),{data:operations}=useOperations(),userId=player?.id??'';
 const season=data?.player.id===userId?data.eventRewards?.season:null;
 const ids=eventIntroductionIds(player,operations,now||serverNow(),season),signature=JSON.stringify(ids);
 const [read,setRead]=useState(()=>({userId,seen:userId?readEventDiscovery(userId):[]}));
 const seen=read.userId===userId?read.seen:userId?readEventDiscovery(userId):[];
 useEffect(()=>{
  if(eventsOpen&&userId&&ids.length)setRead({userId,seen:markEventDiscoveryRead(userId,ids)});
 },[eventsOpen,userId,signature]);
 useEffect(()=>{
  const refresh=()=>setRead({userId,seen:userId?readEventDiscovery(userId):[]});
  window.addEventListener('storage',refresh);return()=>window.removeEventListener('storage',refresh);
 },[userId]);
 return !eventsOpen&&ids.some(id=>!seen.includes(id));
}
