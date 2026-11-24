import {useCallback,useEffect,useRef,useState,type ReactNode} from 'react';
import type {FriendProfile,FriendsResponse,Player} from '@garden/contracts';
import {ApiFailure,duration,key,request,serverNow} from './api';
import {tr} from './i18n';
import {Button,Card,Icon} from './ui';
import {ProfilePortrait} from './GardenerProfile';
import RankingMenu from './RankingMenu';
import {useFriendProfiles} from './FriendProfiles';
import {useActivity} from './Activity';
import './friends.css';
import HubLoading from './HubLoading';
import {usePageSnapshot} from './page-snapshots';

type Tab='list'|'recommend'|'help'|'ranking';
export default function FriendsMenu({player,refresh,notify}:{player:Player;refresh:()=>Promise<void>;notify:(message:string)=>void}){
 const [data,setData]=usePageSnapshot<FriendsResponse>(player.id,'friends');
 const [tab,setTab]=useState<Tab>('list'),[error,setError]=useState(''),[mutationBusy,setBusy]=useState(false),[confirmed,setConfirmed]=useState(''),[loading,setLoading]=useState(false),[,tick]=useState(0);
 const busy=mutationBusy||confirmed!==player.id;
 const [sending,setSending]=useState<string|null>(null);
 const guard=useRef(false),mounted=useRef(true),loadSequence=useRef(0);
 const requestKeys=useRef(new Map<string,string>());
 const {openProfile,revision,changed}=useFriendProfiles(),{updateData}=useActivity();
 const load=useCallback(async()=>{const sequence=++loadSequence.current;setLoading(true);try{const result=await request<FriendsResponse>('/friends');if(mounted.current&&sequence===loadSequence.current){setData(result);setConfirmed(player.id);updateData(data=>({...data,notifications:{...data.notifications,friends:result.incoming.length}}));setError('')}}catch(e){if(mounted.current&&sequence===loadSequence.current)setError(e instanceof Error?e.message:tr('친구를 불러오지 못했어요.'));}finally{if(mounted.current&&sequence===loadSequence.current)setLoading(false);}},[player.id,updateData,setData]);
 useEffect(()=>{mounted.current=true;void load();const timer=setInterval(()=>{tick(n=>n+1);if(document.visibilityState==='visible')void load()},15000);const focus=()=>void load();window.addEventListener('focus',focus);return()=>{mounted.current=false;loadSequence.current++;clearInterval(timer);window.removeEventListener('focus',focus)}},[load,revision]);
 useEffect(()=>{const timer=setInterval(()=>tick(n=>n+1),1000);return()=>clearInterval(timer)},[]);
 async function perform(path:string,body:Record<string,unknown>={},message?:string){if(guard.current||confirmed!==player.id)return;guard.current=true;setBusy(true);setError('');try{await request(path,{key:key(),...body});await refresh();await load();changed();if(message)notify(message);}catch(e){setError(e instanceof Error?e.message:tr('잠시 후 다시 시도해 주세요.'));}finally{guard.current=false;if(mounted.current)setBusy(false);}}
 async function sendFriend(profile:FriendProfile){
  if(guard.current||confirmed!==player.id)return;
  guard.current=true;setBusy(true);setSending(profile.userId);setError('');
  const targetKey=player.id+'/'+profile.userId,idempotencyKey=requestKeys.current.get(targetKey)??key();
  requestKeys.current.set(targetKey,idempotencyKey);
  try{
   const {relation}=await request<{relation:'outgoing'|'friend'}>('/friends/requests',{key:idempotencyKey,userId:profile.userId});
   requestKeys.current.delete(targetKey);
   if(mounted.current){
    // Ignore list reads that started before the server confirmed this request.
    loadSequence.current++;
    const confirmed={...profile,relation};
    const withoutTarget=(entries:FriendProfile[])=>entries.filter(entry=>entry.userId!==profile.userId);
    setData(current=>current?{
     ...current,
     recommendations:withoutTarget(current.recommendations),
     incoming:withoutTarget(current.incoming),
     friends:relation==='friend'?[confirmed,...withoutTarget(current.friends)]:withoutTarget(current.friends),
     outgoing:relation==='outgoing'?[confirmed,...withoutTarget(current.outgoing)]:withoutTarget(current.outgoing),
    }:current);
   }
   // The usual friend and activity refreshes follow without delaying feedback.
   changed();
   notify(relation==='friend'?tr('친구가 되었어요!'):tr('친구 요청을 보냈어요.'));
  }catch(error){
   if(error instanceof ApiFailure&&!['NETWORK','INTERNAL_ERROR'].includes(error.code))requestKeys.current.delete(targetKey);
   if(mounted.current)setError(error instanceof Error?error.message:tr('친구 요청을 보내지 못했어요.'));
  }finally{
   guard.current=false;
   if(mounted.current){setBusy(false);setSending(null);}
  }
 }
 function person(p:FriendProfile,actions?:ReactNode){return <li key={p.userId} className="friend-person" data-frame="card_ice_v9" data-content-group><button className="friend-person-profile" onClick={()=>openProfile(p.userId)} aria-label={p.nickname+' '+tr('프로필 보기')}><ProfilePortrait appearance={p.profileAppearance} size={48}/><span><strong>{p.nickname}</strong><small>{tr('레벨')} {p.level}{p.guildName?' · '+p.guildName:''}</small></span></button><div className="friend-person-actions">{actions??<span className="friend-connected"><Icon id="guild" size={25}/>{tr('친구')}</span>}</div></li>}
 return <div className="friends-menu">
  <div className="friend-tabs" role="tablist" aria-label={tr('친구 메뉴')}>{([['list','lumi','친구'],['recommend','telescope','추천'],['help','heart','하트'],['ranking','ranking_trophy_v51','랭킹']] as const).map(([id,icon,label])=><button key={id} role="tab" aria-selected={tab===id} aria-controls="friend-tab-panel" data-frame={tab===id?'button_secondary':'card_ice_v9'} data-frame-scale="0.1" onClick={()=>setTab(id)}><Icon id={icon} size={32}/><span>{tr(label)}{id==='list'&&!!data?.incoming.length&&<b>{data.incoming.length}</b>}</span></button>)}</div>
  {error&&!!data&&<Card><p role="alert">{error}</p><Button secondary onClick={()=>void load()}>{tr('다시 불러오기')}</Button></Card>}
  <section id="friend-tab-panel" role="tabpanel" aria-label={tr(({list:'친구 목록',recommend:'친구 추천',help:'하트 도움',ranking:'친구 랭킹'})[tab])}>
  {!data?<HubLoading reducedMotion={player.settings.reducedMotion} kind="friends" error={error} retrying={loading} onRetry={()=>void load()}/>:tab==='ranking'?<RankingMenu key={revision} player={player} friendsOnly/>:tab==='list'?<>
   {!!data.incoming.length&&<><h3>{tr('받은 친구 요청')} <span>{data.incoming.length}</span></h3><ul className="friend-list">{data.incoming.map(p=>person(p,<><Button tone="green" disabled={busy} onClick={()=>void perform('/friends/respond',{userId:p.userId,accept:true},tr('친구가 되었어요!'))}>{tr('수락')}</Button><Button secondary disabled={busy} onClick={()=>void perform('/friends/respond',{userId:p.userId,accept:false})}>{tr('거절')}</Button></>))}</ul></>}
   <h3>{tr('내 친구')} <span>{data.friends.length}</span></h3>{data.friends.length?<ul className="friend-list">{data.friends.map(p=>person(p))}</ul>:<Card className="friend-empty" tone="gold"><div className="friend-empty-message"><Icon id="lumi_happy" size={94}/><div><h3>{tr('함께할 친구를 만나보세요')}</h3><p>{tr('친구와 하트를 나누고 순위를 비교해요.')}</p></div></div><Button icon="telescope" onClick={()=>setTab('recommend')}>{tr('친구 추천 보기')}</Button></Card>}
  </>:tab==='recommend'?<>
   <h3>{tr('친구 추천')}</h3><p className="friend-note">{tr('같은 길드와 비슷한 레벨의 정원사를 추천해요.')}</p>
   <ul className="friend-list">{data.recommendations.map(p=>person(p,sending===p.userId?
    <span className="friend-request-status" role="status"><span>{tr('보내는 중…')}</span></span>:
    <Button tone="green" icon="guild" disabled={busy} onClick={()=>void sendFriend(p)}>{tr('추가')}</Button>))}</ul>
   {!data.recommendations.length&&<Card><p>{tr('새로운 친구를 기다리고 있어요.')}</p></Card>}
   {!!data.outgoing.length&&<><h3>{tr('보낸 친구 요청')}</h3><ul className="friend-list">{data.outgoing.map(p=>person(p,<span className="friend-request-status"><span>{tr('요청 중')}</span></span>))}</ul></>}
  </>:<>
   <Card className="friend-heart-hero" tone="gold"><Icon id="heart" size={78}/><div><h3>{tr('하트를 나누면 더 즐거워요')}</h3><p>{tr('내 하트는 줄어들지 않아요.')}</p></div><Button icon="heart" tone="green" disabled={busy||!data.friends.length||data.heartNextAt>serverNow()||data.storedHearts>=20} onClick={()=>void perform('/friends/hearts/request',{},tr('친구들에게 하트를 요청했어요.'))}>{data.heartNextAt>serverNow()?tr('다음 요청')+' '+duration(data.heartNextAt-serverNow()):tr('친구에게 하트 요청')}</Button>{data.myRequest&&<p>{tr('받은 도움')} {data.myRequest.received} / {data.myRequest.maximum}</p>}<small>{tr('4시간마다 요청 · 요청당 최대 5개')}<br/>{tr('오늘 보낸 하트')} {data.heartsSent}/10 · {tr('받은 하트')} {data.heartsReceived}/10</small></Card>
   <h3>{tr('친구의 하트 요청')}</h3>{data.heartRequests.length?<ul className="friend-list">{data.heartRequests.map(r=><li key={r.id} className="friend-person" data-frame="card_ice_v9" data-content-group><button className="friend-person-profile" onClick={()=>openProfile(r.userId)} aria-label={r.nickname+' '+tr('프로필 보기')}><Icon id="heart" size={43}/><span><strong>{r.nickname}</strong><small>{tr('받은 도움')} {r.received}/{r.maximum}</small></span></button><div className="friend-person-actions"><Button icon="heart" disabled={busy||r.helped||data.heartsSent>=10||r.expiresAt<=serverNow()} onClick={()=>void perform('/friends/hearts/'+r.id+'/help',{},tr('친구에게 하트를 보냈어요!'))}>{r.helped?tr('도움 완료'):tr('돕기')}</Button></div></li>)}</ul>:<Card><p>{tr('지금 도움이 필요한 친구가 없어요.')}</p></Card>}
   <h3>{tr('친구가 보낸 하트')}</h3>{data.gifts.length?<ul className="friend-list">{data.gifts.map(g=><li key={g.id} className="friend-person" data-frame="card_peach_v9" data-content-group><Icon id="heart" size={45}/><span className="friend-gift-copy"><strong>{g.senderName}</strong><small>{tr('하트')} +{g.quantity}</small></span><div className="friend-person-actions"><Button disabled={busy||player.hearts>=5} onClick={()=>void perform('/gifts/'+g.id+'/claim',{},tr('하트를 받았어요!'))}>{player.hearts>=5?tr('가득 참'):tr('받기')}</Button></div></li>)}</ul>:<Card><p>{tr('친구가 보낸 하트는 여기에 보관돼요.')}</p></Card>}
  </>}
  </section>
 </div>;
}
