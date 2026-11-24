import GardenVisit from './garden-world/GardenVisit';
import GuildConversation from './GuildConversation';
import './guild-conversation.css';
import './garden-invitation.css';
import {tr,formatLocale} from "./i18n";
import { useEffect, useRef, useState } from 'react';
import type { Booster, ChatMessage, Guild, GuildMember, Player, SupportRequest, PassClaimAllResponse, SeasonEventProgress } from '@garden/contracts';
import { duration, request, serverNow } from './api';
import {guildSocketUrl} from './api-endpoint';
import { Button, Icon, IconButton, Row, Card, Amount, Poster, LinkAction, names } from './ui';
import {ProfilePortrait} from './GardenerProfile';
import './friends.css';
import PassActions from './PassActions';
import CommerceDialog from './CommerceDialog';
import PassRewards,{PassProgress,type PassTier} from './PassRewards';
import type {AttendanceState} from './AttendancePanel';
import EventsContent,{EventsLoadingContent,type EventsContentProps} from './EventsContent';
import type {EventTabId} from './event-tabs';
import {usePageSnapshot} from './page-snapshots';
import HubLoading from './HubLoading';
import {useActivity} from './Activity';
import {useOperations} from './OperationsUI';
import {useFriendProfiles} from './FriendProfiles';
import {sound,startMusic} from './sound';
import {guildEmblemIcon,guildEmblems} from './guild-emblems';
import {isGuildSubpage} from './HubNavigation';
import './guild-layout.css';
import guildEntryHero from '../../../packages/assets/guild-map-v109/runtime/entry-hero.webp';
import guildCreateHero from '../../../packages/assets/guild-map-v109/runtime/create-hero.webp';
import guildFindHero from '../../../packages/assets/guild-map-v109/runtime/find-hero.webp';
import guildJoinedTable from '../../../packages/assets/guild-map-v109/runtime/joined-table.webp';
import './event-design-v62.css';

type Mutate = (path:string,body?:Record<string,unknown>,method?:string)=>Promise<unknown>;
interface Props { page:string; player:Player; mutate:Mutate; refresh:()=>Promise<void>; notify:(message:string)=>void; onPage:(page:string)=>void }
type EventProgress=SeasonEventProgress;
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
interface SupportIntent {kind:'heart'|Booster;nextAt:number;pending:boolean}
interface GuildView {
  guild:(Guild & {notice:string})|null;
  members:GuildMember[];
  requests:Array<SupportRequest & {helped:boolean}>;
  messages:ChatMessage[];
  applications:Array<{userId:string;nickname:string;level:number}>;
  supportStatus?:SupportStatus;
}
const boosters:Booster[]=['hammer','sweep-row','sweep-column','shuffle'];
const roleNames:Record<GuildMember['role'],string>={leader:'길드장',officer:'운영진',member:'멤버'};
function EmblemPicker({value,onChange,disabled}:{value:number;onChange:(value:number)=>void;disabled:boolean}){
 return <div className="emblem-picker" role="group" aria-label={tr("길드 문장 선택")}>
  {guildEmblems.map((item,index)=>{
   const selected=value===index,label=tr(item.label);
   return <button type="button" key={item.icon} className="emblem-choice" data-frame={selected?'button_secondary':'card_ice_v9'}
    aria-label={label+(selected?tr(" · 선택"):'')} aria-pressed={selected} disabled={disabled} onClick={()=>onChange(index)}>
    <Icon id={item.icon} size={46}/><small>{label}</small>{selected&&<b aria-hidden="true">✓</b>}
   </button>;
  })}
 </div>;
}

export default function CommunityMenus({page,player,mutate,refresh,notify,onPage}:Props){
  const {openProfile}=useFriendProfiles();
  const activity=useActivity(),operations=useOperations();
  const [events,setEvents]=usePageSnapshot<EventState>(player.id,'events');
  const [eventTab,setEventTab]=useState<EventTabId>('attendance'),[eventConfirmed,setEventConfirmed]=useState(''),[eventLoading,setEventLoading]=useState(false);
  const eventRead=useRef(0),eventOwner=useRef(player.id);eventOwner.current=player.id;
  const [loadError,setLoadError]=useState('');
  const [mutationWorking,setWorking]=useState(false),[guildConfirmed,setGuildConfirmed]=useState(''),[guildLoading,setGuildLoading]=useState(false);
  const guildRead=useRef(0);
  const [showPassGifts,setShowPassGifts]=useState(false);
  const busy=useRef(false);
  const [guilds,setGuilds]=useState<Guild[]>([]);
  const [searching,setSearching]=useState(true);
  const [searchError,setSearchError]=useState('');
  const searchSequence=useRef(0);
  const [view,setView]=usePageSnapshot<GuildView>(player.id,'guild/'+(player.guildId??'none'));
  const [search,setSearch]=useState('');
  const [guildName,setGuildName]=useState('');
  const [description,setDescription]=useState('');
  const [notice,setNotice]=useState('');
  const [mode,setMode]=useState<'open'|'approval'>('open');
  const [minLevel,setMinLevel]=useState('5');
  const [emblem,setEmblem]=useState(0);
  const [chatText,setChatText]=useState('');
  const [showGuildInfo,setShowGuildInfo]=useState(false);
  const [supportIntents,setSupportIntents]=useState<{scope:string;heart?:SupportIntent;item?:SupportIntent}>({scope:''});
  const supportPending=useRef(new Set<string>()),supportAlive=useRef(true);
  const [invitedGarden,setInvitedGarden]=useState<string|null>(null);
  useEffect(()=>setInvitedGarden(null),[player.id]);
  const [tab,setTab]=useState<'chat'|'help'|'members'|'manage'>('chat');
  const [pendingJoins,setPendingJoins]=useState<string[]>([]);
  const [confirmation,setConfirmation]=useState<{kind:'transfer'|'kick'|'leave';member?:GuildMember}|null>(null);
  const [,tick]=useState(0);
  const validMinimum=Number.isInteger(Number(minLevel))&&Number(minLevel)>=5&&Number(minLevel)<=10000;
  const ownRole=view?.members.find(m=>m.userId===player.id)?.role;
  const manages=ownRole==='leader'||ownRole==='officer';
  const guildPage=page==='guild'||isGuildSubpage(page);
  const guildUnlocked=player.level>=5;
  const findingGuild=page==='guild/find'&&guildUnlocked&&!player.guildId;

  const guildKey=player.id+'/'+player.guildId;
  const supportOwner=useRef(guildKey);supportOwner.current=guildKey;
  const localSupport=supportIntents.scope===guildKey?supportIntents:undefined;
  useEffect(()=>{supportAlive.current=true;return()=>{supportAlive.current=false;};},[]);
  useEffect(()=>setShowGuildInfo(false),[guildKey]);
  const working=mutationWorking||page==='pass'&&eventConfirmed!==player.id||guildPage&&!!player.guildId&&guildConfirmed!==guildKey;
  useEffect(()=>()=>{eventRead.current++;guildRead.current++;},[]);
  async function perform(fn:()=>Promise<unknown>){
    if(busy.current||page==='pass'&&eventConfirmed!==player.id||guildPage&&!!player.guildId&&guildConfirmed!==guildKey)return;busy.current=true;setWorking(true);
    try{await fn();}catch(error){notify(error instanceof Error?error.message:tr("잠시 후 다시 시도해 주세요."));}
    finally{busy.current=false;setWorking(false);}
  }
  async function loadEvents(){
    const sequence=++eventRead.current,owner=player.id;setEventLoading(true);
    try{const next=await request<EventState>('/events');if(eventOwner.current!==owner||sequence!==eventRead.current)return;setEvents(next);activity.updateData(data=>({...data,eventRewards:next}));setEventConfirmed(owner);setLoadError('');}
    catch(error){if(eventOwner.current===owner&&sequence===eventRead.current){setEventConfirmed('');setLoadError(error instanceof Error?error.message:tr("연결을 확인해 주세요."));}throw error;}
    finally{if(eventOwner.current===owner&&sequence===eventRead.current)setEventLoading(false);}
  }
  async function loadView(){
    const sequence=++guildRead.current,owner=player.id;setGuildLoading(true);
    try{const next=await request<GuildView>('/guild');if(eventOwner.current!==owner||sequence!==guildRead.current)return;setView(next);setGuildConfirmed(guildKey);
      setSupportIntents(old=>old.scope!==guildKey?old:{...old,
        heart:!old.heart?.pending&&(next.supportStatus?.heartNextAt??0)>serverNow()?undefined:old.heart,
        item:!old.item?.pending&&(next.supportStatus?.itemNextAt??0)>serverNow()?undefined:old.item,
      });
      activity.updateData(data=>({...data,notifications:{...data.notifications,guild:next.members.length<30&&next.members.some(member=>member.userId===player.id&&member.role!=='member')?next.applications.length:0}}));setLoadError('');if(!next.guild&&player.guildId)await refresh();}
    finally{if(eventOwner.current===owner&&sequence===guildRead.current)setGuildLoading(false);}
  }
  async function loadSearch(query:string){
    const sequence=++searchSequence.current;
    setSearching(true);setSearchError('');
    try{
      const result=await request<{guilds:Guild[];pendingIds:string[]}>('/guilds?q='+encodeURIComponent(query.trim()));
      if(sequence!==searchSequence.current)return;
      setGuilds(result.guilds);setPendingJoins(result.pendingIds);
    }catch(error){
      if(sequence===searchSequence.current)setSearchError(error instanceof Error?error.message:tr('길드를 불러오지 못했어요.'));
    }finally{
      if(sequence===searchSequence.current)setSearching(false);
    }
  }
  useEffect(()=>{
    setLoadError('');setConfirmation(null);
    if(page==='events'||page==='pass'){setEventConfirmed('');void loadEvents().catch(()=>{});}
    if(guildPage&&guildUnlocked&&player.guildId){setGuildConfirmed('');void loadView().catch(error=>setLoadError(error instanceof Error?error.message:tr("길드를 불러오지 못했어요.")));}
  },[page,guildUnlocked,player.guildId,player.id]);
  useEffect(()=>{
    if(!findingGuild)return;
    void loadSearch(search);
    return()=>{searchSequence.current++;};
  },[findingGuild,player.id]);
  useEffect(()=>{const timer=setInterval(()=>tick(n=>n+1),1000);return()=>clearInterval(timer);},[]);
  useEffect(()=>{if(!guildPage||player.guildId||!pendingJoins.length)return;const timer=setInterval(()=>void refresh().catch(()=>{}),5000);return()=>clearInterval(timer);},[guildPage,player.guildId,pendingJoins.length]);
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

  async function requestGuildSupport(kind:'heart'|Booster){
    const channel=kind==='heart'?'heart':'item',scope=guildKey,lock=scope+'/'+channel;
    const status=view?.supportStatus,confirmed=channel==='heart'?status?.heartNextAt:status?.itemNextAt;
    if(working||supportPending.current.has(lock)||(confirmed??0)>serverNow()||
      (localSupport?.[channel]?.nextAt??0)>serverNow()||kind==='heart'&&(status?.storedHearts??0)>=20)return;
    supportPending.current.add(lock);
    const update=(intent?:SupportIntent)=>{
      if(!supportAlive.current||supportOwner.current!==scope)return;
      setSupportIntents(old=>({...((old.scope===scope)?old:{scope}),[channel]:intent}));
    };
    // Render immediately. Polling or a socket refresh cannot undo this local feedback.
    update({kind,nextAt:serverNow()+14_400_000,pending:true});
    try{
      await mutate('/guild/requests',{kind});
      update({kind,nextAt:serverNow()+14_400_000,pending:false});
      // A refresh failure must never turn an accepted request back into a retry button.
      if(supportAlive.current&&supportOwner.current===scope)void loadView().catch(()=>{});
    }catch(error){
      update();
      if(supportAlive.current&&supportOwner.current===scope)notify(error instanceof Error?error.message:tr("잠시 후 다시 시도해 주세요."));
    }finally{supportPending.current.delete(lock);}
  }

  async function claimEvent(kind:'personal'|'guild'){await mutate('/events/claim',{kind});await loadEvents();notify(tr("정원 활동 보상을 받았어요!"));}
  function openManagement(){
    if(!view?.guild)return;setDescription(view.guild.description);setNotice(view.guild.notice);setMode(view.guild.mode);setMinLevel(String(view.guild.minLevel));setEmblem(view.guild.emblem);setTab('manage');
  }
  async function sendChat(){if(!chatText.trim())return;await mutate('/guild/chat',{text:chatText});setChatText('');await loadView();}
  async function confirmGuildAction(){
    if(!confirmation)return;
    if(confirmation.kind==='leave'){await mutate('/guild/leave');setView(null);await refresh();}
    else if(confirmation.member){await mutate(confirmation.kind==='transfer'?'/guild/role':'/guild/kick',{userId:confirmation.member.userId,...(confirmation.kind==='transfer'?{role:'leader'}:{})});await loadView();}
    setConfirmation(null);
  }

  if(page==='events'||page==='pass'){
    if(page==='pass'&&operations.data?.settings.features.pass===false)return <p>{tr('잠시 쉬어가는 기능이에요. 나중에 다시 확인해 주세요.')}</p>;
    if(page==='events'){
      const preview:Pick<EventsContentProps,'daily'|'season'|'personal'|'guild'|'attendance'>|null=events??activity.data?.eventRewards??null;
      if(!preview)return <EventsLoadingContent player={player} selected={eventTab} onSelect={setEventTab} error={loadError} retrying={eventLoading} onRetry={()=>void loadEvents().catch(()=>{})}/>;
      return <EventsContent initialTab={eventTab} onTabChange={setEventTab} refreshError={loadError} revalidating={eventLoading} onRetry={()=>void loadEvents().catch(()=>{})} player={player} mutate={mutate} daily={preview.daily} attendance={preview.attendance} season={preview.season} personal={preview.personal} guild={preview.guild} hasGuild={!!player.guildId} working={working||eventConfirmed!==player.id} onPage={onPage} onClaimSeason={kind=>{if(eventConfirmed===player.id)void perform(()=>claimEvent(kind));}} onClaim={()=>{if(eventConfirmed===player.id)void perform(async()=>{await mutate('/events/daily');await loadEvents();notify(tr("출석 선물을 받았어요!"));});}}/>;
    }
    if(!events)return <HubLoading reducedMotion={player.settings.reducedMotion} kind="pass" error={loadError} retrying={eventLoading} onRetry={()=>void loadEvents().catch(()=>{})}/>;
    const guildGiftPanel=events.pass.guildGifts.length>0&&<><h3>{tr("함께 나누는 패스 선물")}</h3>{events.pass.guildGifts.map(gift=><Row key={gift.seasonId} icon="guild" title={tr("길드 선물권")}><small>{tr("현재 길드원 모두에게 망치")}{' '}{gift.quantityPerMember}{tr("개씩")}</small>{gift.sent?<Button disabled>{tr("선물 전달 완료")}</Button>:player.guildId?<Button attention={1} disabled={working} onClick={()=>void perform(async()=>{await mutate('/pass/guild-gift',{seasonId:gift.seasonId});await loadEvents();notify(tr("길드원들의 선물함에 망치를 보냈어요!"));})}>{tr("길드원에게 선물 보내기")}</Button>:<Button secondary onClick={()=>onPage('guild')}>{tr("가입 후 선물 보내기")}</Button>}</Row>)}<p className="fine">{tr("선물권은 보관돼요. 보낼 때 같은 길드에 있는 모두의 선물함에 한 번씩 도착해요.")}</p></>;

    if(player.level<5)return <div className="empty"><Icon id="star" size={90}/><h3>{tr("차곡차곡 자라는 정원")}</h3><p>{tr("4판을 완료하면 정원 패스를 확인할 수 있어요.")}<br/>{tr("이미 모은 진행은 그대로 이어져요.")}</p></div>;
    if(!events.season||serverNow()>=events.season.ends_at)return <div className="empty"><Icon id="star" size={90}/><h3>{tr("다음 정원 시즌을 준비 중이에요")}</h3><p>{tr("새 시즌이 열리면 여기에서 보상을 확인할 수 있어요.")}</p>{guildGiftPanel}</div>;
    const end=new Date(events.season.ends_at);
    return <>
      <div className="garden-pass">
        <PassProgress pass={events.pass}/>
        <div className="pass-season-line">
          <span><Icon id="star" size={20}/>{tr('새 레벨 +10점')}</span>
          <span>{tr('시즌 종료')} <time dateTime={end.toISOString()}>{end.toLocaleString(formatLocale(),{month:'numeric',day:'numeric',hour:'numeric',minute:'2-digit'})}</time></span>
        </div>
        <PassRewards key={`${player.id}:${events.season.id}`} pass={events.pass} working={working} reducedMotion={player.settings.reducedMotion} onClaim={(tier,track)=>void perform(async()=>{
          await mutate('/pass/claim',{tier,track});await loadEvents();notify(tr('{0}단계 선물을 받았어요!',{0:tier}));
        })}/>
        <PassActions player={player} seasonId={events.season.id} seasonEndsAt={events.season.ends_at} pass={events.pass} working={working} perform={perform} onPage={onPage} onReload={async()=>{await refresh();await loadEvents();}} onClaimAll={()=>void perform(async()=>{const result=await mutate('/pass/claim-all') as PassClaimAllResponse;await loadEvents();notify(result.reason==='CLAIMED'&&result.claimed.length?tr("선물 {0}개를 모두 받았어요!",{0:(result.claimed.length)}):tr("현재 받을 수 있는 선물을 모두 받았어요."));})}/>
      </div>
      {guildGiftPanel&&<div className="pass-guild-gifts-open"><IconButton id="guild" label={tr('길드 선물권')} onClick={()=>setShowPassGifts(true)}/></div>}
      {showPassGifts&&guildGiftPanel&&<CommerceDialog title={tr('함께 나누는 패스 선물')} onClose={()=>{if(!working)setShowPassGifts(false);}}>{guildGiftPanel}</CommerceDialog>}
    </>;
  }

  if(!guildUnlocked)return <div className="empty"><Icon id="guild" size={110}/><h3>{tr("함께 가꾸면 더 즐거워요")}</h3><p>{tr("4판을 완료하면 길드가 열려요.")}</p></div>;
  if(!player.guildId){
    if(findingGuild)return <div className="guild-find">
      <img className="guild-map-find-hero" src={guildFindHero} alt="" aria-hidden="true" draggable={false}/>
      <Card tone="blue">
        <form className="guild-search-form" onSubmit={event=>{event.preventDefault();if(!searching&&!busy.current)void loadSearch(search);}}>
          <div className="input-frame" data-frame="panel"><input value={search} onChange={event=>setSearch(event.target.value)} placeholder={tr('길드 이름 검색')} aria-label={tr('길드 이름 검색')} maxLength={24} enterKeyHint="search"/></div>
          <Button type="submit" tone="blue" disabled={working||searching}>{tr('검색')}</Button>
        </form>
        {searching?<p role="status" className="fine">{tr('길드를 찾는 중…')}</p>:searchError?<p role="status" className="fine">{tr(searchError)}</p>:!guilds.length&&<p role="status" className="fine">{tr('검색 결과가 없어요.')}</p>}
      </Card>
      {!searching&&!searchError&&guilds.length>0&&<section className="guild-find-results" aria-label={tr('길드 목록')}><h3>{tr('길드 목록')}</h3>{guilds.map(g=>{
        const pending=pendingJoins.includes(g.id),full=g.members>=30,locked=player.level<g.minLevel,approval=g.mode==='approval';
        const joinLabel=pending?tr('승인 대기'):full?tr('인원 가득'):locked?tr('레벨 부족'):approval?tr('가입 신청'):tr('가입');
        return <Row key={g.id} icon={guildEmblemIcon(g.emblem)} title={g.name}>
          <small>{g.members}{tr('/30 · 레벨')}{' '}{g.minLevel}+</small>
          <Button tone={approval?'blue':'green'} disabled={working||pending||full||locked} onClick={()=>void perform(async()=>{
            await mutate(`/guilds/${g.id}/join`);
            if(approval){setPendingJoins(ids=>[...new Set([...ids,g.id])]);notify(tr('가입 승인을 요청했어요.'));}
            else notify(tr('길드에 오신 것을 환영해요!'));
          })}>{joinLabel}</Button>
        </Row>;
      })}</section>}
    </div>;
    if(page==='guild/create'){
      const canCreate=guildName.trim().length>=2&&validMinimum;
      return <div className="guild-create"><img className="guild-map-create-hero" src={guildCreateHero} alt="" aria-hidden="true" draggable={false}/><Card className="guild-create-card" tone="blue">
        <form className="guild-create-form" onSubmit={event=>{
          event.preventDefault();
          if(!canCreate)return;
          void perform(async()=>{
            await mutate('/guilds',{name:guildName,description,mode,emblem,minLevel:Number(minLevel)});
            setGuildName('');
          });
        }}>
          <label htmlFor="guild-name">{tr('길드 이름')}</label>
          <div className="input-frame" data-frame="panel"><input id="guild-name" value={guildName} onChange={event=>setGuildName(event.target.value)} placeholder={tr('길드 이름')} maxLength={24}/></div>
          <label htmlFor="guild-description">{tr('길드 소개')}</label>
          <div className="input-frame" data-frame="panel"><textarea id="guild-description" value={description} onChange={event=>setDescription(event.target.value)} placeholder={tr('어떤 정원을 가꾸고 싶나요?')} maxLength={160}/></div>
          <div className="guild-create-settings">
            <div><label htmlFor="guild-mode">{tr('가입 방법')}</label>
              <div className="input-frame" data-frame="panel"><select id="guild-mode" value={mode} onChange={event=>setMode(event.target.value as typeof mode)}><option value="open">{tr('누구나 가입')}</option><option value="approval">{tr('승인 후 가입')}</option></select></div></div>
            <div><label htmlFor="guild-minimum">{tr('최소 레벨')}</label>
              <div className="input-frame" data-frame="panel"><input id="guild-minimum" type="number" inputMode="numeric" min={5} max={10000} value={minLevel} onChange={event=>setMinLevel(event.target.value)}/></div></div>
          </div>
          <p className="guild-customization-title">{tr('길드 문장')}</p>
          <EmblemPicker value={emblem} onChange={setEmblem} disabled={working}/>
          <Button type="submit" tone="green" disabled={working||!canCreate}>{tr('길드 창설')}</Button>
        </form>
      </Card></div>;
    }
    return <div className="guild-entry"><img className="guild-map-entry-hero" src={guildEntryHero} alt="" aria-hidden="true" draggable={false}/><h2>{tr('함께할 길드를 만나보세요')}</h2><p>{tr('길드원과 하트를 나누고 함께 즐겨요.')}</p><div className="guild-entry-actions">
      <div><Button tone="green" icon="guild" onClick={()=>onPage('guild/find')}>{tr('길드 찾기')}</Button><p>{tr('좋은 길드에 가입해요.')}</p></div>
      <div><Button tone="blue" icon={guildEmblemIcon(0)} onClick={()=>onPage('guild/create')}>{tr('길드 창설')}</Button><p>{tr('나만의 길드를 만들어요.')}</p></div>
    </div></div>;
  }
  if(!view?.guild)return <div className="guild-initial-loading"><HubLoading reducedMotion={player.settings.reducedMotion} kind="guild" error={loadError} retrying={guildLoading} onRetry={()=>void loadView().catch(error=>setLoadError(error instanceof Error?error.message:tr("길드를 불러오지 못했어요.")))}/></div>;
  const support=view.supportStatus;
  const heartNextAt=(support?.heartNextAt??0)>serverNow()?support!.heartNextAt:localSupport?.heart?.nextAt??0;
  const itemNextAt=(support?.itemNextAt??0)>serverNow()?support!.itemNextAt:localSupport?.item?.nextAt??0;
  const tabs=[['chat','mail','대화'],['help','heart','도움'],['members','lumi','멤버'],['manage','settings','관리']] as const;
  return <div className="guild-layout" data-tab={tab}>
    {loadError&&<div className="hub-refresh-notice" role="status"><span>{tr('최신 정보를 확인하지 못했어요.')}</span><Button tone="blue" onClick={()=>void loadView().catch(()=>{})}>{tr('다시 불러오기')}</Button></div>}
    <section className="guild-banner" data-long-name={view.guild.name.length>12||undefined}><img className="guild-map-joined-art" src={guildJoinedTable} alt="" aria-hidden="true" draggable={false}/><div className="guild-title"><Icon id={guildEmblemIcon(view.guild.emblem)} size={72}/><div><h3 title={view.guild.name}>{view.guild.name}</h3></div></div>{tab==='chat'&&<Button className="guild-info-toggle" tone="blue" onClick={()=>setShowGuildInfo(true)}>{tr("길드 정보")}</Button>}</section>
    {tab!=='chat'&&<section className="guild-summary" aria-label={tr('길드 소개')} data-frame="card_ice_v9" data-frame-scale="0.12">{view.guild.description&&<p title={view.guild.description}>{view.guild.description}</p>}<small>{view.members.length}{tr("/30 · 최소 레벨")}{' '}{view.guild.minLevel}</small></section>}
    <div className="guild-section-tabs" role="group" aria-label={tr('길드')}>{tabs.filter(([id])=>id!=='manage'||manages).map(([id,icon,label])=><button key={id} aria-pressed={tab===id} data-frame={tab===id?'button_secondary':'card_ice_v9'} data-frame-scale="0.12" onClick={()=>{sound('button');startMusic();if(id==='manage')openManagement();else setTab(id);}}><Icon id={icon} size={28}/><span>{tr(label)}</span></button>)}</div>
    {view.guild.notice&&tab!=='chat'&&<div className="guild-notice"><Row icon="mail" title={tr("길드 공지")}><p className="fine">{view.guild.notice}</p></Row></div>}
    {tab==='chat'?<GuildConversation messages={view.messages} members={view.members} playerId={player.id} text={chatText} working={working}
      onText={setChatText} onSend={()=>void perform(sendChat)} onProfile={openProfile} onVisit={setInvitedGarden} onGifts={()=>onPage('gifts')}
      onBlock={userId=>void perform(async()=>{await mutate('/guild/block',{userId});await loadView();})}
      onReport={messageId=>void perform(async()=>{await mutate('/guild/report',{messageId,reason:tr("사용자 신고")});notify(tr("신고를 접수했어요."));})}/>
    :tab==='help'?<Card title={tr("도움 나누기")} tone="green">
      <Button className="guild-heart-request" disabled={working||heartNextAt>serverNow()||(support?.storedHearts??0)>=20} icon="heart" onClick={()=>void requestGuildSupport('heart')}>{localSupport?.heart?.pending?tr("요청 중"):heartNextAt>serverNow()?tr("다음 요청 {0}",{0:duration(heartNextAt-serverNow())}):tr("하트 도움 요청")}</Button>
      <p className="fine">{tr("오늘 하트 지원")}{' '}{support?.heartsSent??0}{tr("/10 · 수신")}{' '}{support?.heartsReceived??0}/10<br/>{tr("보관한 길드 하트")}{' '}{support?.storedHearts??0}/20</p>
      {boosters.map(item=><Row key={item} icon={item} title={names[item]}><small>{tr("보유")}{' '}{player.inventory[item].normal+player.inventory[item].bound}{' '}{tr("· 지원 가능")}{' '}{player.inventory[item].normal}</small><Button secondary disabled={working||itemNextAt>serverNow()} onClick={()=>void requestGuildSupport(item)}>{localSupport?.item?.pending&&localSupport.item.kind===item?tr("요청 중"):itemNextAt>serverNow()?tr("요청 대기"):tr("요청")}</Button></Row>)}
      <p className="fine">{tr("오늘 아이템 지원")}{' '}{support?.itemsSent??0}{tr("/3 · 수신")}{' '}{support?.itemsReceived??0}/3{itemNextAt>serverNow()&&<><br/>{tr("다음 아이템 요청")}{' '}{duration(itemNextAt-serverNow())}</>}</p>
      <h3>{tr("길드원이 기다리는 도움")}</h3>{view.requests.length?view.requests.map(r=><Row key={r.id} icon={r.kind==='heart'?'heart':r.kind} title={`${r.nickname} · ${r.received}/${r.maximum}`}><small>{r.kind==='heart'?tr("하트"):names[r.kind]} · {duration(r.expiresAt-serverNow())}</small><Button disabled={working||r.userId===player.id||r.helped||r.received>=r.maximum||(r.kind==='heart'?(support?.heartsSent??0)>=10:(support?.itemsSent??0)>=3||player.inventory[r.kind].normal===0)} onClick={()=>void perform(async()=>{await mutate(`/guild/requests/${r.id}/help`);await loadView();notify(tr("도움을 보냈어요!"));})}>{r.userId===player.id?tr("내 요청"):r.helped?tr("도움 완료"):tr("도와주기")}</Button></Row>):<p className="fine">{tr("아직 기다리는 요청이 없어요.")}</p>}
    </Card>:tab==='manage'&&manages?<Card title={tr("우리 길드 관리")} tone="green">
      <label htmlFor="guild-notice">{tr("길드 공지")}</label><div className="input-frame" data-frame="panel"><textarea id="guild-notice" value={notice} maxLength={240} onChange={event=>setNotice(event.target.value)}/></div>
      <label htmlFor="edit-guild-description">{tr("소개")}</label><div className="input-frame" data-frame="panel"><textarea id="edit-guild-description" value={description} maxLength={160} onChange={event=>setDescription(event.target.value)}/></div>
      <label htmlFor="edit-guild-mode">{tr("가입 방법")}</label><div className="input-frame" data-frame="panel"><select id="edit-guild-mode" value={mode} onChange={event=>setMode(event.target.value as typeof mode)}><option value="open">{tr("누구나 가입")}</option><option value="approval">{tr("승인 후 가입")}</option></select></div>
      <label htmlFor="edit-guild-minimum">{tr("최소 레벨")}</label><div className="input-frame" data-frame="panel"><input id="edit-guild-minimum" type="number" inputMode="numeric" min={5} max={10000} value={minLevel} onChange={event=>setMinLevel(event.target.value)}/></div>
      <EmblemPicker value={emblem} onChange={setEmblem} disabled={working}/><Button disabled={working||!validMinimum} onClick={()=>void perform(async()=>{await mutate('/guild',{notice,description,mode,minLevel:Number(minLevel),emblem},'PATCH');await loadView();notify(tr("길드 정보를 저장했어요."));})}>{tr("길드 정보 저장")}</Button>
      <h3>{tr("가입 신청")}</h3>{view.applications.length?view.applications.map(applicant=><Row key={applicant.userId} onProfile={()=>openProfile(applicant.userId)} icon="lumi" title={tr("{0} · 레벨 {1}",{0:(applicant.nickname),1:(applicant.level)})}><Button disabled={working||view.members.length>=30} onClick={()=>void perform(async()=>{await mutate('/guild/approve',{userId:applicant.userId});await loadView();})}>{tr("가입 승인")}</Button></Row>):<p className="fine">{tr("대기 중인 가입 신청이 없어요.")}</p>}
    </Card>:<div className="guild-members">
      <ul className="friend-list">{view.members.map(member=><li key={member.userId} className="friend-person" data-frame="card_ice_v9" data-content-group><button className="friend-person-profile" onClick={()=>openProfile(member.userId)} aria-label={member.nickname+' '+tr('프로필 보기')}><ProfilePortrait appearance={member.profileAppearance} size={48}/><span><strong>{member.nickname} · {tr(roleNames[member.role])}</strong><small>{tr("레벨")}{' '}{member.level}{' '}{tr("· 도움")}{' '}{member.contribution}</small></span></button>{(ownRole==='leader'||manages)&&member.userId!==player.id&&<div className="friend-person-actions">{ownRole==='leader'&&member.userId!==player.id&&<><Button secondary disabled={working} onClick={()=>void perform(async()=>{await mutate('/guild/role',{userId:member.userId,role:member.role==='officer'?'member':'officer'});await loadView();})}>{member.role==='officer'?tr("일반 멤버로"):tr("운영진 임명")}</Button><Button secondary disabled={working} onClick={()=>setConfirmation({kind:'transfer',member})}>{tr("길드장 위임")}</Button></>}{manages&&member.userId!==player.id&&member.role!=='leader'&&(ownRole==='leader'||member.role==='member')&&<Button secondary disabled={working} onClick={()=>setConfirmation({kind:'kick',member})}>{tr("추방")}</Button>}</div>}</li>)}</ul>
      <LinkAction className="guild-leave" disabled={working} onClick={()=>setConfirmation({kind:'leave'})}>{tr("길드 탈퇴")}</LinkAction>
    </div>}
    {confirmation&&<Card title={tr("길드 변경 확인")}><h3>{confirmation.kind==='transfer'?tr("{0}님에게 길드장을 넘길까요?",{0:(confirmation.member?.nickname)}):confirmation.kind==='kick'?tr("{0}님을 추방할까요?",{0:(confirmation.member?.nickname)}):tr("길드를 떠날까요?")}</h3><p className="fine">{confirmation.kind==='transfer'?tr("위임하면 일반 멤버가 되며, 새 길드장이 길드를 관리해요."):tr("진행 중인 지원 요청이 닫혀요. 이미 도착한 선물은 선물함에 보관돼요.")}</p><Button disabled={working} onClick={()=>void perform(confirmGuildAction)}>{confirmation.kind==='transfer'?tr("길드장 위임 확인"):confirmation.kind==='kick'?tr("추방 확인"):tr("탈퇴 확인")}</Button><Button secondary disabled={working} onClick={()=>setConfirmation(null)}>{tr("돌아가기")}</Button></Card>}
    {tab!=='chat'&&<Button secondary icon="chest" onClick={()=>onPage('gifts')}>{tr("선물함 열기")}</Button>}
    {showGuildInfo&&tab==='chat'&&<CommerceDialog title={tr('길드 정보')} onClose={()=>setShowGuildInfo(false)}><h3>{view.guild.name}</h3>{view.guild.description&&<p>{view.guild.description}</p>}<p className="fine">{view.members.length}{tr('/30 · 최소 레벨')}{' '}{view.guild.minLevel}</p>{view.guild.notice&&<><h3>{tr('길드 공지')}</h3><p>{view.guild.notice}</p></>}</CommerceDialog>}
    {invitedGarden&&<GardenVisit userId={invitedGarden} reducedMotion={player.settings.reducedMotion} onClose={()=>setInvitedGarden(null)}/>}
  </div>;
}
