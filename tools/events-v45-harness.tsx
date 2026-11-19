import HomeHub from '../apps/client/src/HomeHub';
import {projectLiveGarden} from '../packages/garden-world/src/live';
import {FLOWERLIGHT_GARDEN_GIFTS,flowerlightGiftInstanceIds} from '../packages/content/src/flowerlight';
import {RESTORATIONS} from '@garden/content';
// Synthetic browser QA only. Unknown API calls are blocked; no production account is used.
import React,{useState} from 'react';
import {createRoot} from 'react-dom/client';
import type {Player,TreasureAttempt} from '@garden/contracts';
import {missionPeriod,treasureDeck,TREASURE_MAX_TURNS} from '@garden/content';
import {newPlayer} from '../apps/api/src/db';
import {createGame} from '@garden/core';
import PlayHud from '../apps/client/src/PlayHud';
import ArtSurface from '../apps/client/src/ArtSurface';
import {defaultOperationsRuntime} from '../packages/contracts/src/operations';
import {FLOWERLIGHT_ID,FLOWERLIGHT_DURATION} from '../packages/content/src/flowerlight';
import {animalExpeditionLevel,selectExpeditionRound,configuredExpeditionRound,expeditionRound} from '../packages/content/src/animal-expedition';
import {ANIMAL_EXPEDITION_STAGES} from '../packages/content/src/animal-expedition';
import expeditionProofs from '../packages/content/src/animal-expedition-proofs.json';
import legacyExpedition from '../tests/fixtures/animal-expedition-v1.json';
import {expeditionCacheKey} from '../apps/client/src/expedition-progress';
import {emptyPowerUses,POWER_FESTIVAL_DURATION} from '../packages/content/src/power-festival';
import {OperationsProvider} from '../apps/client/src/OperationsUI';
import {PowerFestivalProvider} from '../apps/client/src/PowerFestival';
import {ActivityProvider} from '../apps/client/src/Activity';
import EventsContent from '../apps/client/src/EventsContent';
import HubPage from '../apps/client/src/HubPage';
import HubNavigation,{type HubTab} from '../apps/client/src/HubNavigation';
import {Modal,Button} from '../apps/client/src/ui';
import {prepareAssets} from '../apps/client/src/assets';
import {configureSound} from '../apps/client/src/sound';
import {setLocale} from '../apps/client/src/i18n';
import '../apps/client/src/home-hub.css';import '../apps/client/src/friends.css';
import '../apps/client/src/style.css';import '../apps/client/src/fonts.css';
import '../apps/client/src/ui-v3.css';import '../apps/client/src/ui-v4.css';import '../apps/client/src/ui-v5.css';import '../apps/client/src/ui-v6.css';
import '../apps/client/src/ui-v7.css';import '../apps/client/src/ui-v8.css';import '../apps/client/src/ui-v9.css';import '../apps/client/src/context-v9.css';

const params=new URLSearchParams(location.search),now=Date.now(),period=missionPeriod('daily',now),runtime=defaultOperationsRuntime();
if(['panda','fox','red-panda'].includes(params.get('animal')??''))runtime.gameEvents.animalExpedition.animal=params.get('animal') as 'panda'|'fox'|'red-panda';
let player=newPlayer('events-tabs-v45-local-qa',now),flowerlightEntries=0,remaining=params.get('state')==='exhausted'?0:3,treasure:TreasureAttempt|null=null;
player.level=Number(params.get('level')??84);player.coins=1000;player.settings={...player.settings,sound:false,music:false,haptics:false};
if(params.get('state')==='complete'){player.flowerFestival={id:FLOWERLIGHT_ID,startedAt:now-60000,endsAt:now+FLOWERLIGHT_DURATION,petals:20,restoredStages:5};player.animalExpedition={completedStages:ANIMAL_EXPEDITION_STAGES.length,completedAttempts:[]};}
if(params.has('festival-stage'))player.flowerFestival={id:FLOWERLIGHT_ID,startedAt:now,endsAt:now+FLOWERLIGHT_DURATION,petals:Number(params.get('petals')??0),restoredStages:Number(params.get('festival-stage'))};
if(params.has('expedition-win')||params.has('expedition-stage')){
 const stage=Number(params.get('expedition-win')??params.get('expedition-stage')),legacy=params.get('legacy')==='1',proof=legacy?legacyExpedition:expeditionProofs.find(proof=>proof.stage===stage&&proof.variant===0)!;
 const attempt={id:'visual-win-'+stage+(legacy?'-legacy':''),stage,variant:0,startedAt:now,level:legacy?legacyExpedition.level as unknown as ReturnType<typeof animalExpeditionLevel>:animalExpeditionLevel(stage)};
 player.animalExpedition={completedStages:stage-1,completedAttempts:[],attempt};if(params.has('expedition-win'))localStorage.setItem(expeditionCacheKey(player.id,attempt.id),JSON.stringify(proof.actions));else localStorage.removeItem(expeditionCacheKey(player.id,attempt.id));
}
if(params.has('expedition-used')){player.animalExpedition??={completedStages:0,completedAttempts:[]};player.animalExpedition.dailyAttempts={day:period.id,used:Number(params.get('expedition-used'))};}
if(params.get('event-window')==='closed')runtime.gameEvents.animalExpedition.endsAt=now-1000;
if(params.get('rush')==='active')runtime.startBoosterRush.dailyTimes=[new Date(now+9*3600000).toISOString().slice(11,16)];
if(params.get('rush')==='off')runtime.startBoosterRush.enabled=false;
if(player.animalExpedition&&params.get('legacy')!=='1'){Object.assign(player.animalExpedition,configuredExpeditionRound(runtime));}
if(params.has('previous-round')){player.animalExpedition=selectExpeditionRound(player.animalExpedition,{roundId:'fox:002',animal:'fox'});runtime.gameEvents.animalExpedition.animal='fox';runtime.gameEvents.animalExpedition.roundId='002';}
player.restored=RESTORATIONS.filter(task=>task.area==='sky').map(task=>task.id);let festivalWorld=projectLiveGarden(player);
const originalFetch=fetch.bind(globalThis);
globalThis.fetch=async(input,init)=>{
 const url=new URL(input instanceof Request?input.url:String(input),location.href);
 if(!url.pathname.includes('/api/'))return originalFetch(input,init);
 const path=url.pathname.slice(url.pathname.indexOf('/api/')+4),body=typeof init?.body==='string'?JSON.parse(init.body):{};
 const envelope=(data:unknown)=>Response.json({data,serverNow:Date.now()});
 if(path==='/garden/world'){festivalWorld=projectLiveGarden(player,festivalWorld);return envelope({world:festivalWorld});}
 if(path==='/offers')return envelope({offers:[]});
 if(path==='/operations/bootstrap')return envelope({settings:runtime,notices:[],events:[],revision:0,maintenanceActive:false});
 if(path==='/progression')return envelope({player,milestone:{progress:7,owned:2},minigame:{remaining,maximum:3,active:treasure?.status==='playing'?treasure:null,nextReset:period.endsAt},notifications:{festival:0,minigame:Number(remaining>0),events:1,pass:0,flowerlight:Number(!player.flowerFestival),expedition:Number(!player.animalExpedition)}});
 if(path==='/flowerlight/start'){flowerlightEntries++;player=structuredClone(player);player.flowerFestival??={id:FLOWERLIGHT_ID,startedAt:Date.now(),endsAt:Date.now()+FLOWERLIGHT_DURATION,petals:0,restoredStages:0};}
 else if(path==='/flowerlight/restore'){player=structuredClone(player);player.flowerFestival!.restoredStages=body.stage;festivalWorld=projectLiveGarden(player,festivalWorld);const gift=FLOWERLIGHT_GARDEN_GIFTS[body.stage-1]!,ids=flowerlightGiftInstanceIds(gift);player.version++;return envelope({player,world:festivalWorld,granted:true,decoration:{installed:ids.filter(id=>!!festivalWorld.placements[id]),stored:ids.filter(id=>!festivalWorld.placements[id])}});}
 else if(path==='/animal-expedition/start'){player=structuredClone(player);player.animalExpedition=selectExpeditionRound(player.animalExpedition,expeditionRound(player.animalExpedition,body.roundId)??configuredExpeditionRound(runtime));const progress=player.animalExpedition,stage=progress.completedStages+1;if(!progress.attempt||body.restart){const used=progress.dailyAttempts?.day===period.id?progress.dailyAttempts.used:0;if(used>=3)return Response.json({error:{code:'EXPEDITION_DAILY_LIMIT',message:'오늘의 원정 도전 횟수를 모두 사용했어요.'}},{status:409});const variant=body.restart?((progress.attempt?.variant??0)+1)%3:0;progress.dailyAttempts={day:period.id,used:used+1};progress.attempt={id:crypto.randomUUID(),stage,variant,startedAt:Date.now(),level:animalExpeditionLevel(stage,variant)};}}
 else if(path==='/animal-expedition/finish'){
  player=structuredClone(player);const progress=player.animalExpedition!,attempt=progress.attempt!,reward=ANIMAL_EXPEDITION_STAGES[attempt.stage-1]!.reward;progress.completedStages=attempt.stage;progress.completedAttempts.push(attempt.id);delete progress.attempt;player.coins+=reward.coins;for(const [item,count] of Object.entries(reward.items))player.inventory[item as keyof typeof player.inventory].bound+=count!;player.version++;return envelope({player:structuredClone(player),granted:true,reward});
 }
 else if(path==='/events')return envelope({daily:{available:false,coins:50,nextReset:period.endsAt},season:null,personal:{progress:0,target:10,coins:300,claimed:true},guild:{progress:0,target:30,coins:100,claimed:true},pass:{points:0,premium:false,tiers:[],guildGifts:[]}});
 else if(path==='/power-festival/start'){player=structuredClone(player);player.powerFestival={id:crypto.randomUUID(),day:period.id,startedAt:Date.now(),endsAt:Date.now()+POWER_FESTIVAL_DURATION,counts:emptyPowerUses(),claimedStages:0};}
 else if(path==='/minigames/treasure/start'){
  treasure??={id:crypto.randomUUID(),day:period.id,deck:treasureDeck(45),maxTurns:TREASURE_MAX_TURNS,startedAt:now,expiresAt:period.endsAt,status:'playing'};remaining=Math.max(0,remaining-1);return envelope({player:structuredClone(player),attempt:treasure});
 }else throw Error('The local tab fixture blocked an unknown API call: '+path);
 player.version++;return envelope({player:structuredClone(player),granted:true});
};
function Fixture(){
 const seasonal=params.get('season-goals'),completed=seasonal==='claimed'||seasonal==='ready';
 const [current,setCurrent]=useState(player),[claimed,setClaimed]=useState(params.get('state')==='claimed'),[personalClaimed,setPersonalClaimed]=useState(seasonal==='claimed'),[guildClaimed,setGuildClaimed]=useState(completed),[active,setActive]=useState<HubTab>(params.has('home')?'home':'events'),[page,setPage]=useState('');
 const navigate=(value:string)=>{if(['home','events','shop','friends','guild'].includes(value)){setActive(value as HubTab);setPage('')}else if(['garden','garden-bag'].includes(value)){setActive('home');setPage(value)}else setPage(value)};
 const update=(next:Player)=>{player=structuredClone(next);setCurrent(player);};
 return <OperationsProvider><PowerFestivalProvider player={current} run={null} confirmedRun={null} onPlayer={update} beforeRequest={async()=>{}}><ActivityProvider player={current} active onPlayer={update}>
  <main className="game-shell" data-art-root data-fixture-flowerlight-entries={flowerlightEntries}>
   {active==='home'?<HomeHub player={current} onPlayer={update} story={null} styleBusy={false} onStyle={()=>{}} onStory={()=>setPage('story')} area={0} editing={page==='garden'||page==='garden-bag'} selected="" visual={null} busy={false} resume={false} menu={page} onMenu={navigate} onPlay={()=>setPage('start')} onArea={()=>{}} onSelect={()=>{}} onRestore={()=>{}} onCloseEditor={()=>setPage('')}/>:<HubPage page={active} player={current}>{active==='events'?<EventsContent player={current} mutate={async()=>{}} daily={{available:!claimed,coins:50,nextReset:period.endsAt}} attendance={{total:claimed?3:2,claimedDays:claimed?3:2,cycleDay:3,bonusItem:'hammer',bonusQuantity:1}} working={false} onClaim={()=>setClaimed(true)} season={params.get('season')==='off'?null:{id:'local-season',ends_at:now+86400000}} personal={{progress:completed?10:7,target:10,coins:300,claimed:personalClaimed}} guild={{progress:completed?30:14,target:30,coins:100,claimed:guildClaimed}} hasGuild onPage={navigate} onClaimSeason={kind=>kind==='personal'?setPersonalClaimed(true):setGuildClaimed(true)}/>:<Button onClick={()=>setActive('events')}>이벤트</Button>}</HubPage>}
   <HubNavigation active={active} onTab={setActive}/>
   {page&&!['garden','garden-bag'].includes(page)&&<Modal title={page==='start'?'레벨 시작 화면':'메뉴 이동 확인'} onClose={()=>setPage('')}><p data-fixture-route={page}>{page}</p></Modal>}
  </main>
 </ActivityProvider></PowerFestivalProvider></OperationsProvider>;
}
setLocale(params.get('lang')==='en'?'en':'ko');configureSound(false,false,false);await prepareAssets(()=>{});await document.fonts.load('16px Jua');await document.fonts.load('18px "Lilita One"');createRoot(document.getElementById('root')!).render(params.has('main-hud')?<main className="game-shell playing" data-art-root><ArtSurface/><PlayHud state={createGame(player.animalExpedition!.attempt!.level)} tool={null} locked={false} onCancelTool={()=>{}}/></main>:<Fixture/>);
