import {useRef,useState} from 'react';
import GoldGardenEntry from './GoldGarden';
import {GOLD_GARDEN_INTERVAL} from '../../../packages/content/src/gold-garden';
import {gameEventAvailable,gameEventConfig} from '../../../packages/contracts/src/operations';
import {POWER_RAINBOW_LEVEL,POWER_RAINBOW_WINS,powerRainbowReached,powerRainbowUnlocked} from '@garden/contracts';
import {POWER_RAINBOW_ART} from './assets';
import StartBoosterRush from './StartBoosterRush';
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
import {childAccount} from './platform/account-age';
import {PowerFestivalShortcut} from './PowerFestival';
import {GardenerAvatar} from './GardenerProfile';
import {useShopOffers} from './shop-offers';
import {useHomeRewardFlight} from './home-reward-flight';
interface Props {onPlayer:(player:Player)=>void;story:StoryState|null;styleBusy:boolean;onStyle:(taskId:string,style:GardenStyle)=>void;onStory:()=>void;player:Player;area:number;editing:boolean;selected:string;visual:RestorationVisual|null;confirmedWorld?:GardenWorldState|null;busy:boolean;preparingPuzzle?:boolean;rewardMotionBlocked?:boolean;resume:boolean;menu:string;onMenu:(page:string)=>void;onPlay:()=>void;onArea:(area:number)=>void;onSelect:(task:GardenTask)=>void;onRestore:(task:GardenTask)=>void;onCloseEditor:()=>void}
const compact=(value:number)=>value>=10000?new Intl.NumberFormat(formatLocale(),{notation:'compact',maximumFractionDigits:1}).format(value):value.toLocaleString(formatLocale());
export default function HomeHub(p:Props){
 const {player}=p,restricted=childAccount();const operations=useOperations(),show=(feature:Parameters<typeof featureEnabled>[0])=>featureEnabled(feature,operations.data);
 const header=useRef<HTMLElement>(null),rewardLayer=useRef<HTMLDivElement>(null);
 const [goldGardenOpen,setGoldGardenOpen]=useState(false);
 const wallet=useHomeRewardFlight(player,!p.editing&&!p.menu&&!p.rewardMotionBlocked&&!goldGardenOpen,header,rewardLayer);
 const {counts:notifications,liveEvents}=useAttention();
 const streak=Math.min(player.winStreak??0,POWER_RAINBOW_WINS),powered=powerRainbowUnlocked(player),rainbowOpen=powerRainbowReached(player);
 const now=serverNow(),unlimited=player.unlimitedUntil>now;
 const unread=p.story?.unlocked.filter(id=>!p.story!.seen.includes(id)).length||0;
 const newStory=unread>0||!!p.story&&(player.level>=8&&!p.story.completedEpisodes?.includes('bridge-v1'));
 const offers=useShopOffers(player,!restricted&&show('offers'),now);
 const shortcutOffer=(kind:'limited'|'chain')=>offers.find(offer=>offer.product.offer?.kind===kind&&offer.status==='available')??
  offers.find(offer=>offer.product.offer?.kind===kind);
 const limited=shortcutOffer('limited'),chain=shortcutOffer('chain');
 const remaining=(endsAt:number)=>endsAt-now>=86_400_000?Math.ceil((endsAt-now)/86_400_000)+tr('일 남음'):duration(endsAt-now);
 const levelButton=<Button className="hub-play" tone="green" disabled={p.preparingPuzzle} onClick={p.onPlay}>{p.preparingPuzzle?tr('퍼즐 준비 중…'):p.resume?tr("이어서 플레이"):tr("레벨 ")+player.level}</Button>;
 return <section className="home-hub" aria-label={tr("정원 홈")}>
  <header ref={header} className="hub-header" data-art-root><ArtSurface/>
   <button className="hub-avatar" data-frame="event_sky_v9" data-frame-scale="0.11" aria-label={tr("내 프로필")} onClick={()=>p.onMenu('profile')}><GardenerAvatar avatar={player.profileAppearance?.avatar} size={44}/></button>
   <button className="hub-counter" data-reward-target="coins" aria-label={tr("코인 상점 · 보유 ")+wallet.coins} onClick={()=>p.onMenu('shop')}><Icon id="coin" size={29}/><strong>{compact(wallet.coins)}</strong></button>
   <button className="hub-counter hub-hearts" aria-label={tr("하트 충전")} onClick={()=>p.onMenu('hearts')}><Icon id="heart" size={30}/><span><strong>{unlimited?'∞':player.hearts}</strong><small>{unlimited?duration(player.unlimitedUntil-now):player.hearts<5?duration(player.heartAt+3_600_000-now):tr("가득")}</small></span></button>
   <button className="hub-counter" data-reward-target="stars" aria-label={tr("정원 가꾸기")} onClick={()=>p.onMenu('garden')}><Icon id="star" size={29}/><strong>{compact(wallet.stars)}</strong></button>
   <span className="ops-settings-wrap"><IconButton id="settings" label={tr("설정")} onClick={()=>p.onMenu('settings')}/>{(operations.unread+(operations.data?.supportUnread??0)+liveEvents)>0&&<i className="ops-unread" aria-label={tr('새 운영 알림')}/>}</span>
  </header>
  {!p.editing&&<>
   <aside className="hub-events hub-events-left hub-home-shortcuts" aria-label={tr('이야기와 이벤트')} data-art-root><ArtSurface/>
    <button aria-label={tr('루미의 기록')} onClick={p.onStory}><Icon id="story_letter_v8" size={54}/><span data-frame="event_sky_v9" data-frame-scale="0.11">{tr(newStory?'새 이야기':'루미의 기록')}</span>{newStory&&<b className="hub-menu-count"><Icon id="count_badge" size={25}/><span>{unread||'!'}</span></b>}</button>
    {show('pass')&&<button aria-label={tr('정원 패스')} onClick={()=>p.onMenu('pass')}><Icon id="rainbow" size={54}/><span data-frame="event_sky_v9" data-frame-scale="0.11">{tr('정원 패스')}</span><RewardDot count={notifications?.pass}/></button>}
    {!restricted&&<button aria-label={tr('순위')} onClick={()=>p.onMenu('ranking')}><Icon id="ranking_trophy_v51" size={54}/><span data-frame="event_sky_v9" data-frame-scale="0.11">{tr('순위')}</span></button>}
    {show('missions')&&<button aria-label={tr('미션')} onClick={()=>p.onMenu('missions')}><Icon id="missions_menu_v51" size={54}/><span data-frame="event_sky_v9" data-frame-scale="0.11">{tr('미션')}</span><RewardDot count={notifications?.missions}/></button>}
   </aside>
   <aside className="hub-events hub-events-right hub-home-shortcuts" aria-label={tr('패키지와 우편')} data-art-root><ArtSurface/>
    {limited&&<button className="hub-offer-shortcut" aria-label={tr('한정 패키지')} onClick={()=>p.onMenu('offers-limited')}><Icon id="bundle_starter_v7" size={62}/>{limited.status==='available'&&<small className="hub-offer-time">{remaining(limited.endsAt)}</small>}<span data-frame="event_sky_v9" data-frame-scale="0.11">{tr('한정 패키지')}</span></button>}
    {chain&&<button className="hub-offer-shortcut" aria-label={tr('연쇄 패키지')} onClick={()=>p.onMenu('offers-chain')}><Icon id="bundle_tools_v7" size={62}/>{chain.status==='available'&&<small className="hub-offer-time">{remaining(chain.endsAt)}</small>}<span data-frame="event_sky_v9" data-frame-scale="0.11">{tr('연쇄 패키지')}</span></button>}
    {!(player.level>=gameEventConfig('flowerlight',operations.data?.settings).minLevel&&show('flowerlight')&&(gameEventAvailable('flowerlight',operations.data?.settings,now)||!!player.flowerFestival)||player.level>=gameEventConfig('animalExpedition',operations.data?.settings).minLevel&&show('animalExpedition')&&(gameEventAvailable('animalExpedition',operations.data?.settings,now)||!!player.animalExpedition))&&show('treasure')&&<button aria-label={tr('보물 카드')} onClick={()=>p.onMenu('treasure')}><Icon id="chest" size={54}/><span data-frame="event_sky_v9" data-frame-scale="0.11">{tr('보물 카드')}</span><RewardDot count={notifications?.minigame}/></button>}
    <button aria-label={tr('선물함')} onClick={()=>p.onMenu('gifts')}><Icon id="mail" size={51}/><span data-frame="event_sky_v9" data-frame-scale="0.11">{tr('선물함')}</span><RewardDot count={notifications?.gifts}/></button>
   </aside>
  </>}
  <HomeGardenWorld openBag={p.menu==='garden-bag'} styles={p.story?.styles} onStyle={p.onStyle} styleBusy={p.styleBusy} styleReady={!!p.story} player={player} editing={p.editing} area={p.area} onArea={p.onArea} onClose={p.onCloseEditor} onEdit={()=>p.onMenu('garden')} onPlayer={p.onPlayer} onRestore={p.onRestore} restoreBusy={p.busy} restoring={!!p.visual} visual={p.visual} confirmedWorld={p.confirmedWorld}/>
  {!p.editing&&<div className="hub-bottom" data-art-root><ArtSurface/>
   <p className="hub-map-hint"><span>{tr('끌어서 둘러보기 · 두 손가락으로 확대')}</span></p>
   <StartBoosterRush/><div className="hub-progress-row"><button className="hub-milestone" data-frame={powered?'event_violet_v9':'event_sky_v9'} data-frame-scale="0.1" onClick={()=>p.onMenu('power-rainbow')} data-locked={!rainbowOpen||undefined} aria-label={t('powerRainbow.name')+' · '+(rainbowOpen?t('powerRainbow.streak',{count:streak,target:POWER_RAINBOW_WINS}):t('powerRainbow.locked',{level:POWER_RAINBOW_LEVEL}))}><Icon id={powered?POWER_RAINBOW_ART:'rainbow'} size={30}/><span>{t('powerRainbow.name')}</span><div className="activity-meter"><i style={{width:(rainbowOpen?streak/POWER_RAINBOW_WINS*100:Math.min(100,(player.level-1)/(POWER_RAINBOW_LEVEL-1)*100))+'%'}}/><span>{rainbowOpen?`${streak} / ${POWER_RAINBOW_WINS}`:t('powerRainbow.locked',{level:POWER_RAINBOW_LEVEL})}</span></div></button>{show('powerFestival')&&<PowerFestivalShortcut onOpen={()=>p.onMenu('power-festival')}/>}</div>
   <div className="hub-main-actions" aria-busy={p.preparingPuzzle}>
    <GoldGardenEntry key={player.id+':'+Math.floor((player.level-1)/GOLD_GARDEN_INTERVAL)} player={player}
     buttonClassName="hub-play" fallback={levelButton} onPlayer={p.onPlayer} onRoundOpenChange={setGoldGardenOpen}/>
    <Button className="hub-build" tone="gold" onClick={()=>p.onMenu('garden')}><Icon id="home" size={40}/><span>{tr("정원 꾸미기")}</span></Button>
   </div>

  </div>}
  <div ref={rewardLayer} className="home-reward-flight" aria-hidden="true"/>
 </section>;
}
