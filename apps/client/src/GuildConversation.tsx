import {useEffect,useLayoutEffect,useRef,useState} from 'react';
import type {ChatMessage,GuildMember} from '@garden/contracts';
import {tr,formatLocale} from './i18n';
import {Button,Card,Icon} from './ui';
import {ProfilePortrait} from './GardenerProfile';
import inviteTicket from '../../../packages/assets/garden-invite-v117/runtime/invite-icon.webp';

interface Props {
 messages:ChatMessage[];members:GuildMember[];playerId:string;text:string;working:boolean;
 onText:(value:string)=>void;onSend:()=>void;onProfile:(id:string)=>void;onVisit:(id:string)=>void;
 onGifts:()=>void;onBlock:(id:string)=>void;onReport:(id:string)=>void;
}

export default function GuildConversation(p:Props){
 const list=useRef<HTMLDivElement>(null),follow=useRef(true);
 const [unread,setUnread]=useState(false);
 const last=p.messages.at(-1)?.id;
 const bottom=()=>{if(list.current)list.current.scrollTop=list.current.scrollHeight;follow.current=true;setUnread(false);};
 useLayoutEffect(()=>{
  if(follow.current)bottom();else setUnread(true);
 },[last]);
 useEffect(()=>{
  const el=list.current;if(!el)return;
  const observer=new ResizeObserver(()=>{if(follow.current)bottom();});
  observer.observe(el);return()=>observer.disconnect();
 },[]);
 return <Card className="guild-chat-panel" tone="blue">
  <div className="guild-chat-toolbar"><h3>{tr('길드 대화')}</h3><Button secondary icon="chest" onClick={p.onGifts}>{tr('선물함 열기')}</Button></div>
  <div ref={list} className="chat-list" role="log" aria-label={tr('길드 대화')} aria-live="polite" aria-relevant="additions text" onScroll={()=>{
   const el=list.current;if(!el)return;follow.current=el.scrollHeight-el.scrollTop-el.clientHeight<48;if(follow.current)setUnread(false);
  }}>
   {p.messages.length?p.messages.map(message=>{
    const own=message.userId===p.playerId;
    return <div className="chat-message" key={message.id} data-own={own||undefined}>
     <button className="guild-chat-avatar" onClick={()=>p.onProfile(message.userId)} aria-label={message.nickname+' '+tr('프로필 보기')}><ProfilePortrait appearance={p.members.find(member=>member.userId===message.userId)?.profileAppearance} size={36}/></button>
     <div className="guild-chat-copy">
      <div className="guild-message-heading"><button className="guild-profile-link" onClick={()=>p.onProfile(message.userId)}>{message.nickname}</button><time dateTime={new Date(message.createdAt).toISOString()}>{new Date(message.createdAt).toLocaleTimeString(formatLocale(),{hour:'2-digit',minute:'2-digit'})}</time>
       {!own&&<details className="guild-message-actions"><summary aria-label={message.nickname+' '+tr('더 보기')}>···</summary><div><button disabled={p.working} onClick={()=>p.onBlock(message.userId)}>{tr('차단')}</button><button disabled={p.working} onClick={()=>p.onReport(message.id)}>{tr('신고')}</button></div></details>}
      </div>
      {message.gardenInvite?<div className="garden-chat-invitation"><img src={inviteTicket} alt=""/><span>{tr('내 정원에 놀러 와!')}</span><Button tone="green" onClick={()=>p.onVisit(message.gardenInvite!.ownerId)}>{tr('정원 방문')}</Button></div>:<p>{message.text}</p>}
     </div>
    </div>;
   }):<div className="guild-chat-empty"><Icon id="mail" size={54}/><p className="fine">{tr('길드원에게 첫 인사를 건네보세요.')}</p></div>}
  </div>
  {unread&&<button className="guild-chat-new" onClick={bottom}>{tr('새 메시지')} ↓</button>}
  <div className="chat-composer"><div className="input-frame" data-frame="panel"><input value={p.text} onChange={event=>p.onText(event.target.value)} placeholder={tr('따뜻한 한마디를 남겨주세요')} maxLength={240} aria-label={tr('길드 채팅')} onKeyDown={event=>{if(event.key==='Enter'&&!event.nativeEvent.isComposing&&!p.working)p.onSend();}}/></div><Button icon="mail" tone="green" disabled={p.working||!p.text.trim()} onClick={p.onSend}><span className="sr-only">{tr('보내기')}</span></Button></div>
 </Card>;
}
