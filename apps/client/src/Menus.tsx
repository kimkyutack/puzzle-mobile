import {useOperations} from './OperationsUI';
import GiftInbox from './GiftInbox';
import {homeIcon} from './home-icon-art';
import {tr,formatLocale} from "./i18n";
import {useEffect,useRef,useState} from 'react';
import {Capacitor} from '@capacitor/core';
import {App as NativeApp} from '@capacitor/app';
import type {Player,Product,Booster,RewardIntent,AdRewardQuota,AdRewardQuotas,AuthResponse} from '@garden/contracts';
import {request,key,duration,serverNow,installSession,clearSession,getLocalFeatures,refillLocalHearts} from './api';
import {Button,Icon,IconButton,Row,Card,Amount,Poster,LinkAction,names} from './ui';
import {purchases,rewardedAds,signIn,identityAvailable,pendingAppleChallenge,clearAppleChallenge} from './platform';
import type {AdState} from './platform';
import {IdentityButton} from './platform/IdentityButton';
import {selectLanguage,useI18n,type Locale} from './i18n';
import {languageOptions} from './locale-preference';
import CommunityMenus from './CommunityMenus';
import {isGuildSubpage} from './HubNavigation';
import {OFFER_PRODUCTS,RESTORATIONS} from '@garden/content';
import RankingMenu from './RankingMenu';
import OffersMenu from './OffersMenu';
import ShopMenu from './ShopMenu';
import FriendsMenu from './FriendsMenu';
import HeartAdButton from './HeartAdButton';
import {GardenerAppearanceEditor,GardenerCard} from './GardenerProfile';
import {childAccount} from './platform/account-age';
import {eraseLocalAccountData} from './platform/erase-local-account';
import LegalLinks from './LegalLinks';
import {useActivity,useAttention} from './Activity';
import './settings-modal.css';
type Mutate=(path:string,body?:Record<string,unknown>,method?:string)=>Promise<unknown>;
interface Props {page:string;player:Player;mutate:Mutate;refresh:()=>Promise<void>;notify:(s:string)=>void;onPage:(p:string)=>void;onLogout:()=>void;onWorkingChange?:(working:boolean)=>void;}
const boosters:Booster[]=['hammer','sweep-row','sweep-column','shuffle','sweep-border'];
interface PendingPurchase {id:string;productId:string;status:string;seasonId?:string;expiresAt:number;canCancel:boolean}
const productTitle=(product:Product|undefined)=>product?((product.offer?.title?tr(product.offer.title):'')||(product.kind==='coins'?String(product.coins.toLocaleString(formatLocale()))+tr(" 코인"):product.kind==='starter'?tr("첫 정원 꾸러미"):product.kind==='pass'?tr("정원 패스"):tr("정원 도구 꾸러미"))):tr("스토어 구매");
export default function Menus({page,player,mutate,refresh,notify,onPage,onLogout,onWorkingChange}:Props){
 const {t,locale}=useI18n();
 const restricted=childAccount();
 const operations=useOperations(),activity=useActivity(),attention=useAttention();
 const canWatchAds=rewardedAds.available()&&operations.data?.settings.features.ads!==false;
 const [appVersion,setAppVersion]=useState('');
 useEffect(()=>{
  if(!Capacitor.isNativePlatform())return;
  let active=true;
  void NativeApp.getInfo().then(info=>{if(active)setAppVersion(`${info.version} (${info.build})`);}).catch(()=>{});
  return()=>{active=false;};
 },[]);
 const [catalog,setCatalog]=useState<{products:Product[];restorations:Array<{id:string;area:string;name:string;cost:number;asset:string}>;season?:{endsAt:number}}>({products:[],restorations:[]});
 const [localHearts,setLocalHearts]=useState(false);
 useEffect(()=>{void getLocalFeatures().then(value=>setLocalHearts(value.freeHeartRefill)).catch(()=>{});},[]);
 const [nickname,setNickname]=useState(player.nickname);
 const [working,setWorking]=useState(false),[status,setStatus]=useState('');
 const [ad,setAd]=useState<AdState>('idle'),[pendingAd,setPendingAd]=useState<RewardIntent|null>(null),[deleteText,setDeleteText]=useState('');
 const [adQuota,setAdQuota]=useState<{owner:string;value:AdRewardQuota}|null>(null),[adQuotaError,setAdQuotaError]=useState(false);
 const adReadSequence=useRef(0),adOwner=useRef(player.id);adOwner.current=player.id;
 const heartAdQuota=!adQuotaError&&adQuota?.owner===player.id?adQuota.value:null;
 const [conflict,setConflict]=useState<{switchToken:string;existing:{nickname:string;level:number}}|null>(null);
 const [decorations,setDecorations]=useState<Array<{id:string;name:string;asset:string}>>([]);
 const [editingAppearance,setEditingAppearance]=useState(false);
 const [linkedProviders,setLinkedProviders]=useState<string[]>([]),[logoutConfirm,setLogoutConfirm]=useState(false);
 const loadLinks=async()=>setLinkedProviders((await request<{providers:Array<{provider:string}>}>('/auth/links')).providers.map(link=>link.provider));
 const [pendingIdentity,setPendingIdentity]=useState<string|null>(null);
 const [purchaseIntents,setPurchaseIntents]=useState<PendingPurchase[]>([]),[cancelPurchaseId,setCancelPurchaseId]=useState<string|null>(null);
 const loadPurchaseIntents=async()=>setPurchaseIntents((await request<{intents:PendingPurchase[]}>('/purchases/intents')).intents);
 const recoverStore=async()=>{try{await purchases.recover(player.id,input=>request('/purchases/verify',input),purchaseStatus)}finally{await Promise.all([refresh(),loadPurchaseIntents()]);}};
 const purchaseStatus=(value:string)=>setStatus(({loading:tr("상품을 불러오는 중"),ready:tr("구매 준비 완료"),purchasing:tr("스토어에서 구매 진행 중"),pending:tr("구매 승인 대기 중"),verifying:tr("구매 확인 중"),complete:tr("구매 완료"),cancelled:tr("구매를 취소했어요"),error:tr("구매를 확인하지 못했어요"),unavailable:tr("이 기기에서 구매할 수 없어요")} as Record<string,string>)[value]||value);
 const run=async(fn:()=>Promise<unknown>)=>{if(working)return;setWorking(true);onWorkingChange?.(true);try{await fn()}catch(e){notify(e instanceof Error?e.message:tr("잠시 후 다시 시도해 주세요."))}finally{setWorking(false);onWorkingChange?.(false)}};
 useEffect(()=>{if(page==='settings')void request<typeof catalog>('/catalog').then(setCatalog).catch(()=>{});},[page]);
 useEffect(()=>{if(page==='settings')void loadLinks().catch(()=>{});},[page,player.id]);
 useEffect(()=>{
  setEditingAppearance(false);setDecorations([]);
  if(page!=='profile')return;
  let live=true;
  void request<{decorations:typeof decorations}>('/profile/decorations').then(result=>{if(live)setDecorations(result.decorations);}).catch(()=>{});
  return()=>{live=false;};
 },[page,player.id]);
 useEffect(()=>{void pendingAppleChallenge().then(setPendingIdentity);},[]);
 useEffect(()=>{if(page==='settings')void loadPurchaseIntents().catch(()=>{});},[page,player.id]);
 function applyAdQuota(quotas:AdRewardQuotas|undefined){setAdQuota(quotas?.heart?{owner:player.id,value:quotas.heart}:null);setAdQuotaError(!quotas?.heart);}
 async function loadAdInfo(){
  const owner=player.id,sequence=++adReadSequence.current;
  try{const r=await request<{intents:RewardIntent[];quotas?:AdRewardQuotas}>('/ads/reward-intents');if(owner!==adOwner.current||sequence!==adReadSequence.current)return;applyAdQuota(r.quotas);const item=r.intents.find(i=>['reserved','pending','review'].includes(i.status));setPendingAd(item??null);if(item)setAd('pending');else setAd(previous=>previous==='pending'?'idle':previous);}
  catch(error){if(owner===adOwner.current&&sequence===adReadSequence.current)setAdQuotaError(true);throw error;}
 }
 useEffect(()=>{if(!canWatchAds||!['hearts','settings'].includes(page))return;setAdQuotaError(false);void loadAdInfo().catch(()=>{});return()=>{adReadSequence.current++;};},[page,player.id,canWatchAds]);
 useEffect(()=>{
  if(!canWatchAds||page!=='hearts')return;let stopped=false,timer:ReturnType<typeof setTimeout>|undefined;
  const reload=()=>{if(!stopped)void loadAdInfo().catch(()=>{});};
  const atMidnight=async()=>{if(stopped)return;try{await loadAdInfo();}catch{}finally{if(!stopped)timer=setTimeout(()=>void atMidnight(),10000);}};
  if(adQuota?.owner===player.id)timer=setTimeout(()=>void atMidnight(),Math.max(100,adQuota.value.resetsAt-serverNow()+100));
  const visible=()=>{if(!document.hidden)reload();};window.addEventListener('focus',reload);document.addEventListener('visibilitychange',visible);
  const native=Capacitor.isNativePlatform()?NativeApp.addListener('appStateChange',state=>{if(state.isActive)reload();}):null;
  return()=>{stopped=true;clearTimeout(timer);window.removeEventListener('focus',reload);document.removeEventListener('visibilitychange',visible);void native?.then(listener=>listener.remove()).catch(()=>{});};
 },[page,player.id,adQuota?.value.resetsAt,canWatchAds]);
 useEffect(()=>{if(!pendingAd||!['hearts','settings'].includes(page)||!['reserved','pending','review'].includes(pendingAd.status))return;let cancelled=false,attempts=0;const timer=setInterval(()=>{if(++attempts>6){clearInterval(timer);return;}const owner=player.id,sequence=++adReadSequence.current;void request<{intent:RewardIntent|null;quotas?:AdRewardQuotas}>('/ads/reward-intents/'+pendingAd.id).then(r=>{if(cancelled||owner!==adOwner.current||sequence!==adReadSequence.current||!r.intent)return;applyAdQuota(r.quotas);setPendingAd(r.intent);if(r.intent.status==='granted'){setAd('granted');void refresh();clearInterval(timer)}}).catch(()=>{});},2000);return()=>{cancelled=true;clearInterval(timer)};},[pendingAd?.id,page,player.id]);
 async function watchAd(){if(!rewardedAds.available()){setAd('unavailable');return;}adReadSequence.current++;let intent:RewardIntent|undefined;let earned=false;try{intent=(await request<{intent:RewardIntent}>('/ads/reward-intents',{key:key(),placement:'heart'})).intent;setPendingAd(intent);const r=await rewardedAds.show(intent,player.id,setAd);earned=r.earnedCallback;await request('/ads/reward-intents/'+intent.id,{key:key(),status:r.status==='cancelled'?'cancelled':'pending'});await checkIntent(intent.id);}catch(e){if(intent&&!earned)await request('/ads/reward-intents/'+intent.id+'/cancel',{key:key()}).catch(()=>{});await loadAdInfo().catch(()=>{});throw e;}}
 async function checkIntent(id:string){const owner=player.id,sequence=++adReadSequence.current;const r=await request<{intent:RewardIntent|null;quotas?:AdRewardQuotas}>('/ads/reward-intents/'+id);if(owner!==adOwner.current||sequence!==adReadSequence.current)return;applyAdQuota(r.quotas);if(r.intent){setPendingAd(r.intent);setAd(r.intent.status==='granted'?'granted':r.intent.status==='cancelled'?'cancelled':'pending');}await refresh();}
 async function checkAd(){if(pendingAd)await checkIntent(pendingAd.id);}
 async function link(provider:'google'|'apple'){const challenge=await request<{nonce:string;challengeId:string}>('/auth/challenge',{provider});const credential=await signIn(provider,challenge.nonce,challenge.challengeId);const result=await request<{conflict?:{switchToken:string;existing:{nickname:string;level:number}};linked?:boolean}>('/auth/link',credential);if(result.conflict)setConflict(result.conflict);else notify(tr("계정이 연결되었어요."));if(provider==='apple'){await clearAppleChallenge();setPendingIdentity(null);}await refresh();await loadLinks();}
 async function finishPendingApple(){if(!pendingIdentity)return;const result=await request<{conflict?:{switchToken:string;existing:{nickname:string;level:number}}}>('/auth/link',{provider:'apple',challengeId:pendingIdentity});if(result.conflict)setConflict(result.conflict);else notify(tr("Apple 계정이 연결되었어요."));await clearAppleChallenge();setPendingIdentity(null);await refresh();await loadLinks();}
 if(page==='offers'||page==='offers-limited'||page==='offers-timed'||page==='offers-chain'){
  if(operations.data?.settings.features.offers===false)return <Card tone="blue"><p>{tr('잠시 쉬어가는 기능이에요. 나중에 다시 확인해 주세요.')}</p></Card>;
  return <OffersMenu key={page} kind={page==='offers-chain'?'chain':page==='offers-timed'?'timed':'limited'} player={player} refresh={refresh} notify={notify}/>;
 }
 if(page==='events')return <CommunityMenus page={page} player={player} mutate={mutate} refresh={refresh} notify={notify} onPage={onPage}/>;
 if(page==='shop')return <ShopMenu player={player} mutate={mutate} refresh={refresh} notify={notify} onPage={onPage}/>;
 if(page==='hearts')return <><Poster id="poster_hearts_v5" className="heart-poster" label={tr("하트 열기구를 타고 날아가는 루미")}><figcaption className="poster-caption" data-frame="event_badge" data-frame-scale="0.1"><Amount kind="heart" value={player.hearts+' / 5'}/></figcaption></Poster><p className="intro">{player.unlimitedUntil>serverNow()?tr("무제한 ")+duration(player.unlimitedUntil-serverNow()):player.hearts<5?tr("다음 하트까지 ")+duration(player.heartAt+3600000-serverNow()):tr("하트가 가득 찼어요")}</p><Button tone="green" icon="heart" disabled={working||player.hearts>=5} onClick={()=>void run(()=>mutate('/hearts/buy',{amount:'full'}))}>{tr("가득 채우기")}{' '}<Amount kind="coin" value={(5-player.hearts)*100}/></Button>{localHearts&&<Button className="local-heart-button" tone="gold" icon="heart" disabled={working||player.hearts>=5} onClick={()=>void run(async()=>{await refillLocalHearts(key());await refresh();notify(tr("하트가 가득 찼어요!"))})}>{tr("무료 충전")}{' '}<small>{tr("로컬")}</small></Button>}<section className="offer-strip" data-content-group data-frame="card_gold_v4"><h3>{tr("하트 걱정 없는 30분")}</h3>{player.level>=5&&player.freeClaimAt<=serverNow()?<Button tone="green" icon="heart" disabled={working} onClick={()=>void run(()=>mutate('/hearts/free'))}>{tr("무료로 시작")}</Button>:<div className="offer-status"><Icon id="heart" size={33}/><span>{player.level<5?tr("4판 완료 후 열려요"):duration(player.freeClaimAt-serverNow())+tr(" 후 다시 받아요")}</span></div>}<p className="fine">{tr("무료 무제한은 수령 후 4시간마다 받을 수 있어요.")}</p></section>{player.level>4&&<details className="auxiliary-options"><summary>{tr("다른 방법으로 하트 받기")}</summary><Card tone="green">{canWatchAds&&<><HeartAdButton quota={heartAdQuota} error={adQuotaError} disabled={working||player.hearts>=5||player.unlimitedUntil>serverNow()||!!pendingAd&&['reserved','pending','review'].includes(pendingAd.status)} onClick={()=>void run(watchAd)}/>{ad!=='idle'&&<p role="status">{{loading:tr("광고 준비 중"),showing:tr("시청 중"),pending:tr("보상 확인 중 — 정원으로 돌아가도 안전해요"),granted:tr("하트 지급 완료"),cancelled:tr("시청을 종료했어요"),'no-fill':tr("지금 볼 수 있는 광고가 없어요"),error:tr("광고를 불러오지 못했어요"),unavailable:tr("광고가 연결된 모바일 앱에서 이용할 수 있어요")}[ad]}</p>}{pendingAd&&<LinkAction icon="mail" onClick={()=>void run(checkAd)}>{tr("보상 상태 확인")}</LinkAction>}</>}{!restricted&&<><LinkAction icon="guild" onClick={()=>onPage('guild')}>{tr("길드에 하트 요청")}</LinkAction><LinkAction icon="lumi_happy" onClick={()=>onPage('friends')}>{tr("친구에게 하트 요청")}</LinkAction></>}<LinkAction icon="mail" onClick={()=>onPage('gifts')}>{tr("보관된 선물 보기")}</LinkAction></Card></details>}<p className="fine">{tr("퍼즐을 클리어하면 하트가 유지돼요. 실패하거나 포기할 때만 1개를 사용해요.")}</p></>;
 if(page==='gifts')return <GiftInbox player={player} mutate={mutate} onPage={onPage}/>;
 if(page==='friends')return <FriendsMenu player={player} refresh={refresh} notify={notify}/>;
 if(page==='ranking')return <RankingMenu player={player} onGuild={()=>onPage('guild')}/>;
 if(page==='pass'||page==='guild'||isGuildSubpage(page))return <CommunityMenus page={page} player={player} mutate={mutate} refresh={refresh} notify={notify} onPage={onPage}/>;
 if(page==='profile'){
  const profile={nickname:player.nickname,level:player.level,highestClear:Math.max(0,player.level-1),appearance:player.profileAppearance,
   restoration:`${player.restored.length} / ${RESTORATIONS.length}`,badge:decorations[0]};
  if(editingAppearance)return <GardenerAppearanceEditor card={profile} working={working} onCancel={()=>setEditingAppearance(false)}
   onSave={profileAppearance=>void run(async()=>{await mutate('/me',{profileAppearance},'PATCH');setEditingAppearance(false);})}/>;
  return <>
   <GardenerCard {...profile}/>
   <Button icon="tile_sprout" tone="gold" disabled={working} onClick={()=>setEditingAppearance(true)}>{tr('프로필 꾸미기')}</Button>
   {!restricted&&<Card title={t('settings.nickname')} tone="green">
    <div className="input-frame" data-frame="panel"><input value={nickname} maxLength={20} onChange={e=>setNickname(e.target.value)} aria-label={tr("닉네임")}/></div>
    <Button icon="tile_sprout" tone="green" disabled={working||!nickname.trim()||nickname.trim()===player.nickname} onClick={()=>void run(()=>mutate('/me',{nickname},'PATCH'))}>{tr("이름 저장")}</Button>
   </Card>}
  </>;
 }
 if(page==='settings')return <div className="settings-panel">
  <section aria-labelledby="settings-help-title">
   <h3 className="settings-section-title" id="settings-help-title">{tr('운영 소식과 도움')}</h3>
   <Button className="settings-row settings-link" rasterFrame={false} secondary attention={operations.unread} icon="mail" onClick={()=>onPage('notices')}>{tr('공지사항')}</Button>
   {!restricted&&<Button className="settings-row settings-link" rasterFrame={false} secondary attention={operations.data?.supportUnread??0} icon="lumi" onClick={()=>onPage('support')}>{tr('고객센터')}</Button>}
   <Button className="settings-row settings-link" rasterFrame={false} secondary attention={attention.counts.gifts+attention.liveEvents} icon={homeIcon('mailbox','mail')} onClick={()=>onPage('gifts')}>{tr('선물함')}</Button>
  </section>
  <section aria-labelledby="settings-play-title">
   <h3 className="settings-section-title" id="settings-play-title">{t('settings.comfort')}</h3>
   {([['sound',t('settings.sound')],['music',t('settings.music')],['haptics',t('settings.haptics')]] as const).map(([id,label])=><div className="settings-row" key={id}>
    <span>{label}</span>
    <button type="button" className="settings-switch" role="switch" aria-checked={player.settings[id]} aria-label={label} disabled={working} onClick={()=>void run(()=>mutate('/me',{settings:{[id]:!player.settings[id]}},'PATCH'))}>
     <span className="settings-switch-track" aria-hidden="true"/>
    </button>
   </div>)}
   <label className="settings-row settings-language">
    <span>{t('common.language')}</span>
    <select aria-label={t('common.language')} value={locale} disabled={working} onChange={e=>{
     const language=e.target.value as Locale;
     selectLanguage(language);
     void run(()=>mutate('/me',{settings:{language}},'PATCH'));
    }}>{Object.entries(languageOptions).map(([code,label])=><option key={code} value={code} lang={code}>{label}</option>)}</select>
   </label>
  </section>
  <details className="settings-disclosure settings-account-link" open={pendingIdentity||conflict?true:undefined}>
   <summary className="settings-row">{tr('계정 연동')}</summary>
   <div className="settings-disclosure-content">
    {linkedProviders.length>0&&<p className="fine">{tr("연결된 계정:")}{' '}{linkedProviders.map(provider=>provider==='apple'?'Apple':'Google').join(', ')}</p>}{restricted?<p className="fine">{tr("아동 계정은 이 기기에서 이용할 수 있어요. 보호자 동의 또는 계정 문의는 개인정보처리방침의 연락처를 이용해 주세요.")}</p>:<>{pendingIdentity&&<><p className="fine">{tr("진행 중이던 Apple 인증을 확인할 수 있어요.")}</p><Button disabled={working} onClick={()=>void run(finishPendingApple)}>{tr("Apple 연결 확인")}</Button><Button secondary onClick={()=>void run(async()=>{await clearAppleChallenge();setPendingIdentity(null);})}>{tr("연결 취소")}</Button></>}<p className="fine">{tr("계정을 연결하면 새 기기에서도 같은 정원을 이어갈 수 있어요.")}</p>{(['google','apple'] as const).map(provider=><IdentityButton disabled={working||!identityAvailable(provider)} key={provider} provider={provider} onClick={()=>void run(()=>link(provider))}/>)}{!identityAvailable('google')&&<p className="fine">{tr("계정 연결은 인증 설정이 완료된 앱에서 이용할 수 있어요.")}</p>}{conflict&&<div><h3>{tr("저장된 정원이 있어요")}</h3><p>{tr("현재:")}{' '}{player.nickname}{' '}{tr("· 레벨")}{' '}{player.level}<br/>{tr("연결 계정:")}{' '}{conflict.existing.nickname}{' '}{tr("· 레벨")}{' '}{conflict.existing.level}</p><p>{tr("진행과 재화는 합쳐지지 않아요.")}</p><Button onClick={()=>void run(async()=>{const r=await request<AuthResponse>('/auth/switch',{switchToken:conflict.switchToken});await installSession(r);location.reload()})}>{tr("기존 정원으로 전환")}</Button><Button secondary onClick={()=>setConflict(null)}>{tr("현재 정원 유지")}</Button></div>}</>}
   </div>
  </details>
  <details className="settings-disclosure settings-management">
   <summary className="settings-row">{tr('구매 및 계정 관리')}</summary>
   <div className="settings-disclosure-content">
    <Card title={tr("구매 내역")} tone="green"><Button secondary disabled={!purchases.available()||working} onClick={()=>void run(async()=>{await recoverStore()})}>{tr("구매 내역 동기화")}</Button>{purchaseIntents.length>0&&<><h3>{tr("확인 중인 구매")}</h3>{purchaseIntents.map(intent=><Row key={intent.id} icon="shop" title={productTitle(catalog.products.find(p=>p.id===intent.productId)||OFFER_PRODUCTS.find(p=>p.id===intent.productId))}><small>{intent.status==='pending'?tr("스토어 승인 대기 중"):intent.status==='review'?tr("구매 내역 검토 중"):tr("구매 요청 확인 대기")}</small>{intent.canCancel&&(cancelPurchaseId===intent.id?<><p className="fine">{tr("스토어에서 결제하지 않은 요청만 정리해 주세요. 이미 완료된 결제는 계속 확인하며, 결제 취소나 환불을 요청하지는 않아요.")}</p><Button secondary disabled={working} onClick={()=>void run(async()=>{await request('/purchases/intents/'+intent.id+'/cancel',{key:key()});setCancelPurchaseId(null);await loadPurchaseIntents();notify(tr("구매 요청을 정리했어요."))})}>{tr("요청 정리 확인")}</Button><Button secondary disabled={working} onClick={()=>setCancelPurchaseId(null)}>{tr("돌아가기")}</Button></>:<Button secondary disabled={working} onClick={()=>setCancelPurchaseId(intent.id)}>{tr("진행하지 않은 요청 정리")}</Button>)}</Row>)}<p className="fine">{tr("스토어 승인 대기 중에는 새로 결제하지 않아도 돼요. 승인 후 구매 내역 동기화를 누르면 확인할 수 있어요.")}</p></>}</Card>{canWatchAds&&<Card title={tr("광고 설정")} tone="blue"><Button secondary disabled={!rewardedAds.available()||working} onClick={()=>void run(()=>rewardedAds.privacyOptions())}>{tr("광고 개인정보 설정")}</Button>{status&&<p role="status">{tr(status)}</p>}{pendingAd&&<><p className="fine">{pendingAd.placement==='heart'?tr("하트"):tr("코인")}{' '}{tr("광고 보상")}{' '}{pendingAd.status==='granted'?tr("지급 완료"):tr("확인 내역")}</p><Button secondary onClick={()=>void run(checkAd)}>{tr("광고 보상 상태 확인")}</Button></>}</Card>}<Card title={t('settings.account')} tone="gold">{logoutConfirm?<><p className="fine">{tr("이 기기의 세션을 종료할까요?")}{' '}{linkedProviders.length?tr("연결한 계정으로 현재 정원을 다시 찾을 수 있어요."):tr("계정을 연결하지 않은 정원은 이 기기에서 다시 불러올 수 없어요. 먼저 계정을 연결해 주세요.")}</p><Button secondary disabled={working||!linkedProviders.length} onClick={()=>void run(async()=>{await request('/auth/logout',{});await clearSession();onLogout()})}>{tr("로그아웃 확인")}</Button><Button secondary disabled={working} onClick={()=>setLogoutConfirm(false)}>{tr("정원 유지")}</Button></>:<Button secondary disabled={working} onClick={()=>setLogoutConfirm(true)}>{tr("이 기기 로그아웃")}</Button>}<p className="fine">{tr("계정을 삭제하면 정원과 진행을 복구할 수 없어요. 삭제하려면 아래에 ‘삭제’를 입력하세요.")}</p><div className="input-frame" data-frame="panel"><input value={deleteText} onChange={e=>setDeleteText(e.target.value)} placeholder={tr("삭제")} aria-label={tr("계정 삭제 확인")}/></div><Button tone="red" className="account-delete-button" disabled={working||deleteText!==tr("삭제")} onClick={()=>void run(async()=>{const result=await request<{identityRevocation:string}>('/account',{confirmation:'DELETE'},'DELETE');await clearSession();await eraseLocalAccountData(player.id).catch(()=>{});if(result.identityRevocation==='manual')window.alert(tr('계정이 삭제됐어요. Apple 계정 설정에서 구름정원의 Apple 로그인 연결을 해제할 수 있어요.'));onLogout()})}>{tr("계정 삭제")}</Button></Card>
   </div>
  </details>
  <footer className="settings-footer">
   <LegalLinks compact locale={locale} onError={notify}/>
   <p>{t('brand.title')}{appVersion&&` · ${appVersion}`}</p>
  </footer>
 </div>;
 return <p>{tr("정원을 불러오고 있어요.")}</p>;
}
