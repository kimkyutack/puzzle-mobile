import {homeIcon} from './home-icon-art';
import {homeCountdown} from './home-countdown';
import {StartGiftSummary} from './StartGift';
import {WeeklyEventShortcut} from './WeeklyEventPage';
import {useId,useLayoutEffect,useRef,useState} from 'react';
import GoldGardenEntry from './GoldGarden';
import {GOLD_GARDEN_INTERVAL} from '../../../packages/content/src/gold-garden';
import {gameEventAvailable,gameEventConfig} from '../../../packages/contracts/src/operations';
import {POWER_RAINBOW_LEVEL,POWER_RAINBOW_WINS,powerRainbowReached,powerRainbowUnlocked} from '@garden/contracts';
import {POWER_RAINBOW_ART} from './assets';
import {UnlimitedHomeShortcut} from './UnlimitedTools';
import {useOperations,featureEnabled} from './OperationsUI';
import {tr,t,formatLocale} from "./i18n";
import type {Player,StoryState,GardenStyle} from '@garden/contracts';
import type {GardenWorldState} from '../../../packages/garden-world/src';
import {duration,serverNow} from './api';
import {Button,Icon,IconButton} from './ui';
import ArtSurface from './ArtSurface';
import {type GardenTask,type RestorationVisual} from './GardenScene';
import HomeGardenWorld from './garden-world/HomeGardenWorld';
import {useAttention,RewardDot} from './Activity';
import './home-hub.css';
import './home-command-dock.css';
import './home-reference-icons.css';
import './home-exact-reference.css';
import './home-progress-v106.css';
import {childAccount} from './platform/account-age';
import HomeDockFace from './HomeDockFace';
import {PowerFestivalShortcut} from './PowerFestival';
import {GardenerAvatar} from './GardenerProfile';
import {useShopOffers} from './shop-offers';
import {useHomeRewardFlight} from './home-reward-flight';
interface Props {onGardenReady?:(ready:boolean)=>void;onPlayer:(player:Player)=>void;story:StoryState|null;styleBusy:boolean;onStyle:(taskId:string,style:GardenStyle)=>void;onStory:()=>void;player:Player;area:number;editing:boolean;selected:string;visual:RestorationVisual|null;confirmedWorld?:GardenWorldState|null;busy:boolean;preparingPuzzle?:boolean;rewardMotionBlocked?:boolean;resume:boolean;menu:string;onMenu:(page:string)=>void;onPlay:()=>void;onArea:(area:number)=>void;onSelect:(task:GardenTask)=>void;onRestore:(task:GardenTask)=>void;onCloseEditor:()=>void}
const compact=(value:number)=>value>=10000?new Intl.NumberFormat(formatLocale(),{notation:'compact',maximumFractionDigits:1}).format(value):value.toLocaleString(formatLocale());
const MENU_COLLAPSED_KEY='garden.home.extras-collapsed.v1';
export default function HomeHub(p:Props){
 const {player}=p,restricted=childAccount();const operations=useOperations(),show=(feature:Parameters<typeof featureEnabled>[0])=>featureEnabled(feature,operations.data);
 const header=useRef<HTMLElement>(null),rewardLayer=useRef<HTMLDivElement>(null);
 const [goldGardenOpen,setGoldGardenOpen]=useState(false);
 const [menuCollapsed,setMenuCollapsed]=useState(()=>{try{return localStorage.getItem(MENU_COLLAPSED_KEY)==='1'}catch{return false}});
 const extrasId=useId(),dockToggle=useRef<HTMLButtonElement>(null),mapHint=useRef<HTMLParagraphElement>(null);
 const toggleMenus=()=>{const next=!menuCollapsed;setMenuCollapsed(next);try{localStorage.setItem(MENU_COLLAPSED_KEY,next?'1':'0')}catch{}};
 const dock=useRef<HTMLDivElement>(null),[gardenInsets,setGardenInsets]=useState<{top:number;bottom:number}>();
 useLayoutEffect(()=>{
  if(p.editing){setGardenInsets(undefined);return;}
  const update=()=>{const home=header.current?.parentElement?.getBoundingClientRect(),head=header.current?.getBoundingClientRect(),bottom=dock.current?.getBoundingClientRect(),toggle=dockToggle.current?.getBoundingClientRect(),hint=mapHint.current?.getBoundingClientRect();if(!home||!head||!bottom)return;const next={top:Math.round(head.bottom-home.top+8),bottom:Math.round(home.bottom-Math.min(bottom.top,toggle?.top??bottom.top,hint?.top??bottom.top)+8)};setGardenInsets(previous=>previous?.top===next.top&&previous.bottom===next.bottom?previous:next);};
  const observer=new ResizeObserver(update);if(header.current){observer.observe(header.current);if(header.current.parentElement)observer.observe(header.current.parentElement);}if(dock.current)observer.observe(dock.current);if(mapHint.current)observer.observe(mapHint.current);update();window.addEventListener('resize',update);return()=>{observer.disconnect();window.removeEventListener('resize',update);};
 },[p.editing,player.id,menuCollapsed]);
 const wallet=useHomeRewardFlight(player,!p.editing&&!p.menu&&!p.rewardMotionBlocked&&!goldGardenOpen,header,rewardLayer);
 const {counts:notifications,liveEvents}=useAttention();
 const operationsAlert=(operations.unread+(operations.data?.supportUnread??0)+liveEvents+(notifications?.gifts??0))>0;
 const streak=Math.min(player.winStreak??0,POWER_RAINBOW_WINS),powered=powerRainbowUnlocked(player),rainbowOpen=powerRainbowReached(player);
 const now=serverNow(),unlimited=player.unlimitedUntil>now;
 const unread=p.story?.unlocked.filter(id=>!p.story!.seen.includes(id)).length||0;
 const newStory=unread>0||!!p.story&&(player.level>=8&&!p.story.completedEpisodes?.includes('bridge-v1'));
 const offers=useShopOffers(player,!restricted&&show('offers'),now);
 const shortcutOffer=(kind:'limited'|'chain')=>offers.find(offer=>offer.product.offer?.kind===kind&&offer.status==='available')??
  offers.find(offer=>offer.product.offer?.kind===kind);
 const limited=shortcutOffer('limited'),chain=shortcutOffer('chain');
 const remaining=(endsAt:number)=>homeCountdown(endsAt-now,true);
 const levelButton=<Button className={'hub-play'+(p.resume?' is-resume':'')} tone="green" disabled={p.preparingPuzzle} onClick={p.onPlay}>{p.preparingPuzzle?tr('퍼즐 준비 중…'):p.resume?tr("이어서 플레이"):tr("레벨 ")+player.level}{!p.preparingPuzzle&&!p.resume&&homeIcon('play','')&&<Icon id={homeIcon('play','')} size={20}/>}</Button>;
 return <section className="home-hub home-command-home home-progress-v106" aria-label={tr("정원 홈")}>
  <header ref={header} className="hub-header" data-art-root><ArtSurface/>
   <button className="hub-avatar" aria-label={tr("내 프로필")} onClick={()=>p.onMenu('profile')}>{!player.profileAppearance?.customImage&&(!player.profileAppearance?.avatar||player.profileAppearance.avatar==='lumi')?<Icon id={homeIcon('avatar','lumi_happy')} size={44}/>:<GardenerAvatar avatar={player.profileAppearance?.avatar} customImage={player.profileAppearance?.customImage} size={44}/>}</button>
   <button className="hub-counter" data-reward-target="coins" aria-label={tr("코인 상점 · 보유 ")+wallet.coins} onClick={()=>p.onMenu('shop')}><HomeDockFace/><Icon id={homeIcon('header-coin','coin')} size={29}/><strong>{compact(wallet.coins)}</strong></button>
   <button className="hub-counter hub-hearts" data-hearts-full={!unlimited&&player.hearts>=5} aria-label={tr("하트 충전")} onClick={()=>p.onMenu('hearts')}><HomeDockFace/><Icon id={homeIcon('header-heart','heart')} size={30}/><span><strong>{unlimited?'∞':player.hearts}</strong><small>{unlimited?duration(player.unlimitedUntil-now):player.hearts<5?duration(player.heartAt+3_600_000-now):tr("가득")}</small></span></button>
   <button className="hub-counter" data-reward-target="stars" aria-label={tr("정원 가꾸기")} onClick={()=>p.onMenu('garden')}><HomeDockFace/><Icon id={homeIcon('header-star','star')} size={29}/><strong>{compact(wallet.stars)}</strong></button>
   <span className={'ops-settings-wrap'+(operationsAlert?' has-source-alert':'')}><IconButton id={homeIcon(operationsAlert?'settings-alert':'settings','settings')} label={tr("설정")} onClick={()=>p.onMenu('settings')}/>{operationsAlert&&<i className="ops-unread" aria-label={tr('새 운영 알림')}/>}</span>
  </header>
  <HomeGardenWorld onReadyChange={p.onGardenReady} homeInsets={gardenInsets} openBag={p.menu==='garden-bag'} styles={p.story?.styles} onStyle={p.onStyle} styleBusy={p.styleBusy} styleReady={!!p.story} player={player} editing={p.editing} area={p.area} onArea={p.onArea} onClose={p.onCloseEditor} onEdit={()=>p.onMenu('garden')} onPlayer={p.onPlayer} onRestore={p.onRestore} restoreBusy={p.busy} restoring={!!p.visual} visual={p.visual} confirmedWorld={p.confirmedWorld}/>
  {!p.editing&&<>
   <aside className="home-promotions" aria-label={tr('패키지')}>
    {([limited,chain] as const).filter(offer=>!!offer).map(offer=><button key={offer!.product.id} className="home-promotion" aria-label={tr(offer!.product.offer?.kind==='chain'?'연쇄 패키지':'한정 패키지')} onClick={()=>p.onMenu(offer!.product.offer?.kind==='chain'?'offers-chain':'offers-limited')}>
     <Icon id={homeIcon(offer!.product.offer?.kind==='chain'?'chain-promo':'promo',offer!.product.offer?.kind==='chain'?'bundle_tools_v7':'bundle_starter_v7')} size={57}/>
     {offer!.status==='available'&&<small className="home-promotion-time" role="timer" aria-live="off">{remaining(offer!.endsAt)}</small>}
     <span>{t(offer!.product.offer?.kind==='chain'?'home.short.chain':'home.short.limited')}</span>
    </button>)}
   </aside>
   <div ref={dock} className="hub-bottom home-command-dock" data-collapsed={menuCollapsed} data-art-root><HomeDockFace/><ArtSurface/>
    <p ref={mapHint} className="hub-map-hint"><span>{tr('끌어서 둘러보기 · 두 손가락으로 확대·축소')}</span></p>
    <button ref={dockToggle} type="button" className="home-dock-toggle" aria-expanded={!menuCollapsed} aria-controls={extrasId} aria-label={t(menuCollapsed?'home.menu.expand':'home.menu.collapse')} onClick={toggleMenus}><span className="home-toggle-tab" aria-hidden="true"/><span className="home-toggle-chevron" aria-hidden="true"/></button>
    <div id={extrasId} className="home-dock-extras" aria-hidden={menuCollapsed} inert={menuCollapsed}><div className="home-dock-extras-content">
    <div className="home-rewards-row"><div className="home-streak-rainbow">
     <StartGiftSummary player={player} compact dock homeCard onInfo={()=>p.onMenu('start-gift')}/>
     <button className="home-rainbow-chip" data-rainbow-open={rainbowOpen} aria-label={t('powerRainbow.name')+' · '+(rainbowOpen?t('powerRainbow.streak',{count:streak,target:POWER_RAINBOW_WINS}):t('powerRainbow.locked',{level:POWER_RAINBOW_LEVEL}))} onClick={()=>p.onMenu('power-rainbow')}>
      <Icon id={homeIcon('rainbow',powered?POWER_RAINBOW_ART:'rainbow')} size={28}/><span className="home-rainbow-title">{t('powerRainbow.name')}</span><strong>{rainbowOpen?`${streak}/${POWER_RAINBOW_WINS}`:t('home.progress.unlock',{level:POWER_RAINBOW_LEVEL})}</strong>
     </button>
     </div>{show('powerFestival')&&<PowerFestivalShortcut onOpen={()=>p.onMenu('power-festival')}/>}
    </div>
    <nav className="home-utility-menu" aria-label={tr('이야기와 이벤트')}>
     <button aria-label={tr('루미의 기록')} onClick={p.onStory}><Icon id={homeIcon('journal','story_letter_v8')} size={40}/><span>{t('home.short.story')}</span>{newStory&&<RewardDot count={unread||1}/>}</button>
     {show('pass')&&<button aria-label={tr('정원 패스')} onClick={()=>p.onMenu('pass')}><Icon id={homeIcon('pass','chest')} size={40}/><span>{t('home.short.pass')}</span><RewardDot count={notifications?.pass}/></button>}
     {!restricted&&<button aria-label={tr('순위')} onClick={()=>p.onMenu('ranking')}><Icon id={homeIcon('ranking','ranking_trophy_v51')} size={40}/><span>{tr('순위')}</span></button>}
     {show('missions')&&<button aria-label={tr('미션')} onClick={()=>p.onMenu('missions')}><Icon id={homeIcon('missions','missions_menu_v51')} size={40}/><span>{tr('미션')}</span><RewardDot count={notifications?.missions}/></button>}
     <UnlimitedHomeShortcut dock onOpen={()=>p.onMenu('start-rush')}/>
     <WeeklyEventShortcut dock player={player} onOpen={p.onMenu}/>
     {!(player.level>=gameEventConfig('flowerlight',operations.data?.settings).minLevel&&show('flowerlight')&&(gameEventAvailable('flowerlight',operations.data?.settings,now)||!!player.flowerFestival)||player.level>=gameEventConfig('animalExpedition',operations.data?.settings).minLevel&&show('animalExpedition')&&(gameEventAvailable('animalExpedition',operations.data?.settings,now)||!!player.animalExpedition))&&show('treasure')&&<button aria-label={tr('보물 카드')} onClick={()=>p.onMenu('treasure')}><Icon id="chest" size={40}/><span>{tr('보물 카드')}</span><RewardDot count={notifications?.minigame}/></button>}
    </nav>
    </div></div>
    <div className="hub-main-actions" aria-busy={p.preparingPuzzle}>
     <GoldGardenEntry key={player.id+':'+Math.floor((player.level-1)/GOLD_GARDEN_INTERVAL)} player={player} buttonClassName="hub-play" fallback={levelButton} onPlayer={p.onPlayer} onRoundOpenChange={setGoldGardenOpen}/>
     <Button className="hub-build" tone="gold" onClick={()=>p.onMenu('garden')}><Icon id={homeIcon('home','home')} size={35}/><span>{tr('정원 꾸미기')}</span></Button>
    </div>
   </div>
  </>}
  <div ref={rewardLayer} className="home-reward-flight" aria-hidden="true"/>
 </section>;
}
