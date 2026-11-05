import {tr,formatLocale} from "./i18n";
import { useEffect, useRef, useState } from 'react';
import type { Booster, ChatMessage, Guild, GuildMember, Player, SupportRequest, PassClaimAllResponse } from '@garden/contracts';
import { duration, request, serverNow } from './api';
import {guildSocketUrl} from './api-endpoint';
import { Button, Icon, Row, Card, Amount, Poster, LinkAction, names } from './ui';
import PassActions from './PassActions';
import type {AttendanceState} from './AttendancePanel';
import EventsContent from './EventsContent';
import {useFriendProfiles} from './FriendProfiles';

type Mutate = (path:string,body?:Record<string,unknown>,method?:string)=>Promise<unknown>;
interface Props { page:string; player:Player; mutate:Mutate; refresh:()=>Promise<void>; notify:(message:string)=>void; onPage:(page:string)=>void }
interface EventProgress { progress:number; target:number; coins:number; claimed:boolean }
interface PassTier { tier:number; points:number; free:{coins:number}; premium:{coins:number;hammer:number;decoration:{id:string;name:string;asset:string}|null;guildGift:{item:'hammer';quantityPerMember:number}|null}; freeClaimed:boolean; premiumClaimed:boolean }
interface EventState {
  dailyClaimed:boolean;
  attendance?:AttendanceState;
  daily:{available:boolean;coins:number;nextReset:number};
  season:{id:string;starts_at:number;ends_at:number}|null;
  pass:{points:number;premium:boolean;tiers:PassTier[];guildGifts:Array<{seasonId:string;item:'hammer';quantityPerMember:number;sent:boolean}>};
  personal:EventProgress;
  guild:EventProgress;
}
interface SupportStatus { heartNextAt:number;itemNextAt:number;heartsSent:number;heartsReceived:number;itemsSent:number;itemsReceived:number;storedHearts:number;nextReset:number }
interface GuildView {
  guild:(Guild & {notice:string})|null;
  members:GuildMember[];
  requests:Array<SupportRequest & {helped:boolean}>;
  messages:ChatMessage[];
  applications:Array<{userId:string;nickname:string;level:number}>;
  supportStatus?:SupportStatus;
}
const boosters:Booster[]=['hammer','sweep-row','sweep-column','shuffle'];
const emblems=[{icon:'guild',label:'함께'},{icon:'tile_flower',label:'보라 블록'},{icon:'tile_sprout',label:'초록 블록'},{icon:'tile_drop',label:'파랑 블록'},{icon:'tile_sun',label:'노랑 블록'},{icon:'tile_acorn',label:'주황 블록'},{icon:'star',label:'별'},{icon:'heart',label:'하트'}];
const roleNames:Record<GuildMember['role'],string>={leader:'길드장',officer:'운영진',member:'멤버'};
function emblemIcon(value:number){return emblems[value]?.icon??'guild';}
function EmblemPicker({value,onChange,disabled}:{value:number;onChange:(value:number)=>void;disabled:boolean}){
 return <div className="emblem-picker" role="group" aria-label={tr("길드 문장 선택")}>{emblems.map((item,index)=><button key={item.label} className="emblem-choice" data-frame={value===index?'card_green_v4':'card_blue_v4'} aria-label={`${tr(item.label)}${value===index?tr(" · 선택"):''}`} aria-pressed={value===index} disabled={disabled} onClick={()=>onChange(index)}><Icon id={item.icon} size={32}/><small>{tr(item.label)}</small>{value===index&&<b aria-hidden="true">✓</b>}</button>)}</div>;
}

export default function CommunityMenus({page,player,mutate,refresh,notify,onPage}:Props){
  const {openProfile}=useFriendProfiles();
  const [events,setEvents]=useState<EventState|null>(null);
  const [loadError,setLoadError]=useState('');
  const [working,setWorking]=useState(false);
  const busy=useRef(false);
  const [guilds,setGuilds]=useState<Guild[]>([]);
  const [view,setView]=useState<GuildView|null>(null);
  const [search,setSearch]=useState('');
  const [guildName,setGuildName]=useState('');
  const [description,setDescription]=useState('');
  const [notice,setNotice]=useState('');
  const [mode,setMode]=useState<'open'|'approval'>('open');
  const [minLevel,setMinLevel]=useState('5');
  const [emblem,setEmblem]=useState(0);
  const [chatText,setChatText]=useState('');
  const [tab,setTab]=useState<'chat'|'help'|'members'|'manage'>('chat');
  const [pendingJoins,setPendingJoins]=useState<string[]>([]);
  const [confirmation,setConfirmation]=useState<{kind:'transfer'|'kick'|'leave';member?:GuildMember}|null>(null);
  const [,tick]=useState(0);
  const validMinimum=Number.isInteger(Number(minLevel))&&Number(minLevel)>=5&&Number(minLevel)<=10000;
  const ownRole=view?.members.find(m=>m.userId===player.id)?.role;
  const manages=ownRole==='leader'||ownRole==='officer';

  async function perform(fn:()=>Promise<unknown>){
    if(busy.current)return;busy.current=true;setWorking(true);
    try{await fn();}catch(error){notify(error instanceof Error?error.message:tr("잠시 후 다시 시도해 주세요."));}
    finally{busy.current=false;setWorking(false);}
  }
  async function loadEvents(){try{setEvents(await request<EventState>('/events'));setLoadError('');}catch(error){setLoadError(error instanceof Error?error.message:tr("연결을 확인해 주세요."));throw error;}}
  async function loadView(){const next=await request<GuildView>('/guild');setView(next);setLoadError('');if(!next.guild&&player.guildId)await refresh();}
  async function loadSearch(){const result=await request<{guilds:Guild[];pendingIds:string[]}>('/guilds?q='+encodeURIComponent(search));setGuilds(result.guilds);setPendingJoins(result.pendingIds);setLoadError('');}
  useEffect(()=>{
    setLoadError('');setConfirmation(null);
    if(page==='events'||page==='pass')void loadEvents().catch(()=>{});
    if(page==='guild'&&player.level>=5)void (player.guildId?loadView():loadSearch()).catch(error=>setLoadError(error instanceof Error?error.message:tr("길드를 불러오지 못했어요.")));
  },[page,player.guildId,player.id]);
  useEffect(()=>{const timer=setInterval(()=>tick(n=>n+1),1000);return()=>clearInterval(timer);},[]);
  useEffect(()=>{if(page!=='guild'||player.guildId||!pendingJoins.length)return;const timer=setInterval(()=>void refresh().catch(()=>{}),5000);return()=>clearInterval(timer);},[page,player.guildId,pendingJoins.length]);
  useEffect(()=>{
    if(page!=='guild'||!player.guildId)return;
    let stopped=false;let fetching=false;let refreshAgain=false;let socket:WebSocket|undefined;
    const seen=new Set<string>();
    const reload=()=>{if(stopped)return;if(fetching){refreshAgain=true;return;}fetching=true;void loadView().catch(()=>{}).finally(()=>{fetching=false;if(refreshAgain){refreshAgain=false;reload();}});};
    const timer=setInterval(reload,5000);
    void request<{ticket:string}>('/guild/socket-ticket',{}).then(({ticket})=>{
      if(stopped)return;
      socket=new WebSocket(guildSocketUrl(ticket,location.href));socket.onmessage=event=>{try{const message=JSON.parse(String(event.data)) as {type?:string;eventId?:string};if(message.type!=='refresh'||!message.eventId||seen.has(message.eventId))return;seen.add(message.eventId);if(seen.size>128)seen.delete(seen.values().next().value!);reload();}catch{/* Unknown transport messages never mutate client state. */}};
    }).catch(()=>{});
    return()=>{stopped=true;clearInterval(timer);socket?.close();};
  },[page,player.guildId,player.id]);

  async function claimEvent(kind:'personal'|'guild'){await mutate('/events/claim',{kind});await loadEvents();notify(tr("정원 활동 보상을 받았어요!"));}
  function openManagement(){
    if(!view?.guild)return;setDescription(view.guild.description);setNotice(view.guild.notice);setMode(view.guild.mode);setMinLevel(String(view.guild.minLevel));setEmblem(view.guild.emblem);setTab('manage');
  }
  async function sendChat(){if(!chatText.trim())return;await mutate('/guild/chat',{text:chatText});setChatText('');await loadView();}
  async function confirmGuildAction(){
    if(!confirmation)return;
    if(confirmation.kind==='leave'){await mutate('/guild/leave');setView(null);await refresh();await loadSearch();}
    else if(confirmation.member){await mutate(confirmation.kind==='transfer'?'/guild/role':'/guild/kick',{userId:confirmation.member.userId,...(confirmation.kind==='transfer'?{role:'leader'}:{})});await loadView();}
    setConfirmation(null);
  }

  if(page==='events'||page==='pass'){
    if(!events)return <div className="empty"><Icon id="chest" size={90}/><p role="status">{loadError||tr("정원 소식을 불러오는 중…")}</p>{loadError&&<Button disabled={working} onClick={()=>void perform(loadEvents)}>{tr("다시 불러오기")}</Button>}</div>;
    const guildGiftPanel=events.pass.guildGifts.length>0&&<><h3>{tr("함께 나누는 패스 선물")}</h3>{events.pass.guildGifts.map(gift=><Row key={gift.seasonId} icon="guild" title={tr("길드 선물권")}><small>{tr("현재 길드원 모두에게 망치")}{' '}{gift.quantityPerMember}{tr("개씩")}</small>{gift.sent?<Button disabled>{tr("선물 전달 완료")}</Button>:player.guildId?<Button disabled={working} onClick={()=>void perform(async()=>{await mutate('/pass/guild-gift',{seasonId:gift.seasonId});await loadEvents();notify(tr("길드원들의 선물함에 망치를 보냈어요!"));})}>{tr("길드원에게 선물 보내기")}</Button>:<Button secondary onClick={()=>onPage('guild')}>{tr("가입 후 선물 보내기")}</Button>}</Row>)}<p className="fine">{tr("선물권은 보관돼요. 보낼 때 같은 길드에 있는 모두의 선물함에 한 번씩 도착해요.")}</p></>;
    if(page==='events')return <EventsContent daily={events.daily} attendance={events.attendance} season={events.season} personal={events.personal} guild={events.guild} hasGuild={!!player.guildId} working={working} onPage={onPage} onClaimSeason={kind=>void perform(()=>claimEvent(kind))} onClaim={()=>void perform(async()=>{await mutate('/events/daily');await loadEvents();notify(tr("출석 선물을 받았어요!"));})}/>;
    if(player.level<5)return <div className="empty"><Icon id="star" size={90}/><h3>{tr("차곡차곡 자라는 정원")}</h3><p>{tr("4판을 완료하면 정원 패스를 확인할 수 있어요.")}<br/>{tr("이미 모은 진행은 그대로 이어져요.")}</p></div>;
    if(!events.season)return <div className="empty"><Icon id="star" size={90}/><h3>{tr("다음 정원 시즌을 준비 중이에요")}</h3><p>{tr("새 시즌이 열리면 여기에서 보상을 확인할 수 있어요.")}</p>{guildGiftPanel}</div>;
    return <>
      <Poster id="poster_gift_v5" className="pass-hero" label={tr("꽃과 보물이 가득한 정원 패스")}><figcaption className="poster-caption" data-frame="event_badge" data-frame-scale="0.1">{events.pass.points}{tr("점")}</figcaption></Poster><p className="intro">{tr("새 레벨 클리어마다 10점")}</p><p className="fine">{tr("시즌 종료")}{' '}{new Date(events.season.ends_at).toLocaleString(formatLocale())}<br/>{events.pass.premium?tr("이번 시즌 프리미엄 보상선 보유"):tr("무료 보상은 누구나 받을 수 있어요.")}</p>
      <PassActions player={player} seasonId={events.season.id} pass={events.pass} working={working} perform={perform} onPage={onPage} onReload={async()=>{await refresh();await loadEvents();}} onClaimAll={()=>void perform(async()=>{const result=await mutate('/pass/claim-all') as PassClaimAllResponse;await loadEvents();notify(result.reason==='CLAIMED'&&result.claimed.length?tr("선물 {0}개를 모두 받았어요!",{0:(result.claimed.length)}):tr("현재 받을 수 있는 선물을 모두 받았어요."));})}/>
      <div className="pass-labels"><span>{tr("무료 선물")}</span><span>{tr("프리미엄 선물")}</span></div>
      {events.pass.tiers.map(tier=><div className="pass-row" role="group" aria-label={tr("{0}단계 보상",{0:(tier.tier)})} key={tier.tier}><strong className="tier-index" data-frame="event_badge" data-frame-scale="0.05">{tier.tier}</strong>{(['free','premium'] as const).map(track=>{
        const claimed=track==='free'?tier.freeClaimed:tier.premiumClaimed;const owned=track==='free'||events.pass.premium;const reached=events.pass.points>=tier.points;const reward=tier[track];const hammer=track==='premium'?tier.premium.hammer:0;
        const label=claimed?tr("수령 완료"):!owned?tr("패스 필요"):!reached?tr("{0}점에 열림",{0:(tier.points)}):tr("받기");
        return <div key={track} className={`reward-card ${track}`} data-frame={track==='free'?'card_green_v4':'card_blue_v4'} data-frame-scale="0.12"><div className="reward-amount"><Icon id="coin" size={24}/><strong>{reward.coins}</strong><span>{tr("코인")}</span></div>{hammer>0&&<small>{tr("망치")}{' '}{hammer}{tr("개")}</small>}{track==='premium'&&tier.premium.decoration&&<small>{tr("프로필 문장")}</small>}{track==='premium'&&tier.premium.guildGift&&<small>{tr("길드 선물권 · 망치")}{' '}{tier.premium.guildGift.quantityPerMember}{tr("개")}</small>}{!claimed&&owned&&reached?<Button attention={1} className="claim-button" tone={track==='premium'?'gold':'green'} icon="chest"  disabled={working||claimed||!owned||!reached} onClick={()=>void perform(async()=>{await mutate('/pass/claim',{tier:tier.tier,track});await loadEvents();notify(tr("{0}단계 선물을 받았어요!",{0:(tier.tier)}));})}>{tr(label)}</Button>:<div className="reward-state"><Icon id={claimed?'star':'close'} size={22}/><small>{tr(label)}</small></div>}</div>;
      })}</div>)}
      {guildGiftPanel}
    </>;
  }

  if(player.level<5)return <div className="empty"><Icon id="guild" size={110}/><h3>{tr("함께 가꾸면 더 즐거워요")}</h3><p>{tr("4판을 완료하면 길드가 열려요.")}</p></div>;
  if(!player.guildId)return <>
    <Card title={tr("친구 길드 찾기")} tone="gold"><p className="intro">{tr("함께 정원을 가꿀 친구를 만나세요")}</p>
    <div className="input-frame" data-frame="panel"><input value={search} onChange={event=>setSearch(event.target.value)} placeholder={tr("길드 이름 검색")} aria-label={tr("길드 검색")} maxLength={24}/></div>
    <Button disabled={working} icon="guild" tone="green" onClick={()=>void perform(loadSearch)}>{tr("길드 찾기")}</Button>
    {loadError&&<p role="status" className="fine">{tr(loadError)}</p>}</Card>
    {guilds.map(g=><Row key={g.id} icon={emblemIcon(g.emblem)} title={g.name}><small>{g.members}{tr("/30 · 레벨")}{' '}{g.minLevel}+</small><Button disabled={working||g.members>=30||player.level<g.minLevel||pendingJoins.includes(g.id)} onClick={()=>void perform(async()=>{await mutate(`/guilds/${g.id}/join`);if(g.mode==='approval'){setPendingJoins(ids=>[...new Set([...ids,g.id])]);notify(tr("가입 승인을 요청했어요."));}else{await loadView();await refresh();notify(tr("길드에 오신 것을 환영해요!"));}})}>{pendingJoins.includes(g.id)?tr("승인 대기"):g.members>=30?tr("인원 가득"):player.level<g.minLevel?tr("레벨 부족"):g.mode==='approval'?tr("가입 신청"):tr("가입")}</Button></Row>)}
    {!guilds.length&&!loadError&&<p className="fine">{tr("찾는 길드가 없다면 새로운 정원을 열어보세요.")}</p>}
    <Card title={tr("새 길드 만들기")} tone="green"><label htmlFor="guild-name">{tr("길드 이름")}</label>
    <div className="input-frame" data-frame="panel"><input id="guild-name" value={guildName} onChange={event=>setGuildName(event.target.value)} placeholder={tr("길드 이름")} maxLength={24}/></div>
    <label htmlFor="guild-description">{tr("길드 소개")}</label><div className="input-frame" data-frame="panel"><textarea id="guild-description" value={description} onChange={event=>setDescription(event.target.value)} placeholder={tr("어떤 정원을 가꾸고 싶나요?")} maxLength={160}/></div>
    <label htmlFor="guild-mode">{tr("가입 방법")}</label><div className="input-frame" data-frame="panel"><select id="guild-mode" value={mode} onChange={event=>setMode(event.target.value as typeof mode)}><option value="open">누구나 가입</option><option value="approval">승인 후 가입</option></select></div>
    <label htmlFor="guild-minimum">{tr("최소 레벨 · 5 이상")}</label><div className="input-frame" data-frame="panel"><input id="guild-minimum" type="number" inputMode="numeric" min={5} max={10000} value={minLevel} onChange={event=>setMinLevel(event.target.value)}/></div>
    <p className="fine">{tr("길드를 나타낼 문장을 골라주세요.")}</p><EmblemPicker value={emblem} onChange={setEmblem} disabled={working}/>
    <Button disabled={working||guildName.trim().length<2||!validMinimum} onClick={()=>void perform(async()=>{await mutate('/guilds',{name:guildName,description,mode,emblem,minLevel:Number(minLevel)});setGuildName('');await loadView();await refresh();})}>{tr("길드 만들기")}</Button></Card>
  </>;
  if(!view?.guild)return <div className="empty"><Icon id="guild" size={80}/><p role="status">{loadError||tr("길드 정원을 불러오는 중…")}</p>{loadError&&<Button onClick={()=>void perform(loadView)}>{tr("다시 불러오기")}</Button>}</div>;
  const support=view.supportStatus;
  const tabs:Array<['chat'|'help'|'members'|'manage',string]>=[['chat',tr("대화")],['help',tr("도움")],['members',tr("멤버")],...(manages?[['manage',tr("관리")] as ['manage',string]]:[])];
  return <>
    <Card tone="gold"><div className="guild-title"><Icon id={emblemIcon(view.guild.emblem)} size={58}/><div><h3>{view.guild.name}</h3><p>{view.guild.description}</p><small>{view.members.length}{tr("/30 · 최소 레벨")}{' '}{view.guild.minLevel}</small></div></div></Card>
    {view.guild.notice&&<Row icon="mail" title={tr("길드 공지")}><p className="fine">{view.guild.notice}</p></Row>}
    <div className="tabs">{tabs.map(([id,label])=><Button tone={tab===id?'green':'gold'} icon={id==='chat'?'mail':id==='help'?'heart':id==='members'?'lumi':'settings'} key={id} onClick={()=>id==='manage'?openManagement():setTab(id)}>{tr(label)}</Button>)}</div>
    {tab==='chat'?<Card title={tr("길드 대화")} tone="blue">
      <div className="chat-list">{view.messages.length?view.messages.map(message=><div className="chat-message" key={message.id} data-frame={message.userId===player.id?'card_green_v4':'card_gold_v4'}><button className="guild-profile-link" onClick={()=>openProfile(message.userId)} aria-label={message.nickname+' '+tr("프로필 보기")}>{message.nickname}</button><p>{message.text}</p>{message.userId!==player.id&&<small><button onClick={()=>void perform(async()=>{await mutate('/guild/block',{userId:message.userId});await loadView();})}>{tr("차단")}</button> · <button onClick={()=>void perform(async()=>{await mutate('/guild/report',{messageId:message.id,reason:tr("사용자 신고")});notify(tr("신고를 접수했어요."));})}>{tr("신고")}</button></small>}</div>):<p className="fine">{tr("길드원에게 첫 인사를 건네보세요.")}</p>}</div>
      <div className="chat-composer"><div className="input-frame" data-frame="panel"><input value={chatText} onChange={event=>setChatText(event.target.value)} placeholder={tr("따뜻한 한마디를 남겨주세요")} maxLength={240} aria-label={tr("길드 채팅")} onKeyDown={event=>{if(event.key==='Enter'&&!event.nativeEvent.isComposing)void perform(sendChat);}}/></div><Button icon="mail" tone="green" disabled={working||!chatText.trim()} onClick={()=>void perform(sendChat)}><span className="sr-only">{tr("보내기")}</span></Button></div>
    </Card>:tab==='help'?<Card title={tr("도움 나누기")} tone="green">
      <Button disabled={working||(support?.heartNextAt??0)>serverNow()||(support?.storedHearts??0)>=20} icon="heart" onClick={()=>void perform(async()=>{await mutate('/guild/requests',{kind:'heart'});await loadView();})}>{support&&support.heartNextAt>serverNow()?tr("다음 요청 {0}",{0:(duration(support.heartNextAt-serverNow()))}):tr("하트 도움 요청")}</Button>
      <p className="fine">{tr("오늘 하트 지원")}{' '}{support?.heartsSent??0}{tr("/10 · 수신")}{' '}{support?.heartsReceived??0}/10<br/>{tr("보관한 길드 하트")}{' '}{support?.storedHearts??0}/20</p>
      {boosters.map(item=><Row key={item} icon={item} title={names[item]}><small>{tr("보유")}{' '}{player.inventory[item].normal+player.inventory[item].bound}{' '}{tr("· 지원 가능")}{' '}{player.inventory[item].normal}</small><Button secondary disabled={working||(support?.itemNextAt??0)>serverNow()} onClick={()=>void perform(async()=>{await mutate('/guild/requests',{kind:item});await loadView();})}>{tr("요청")}</Button></Row>)}
      <p className="fine">{tr("오늘 아이템 지원")}{' '}{support?.itemsSent??0}{tr("/3 · 수신")}{' '}{support?.itemsReceived??0}/3{support&&support.itemNextAt>serverNow()&&<><br/>{tr("다음 아이템 요청")}{' '}{duration(support.itemNextAt-serverNow())}</>}</p>
      <h3>{tr("길드원이 기다리는 도움")}</h3>{view.requests.length?view.requests.map(r=><Row key={r.id} icon={r.kind==='heart'?'heart':r.kind} title={`${r.nickname} · ${r.received}/${r.maximum}`}><small>{r.kind==='heart'?tr("하트"):names[r.kind]} · {duration(r.expiresAt-serverNow())}</small><Button disabled={working||r.userId===player.id||r.helped||r.received>=r.maximum||(r.kind==='heart'?(support?.heartsSent??0)>=10:(support?.itemsSent??0)>=3||player.inventory[r.kind].normal===0)} onClick={()=>void perform(async()=>{await mutate(`/guild/requests/${r.id}/help`);await loadView();notify(tr("도움을 보냈어요!"));})}>{r.userId===player.id?tr("내 요청"):r.helped?tr("도움 완료"):tr("도와주기")}</Button></Row>):<p className="fine">{tr("아직 기다리는 요청이 없어요.")}</p>}
    </Card>:tab==='manage'&&manages?<Card title={tr("우리 길드 관리")} tone="green">
      <label htmlFor="guild-notice">{tr("길드 공지")}</label><div className="input-frame" data-frame="panel"><textarea id="guild-notice" value={notice} maxLength={240} onChange={event=>setNotice(event.target.value)}/></div>
      <label htmlFor="edit-guild-description">{tr("소개")}</label><div className="input-frame" data-frame="panel"><textarea id="edit-guild-description" value={description} maxLength={160} onChange={event=>setDescription(event.target.value)}/></div>
      <label htmlFor="edit-guild-mode">{tr("가입 방법")}</label><div className="input-frame" data-frame="panel"><select id="edit-guild-mode" value={mode} onChange={event=>setMode(event.target.value as typeof mode)}><option value="open">누구나 가입</option><option value="approval">승인 후 가입</option></select></div>
      <label htmlFor="edit-guild-minimum">{tr("최소 레벨")}</label><div className="input-frame" data-frame="panel"><input id="edit-guild-minimum" type="number" inputMode="numeric" min={5} max={10000} value={minLevel} onChange={event=>setMinLevel(event.target.value)}/></div>
      <EmblemPicker value={emblem} onChange={setEmblem} disabled={working}/><Button disabled={working||!validMinimum} onClick={()=>void perform(async()=>{await mutate('/guild',{notice,description,mode,minLevel:Number(minLevel),emblem},'PATCH');await loadView();notify(tr("길드 정보를 저장했어요."));})}>{tr("길드 정보 저장")}</Button>
      <h3>{tr("가입 신청")}</h3>{view.applications.length?view.applications.map(applicant=><Row key={applicant.userId} onProfile={()=>openProfile(applicant.userId)} icon="lumi" title={tr("{0} · 레벨 {1}",{0:(applicant.nickname),1:(applicant.level)})}><Button disabled={working||view.members.length>=30} onClick={()=>void perform(async()=>{await mutate('/guild/approve',{userId:applicant.userId});await loadView();})}>{tr("가입 승인")}</Button></Row>):<p className="fine">{tr("대기 중인 가입 신청이 없어요.")}</p>}
    </Card>:<>
      {view.members.map(member=><Row key={member.userId} onProfile={()=>openProfile(member.userId)} icon="lumi" title={`${member.nickname} · ${tr(roleNames[member.role])}`}><small>{tr("레벨")}{' '}{member.level}{' '}{tr("· 도움")}{' '}{member.contribution}</small>{ownRole==='leader'&&member.userId!==player.id&&<><Button secondary disabled={working} onClick={()=>void perform(async()=>{await mutate('/guild/role',{userId:member.userId,role:member.role==='officer'?'member':'officer'});await loadView();})}>{member.role==='officer'?tr("일반 멤버로"):tr("운영진 임명")}</Button><Button secondary disabled={working} onClick={()=>setConfirmation({kind:'transfer',member})}>{tr("길드장 위임")}</Button></>}{manages&&member.userId!==player.id&&member.role!=='leader'&&(ownRole==='leader'||member.role==='member')&&<Button secondary disabled={working} onClick={()=>setConfirmation({kind:'kick',member})}>{tr("추방")}</Button>}</Row>)}
      <Button secondary disabled={working} onClick={()=>setConfirmation({kind:'leave'})}>{tr("길드 탈퇴")}</Button>
    </>}
    {confirmation&&<Card title={tr("길드 변경 확인")}><h3>{confirmation.kind==='transfer'?tr("{0}님에게 길드장을 넘길까요?",{0:(confirmation.member?.nickname)}):confirmation.kind==='kick'?tr("{0}님을 추방할까요?",{0:(confirmation.member?.nickname)}):tr("길드를 떠날까요?")}</h3><p className="fine">{confirmation.kind==='transfer'?tr("위임하면 일반 멤버가 되며, 새 길드장이 길드를 관리해요."):tr("진행 중인 지원 요청이 닫혀요. 이미 도착한 선물은 선물함에 보관돼요.")}</p><Button disabled={working} onClick={()=>void perform(confirmGuildAction)}>{confirmation.kind==='transfer'?tr("길드장 위임 확인"):confirmation.kind==='kick'?tr("추방 확인"):tr("탈퇴 확인")}</Button><Button secondary disabled={working} onClick={()=>setConfirmation(null)}>{tr("돌아가기")}</Button></Card>}
    <Button secondary onClick={()=>onPage('gifts')}>{tr("선물함 열기")}</Button>
  </>;
}
