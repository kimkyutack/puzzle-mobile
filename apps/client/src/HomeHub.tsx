import {tr,formatLocale} from "./i18n";
import {useEffect,useState} from 'react';
import type {Player,StoryState,GardenStyle,OffersResponse,ShopOffer} from '@garden/contracts';
import type {GardenWorldState} from '../../../packages/garden-world/src';
import {duration,serverNow,request} from './api';
import {Button,Icon,IconButton} from './ui';
import ArtSurface from './ArtSurface';
import {type GardenTask,type RestorationVisual} from './GardenScene';
import HomeGardenWorld from './garden-world/HomeGardenWorld';
import {useActivity,RewardDot} from './Activity';
import './home-hub.css';
interface Props {onPlayer:(player:Player)=>void;story:StoryState|null;styleBusy:boolean;onStyle:(taskId:string,style:GardenStyle)=>void;onStory:()=>void;player:Player;area:number;editing:boolean;selected:string;visual:RestorationVisual|null;confirmedWorld?:GardenWorldState|null;busy:boolean;resume:boolean;menu:string;onMenu:(page:string)=>void;onPlay:()=>void;onArea:(area:number)=>void;onSelect:(task:GardenTask)=>void;onRestore:(task:GardenTask)=>void;onCloseEditor:()=>void}
const compact=(value:number)=>value>=10000?new Intl.NumberFormat(formatLocale(),{notation:'compact',maximumFractionDigits:1}).format(value):value.toLocaleString(formatLocale());
export default function HomeHub(p:Props){
 const {player}=p;
 const {data:activity}=useActivity(),notifications=activity?.notifications;
 const now=serverNow(),unlimited=player.unlimitedUntil>now;
 const unread=p.story?.unlocked.filter(id=>!p.story!.seen.includes(id)).length||0;
 const newStory=unread>0||(player.level>=8&&!p.story?.completedEpisodes?.includes('bridge-v1'));
 const [offers,setOffers]=useState<ShopOffer[]>([]);
 useEffect(()=>{let live=true;setOffers([]);void request<OffersResponse>('/offers').then(result=>{if(live)setOffers(result.offers)},()=>{});return()=>{live=false}},[player.id,player.version]);
 const timed=offers.find(offer=>offer.product.offer?.kind==='timed'&&offer.status==='available'&&offer.endsAt>now);
 const deadline=(kind:'limited'|'chain')=>offers.find(offer=>offer.product.offer?.kind===kind&&offer.status==='available'&&offer.endsAt>now)?.endsAt;
 const remaining=(endsAt:number)=>endsAt-now>=86_400_000?Math.ceil((endsAt-now)/86_400_000)+tr('일 남음'):duration(endsAt-now);
 return <section className="home-hub" aria-label={tr("정원 홈")}>
  <header className="hub-header" data-art-root><ArtSurface/>
   <button className="hub-avatar" data-frame="event_sky_v9" data-frame-scale="0.11" aria-label={tr("내 프로필")} onClick={()=>p.onMenu('profile')}><Icon id="lumi" size={44}/></button>
   <button className="hub-counter" aria-label={tr("코인 상점 · 보유 ")+(player.coins+player.boundCoins)} onClick={()=>p.onMenu('shop')}><Icon id="coin" size={29}/><strong>{compact(player.coins+player.boundCoins)}</strong></button>
   <button className="hub-counter hub-hearts" aria-label={tr("하트 충전")} onClick={()=>p.onMenu('hearts')}><Icon id="heart" size={30}/><span><strong>{unlimited?'∞':player.hearts}</strong><small>{unlimited?duration(player.unlimitedUntil-now):player.hearts<5?duration(player.heartAt+3_600_000-now):tr("가득")}</small></span></button>
   <button className="hub-counter" aria-label={tr("정원 가꾸기")} onClick={()=>p.onMenu('garden')}><Icon id="star" size={29}/><strong>{compact(player.stars)}</strong></button>
   <IconButton id="settings" label={tr("설정")} onClick={()=>p.onMenu('settings')}/>
  </header>
  {!p.editing&&<>
   <aside className="hub-events hub-events-left hub-home-shortcuts" aria-label={tr('이야기와 이벤트')} data-art-root><ArtSurface/>
    <button aria-label={tr('루미의 기록')} onClick={p.onStory}><Icon id="story_letter_v8" size={54}/><span data-frame="event_sky_v9" data-frame-scale="0.11">{tr(newStory?'새 이야기':'루미의 기록')}</span>{newStory&&<b className="hub-menu-count"><Icon id="count_badge" size={25}/><span>{unread||'!'}</span></b>}</button>
    <button aria-label={tr('정원 패스')} onClick={()=>p.onMenu('pass')}><Icon id="rainbow" size={54}/><span data-frame="event_sky_v9" data-frame-scale="0.11">{tr('정원 패스')}</span><RewardDot count={notifications?.pass}/></button>
    <button aria-label={tr('순위')} onClick={()=>p.onMenu('ranking')}><Icon id="star" size={54}/><span data-frame="event_sky_v9" data-frame-scale="0.11">{tr('순위')}</span></button>
    <button aria-label={tr('미션')} onClick={()=>p.onMenu('missions')}><Icon id="story_letter_v8" size={54}/><span data-frame="event_sky_v9" data-frame-scale="0.11">{tr('미션')}</span><RewardDot count={notifications?.missions}/></button>
   </aside>
   <aside className="hub-events hub-events-right hub-home-shortcuts" aria-label={tr('패키지와 우편')} data-art-root><ArtSurface/>
    <button className="hub-offer-shortcut" aria-label={tr('한정 패키지')} onClick={()=>p.onMenu('offers-limited')}><Icon id="bundle_starter_v7" size={62}/>{deadline('limited')&&<small className="hub-offer-time">{remaining(deadline('limited')!)}</small>}<span data-frame="event_sky_v9" data-frame-scale="0.11">{tr('한정 패키지')}</span></button>
    <button className="hub-offer-shortcut" aria-label={tr('연쇄 패키지')} onClick={()=>p.onMenu('offers-chain')}><Icon id="bundle_tools_v7" size={62}/>{deadline('chain')&&<small className="hub-offer-time">{remaining(deadline('chain')!)}</small>}<span data-frame="event_sky_v9" data-frame-scale="0.11">{tr('연쇄 패키지')}</span></button>
    <button aria-label={tr('보물 카드')} onClick={()=>p.onMenu('treasure')}><Icon id="chest" size={54}/><span data-frame="event_sky_v9" data-frame-scale="0.11">{tr('보물 카드')}</span><RewardDot count={notifications?.minigame}/></button>
    <button aria-label={tr('선물함')} onClick={()=>p.onMenu('gifts')}><Icon id="mail" size={51}/><span data-frame="event_sky_v9" data-frame-scale="0.11">{tr('선물함')}</span><RewardDot count={notifications?.gifts}/></button>
   </aside>
  </>}
  <HomeGardenWorld styles={p.story?.styles} onStyle={p.onStyle} styleBusy={p.styleBusy} styleReady={!!p.story} player={player} editing={p.editing} area={p.area} onArea={p.onArea} onClose={p.onCloseEditor} onEdit={()=>p.onMenu('garden')} onPlayer={p.onPlayer} onRestore={p.onRestore} restoreBusy={p.busy} restoring={!!p.visual} visual={p.visual} confirmedWorld={p.confirmedWorld}/>
  {!p.editing&&<div className="hub-bottom" data-art-root><ArtSurface/>
   <button className="hub-milestone" data-frame="event_sky_v9" data-frame-scale="0.1" onClick={()=>p.onMenu('tools')} aria-label={tr('별빛 대폭탄 진행')}><Icon id="world-bomb" size={30}/><span>{tr('다음 대폭탄')}</span><div className="activity-meter"><i style={{width:10*(activity?.milestone.progress??0)+'%'}}/><span>{activity?.milestone.progress??0} / 10</span></div><small>{tr('보유')} {activity?.milestone.owned??0}</small></button>
   <div className="hub-main-actions"><Button className="hub-play" tone="green" onClick={p.onPlay}>{p.resume?tr("이어서 플레이"):tr("레벨 ")+player.level}</Button><Button className="hub-build" tone="gold" onClick={()=>p.onMenu('garden')}><Icon id="home" size={40}/><span>{tr("정원 꾸미기")}</span></Button></div>

  </div>}
 </section>;
}
