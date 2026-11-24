import {contextualItemGuide,itemGuideAllows,learnedItemGuidance} from './item-guidance';
import {ItemLessonGuide,ItemLessonInvitation,itemLessonHint} from './ItemLessonGuide';
import {StartGiftArrival,StartGiftInfoModal} from './StartGift';
import WeeklyEventPage from './WeeklyEventPage';
import UnlimitedToolsModal from './UnlimitedTools';
import {isWeeklyEvent,weeklyEvent} from '../../../packages/contracts/src/weekly-events';
import {startBoosterCells} from './lumi-intro';
import {CONTINUE_COSTS} from '@garden/contracts';
import {gameEventConfig,gameEventAvailable} from '../../../packages/contracts/src/operations';
import {featureEnabled,OperationsMenu,useOperations} from './OperationsUI';
import {startBoosterWindow} from '../../../packages/contracts/src/start-booster-rush';
import {tr} from "./i18n";
import {useCallback,useEffect,useMemo,useRef,useState,type CSSProperties} from 'react';
import {freeStartTrialItem,supportsEngine} from '@garden/contracts';
import type {Action,AuthResponse,Booster,GameEvent,GameState,Player,PreBooster,Run,StateResponse,RewardIntent,StoryScene} from '@garden/contracts';
import {stateHash,type CascadeFrame} from '@garden/core';
import {createPuzzleExecutor} from './puzzle-executor';
import {deferredWrite} from './after-paint';
import {availableBooster,backgroundSave} from './local-play';
import {applyPreferences,rememberPreferences,pendingPreferences,confirmPreferences,comfortKeys} from './play-preferences';
import {AREAS,RESTORATIONS,STORY_SCENES,storyForTask,getUnlockedStories} from '@garden/content';
import type {GardenWorldState} from '../../../packages/garden-world/src';
import {prepareAssets,goalArt,POWER_RAINBOW_ART} from './assets';
import {ApiFailure,key,request,serverNow,duration,clearSession} from './api';
import {onResume,onGuidedBack,rewardedAds,purchases,setSceneChrome} from './platform';
import {childAccount} from './platform/account-age';
import {configureSound,pauseAudio,sound,startMusic} from './sound';
import ArtSurface from './ArtSurface';
import Board from './CascadeBoard';
import {BOARD_REFERENCE_COLUMNS} from './board-geometry';
import PlayHud from './PlayHud';
import CampaignDeviceHint from './CampaignDeviceHint';
import Menus from './Menus';
import {ActivityProvider,MissionMenu,TreasureMenu} from './Activity';
import HiddenMissionModal,{HiddenMissionPlayBadge} from './HiddenMissionModal';
import {hiddenMissionAnnouncement,predictedHiddenMission,visibleHiddenMission} from './hidden-mission-state';
import {FlowerlightFestival} from './ContentEvents';
import AnimalExpedition from './AnimalExpedition';
import HomeHub from './HomeHub';
import {FirstGardenGuide,FirstGardenBuilding,FirstPuzzleRetry} from './FirstGardenGuide';
import {FIRST_GARDEN_RESTORATION,firstGardenStep,firstPuzzleResult} from './first-garden-tutorial';
import {rememberPuzzleReward} from './home-rewards';
import HubNavigation,{currentHubRoute,isGuildSubpage,type HubRoute} from './HubNavigation';
import HubPage from './HubPage';
import {FriendProfiles} from './FriendProfiles';
import StartLevelModal from './StartLevelModal';
import BridgeEpisode from './BridgeEpisode';
import LoadingScreen from './LoadingScreen';
import './loading-story.css';
import {StoryViewer,StoryJournal} from './StoryUI';
import {useStory} from './useStory';
import {Button,Icon,IconButton,Modal,Card,LinkAction,FrameFace,names} from './ui';
import {EndRunMenu,RunContinueMenu,RunPauseMenu} from './RunMenus';
import {GardenScene,GardenEditor,type GardenTask,type RestorationVisual} from './GardenScene';
import {featureHelp,unseenBoardFeatures} from './feature-help';
import {cacheHelp,knownHelp,pendingHelp,rememberHelp,completeHelpSync} from './help-history';
import {applyPlayerLanguage,useI18n,translateText} from './i18n';
import {syncLanguagePreference} from './locale-preference';
import {reconcileCachedRun,type CachedRun} from './recovery';
import {pendingMutation} from './mutation-recovery';
import {HeartStartFlow} from './heart-start-flow';
import {createRunGateway} from './run-gateway';
import {needsFinish,nextPreviewLevel} from './completion';
import WinModal from './WinModal';
import {PowerFestivalProvider,PowerFestivalBar,PowerFestivalDialog} from './PowerFestival';
import {powerUses,addPowerUses} from '../../../packages/content/src/power-festival';
import {showFestival} from './power-festival-state';
import {hiddenMissionKind} from '../../../packages/content/src/hidden-power-missions';
interface RunResponse {player:Player;run:Run;events?:GameEvent[]}
const menuTitles:Record<string,string>={notices:'공지사항',support:'고객센터',"live-events":'이벤트 보상',offers:'한정 패키지','offers-limited':'한정 패키지','offers-timed':'타임 특가','offers-chain':'연쇄 패키지',shop:'상점',hearts:'하트 충전',ranking:'순위표',guild:'우리 길드',gifts:'선물함',settings:'설정',profile:'나의 정원사',events:'무료 선물',pass:'정원 패스'};
const cacheKey=(id:string)=>`cloud-garden-run-${id}`;
export default function App(){
 const {t}=useI18n();const operations=useOperations(),startRush=startBoosterWindow(operations.data?.settings.startBoosterRush,serverNow());
 const [player,setPlayer]=useState<Player|null>(null),[run,setRun]=useState<Run|null>(null),[screen,setScreen]=useState<HubRoute|'play'>(()=>childAccount()?'home':currentHubRoute());
 const [menu,setMenu]=useState(''),[ready,setReady]=useState(false),[progress,setProgress]=useState(0),[error,setError]=useState('');
 const heartStartFlow=useRef(new HeartStartFlow());
 const [continuing,setContinuing]=useState(false);
 const [restart,setRestart]=useState<{userId:string;levelId:number}|null>(null);
 const [busy,setBusy]=useState(false),[animating,setAnimating]=useState(false),[offline,setOffline]=useState(!navigator.onLine),[pending,setPending]=useState(false);
 const runGateway=useRef(createRunGateway(request));
 const [startError,setStartError]=useState(''),[startContentRevision,setStartContentRevision]=useState(0);
 const loadStartLevel=useCallback((id:number)=>runGateway.current.preview(id).then(result=>result.level),[]);
 const peekStartLevel=useCallback((id:number)=>runGateway.current.peek(id)?.level,[]);
 useEffect(()=>{if(ready&&player)void loadStartLevel(player.level).catch(()=>{});},[ready,player?.id,player?.level,startContentRevision,loadStartLevel]);
 const [lastAction,setLastAction]=useState<Action|undefined>();
 const [frames,setFrames]=useState<CascadeFrame[]>([]),[boardDisplay,setBoardDisplay]=useState<{runId:string;state:GameState}|null>(null);
 const [events,setEvents]=useState<GameEvent[]>([]),[tool,setTool]=useState<Booster|null>(null),[preBoosters,setPreBoosters]=useState<PreBooster[]>([]);
 const [notice,setNotice]=useState(''),[tutorial,setTutorial]=useState(true),[clock,setClock]=useState(0),[area,setArea]=useState(0);
 const weeklyKey=weeklyEvent(serverNow()).key;
 useEffect(()=>{
  if(!player)return;
  const marker='weekly-event-cache:'+player.id;
  try{
   if(localStorage.getItem(marker)===weeklyKey)return;
   const attempts=new Set(player.weeklyEventKey!==weeklyKey?[]:[player.animalExpedition?.attempt?.id,...Object.values(player.gardenGames??{}).flatMap(progress=>Object.values(progress.rounds).map(round=>round.attempt?.id))].filter(Boolean));
   for(const storageKey of Object.keys(localStorage)){
    if((storageKey.startsWith('animal-expedition-v1:'+player.id+':')||storageKey.startsWith('garden-game-actions:'))&&!attempts.has(storageKey.split(':').at(-1)))localStorage.removeItem(storageKey);
   }
   localStorage.setItem(marker,weeklyKey);
  }catch{/* Expired attempts are also rejected by the server. */}
 },[player?.id,weeklyKey]);
 const [selectedGarden,setSelectedGarden]=useState(''),[gardenBusy,setGardenBusy]=useState(false),[restorationVisual,setRestorationVisual]=useState<RestorationVisual|null>(null);
 const [restoredWorld,setRestoredWorld]=useState<GardenWorldState|null>(null);
 const [firstGardenMapReady,setFirstGardenMapReady]=useState(false);
 const [firstGardenLoadAttempt,setFirstGardenLoadAttempt]=useState(0);
 const restorationGuard=useRef(false),restoreGeneration=useRef(0);
 const firstRestorationBusy=useRef(false);
 const firstStep=firstGardenStep(player,run);
 const firstBuilding=firstRestorationBusy.current&&!!restorationVisual;
 const [activeStory,setActiveStory]=useState<StoryScene|null>(null),[pendingStory,setPendingStory]=useState<string|null>(null),[storyError,setStoryError]=useState('');
 const [storyListOpen,setStoryListOpen]=useState(false);
 const storyReturn=useRef(''),storyCloseGuard=useRef(false);
 const gardenTimers=useRef<ReturnType<typeof setTimeout>[]>([]);
 useEffect(()=>()=>gardenTimers.current.forEach(clearTimeout),[]);
 const [adStatus,setAdStatus]=useState(''),[adIntent,setAdIntent]=useState<RewardIntent|null>(null);
 const [authRecovery,setAuthRecovery]=useState(false);const [unlock,setUnlock]=useState<string|null>(null);const [updateRequired,setUpdateRequired]=useState(false);
 useEffect(()=>{void setSceneChrome(screen!=='home'||(!!menu&&menu!=='garden')||!!unlock||!!activeStory).catch(()=>{});},[screen,menu,unlock,activeStory]);
 useEffect(()=>{const pop=()=>{const step=firstGardenStep(playerRef.current,runRef.current);if(firstRestorationBusy.current){history.replaceState({gardenTab:'home'},'','#/home');setScreen('home');return;}if(step){history.replaceState({gardenTab:'home'},'','#/home');setScreen(step==='puzzle'&&runRef.current?'play':'home');if(step==='restore')setMenu('');return;}heartStartFlow.current.cancel();setScreen(childAccount()?'home':currentHubRoute());setMenu('');setTool(null);setActiveStory(null);};window.addEventListener('popstate',pop);return()=>window.removeEventListener('popstate',pop);},[]);
 const guildPageAvailable=!!player&&!player.guildId&&player.level>=5;
 useEffect(()=>{
  if(!player||guildPageAvailable||!isGuildSubpage(screen))return;
  if(currentHubRoute()===screen)history.replaceState({gardenTab:'guild'},'','#/guild');
  setScreen('guild');
 },[player,guildPageAvailable,screen]);
 const ensureVersion=(r:Run)=>{if(!supportsEngine(r.state.engineVersion)||!supportsEngine(r.level.engineVersion)){setUpdateRequired(true);throw new Error(tr("새로운 퍼즐 버전이 필요해요. 앱을 업데이트한 뒤 같은 판을 이어가세요."));}};
 const playerRef=useRef<Player|null>(null),runRef=useRef<Run|null>(null),confirmed=useRef<Run|null>(null),cache=useRef<CachedRun|null>(null),syncing=useRef<Promise<void>|null>(null),finishing=useRef(false),starting=useRef<string|null>(null),inputGuard=useRef(false),startGuard=useRef(false),continueGuard=useRef(false);
 const [calculating,setCalculating]=useState(false);
 const puzzleExecutor=useRef<ReturnType<typeof createPuzzleExecutor>|null>(null);
 useEffect(()=>{const executor=createPuzzleExecutor();puzzleExecutor.current=executor;return()=>{puzzleExecutor.current=null;executor.dispose();}},[]);
 useEffect(()=>{++restoreGeneration.current;restorationGuard.current=false;setGardenBusy(false);firstRestorationBusy.current=false;setRestorationVisual(null);setRestoredWorld(null);gardenTimers.current.forEach(clearTimeout);gardenTimers.current=[];return()=>{++restoreGeneration.current;gardenTimers.current.forEach(clearTimeout);};},[player?.id]);
 const updatePlayer=(p:Player)=>{if(playerRef.current?.id===p.id&&playerRef.current.version>p.version)return;p=applyPreferences(p);configureSound(p.settings.sound,p.settings.haptics,p.settings.music);cacheHelp(p.id,p.tutorials);applyPlayerLanguage(p);playerRef.current=p;setPlayer(p)};
 const updateRun=(r:Run|null)=>{if(r){ensureVersion(r);const current=runRef.current;if(current?.id===r.id&&stateHash(current.state)===stateHash(r.state))r={...r,state:current.state};}runRef.current=r;setRun(r)};
 const notify=useCallback((s:string)=>{setNotice(translateText(s))},[]);
 const wasStartRushActive=useRef(startRush.active);
 useEffect(()=>{
  if(wasStartRushActive.current&&!startRush.active&&menu==='start'&&player&&!startGuard.current){
   const trial=freeStartTrialItem(peekStartLevel(nextPreviewLevel(player.level,run)),player);
   if(preBoosters.some(item=>item!==trial)){
    setPreBoosters(preBoosters.filter(item=>item===trial));
    starting.current=null;
    notify(tr('시작 아이템 무제한 시간이 끝났어요. 도구를 다시 선택해 주세요.'));
   }
  }
  wasStartRushActive.current=startRush.active;
 },[startRush.active,menu,player,run,preBoosters,peekStartLevel,notify]);
 useEffect(()=>{if(!notice)return;const timer=setTimeout(()=>setNotice(''),4200);return()=>clearTimeout(timer)},[notice]);
 const narrative=useStory(player,notify);
 useEffect(()=>{if(!pendingStory||screen!=='home'||menu||activeStory||restorationVisual||!player)return;const scene=STORY_SCENES.find(item=>item.id===pendingStory);setPendingStory(null);if(scene&&getUnlockedStories(player).includes(scene.id)&&!narrative.story?.seen.includes(scene.id)){storyReturn.current=scene.taskId?'garden':'';setStoryError('');setActiveStory(scene);}},[pendingStory,screen,menu,activeStory,restorationVisual,player?.restored,player?.level,narrative.story]);
 const pendingDiscovery=useRef<{runId:string;features:string[]}|null>(null);
 const itemHelpSeen=player?knownHelp(player.id,player.tutorials):[];
 const itemGuide=useMemo(()=>screen==='play'&&run&&!menu&&!unlock&&!tool&&!(tutorial&&run.state.turn===0&&run.level.tutorial?.feature==='swap')?contextualItemGuide(run.state,itemHelpSeen):null,[screen,run?.state,menu,unlock,tool,tutorial,itemHelpSeen.join('|')]);
 const screenRef=useRef(screen);screenRef.current=screen;
 const menuRef=useRef(menu);menuRef.current=menu;
 useEffect(()=>{
  if(!firstStep&&!firstBuilding)return;
  let disposed=false,release:(()=>void)|undefined;
  void onGuidedBack(()=>{const step=firstGardenStep(playerRef.current,runRef.current);if(step==='puzzle'){if(runRef.current){setScreen('play');if(runRef.current.state.status!=='won')setMenu('');}else setScreen('home');}else if(step==='restore'){setScreen('home');setMenu('');}}).then(clean=>{if(disposed)clean();else release=clean;});
  return()=>{disposed=true;release?.();};
 },[firstStep,firstBuilding]);
 useEffect(()=>{if(firstStep==='restore'&&screen!=='play'&&screen!=='home'){setScreen('home');setMenu('');}},[firstStep,screen]);

 const visualBarrier=useRef<{active:boolean;waiters:Set<()=>void>}>({active:false,waiters:new Set()});
 const settleVisuals=useCallback(()=>{visualBarrier.current.active=false;inputGuard.current=false;setAnimating(false);for(const resolve of visualBarrier.current.waiters)resolve();visualBarrier.current.waiters.clear();},[]);
 const startVisuals=useCallback((_durationMs:number)=>{visualBarrier.current.active=true;setAnimating(true);},[]);
 function holdVisuals(_valid=true){if(screenRef.current!=='play'){settleVisuals();return;}visualBarrier.current.active=true;setAnimating(true);}
 useEffect(()=>()=>{for(const resolve of visualBarrier.current.waiters)resolve();visualBarrier.current.waiters.clear();visualBarrier.current.active=false},[]);
 useEffect(()=>{if(screen!=='play')settleVisuals()},[screen,settleVisuals]);
 const helpSyncing=useRef(false);
 async function flushHelp(){const p=playerRef.current;if(!p||helpSyncing.current||!navigator.onLine||!pendingHelp(p.id).length)return;helpSyncing.current=true;try{while(playerRef.current?.id===p.id&&navigator.onLine){const pending=pendingHelp(p.id);if(!pending.length)break;const response=await request<{player:Player}>('/me',{tutorials:knownHelp(p.id,playerRef.current.tutorials)},'PATCH');if(playerRef.current?.id!==p.id)return;updatePlayer(response.player);completeHelpSync(p.id,pending);}}catch{/* The durable discovery and pending acknowledgement survive offline play and restart. */}finally{helpSyncing.current=false}}
 function acknowledgeHelp(feature?:string){const p=playerRef.current;if(p&&feature&&!knownHelp(p.id,p.tutorials).includes(feature)){rememberHelp(p.id,[feature]);void flushHelp();}setUnlock(null);setTutorial(false);}
 useEffect(()=>{if(!run||!player||screen!=='play'||menu||unlock||animating||itemGuide||run.state.status!=='playing')return;const seen=knownHelp(player.id,player.tutorials),queued=pendingDiscovery.current?.runId===run.id?pendingDiscovery.current.features:[];const feature=queued.find(item=>!seen.includes(item))??unseenBoardFeatures(run.state,seen)[0];if(feature){rememberHelp(player.id,[feature]);setUnlock(feature);void flushHelp();}},[run?.id,run?.state,player?.tutorials,screen,menu,unlock,animating,itemGuide]);
 const awaitingBatchBase=()=>!!cache.current?.batch&&cache.current.batch.sequence!==confirmed.current?.sequence;
 const writeCache=()=>{const p=playerRef.current;if(p&&cache.current&&runRef.current?.userId===p.id){cache.current.baseSequence=cache.current.batch?.sequence??confirmed.current?.sequence;if(needsFinish(runRef.current))cache.current.finishPending=true;else delete cache.current.finishPending;localStorage.setItem(cacheKey(p.id),JSON.stringify(cache.current));}};
 const cacheWriter=useRef<ReturnType<typeof deferredWrite>|null>(null);
 cacheWriter.current??=deferredWrite(()=>{try{writeCache();}catch{setError(tr('이 기기에 진행을 보관할 수 없어요. 저장 공간을 확인해 주세요.'));}});
 const persist=(defer=false)=>{if(defer)cacheWriter.current?.schedule();else{cacheWriter.current?.cancel();writeCache();}setPending(!!(cache.current?.queue.length||cache.current?.finishPending||cache.current?.abandonPending))};
 useEffect(()=>{
  const flush=()=>cacheWriter.current?.flush(),hidden=()=>{if(document.hidden)flush();};
  window.addEventListener('pagehide',flush);window.addEventListener('garden:audio-pause',flush);document.addEventListener('visibilitychange',hidden);
  return()=>{flush();window.removeEventListener('pagehide',flush);window.removeEventListener('garden:audio-pause',flush);document.removeEventListener('visibilitychange',hidden);};
 },[]);
 const victorySound=useRef<string|null>(null);
 const presentedHiddenMission=useRef('');
 const hiddenMissionsEnabled=operations.data?.settings.features.missions!==false;
 useEffect(()=>{
  if(!run||run.state.status!=='won'||screen!=='play'||menu||animating)return;
  const id=run.id;
  const user=playerRef.current;
  const now=serverNow();
  const storageKey=`cloud-garden-hidden-mission-announcement-${user?.id}`;
  function isUnseen(notice:string|undefined){
   if(!notice||presentedHiddenMission.current===storageKey+':'+notice)return false;
   try{return localStorage.getItem(storageKey)!==notice;}catch{return true;}
  }
  const mission=visibleHiddenMission(user?.hiddenPowerMission,now);
  const predicted=mission&&predictedHiddenMission(mission,run,confirmed.current,now);
  const mayHaveMission=hiddenMissionsEnabled&&(isUnseen(hiddenMissionAnnouncement(predicted,now))||
   user?.level===run.level.id&&hiddenMissionKind(run.level.id));
  // Wait for the existing save on relevant wins. Offline results still open with the normal pending reward.
  const waitForSave=mayHaveMission&&run.status!=='won'&&!offline;
  const timer=setTimeout(()=>{
   const latest=runRef.current;
   if(latest?.id!==id||latest.state.status!=='won'||screenRef.current!=='play'||menuRef.current||visualBarrier.current.active||playerRef.current?.id!==user?.id)return;
   if(victorySound.current!==id){victorySound.current=id;sound('win');}
   const announcement=latest.status==='won'&&hiddenMissionsEnabled?hiddenMissionAnnouncement(playerRef.current?.hiddenPowerMission,serverNow()):undefined;
   if(announcement&&isUnseen(announcement)){
    presentedHiddenMission.current=storageKey+':'+announcement;
    try{localStorage.setItem(storageKey,announcement);}catch{/* The in-memory marker still applies. */}
    setMenu('hidden-mission');
   }else setMenu('win');
  },waitForSave?8000:180);
  return()=>clearTimeout(timer);
 },[run?.id,run?.state.status,run?.status,screen,menu,animating,offline,hiddenMissionsEnabled]);
 const clearNoticeRun=useRef<string|null>(null);
 function confirmedClear(res:RunResponse){
  rememberPuzzleReward(res.player,res.run);
  if(!res.run.reward||clearNoticeRun.current===res.run.id)return;
  clearNoticeRun.current=res.run.id;
  if(res.player.level===2)setPendingStory('letters-prologue');
  if(res.player.level===gameEventConfig('animalExpedition',operations.data?.settings).minLevel&&gameEventAvailable('animalExpedition',operations.data?.settings,serverNow()))notify(tr('동물 구출 원정이 열렸어요! 이벤트에서 숲속 친구들을 만나 보세요.'));
  if(res.player.level===5)notify(tr("무료 무제한과 길드가 열렸어요!"));
 }
 const ownsRun=(r:Run)=>playerRef.current?.id===r.userId&&confirmed.current?.id===r.id&&cache.current?.runId===r.id;
 function clearLocalRun(userId:string){
  cacheWriter.current?.cancel();
  localStorage.removeItem(cacheKey(userId));
  cache.current=null;confirmed.current=null;updateRun(null);setPending(false);
 }
 async function finish(){
  const r=confirmed.current;
  if(!r||finishing.current||cache.current?.queue.length||!needsFinish(r))return;
  finishing.current=true;
  persist();
  try{
   const res=await request<RunResponse>(`/runs/${r.id}/finish`,{key:`finish-${r.id}`});
   if(!ownsRun(r))return;
   updatePlayer(res.player);confirmed.current=res.run;updateRun(res.run);confirmedClear(res);persist();
  }finally{finishing.current=false;}
 }
 async function sync(){
  if(syncing.current)return syncing.current;
  const initial=confirmed.current;
  if(!initial||!ownsRun(initial)||!navigator.onLine)return;
  ensureVersion(initial);
  const work=(async()=>{
   try{
    while(ownsRun(initial)&&cache.current?.queue.length){
     const c=cache.current,r=confirmed.current!;
     const batch=c.batch??{id:key(),sequence:r.sequence,actions:c.queue.slice(0,200),
      ...(runRef.current?.state.status==='won'&&c.queue.length<=200?{finishOnWin:true}:{})};
     c.batch=batch;persist();
     const res=await request<RunResponse>(`/runs/${r.id}/actions`,{
      idempotencyKey:batch.id,sequence:batch.sequence,actions:batch.actions,...(batch.finishOnWin?{finishOnWin:true}:{}),
     });
     if(!ownsRun(initial)||cache.current!==c)return;
     const decision=reconcileCachedRun(confirmed.current!,c,res.run);
     if(decision.kind==='conflict'){
      localStorage.setItem(cacheKey(r.userId)+'-conflict',JSON.stringify(decision.archive));
      setMenu(value=>value==='win'||value==='hidden-mission'?'':value);
     }
     cache.current=decision.cache;
     const current=confirmed.current!;
     confirmed.current=current.sequence>res.run.sequence?current:res.run;
     updatePlayer(res.player);updateRun(decision.run);confirmedClear(res);persist();setOffline(false);
    }
    if(!ownsRun(initial))return;
    if(cache.current?.abandonPending){
     const res=await request<RunResponse>(`/runs/${initial.id}/abandon`,{key:`abandon-${initial.id}`});
     if(!ownsRun(initial))return;
     updatePlayer(res.player);confirmedClear(res);clearLocalRun(initial.userId);setOffline(false);
    }else if(needsFinish(confirmed.current)){
     await finish();
     if(ownsRun(initial))setOffline(false);
    }
   }catch(e){
    if(!ownsRun(initial))return;
    if(!(e instanceof ApiFailure)||e.code==='NETWORK'){setOffline(true);return;}
    if(cache.current?.abandonPending&&e.code==='RUN_NOT_FOUND'){
     clearLocalRun(initial.userId);setOffline(false);notify(e.message);return;
    }
    const canReconcile=['STALE_SEQUENCE','SEQUENCE_MISMATCH','RUN_EXPIRED','RUN_CLOSED','ITEMS_EMPTY','INVALID_ACTION','INVALID_TARGET','ENGINE_ERROR','IDEMPOTENCY_CONFLICT'].includes(e.code);
    if(!canReconcile){notify(e.message);return;}
    try{
     const {run:latest}=await request<{run:Run}>(`/runs/${initial.id}`);
     if(!ownsRun(initial))return;
     localStorage.setItem(cacheKey(initial.userId)+'-conflict',JSON.stringify(cache.current));
     const abandon=!!cache.current?.abandonPending&&latest.status==='active'&&latest.state.status!=='won';
     if(latest.status==='expired'||latest.expiresAt<=serverNow()||cache.current?.abandonPending&&latest.status!=='active'){
      clearLocalRun(initial.userId);
      setScreen('home');setMenu('');
     }else{
      cache.current={runId:latest.id,queue:[],...(abandon?{abandonPending:true}:{})};
      confirmed.current=latest;updateRun(latest);persist();
      if(latest.state.status!=='won')setMenu(value=>value==='win'||value==='hidden-mission'?'':value);
     }
     setOffline(false);void refresh().then(()=>{
      const player=playerRef.current;
      if(player)rememberPuzzleReward(player,latest);
     }).catch(()=>{});
     notify(tr('다른 기기의 최신 진행을 불러왔어요. 이 기기의 미저장 기록은 별도로 보관했어요.'));
    }catch(recoveryError){
     if(!ownsRun(initial))return;
     if(recoveryError instanceof ApiFailure&&recoveryError.code!=='NETWORK')notify(recoveryError.message);
     else setOffline(true);
    }
   }
  })();
  syncing.current=work;
  try{await work;}finally{if(syncing.current===work)syncing.current=null;}
 }
 const saveScheduler=useRef<ReturnType<typeof backgroundSave>|null>(null);
 saveScheduler.current??=backgroundSave(()=>sync());
 useEffect(()=>()=>saveScheduler.current?.cancel(),[]);
 const preferenceSync=useRef(false);
 async function flushPreferences(){const p=playerRef.current;if(!p||preferenceSync.current||!navigator.onLine)return;const values=pendingPreferences(p.id);if(!Object.keys(values).length)return;preferenceSync.current=true;try{const res=await request<{player:Player}>('/me',{key:key(),settings:values},'PATCH');if(playerRef.current?.id!==p.id)return;confirmPreferences(p.id,values,res.player.settings);updatePlayer(res.player);}catch{/* The device preference remains effective while offline. */}finally{preferenceSync.current=false;}}
 async function refresh(){const res=await request<StateResponse>('/me');res.player=await syncLanguagePreference(res.player,async language=>(await request<{player:Player}>('/me',{key:key(),settings:{language}},'PATCH')).player);updatePlayer(res.player);const active=res.activeRun,current=confirmed.current;if(active&&runRef.current?.id===active.id&&current?.id===active.id&&active.sequence>=current.sequence&&current.status==='active'&&!cache.current?.queue.length){confirmed.current=active;updateRun(active);}}
 function retryConnection(){
  if(!navigator.onLine)return;
  if(cache.current?.queue.length||cache.current?.abandonPending||needsFinish(runRef.current)){
   void sync().catch(()=>{});
   return;
  }
  // A continuation may have committed even if its response was lost.
  void refresh().then(()=>setOffline(false),()=>setOffline(true));
 }
 async function mutate(path:string,body:Record<string,unknown>={},method?:string){
  const p=playerRef.current!,settings=path==='/me'&&body.settings&&typeof body.settings==='object'?body.settings as Record<string,unknown>:null;
  if(settings&&comfortKeys.some(key=>typeof settings[key]==='boolean')){rememberPreferences(p.id,settings);updatePlayer({...p,settings:{...p.settings}});}
  const command=pendingMutation(p.id,path,body,method);
  try{const res=await request<{player?:Player;world?:GardenWorldState}>(path,{...body,key:command.id},method);command.complete();if(playerRef.current?.id!==p.id)return res;if(res.player){if(settings)confirmPreferences(p.id,settings,res.player.settings);updatePlayer(res.player);}else await refresh();if(res.world&&path.startsWith('/pass/'))setRestoredWorld(res.world);window.dispatchEvent(new Event('garden:activity-changed'));return res;}catch(error){if(error instanceof ApiFailure&&!['INTERNAL_ERROR','NETWORK'].includes(error.code))command.complete();throw error;}
 }
 async function start(first=false){
  if(startGuard.current||continueGuard.current)return;
  if(cache.current?.abandonPending){void sync();setStartError(t('status.endingRun'));return;}
  if(cache.current?.queue.length||needsFinish(runRef.current)){
   void sync();
   setStartError(cache.current?.queue.length?t('status.saving'):tr('보상을 확인하고 있어요.'));
   return;
  }
  startGuard.current=true;setBusy(true);setError('');setStartError('');starting.current??=key();
  const trial=player?freeStartTrialItem(peekStartLevel(nextPreviewLevel(player.level,run)),player):undefined;
  try{
   const current=playerRef.current!,selected=first?[]:preBoosters;
   const res=await runGateway.current.start({
    idempotencyKey:starting.current,
    preBoosters:selected,
    freeStartBoosters:selected.some(item=>item!==trial)&&startBoosterWindow(operations.data?.settings.startBoosterRush,serverNow()).active,
    useFreeStartTrial:trial!==undefined&&selected.includes(trial),
    levelId:current.level
   });starting.current=null;settleVisuals();pendingDiscovery.current=null;setUnlock(null);updatePlayer(res.player);confirmed.current=res.run;updateRun(res.run);cache.current={runId:res.run.id,queue:[]};if(res.run.level.id===2){rememberHelp(res.player.id,['lumi-items-invite-v1']);void flushHelp();}persist();setScreen('play');setMenu('');setPreBoosters([]);setTool(null);setEvents([]);setFrames([]);setLastAction(undefined);setTutorial(!knownHelp(res.player.id,res.player.tutorials).includes(res.run.level.tutorial?.feature||''));sound('button');
  }catch(e){
   if(e instanceof ApiFailure&&e.code==='START_BOOSTER_EVENT_ENDED'){starting.current=null;setPreBoosters([]);operations.refresh();}
   if(e instanceof ApiFailure&&e.code==='START_BOOSTER_TRIAL_USED'){starting.current=null;setPreBoosters([]);await refresh().catch(()=>{});}
   if(e&&typeof e==='object'&&'code' in e&&e.code==='CONTENT_CHANGED'){await refresh().catch(()=>{});setStartContentRevision(n=>n+1);}
   const message=e instanceof Error?e.message:tr("시작하지 못했어요.");setStartError(message);notify(message);
   if(e instanceof ApiFailure&&/HEART|LIFE/.test(e.code)){starting.current=null;heartStartFlow.current.waitForHearts();setMenu('hearts')}
  }finally{setBusy(false);startGuard.current=false;}
 }
 useEffect(()=>{
  if(!pending)setStartError(current=>[t('status.saving'),t('status.endingRun'),tr('보상을 확인하고 있어요.')].includes(current)?'':current);
 },[pending]);
 useEffect(()=>{let cancelled=false;async function boot(){try{
   await Promise.all([prepareAssets(setProgress),document.fonts.load('18px Jua'),document.fonts.load('18px "Lilita One"')]);
   const res=await request<StateResponse>('/me');
   if(cancelled)return;try{res.player=await syncLanguagePreference(res.player,async language=>(await request<{player:Player}>('/me',{key:key(),settings:{language}},'PATCH')).player)}catch{notify(tr("언어는 이 기기에 저장했어요. 연결되면 다시 동기화해요."))}if(cancelled)return;updatePlayer(res.player);setReady(true);void flushHelp();void flushPreferences();if(res.activeRun)ensureVersion(res.activeRun);
   if(purchases.available())void purchases.recover(res.player.id,input=>request('/purchases/verify',input)).finally(refresh).catch(()=>notify(tr("이전 구매 확인을 설정에서 다시 시도할 수 있어요.")));
   let saved:CachedRun|null=null;
   try{
    const raw=localStorage.getItem(cacheKey(res.player.id)),decoded=raw?JSON.parse(raw) as CachedRun:null;
    if(typeof decoded?.runId==='string'&&Array.isArray(decoded.queue))saved=decoded;
   }catch{/* invalid cache ignored */}
   if(saved&&saved.runId!==res.activeRun?.id&&(saved.finishPending||saved.batch?.finishOnWin)){
    void request<{run:Run}>(`/runs/${encodeURIComponent(saved.runId)}`).then(async({run})=>{
     if(cancelled||!run.reward||playerRef.current?.id!==run.userId)return;
     if(playerRef.current.level<=run.level.id)await refresh();
     const player=playerRef.current;
     if(!cancelled&&player)rememberPuzzleReward(player,run);
    }).catch(()=>{});
   }
   if(res.activeRun&&res.activeRun.status==='active'&&res.activeRun.expiresAt>serverNow()){
    confirmed.current=res.activeRun;
    const decision=reconcileCachedRun(res.activeRun,saved);
    cache.current=decision.cache;
    if(decision.kind==='conflict')localStorage.setItem(cacheKey(res.player.id)+'-conflict',JSON.stringify(decision.archive));
    setTutorial(!knownHelp(res.player.id,res.player.tutorials).includes(res.activeRun.level.tutorial?.feature||''));
    updateRun(decision.run);persist();
    if(!decision.cache.abandonPending)setScreen('play');
    void sync().catch(error=>notify(error instanceof Error?error.message:tr('보상을 확인하고 있어요.')));
   }else{
    if(saved?.abandonPending)localStorage.removeItem(cacheKey(res.player.id));
    if(sessionStorage.getItem('garden-recover-account')==='1'){
     sessionStorage.removeItem('garden-recover-account');setScreen('home');setMenu('settings');
    }else if(res.player.level===1&&!saved?.abandonPending)await start(true);
   }
  }catch(e){if(!cancelled){setError(e instanceof Error?e.message:tr("정원을 불러오지 못했어요."));if(e instanceof ApiFailure&&['UNAUTHORIZED','ACCOUNT_NOT_FOUND','SESSION_EXPIRED','AUTH_REQUIRED','REFRESH_EXPIRED'].includes(e.code))setAuthRecovery(true);}}}void boot();return()=>{cancelled=true}},[]);
 useEffect(()=>{const timer=setInterval(()=>setClock(n=>n+1),1000);const online=()=>{setOffline(false);void flushHelp();void flushPreferences();void sync().then(refresh).catch(()=>{})};const no=()=>setOffline(true);window.addEventListener('online',online);window.addEventListener('offline',no);const visibility=()=>{if(document.hidden){pauseAudio();void sync();}else{void flushPreferences();void sync().then(refresh).catch(()=>{});startMusic()}};document.addEventListener('visibilitychange',visibility);window.addEventListener('garden:audio-pause',pauseAudio);window.addEventListener('garden:audio-resume',startMusic);let release:(()=>void)|undefined;void onResume(online).then(v=>{release=v});return()=>{clearInterval(timer);window.removeEventListener('online',online);window.removeEventListener('offline',no);document.removeEventListener('visibilitychange',visibility);window.removeEventListener('garden:audio-pause',pauseAudio);window.removeEventListener('garden:audio-resume',startMusic);release?.()}},[]);
 useEffect(()=>{if(!pending)return;const timer=setInterval(()=>{void sync()},5000);return()=>clearInterval(timer)},[pending]);
 useEffect(()=>{if(!adIntent||!['reserved','pending','review'].includes(adIntent.status))return;let cancelled=false,attempts=0;const timer=setInterval(()=>{if(++attempts>6){clearInterval(timer);return;}void request<{intent:RewardIntent|null}>('/ads/reward-intents/'+adIntent.id).then(r=>{if(cancelled||!r.intent)return;setAdIntent(r.intent);if(r.intent.status==='granted'){setAdStatus(tr("추가 코인을 받았어요!"));void refresh();clearInterval(timer);}}).catch(()=>{});},2000);return()=>{cancelled=true;clearInterval(timer)};},[adIntent?.id]);
 useEffect(()=>{
  if(screen==='play'&&run?.state.status==='lost'&&!menu&&!animating)setMenu('fail');
  if(run?.state.status==='playing'&&menu==='fail')setMenu('');
  if(run?.state.status==='error')setError(tr('퍼즐 처리에 오류가 있어요. 보상은 지급하지 않고 판을 보관했어요.'));
 },[run?.state.status,screen,animating,menu]);
 async function act(action:Action){const r=runRef.current,executor=puzzleExecutor.current;if(!r||!executor||updateRequired||inputGuard.current||busy||awaitingBatchBase()||cache.current?.abandonPending||visualBarrier.current.active||r.state.status!=='playing')return;inputGuard.current=true;
  if(itemGuide&&!itemGuideAllows(itemGuide,action)){inputGuard.current=false;return;}
  if(action.type==='booster'&&(!playerRef.current||availableBooster(playerRef.current,cache.current?.queue??[],action.item)<=0)){notify(tr("아이템이 부족해요."));inputGuard.current=false;return;}
  holdVisuals();setCalculating(true);
  try{const result=await executor.apply(r.state,action);
  if(puzzleExecutor.current!==executor||!ownsRun(r)||runRef.current?.state!==r.state)return;
  setFrames(result.frames);setLastAction(action);setEvents(result.events);holdVisuals(result.accepted);
  if(result.accepted){const p=playerRef.current;if(p){const learned=learnedItemGuidance(itemGuide,result.events,knownHelp(p.id,p.tutorials));if(learned.length){rememberHelp(p.id,learned);void flushHelp();}}updateRun({...r,state:result.state,powerUses:addPowerUses(r.powerUses,powerUses(result.events))});cache.current!.queue.push(action);persist(true);if(action.type==='booster')setTool(null);if(tutorial&&r.state.turn===0)acknowledgeHelp(r.level.tutorial?.feature);else setTutorial(false);
   const made=result.events.flatMap(e=>e.type==='spawn'&&e.kind&&['wind-row','wind-column','bomb','glider','rainbow','beehive'].includes(e.kind)?[e.kind]:[]);
   if(made.length)pendingDiscovery.current={runId:r.id,features:[...new Set([...(pendingDiscovery.current?.runId===r.id?pendingDiscovery.current.features:[]),...made])]};
   if(result.state.status==='won')void loadStartLevel(r.level.id+1).catch(()=>{});
   if(result.state.status==='won'||result.state.status==='lost'){saveScheduler.current?.cancel();void sync();}else saveScheduler.current?.schedule();
  }else{sound('invalid');notify(result.reason==='PIPE_END_REQUIRED'?tr('양 끝의 자석을 타격해 주세요.'):result.reason==='WIND_SEED_REQUIRED'?tr('바람 씨앗으로 풍차를 타격해 주세요.'):result.reason==='PLANTER_COVERED'?tr('연결된 장치를 먼저 맞혀 화분을 드러내 주세요.'):result.reason==='DEVICE_GATE_REQUIRED'?tr('표시된 장치를 작동시켜 문을 열어 주세요.'):action.type==='booster'?(action.item==='color-magnet'?tr('일반 타일을 골라 같은 색을 모아요.'):tr('이 칸에는 사용할 수 없어요.')):result.reason==='not_adjacent'?tr("바로 옆 칸과 바꿔 주세요."):tr("같은 색 블록 3개를 연결해 보세요."));}
  }catch(error){if(puzzleExecutor.current===executor&&ownsRun(r)){settleVisuals();setError(error instanceof Error?error.message:tr('퍼즐 처리에 오류가 있어요.'));}}
  finally{if(puzzleExecutor.current===executor)setCalculating(false);inputGuard.current=false;}
 }
 async function continueRun(){
  const r=confirmed.current;
  if(!r||!ownsRun(r)||continueGuard.current||cache.current?.abandonPending)return;
  if(cache.current?.queue.length||!navigator.onLine){void sync();notify(t('status.saving'));return;}
  const cost=CONTINUE_COSTS[r.continues];
  if(r.state.status!=='lost'||cost===undefined)return;
  continueGuard.current=true;setContinuing(true);
  try{
   const res=await request<RunResponse>(`/runs/${r.id}/continue`,{
    key:`continue-${r.id}-${r.sequence}`,sequence:r.sequence,expectedCost:cost,
   });
   if(!ownsRun(r))return;
   updatePlayer(res.player);confirmed.current=res.run;updateRun(res.run);persist();setOffline(false);
   if(screenRef.current==='play'&&menuRef.current==='fail')setMenu('');
  }catch(e){
   if(ownsRun(r)){
    if(e instanceof ApiFailure&&e.code==='NETWORK')setOffline(true);
    notify(e instanceof Error?e.message:tr('이어할 수 없어요.'));
   }
  }finally{continueGuard.current=false;setContinuing(false);}
 }
 function saveAndReturnHome(){
  if(firstGardenStep(playerRef.current,runRef.current)==='puzzle'||firstBuilding)return;
  setScreen('home');setMenu('');setTool(null);
  void sync().catch(()=>{});
 }
 function abandonCurrentRun(tutorialRetry=false){
  if(!tutorialRetry&&firstGardenStep(playerRef.current,runRef.current))return;
  const r=runRef.current;
  if(!r||!ownsRun(r)||r.status!=='active'||r.state.status==='won'||continueGuard.current||!cache.current||cache.current.abandonPending)return;
  cache.current.abandonPending=true;
  persist();
  return r;
 }
 function exitRun(){
  if(abandonCurrentRun())saveAndReturnHome();
 }
 function restartRun(){
  const guided=firstGardenStep(playerRef.current,runRef.current)==='puzzle';
  const previous=abandonCurrentRun(guided);
  if(!previous)return;
  starting.current=null;
  setPreBoosters([]);
  setRestart({userId:previous.userId,levelId:previous.level.id});
  setScreen(guided?'play':'home');
  void openStartLevel(guided);
  void sync();
 }
 async function doubleCoins(){if(!run||!player)return;if(!rewardedAds.available()){setAdStatus(tr("광고가 연결된 모바일 앱에서 이용할 수 있어요."));return;}setBusy(true);let currentIntent:RewardIntent|undefined;let earned=false;try{const r=await request<{intent:RewardIntent}>('/ads/reward-intents',{key:key(),placement:'coin_bonus',runId:run.id});currentIntent=r.intent;setAdIntent(r.intent);const res=await rewardedAds.show(r.intent,player.id,state=>setAdStatus({loading:tr("광고 준비 중"),showing:tr("시청 중"),pending:tr("보상 확인 중"),granted:tr("지급 완료"),'no-fill':tr("지금 볼 수 있는 광고가 없어요"),cancelled:tr("시청을 종료했어요"),error:tr("광고를 불러오지 못했어요"),unavailable:tr("광고를 이용할 수 없어요"),idle:''}[state]));earned=res.earnedCallback;await request('/ads/reward-intents/'+r.intent.id,{key:key(),status:res.status==='cancelled'?'cancelled':'pending'});await refresh();}catch(e){if(currentIntent&&!earned)await request('/ads/reward-intents/'+currentIntent.id+'/cancel',{key:key()}).catch(()=>{});notify(e instanceof Error?e.message:tr("광고 연결 실패"))}finally{setBusy(false)}}
 async function reconnectIdentity(){setBusy(true);try{await clearSession();sessionStorage.setItem('garden-recover-account','1');location.reload();}catch(e){setError(e instanceof Error?e.message:tr("계정에 다시 연결하지 못했어요."))}finally{setBusy(false)}}
 function selectGarden(task:GardenTask){setSelectedGarden(task.id);setArea(Math.max(0,AREAS.findIndex(a=>a.id===task.area)));setScreen('home');setMenu('garden');setTool(null);}
 function changeGarden(index:number){setArea(index);const tasks=RESTORATIONS.filter(t=>t.area===AREAS[index]?.id);setSelectedGarden((tasks.find(t=>!playerRef.current?.restored.includes(t.id))||tasks[0])?.id??'');}
 async function restoreGarden(task:GardenTask){
  const current=playerRef.current;if(!current||restorationGuard.current||current.restored.includes(task.id))return;
  const step=firstGardenStep(current,runRef.current);if(step==='puzzle'||step==='restore'&&task.id!==FIRST_GARDEN_RESTORATION.id)return;
  firstRestorationBusy.current=step==='restore';
  restorationGuard.current=true;setGardenBusy(true);const nonce=++restoreGeneration.current,started=performance.now();
  setArea(Math.max(0,AREAS.findIndex(a=>a.id===task.area)));setRestorationVisual({taskId:task.id,phase:'building',nonce});sound('restore');
  try{
   const result=await mutate('/garden/restore',{taskId:task.id});if(playerRef.current?.id!==current.id||restoreGeneration.current!==nonce)return;
   if(result.world)setRestoredWorld(result.world);
   const reveal=()=>{if(playerRef.current?.id!==current.id||restoreGeneration.current!==nonce)return;setRestorationVisual({taskId:task.id,phase:'revealed',nonce});gardenTimers.current.push(setTimeout(()=>{
    if(playerRef.current?.id!==current.id||restoreGeneration.current!==nonce)return;
    firstRestorationBusy.current=false;setRestorationVisual(null);restorationGuard.current=false;setGardenBusy(false);
    const scene=storyForTask(task.id);if(scene){if(screenRef.current==='home'&&menuRef.current==='garden')setMenu('');setPendingStory(scene.id);}
    if(result.world?.owned['restored-'+task.id]&&!result.world.placements['restored-'+task.id])notify(tr('복원한 시설은 보관함에 있어요. 원하는 자리에 놓아 주세요.'));
   },350));};
   const remaining=Math.max(0,600-(performance.now()-started));if(remaining)gardenTimers.current.push(setTimeout(reveal,remaining));else reveal();
  }catch(e){if(playerRef.current?.id===current.id&&restoreGeneration.current===nonce){firstRestorationBusy.current=false;setRestorationVisual(null);restorationGuard.current=false;setGardenBusy(false);notify(e instanceof Error?e.message:tr('정원을 가꾸지 못했어요.'));}}
 }
 async function closeStory(){if(!activeStory||storyCloseGuard.current)return;storyCloseGuard.current=true;try{await narrative.acknowledge(activeStory.id);setActiveStory(null);if(storyReturn.current==='garden'){const next=RESTORATIONS.find(t=>!playerRef.current?.restored.includes(t.id));if(next)setArea(Math.max(0,AREAS.findIndex(a=>a.id===next.area)));}setMenu(storyReturn.current);}catch(error){setStoryError(error instanceof Error?error.message:tr("기록을 저장하지 못했어요. 다시 시도해 주세요."));}finally{storyCloseGuard.current=false;}}
 async function enterFirstGarden(){
  const current=playerRef.current,r=runRef.current;if(!current||!r||!firstPuzzleResult(current,r))return;
  try{await sync();}catch(error){notify(error instanceof Error?error.message:tr('보상을 확인하고 있어요.'));return;}
  if(runRef.current?.status!=='won'||(playerRef.current?.stars??0)<FIRST_GARDEN_RESTORATION.cost){notify(tr('보상을 확인하고 있어요.'));return;}
  setSelectedGarden(FIRST_GARDEN_RESTORATION.id);setArea(0);setTool(null);setMenu('');setScreen('home');history.replaceState({gardenTab:'home'},'','#/home');
 }
 async function openStartLevel(tutorialRetry=false){
  const current=playerRef.current;if(!current)return;
  if(firstGardenStep(current,runRef.current)==='restore'){if(screenRef.current==='play')await enterFirstGarden();else{setScreen('home');setMenu('');}return;}
  if(firstGardenStep(current,runRef.current)==='puzzle'&&!tutorialRetry)return;
  setStartError('');setMenu('start');setTool(null);setAdStatus('');
  // Download in parallel with the previous clear; opening this view never spends rewards.
  void loadStartLevel(nextPreviewLevel(current.level,runRef.current)).catch(()=>{});
 }

 useEffect(()=>{
  if(!restart)return;
  if(menu!=='start'||player?.id!==restart.userId){setRestart(null);return;}
  if(pending||cache.current?.abandonPending)return;
  setRestart(null);
  if(!runRef.current&&player.level===restart.levelId)void start(true);
 },[restart,menu,pending,player?.id,player?.level]);

 function toggleStartBooster(item:PreBooster){
  const current=playerRef.current;
  if(!current||startGuard.current)return;
  const level=peekStartLevel(nextPreviewLevel(current.level,runRef.current));
  const count=current.inventory[item];
  const hasStock=(count?.normal??0)+(count?.bound??0)>0;
  if(!preBoosters.includes(item)&&!hasStock&&freeStartTrialItem(level,current)!==item&&
   !startBoosterWindow(operations.data?.settings.startBoosterRush,serverNow()).active){
   notify(tr("선택할 도구가 없어요."));
   return;
  }
  starting.current=null;
  setPreBoosters(items=>items.includes(item)?items.filter(value=>value!==item):[...items,item]);
 }

 function goTab(tab:HubRoute){
  if(firstGardenStep(playerRef.current,runRef.current)||firstBuilding)return;
  if(childAccount()&&(tab==='friends'||tab==='guild'||isGuildSubpage(tab)))tab='home';
  heartStartFlow.current.cancel();
  if(location.hash!=='#/'+tab)history.pushState({gardenTab:tab,fromGuildHome:isGuildSubpage(tab)&&currentHubRoute()==='guild'},'','#/'+tab);
  setScreen(tab);setMenu('');setTool(null);setActiveStory(null);
 }
 function backFromGuild(){
  if(!isGuildSubpage(currentHubRoute()))return;
  if(history.state?.fromGuildHome){history.back();return;}
  history.replaceState({gardenTab:'guild'},'','#/guild');
  setScreen('guild');
 }
 const openMenu=(value:string)=>{if((firstGardenStep(playerRef.current,runRef.current)||firstBuilding)&&!(firstGardenStep(playerRef.current,runRef.current)==='puzzle'&&screenRef.current==='play'&&['pause','settings','tools'].includes(value)))return;if(childAccount()&&['guild','friends','ranking','support','offers','offers-limited','offers-timed','offers-chain'].includes(value))return;if(menu==='hearts'&&value!=='hearts'&&heartStartFlow.current.cancel()){setScreen('home');setPreBoosters([]);}if(value==='home'||value==='shop'||value==='friends'||value==='guild'||value==='events'||isGuildSubpage(value)||isWeeklyEvent(value)){goTab(value);return;}if(value==='start'){void openStartLevel();return;}if(value==='garden-bag'){goTab('home');setMenu(value);setTool(null);return;}if(value==='garden'){goTab('home');const next=RESTORATIONS.find(t=>!playerRef.current?.restored.includes(t.id))??RESTORATIONS.at(-1)!;setSelectedGarden(next.id);setArea(Math.max(0,AREAS.findIndex(a=>a.id===next.area)));}
  if(value==='story')setStoryListOpen(false);
  setMenu(value);setTool(null);
 };
 function closeHearts(){
  if(startGuard.current)return;
  const current=playerRef.current;if(!current)return;
  const action=heartStartFlow.current.close(current,serverNow());
  if(action==='wait')return;
  if(action==='resume'){setMenu('start');setTool(null);void start();return;}
  if(action==='home'){goTab('home');setPreBoosters([]);return;}
  setMenu('');
 }
 function onHeartsWorking(working:boolean){if(heartStartFlow.current.setWorking(working))closeHearts();}
 if(!ready||!player)return <LoadingScreen progress={progress} error={tr(error)} recovering={authRecovery} busy={busy} onRecover={()=>void reconnectIdentity()} onRetry={()=>location.reload()}/>;
 const guildSubpage=isGuildSubpage(screen),hubTab=guildSubpage?'guild':isWeeklyEvent(screen)?'home':screen;
 const hubPage=guildSubpage&&!guildPageAvailable?'guild':screen;
 const editingGarden=menu==='garden'||menu==='garden-bag';
 const limitedOffersMenu=menu==='offers'||menu==='offers-limited';
 const chainOffersMenu=menu==='offers-chain';
 const now=serverNow()+clock*0;const unlimited=player.unlimitedUntil>now;
 const hiddenMission=hiddenMissionsEnabled?visibleHiddenMission(player.hiddenPowerMission,now):undefined;
 const showHiddenMissionBadge=screen==='play'&&run?.state.status==='playing'&&!!hiddenMission;
 const showPowerFestival=screen==='play'&&featureEnabled('powerFestival',operations.data)&&showFestival(player.powerFestival,now);
 const closeMenu=()=>{if(firstBuilding)return;if(firstGardenStep(playerRef.current,runRef.current)){if(menu==='win'){void enterFirstGarden();return;}if(menu==='start'||menu==='fail')return;}if(menu==='fail'){saveAndReturnHome();return;}if(menu==='hearts'){closeHearts();return;}if(menu==='win'||menu==='hidden-mission'||menu==='start'){setScreen('home');setPreBoosters([]);setTool(null);}setMenu('')};
 const trialHint=run?.state.turn===0&&run.level.startBoosterGuide?.trial&&run.preBoosters.includes(run.level.startBoosterGuide.item);
 const beforePowerRequest=async()=>{
  await sync();
  if(cache.current?.queue.length)throw new Error(tr('진행을 저장한 뒤 다시 시도해 주세요.'));
 };
 const missionLayout=showHiddenMissionBadge&&run?{'--hidden-mission-board-ratio':Math.max(BOARD_REFERENCE_COLUMNS,run.state.width)/run.state.height} as CSSProperties:undefined;
 return <PowerFestivalProvider player={player} run={run} confirmedRun={confirmed.current} onPlayer={updatePlayer} beforeRequest={beforePowerRequest}><ActivityProvider player={player} active={screen!=='play'} onPlayer={updatePlayer}><FriendProfiles userId={player.id} notify={notify} reducedMotion={player.settings.reducedMotion}><main className={`game-shell ${screen==='play'?'playing':''} ${screen==='play'&&run?.state.devices?'has-campaign-device':''} ${showPowerFestival?'has-power-festival':''} ${screen==='play'&&tutorial&&!itemGuide&&run?.state.turn===0&&run.level.tutorial?'has-tutorial':''} ${itemGuide?'has-item-lesson':''} ${showHiddenMissionBadge?'has-hidden-mission-badge':''}`} style={missionLayout} data-art-root>
  <ArtSurface scene={screen==='play'?'play':undefined}/>
  {hubPage==='home'?<div className="first-garden-home" inert={firstStep==='restore'||firstBuilding}><HomeHub key={player.id+':'+firstGardenLoadAttempt} onGardenReady={setFirstGardenMapReady} onPlayer={updatePlayer} story={narrative.story} styleBusy={narrative.styleBusy} onStyle={(taskId,style)=>void narrative.chooseStyle(taskId,style)} onStory={()=>openMenu('story')} player={player} area={area} editing={editingGarden} selected={selectedGarden} visual={restorationVisual} confirmedWorld={restoredWorld} busy={gardenBusy} rewardMotionBlocked={!!(activeStory||pendingStory||unlock||error||updateRequired)} resume={run?.status==='active'&&!cache.current?.abandonPending} menu={menu} onMenu={openMenu} onPlay={()=>{if(run?.status==='active'&&!cache.current?.abandonPending){setScreen('play');setMenu('')}else openMenu('start')}} onArea={changeGarden} onSelect={selectGarden} onRestore={task=>void restoreGarden(task)} onCloseEditor={()=>setMenu('')}/></div>:isWeeklyEvent(hubPage)?<WeeklyEventPage event={hubPage} player={player} onPlayer={updatePlayer} onHome={()=>goTab('home')} onPage={openMenu}/>:hubPage!=='play'?<HubPage key={hubTab} page={hubPage} player={player} onGuildBack={backFromGuild}><Menus page={hubPage} player={player} mutate={mutate} refresh={refresh} notify={notify} onPage={openMenu} onLogout={()=>location.reload()}/></HubPage>:run&&<>

   <PlayHud moves={run.state.moves} state={boardDisplay?.runId===run.id?boardDisplay.state:run.state} tool={tool} locked={busy||animating||awaitingBatchBase()} onCancelTool={()=>setTool(null)}/>
   <div className="play-event-row">
    <PowerFestivalBar onOpen={()=>openMenu('power-festival')} disabled={busy||animating||!!menu||!!unlock}/>
    {showHiddenMissionBadge&&hiddenMission&&<HiddenMissionPlayBadge mission={predictedHiddenMission(hiddenMission,run,confirmed.current,now)} now={now} disabled={busy||animating||!!menu||!!unlock||!!error||updateRequired} onOpen={()=>setMenu('hidden-mission-info')}/>}
   </div>
   <div className="board-area" style={{'--festival-board-ratio':run.state.width/run.state.height} as CSSProperties}><div className={`level-ribbon ${tool||trialHint?'is-tool-hint':''}`} data-frame={tool||trialHint?'resource_pearl_v9':'event_sky_v9'} data-frame-scale="0.1"><span>{tool?tr("{0} · 사용할 칸을 골라주세요",{0:(names[tool])}):trialHint?t('start.trialPlayHint'):tr("레벨 ")+run.level.id+(run.state.journey?" · "+t("journey.progress",{stage:(boardDisplay?.runId===run.id?boardDisplay.state:run.state).journey?.stage??1}):"")}</span></div>{itemGuide&&<ItemLessonGuide guide={itemGuide} waiting={animating||calculating}/>}<CampaignDeviceHint state={boardDisplay?.runId===run.id?boardDisplay.state:run.state}/><StartGiftArrival key={'gift:'+run.id} run={run} reduced={player.settings.reducedMotion}/><Board key={run.id} boosterIntro={startBoosterCells(run.state,run.preBoosters,run.startGift?.placements)} state={run.state} events={events} frames={frames} onStateShown={state=>setBoardDisplay(current=>current?.runId===run.id&&current.state===state?current:{runId:run.id,state})} action={lastAction} locked={updateRequired||busy||calculating||awaitingBatchBase()||!!menu||!!unlock} onVisualStart={duration=>{if(runRef.current?.id===run.id)startVisuals(duration)}} onVisualSettled={()=>{if(runRef.current?.id===run.id)settleVisuals()}} tool={tool} onAction={act} reduced={player.settings.reducedMotion} tutorial={itemGuide?!animating&&!calculating?itemLessonHint(itemGuide):undefined:tutorial&&run.state.turn===0?run.level.tutorial:undefined}/>{tutorial&&!itemGuide&&run.state.turn===0&&run.level.tutorial&&<div className="tutorial-bubble" data-frame="card_blue_v4"><p>{tr(run.level.tutorial.text)}</p>{!firstPuzzleResult(player,run)&&<button onClick={()=>acknowledgeHelp(run.level.tutorial?.feature)}>{tr("건너뛰기")}</button>}</div>}</div>
   <footer className="play-footer" data-frame="dock_v3" data-frame-bleed="8"><p className="play-status" role="status" data-frame="event_sky_v9" data-frame-scale="0.1">{pending?(offline?t('status.offline'):t('status.saving')):run.state.status==='won'?t('status.win'):''}</p><div className="booster-toolbar">{(['hammer','sweep-row','sweep-column','shuffle'] as const).map(item=><button key={item} disabled={!!itemGuide||busy||animating||awaitingBatchBase()||!!menu||!!unlock||run.state.status!=='playing'} aria-label={names[item]} className={tool===item?'chosen':''} onClick={()=>{if(availableBooster(player,cache.current?.queue??[],item)===0){notify(tr("{0}가 없어요. 상점에서 구입할 수 있어요.",{0:(names[item])}));return;}if(item==='shuffle')void act({type:'booster',item});else setTool(tool===item?null:item)}}><span className="booster-socket"><Icon id="booster_socket" size={68}/><Icon id={item} size={51}/><span className="booster-count"><Icon id="count_badge" size={27}/><b>{availableBooster(player,cache.current?.queue??[],item)}</b></span></span><small>{names[item]}</small></button>)}<button aria-label={tr("도구 가방")} disabled={!!itemGuide||busy||animating||awaitingBatchBase()||!!menu||!!unlock||run.state.status!=="playing"} onClick={()=>openMenu("tools")}><span className="booster-socket"><Icon id="booster_socket" size={68}/><Icon id="bundle_tools_v7" size={51}/><span className="booster-count"><Icon id="count_badge" size={27}/><b>{(["sweep-border","world-bomb","cross-firework","color-magnet","move-hourglass"] as const).reduce((sum,item)=>sum+availableBooster(player,cache.current?.queue??[],item),0)}</b></span></span><small>{tr("도구 가방")}</small></button><div className="play-footer-controls"><IconButton disabled={busy||animating} id="settings" label={tr("퍼즐 설정")} onClick={()=>openMenu('pause')}>{tr("설정")}</IconButton></div></div></footer>
  </>}
  {hubTab!=='play'&&!isWeeklyEvent(screen)&&!editingGarden&&firstStep!=='restore'&&!firstBuilding&&<HubNavigation active={hubTab} onTab={goTab}/>}
  {screen!=='play'&&pending&&cache.current?.abandonPending&&<div className="connection-note" role="status">{t('status.endingRun')}{' '}<button onClick={retryConnection}>{tr('다시 연결')}</button></div>}
  {offline&&!cache.current?.abandonPending&&<div className="connection-note" role="status">{tr("연결을 기다리고 있어요")}{' '}<button onClick={retryConnection}>{tr("다시 연결")}</button></div>}
  {notice&&<div className={'toast'+(screen==='friends'?' friend-toast':'')} role="status" data-frame="card_peach_v9">{screen==='friends'&&<FrameFace id="card_peach_v9"/>}{tr(notice)}</div>}
  {updateRequired&&<Modal title={tr("업데이트가 필요해요")} onClose={()=>{}}><p>{tr("새로운 퍼즐 규칙이 준비됐어요. 앱을 업데이트한 뒤 보관된 판을 이어갈 수 있어요.")}</p><Button onClick={()=>location.reload()}>{tr("다시 불러오기")}</Button></Modal>}
  {error&&!updateRequired&&<Modal title={tr("진행 확인")} onClose={()=>setError('')}><p>{tr(error)}</p><Button onClick={()=>void sync().then(refresh)}>{tr("다시 연결")}</Button></Modal>}
  {menu==='start'&&<StartLevelModal player={player} levelId={nextPreviewLevel(player.level,run)} loadLevel={loadStartLevel} peekLevel={peekStartLevel} reloadKey={startContentRevision} error={startError} selected={preBoosters} busy={busy||!!(restart&&pending)} unlimited={unlimited} onToggle={toggleStartBooster} onPlay={()=>void start()} onClose={closeMenu}/>}
  {(menu==='hidden-mission'||menu==='hidden-mission-info')&&player.hiddenPowerMission&&<HiddenMissionModal key={player.hiddenPowerMission.milestone} mission={player.hiddenPowerMission} now={now} beforeRequest={beforePowerRequest} onPlayer={updatePlayer} onContinue={()=>setMenu(menu==='hidden-mission'?'win':'')}/>}
  {(menu==='win'||menu==='hidden-mission'&&!player.hiddenPowerMission)&&run&&<WinModal firstGarden={firstPuzzleResult(player,run)} run={run} player={player} onPlayer={updatePlayer} busy={busy} showAd={rewardedAds.available()&&operations.data?.settings.features.ads!==false} onClose={closeMenu} onNext={()=>void openStartLevel()} onHome={()=>{if(firstPuzzleResult(player,run)){void enterFirstGarden();return;}setScreen('home');setMenu('')}} onDouble={()=>void doubleCoins()}>
   {adStatus&&<p role="status">{tr(adStatus)}</p>}{adIntent&&<LinkAction icon="mail" onClick={()=>void request<{intent:RewardIntent}>('/ads/reward-intents/'+adIntent.id).then(r=>{setAdStatus(r.intent.status==='granted'?tr("추가 코인을 받았어요!"):tr("보상 확인 중"));void refresh()})}>{tr("지급 상태 확인")}</LinkAction>}
  </WinModal>}
  {menu==='fail'&&run&&firstPuzzleResult(player,run)&&<FirstPuzzleRetry busy={busy||pending} onRetry={restartRun}/>}
  {menu==='fail'&&run&&!firstPuzzleResult(player,run)&&<RunContinueMenu run={run} player={player} coins={player.coins+player.boundCoins} continuing={continuing} onContinue={()=>void continueRun()} onSave={saveAndReturnHome} onEnd={()=>setMenu('end-run')}/>}
  {menu==='pause'&&<RunPauseMenu tutorial={firstStep==='puzzle'} onClose={closeMenu} onSettings={()=>openMenu('settings')} onSave={saveAndReturnHome} onEnd={()=>setMenu('end-run')}/>}
  {menu==='end-run'&&run&&<EndRunMenu run={run} player={player} onClose={()=>setMenu(run.state.status==='lost'?'fail':'pause')} onRetry={restartRun} onExit={exitRun}/>}
  {menuTitles[menu]&&<Modal theme={menu==='garden'?'garden':menu==='pass'?'sky':menu==='shop'?'shop':menu==='guild'?'guild':'sky'} className={menu==='pass'?'garden-pass-modal':limitedOffersMenu?'limited-offers-modal':chainOffersMenu?'chain-offers-modal':undefined} title={menuTitles[menu]} onClose={closeMenu} wide={!limitedOffersMenu&&!chainOffersMenu&&!['settings','profile','hearts','gifts','pass'].includes(menu)}>{['notices','support','live-events'].includes(menu)?<OperationsMenu page={menu} mutate={mutate}/>:<Menus page={menu} player={player} mutate={mutate} refresh={refresh} notify={notify} onPage={openMenu} onLogout={()=>location.reload()} onWorkingChange={menu==='hearts'?onHeartsWorking:undefined}/>}</Modal>}
  {menu==='flowerlight'&&<FlowerlightFestival key={player.id} player={player} onPlayer={updatePlayer} onClose={closeMenu} onPage={openMenu} onPlay={()=>{setMenu('');if(run?.status==='active')setScreen('play');else void openStartLevel()}}/>}
  {menu==='animal-expedition'&&<AnimalExpedition player={player} onPlayer={updatePlayer} onClose={closeMenu} onPage={openMenu}/>}
  {menu==='start-gift'&&<StartGiftInfoModal player={player} onClose={closeMenu}/>}
  {menu==='power-rainbow'&&<Modal title={t('powerRainbow.name')} onClose={closeMenu}>
   <Card><p className="intro"><Icon id={POWER_RAINBOW_ART} size={74}/></p><p>{t('powerRainbow.help')}</p></Card>
  </Modal>}
  {menu==='start-rush'&&<UnlimitedToolsModal onClose={closeMenu} onPlay={()=>openMenu('start')}/>}
  {menu==='power-festival'&&<PowerFestivalDialog onClose={closeMenu} onPlay={()=>openMenu('start')}/>}
  {menu==='missions'&&<Modal title={tr('미션')} onClose={closeMenu} wide><MissionMenu/></Modal>}
  {menu==='treasure'&&<Modal title={tr('보물 카드')} onClose={closeMenu}><TreasureMenu/></Modal>}
  {menu==='tools'&&<Modal title={tr('도구 가방')} onClose={closeMenu}><div className="tool-bag-grid">{(['hammer','sweep-row','sweep-column','shuffle','sweep-border','world-bomb','cross-firework','color-magnet','move-hourglass'] as const).map(item=><button key={item} className="tool-bag-item" data-frame="card_blue_v4" data-frame-scale="0.14" disabled={screen==='play'&&(!run||run.state.status!=='playing')||availableBooster(player,cache.current?.queue??[],item)===0} onClick={()=>{if(screen!=='play'){notify(tr('퍼즐 안에서 도구를 사용할 수 있어요.'));return;}setMenu('');if(['shuffle','sweep-border','world-bomb','move-hourglass'].includes(item))void act({type:'booster',item});else setTool(item);}}><Icon id={item} size={63}/><strong>{names[item]}</strong><small>{tr(({hammer:'한 칸 정리','sweep-row':'가로 한 줄 정리','sweep-column':'세로 한 줄 정리',shuffle:'타일 다시 섞기','sweep-border':'바깥 테두리 전체 정리','world-bomb':'맵 전체에 강력한 한 방','cross-firework':'가로와 세로를 함께 정리','color-magnet':'선택한 타일과 같은 색 정리','move-hourglass':'이동 횟수 3회 추가'} as const)[item])}</small><b>{availableBooster(player,cache.current?.queue??[],item)}</b></button>)}</div>{screen!=='play'&&<p className="fine">{tr('퍼즐 안에서 도구를 사용할 수 있어요.')}</p>}</Modal>}
  {menu==='story'&&!activeStory&&<StoryJournal story={narrative.story} player={player} loading={narrative.loading} error={narrative.error} showList={storyListOpen} onListChange={setStoryListOpen} onRetry={()=>void narrative.reload()} onPlay={scene=>{storyReturn.current='story';setStoryError('');setActiveStory(scene);}} onEpisode={()=>setMenu('rescue')} onClose={closeMenu}/>}
  {menu==='rescue'&&<BridgeEpisode key={player.id} player={player} onClose={()=>{setMenu('story')}} onHome={()=>goTab('home')} onPlayer={updatePlayer} onComplete={()=>void narrative.reload()}/>}
  {activeStory&&<StoryViewer key={activeStory.id} scene={activeStory} busy={narrative.saving} error={tr(storyError)} onClose={()=>void closeStory()}/>}
  {screen==='home'&&player.level===2&&player.restored.includes(FIRST_GARDEN_RESTORATION.id)&&!(run?.level.id===2&&run.status==='active')&&!knownHelp(player.id,player.tutorials).includes('lumi-items-invite-v1')&&!menu&&!activeStory&&!pendingStory&&!narrative.loading&&!restorationVisual&&!error&&!updateRequired&&<ItemLessonInvitation busy={busy} error={startError} onPlay={()=>void start(true)}/> }
  {screen==='home'&&firstStep==='restore'&&!menu&&!activeStory&&!pendingStory&&!firstBuilding&&!error&&!updateRequired&&<FirstGardenGuide onRetry={()=>{setFirstGardenMapReady(false);setFirstGardenLoadAttempt(n=>n+1);}} ready={firstGardenMapReady} stars={player.stars} busy={gardenBusy} onRestore={()=>void restoreGarden(FIRST_GARDEN_RESTORATION)}/>}
  {screen!=='play'&&firstStep==='puzzle'&&!menu&&!busy&&!error&&!updateRequired&&<FirstPuzzleRetry busy={busy} onRetry={()=>void start(true)}/>}
  {firstBuilding&&<FirstGardenBuilding/>}
  {unlock&&<Modal title={tr("{0} 발견!",{0:(names[unlock])})} onClose={()=>acknowledgeHelp(unlock)}><Card className="discovery-card"><div className="hero-reward discovery-reward"><Icon id="fx_starburst" size={265}/><Icon id="fx_ring" size={190}/><Icon id={goalArt(unlock)} size={145}/><span className="discovery-spark s1"><Icon id="sparkle" size={38}/></span><span className="discovery-spark s2"><Icon id="sparkle" size={29}/></span></div><p className="intro">{featureHelp(unlock)}</p></Card><Button onClick={()=>acknowledgeHelp(unlock)}>{tr("좋아요!")}</Button></Modal>}
 </main></FriendProfiles></ActivityProvider></PowerFestivalProvider>;
}
